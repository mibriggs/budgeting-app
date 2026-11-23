// Personal access tokens. Each has one scope, and only that scope's route accepts it:
// - 'widget' (Settings → Widget): a Scriptable script reads this month's numbers from
//   GET /api/widget.
// - 'quick-add' (Settings → AI): an automation adds alerts or notes to the inbox with
//   POST /api/quick-add.
// No other route accepts a token, and a token of one scope is refused by the other's route.
//
// Only a SHA-256 hash is stored, so a leaked database doesn't hand out working tokens, and a
// lookup by hash needs no constant-time compare (the hash, not the token, is what's compared).

import { createHash, randomBytes } from 'node:crypto';
import { and, count, desc, eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { apiToken, type TokenScope } from '#lib/server/db/schema.ts';
import { TOKEN_NAME_MAX } from '#lib/token-limits.ts';

/** Recognisable prefix, so a token pasted somewhere it shouldn't be is easy to spot. */
const PREFIX = 'cj_';
/** Per scope: up to 10 widget tokens and 10 Quick add tokens. */
export const MAX_TOKENS = 10;
/** `lastUsedAt` is only rewritten when it's older than this. */
const LAST_USED_GAP_MS = 60 * 60 * 1000;

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

export function listTokens(userId: string, scope: TokenScope) {
	return db
		.select({
			id: apiToken.id,
			name: apiToken.name,
			hint: apiToken.hint,
			createdAt: apiToken.createdAt,
			lastUsedAt: apiToken.lastUsedAt
		})
		.from(apiToken)
		.where(and(eq(apiToken.userId, userId), eq(apiToken.scope, scope)))
		.orderBy(desc(apiToken.createdAt));
}

export type TokenRow = Awaited<ReturnType<typeof listTokens>>[number];

/**
 * Makes a token. Returns the token itself, which is never stored and can't be shown again, or
 * an error for a bad name or too many tokens.
 */
export async function createToken(
	userId: string,
	scope: TokenScope,
	rawName: string
): Promise<{ token: string } | { error: string }> {
	const name = rawName.trim().replace(/\s+/g, ' ');
	if (!name)
		return {
			error: `Give it a name, like "${scope === 'widget' ? 'iPhone widget' : 'Email alerts'}".`
		};
	if (name.length > TOKEN_NAME_MAX)
		return { error: `Keep the name to ${TOKEN_NAME_MAX} characters.` };

	const [{ total }] = await db
		.select({ total: count() })
		.from(apiToken)
		.where(and(eq(apiToken.userId, userId), eq(apiToken.scope, scope)));
	if (total >= MAX_TOKENS)
		return { error: `You can have up to ${MAX_TOKENS} tokens. Revoke one you don't use first.` };

	const token = PREFIX + randomBytes(32).toString('base64url');
	await db
		.insert(apiToken)
		.values({ userId, name, scope, tokenHash: hash(token), hint: token.slice(-4) });
	return { token };
}

/** Revokes one of the user's own tokens of this scope. False if there was no such token. */
export async function revokeToken(userId: string, scope: TokenScope, id: string) {
	const removed = await db
		.delete(apiToken)
		.where(and(eq(apiToken.id, id), eq(apiToken.userId, userId), eq(apiToken.scope, scope)))
		.returning({ id: apiToken.id });
	return removed.length > 0;
}

/**
 * The user a request's `Authorization: Bearer cj_…` header belongs to, or null for a missing,
 * malformed, unknown or revoked token, or one made for another scope. Notes when the token was
 * used (at most hourly).
 */
export async function userIdForToken(
	authorization: string | null,
	scope: TokenScope
): Promise<string | null> {
	const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
	// Cheap shape check before touching the database: prefix + 43 base64url characters.
	if (!token || !/^cj_[A-Za-z0-9_-]{43}$/.test(token)) return null;

	const [row] = await db
		.select({ id: apiToken.id, userId: apiToken.userId, lastUsedAt: apiToken.lastUsedAt })
		.from(apiToken)
		.where(and(eq(apiToken.tokenHash, hash(token)), eq(apiToken.scope, scope)))
		.limit(1);
	if (!row) return null;

	const now = Date.now();
	if (!row.lastUsedAt || now - row.lastUsedAt.getTime() > LAST_USED_GAP_MS) {
		await db
			.update(apiToken)
			.set({ lastUsedAt: new Date(now) })
			.where(eq(apiToken.id, row.id));
	}
	return row.userId;
}

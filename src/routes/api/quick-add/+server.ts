// POST /api/quick-add: add bank alerts or notes to the inbox from an automation (Shortcuts,
// Zapier, n8n, a script), with `Authorization: Bearer cj_…` (a Quick add token from
// Settings → AI). Widget tokens are refused here, and these tokens are refused everywhere else.
//
//   Body:     { "message": "…" }   1 to 10,000 characters; one item per alert or note, up to 20
//   202:      { status: "reading", items: [{ id }], message }  saved; reading in the background
//   400/401/415/429: { error }      nothing saved
//
// Same rules as Quick add in the app: the patterns first, then Claude only if the account has it
// turned on (Settings → AI), with the same per-user limits, shared with the app. The answer comes
// right away so the automation doesn't wait on Claude; when the items are read (or couldn't be),
// every device with notifications on gets one push, like a paste in the app. If reading is cut
// off partway, the items stay "Reading…" and are read again when the inbox is opened.

import { json } from '@sveltejs/kit';
import { waitUntil } from '@vercel/functions';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { userIdForToken } from '#lib/server/api-token.ts';
import { db } from '#lib/server/db/index.ts';
import { user } from '#lib/server/db/schema.ts';
import { saveToInbox } from '#lib/server/quick-add/inbox.ts';
import type { RequestHandler } from './$types';

const Body = z.object({ message: z.string().trim().min(1).max(10_000) });

const noStore = { 'cache-control': 'no-store' };

/** Whether Vercel's request context (where waitUntil hooks in) is there for this request. */
const hasRequestContext = () =>
	Boolean(
		(globalThis as Record<symbol, { get?: () => unknown } | undefined>)[
			Symbol.for('@vercel/request-context')
		]?.get?.()
	);
const fail = (status: number, error: string, headers: Record<string, string> = {}) =>
	json({ error }, { status, headers: { ...noStore, ...headers } });

export const POST: RequestHandler = async ({ request }) => {
	const userId = await userIdForToken(request.headers.get('authorization'), 'quick-add');
	if (!userId)
		return fail(401, 'Missing, unknown or revoked Quick add token.', {
			'www-authenticate': 'Bearer'
		});
	if (!request.headers.get('content-type')?.startsWith('application/json'))
		return fail(415, 'Send JSON with Content-Type: application/json.');
	const body = Body.safeParse(await request.json().catch(() => null));
	if (!body.success) return fail(400, 'Send { "message": "…" } with 1 to 10,000 characters.');

	const [owner] = await db
		.select({ id: user.id, timezone: user.timezone })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	if (!owner) return fail(401, 'Missing, unknown or revoked Quick add token.');

	const saved = await saveToInbox(owner, body.data.message, { strict: true });
	if ('error' in saved) return fail(saved.status, saved.error);

	// Keeps the function running after the answer until the items are read and the push is sent
	// (on Vercel; elsewhere the promise just runs). `read` never rejects. If Vercel ever stops
	// providing the request context waitUntil needs, it silently does nothing and reading may be
	// cut off (the items then wait as "Reading…" until the inbox is opened), so say so in the logs.
	if (process.env.VERCEL && !hasRequestContext())
		console.warn(
			'Quick add API: no Vercel request context, so waitUntil can’t keep reading alive.'
		);
	waitUntil(saved.read());

	const count = saved.saved.length;
	return json(
		{
			status: 'reading',
			items: saved.saved,
			message: `Saved ${count === 1 ? '1 item' : `${count} items`} to your inbox. You’ll get a notification when ${count === 1 ? 'it’s' : 'they’re'} read.`
		},
		{ status: 202, headers: noStore }
	);
};

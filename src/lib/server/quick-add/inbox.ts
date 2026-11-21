// Quick add inbox: save a pasted alert or typed note, read it (patterns first, then Claude), keep
// the result until the user adds it as an expense or dismisses it, and tell them when it's ready.
//
// Reading happens inside the request that saved the message. If that request dies partway (the
// function is stopped, the model times out), the row stays 'reading' and is read again the next
// time the inbox is opened (retryStuck), so nothing is lost.

import { and, asc, count, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { Temporal, today as todayIn, type PlainDate } from '#lib/dates.ts';
import { formatCents } from '#lib/money.ts';
import { parseQuickAdd, splitMessages, type QuickAddContext } from '#lib/quick-add/parse.ts';
import { isComplete, whatsMissing, type HistoryExample } from '#lib/quick-add/prompt.ts';
import { isActiveCategory, listActiveCategories } from '#lib/server/budget/categories.ts';
import { recentExpenses } from '#lib/server/budget/dashboard.ts';
import { isActivePaymentMethod, listPaymentMethods } from '#lib/server/budget/payment-methods.ts';
import { createTransaction } from '#lib/server/budget/transactions.ts';
import { db } from '#lib/server/db/index.ts';
import {
	expense,
	expenseCategory,
	pendingExpense,
	quickAddUse,
	user as userTable
} from '#lib/server/db/schema.ts';
import { notify } from '#lib/server/push.ts';
import { MAX_NAME_LENGTH, parseAmount, parseDate } from '#lib/transaction-input.ts';
import { askClaude, modelAvailable } from './claude.ts';

/** Most items one inbox may hold, so a stuck script can't fill the table. */
export const MAX_PENDING = 100;
/** Per-user Quick add limits, counted in the database so they hold across server instances.
 *  Pastes per second and per minute stop a double tap or a runaway script. Claude readings per
 *  day (from the user's local midnight) cap the model spend per account; items the patterns read
 *  alone don't count. Past the daily cap, items are still saved and read by the patterns. */
export const SENDS_PER_SECOND = 1;
export const SENDS_PER_MINUTE = 10;
export const CLAUDE_READINGS_PER_DAY = 100;
/** A row still 'reading' after this long is assumed stopped partway, and read again. */
const STUCK_AFTER_MS = 2 * 60 * 1000;
/** How many recent expenses go in the prompt as examples (distinct names only). */
const HISTORY_EXAMPLES = 15;
/** How many of the user's latest expenses the parser learns names → categories from. */
const HISTORY_ROWS = 2000;

type User = { id: string; timezone?: string | null };

export type PendingItem = Awaited<ReturnType<typeof listPending>>[number];

// -------------------------------------------------------------------------------------------------
// Reading

/** Start of today in the user's time zone (UTC if theirs isn't valid), for the daily cap. */
function startOfDay(timeZone?: string | null): Date {
	let zone = timeZone || 'UTC';
	try {
		Temporal.Now.zonedDateTimeISO(zone);
	} catch {
		zone = 'UTC';
	}
	return new Date(Temporal.Now.zonedDateTimeISO(zone).startOfDay().epochMilliseconds);
}

/** How many of today's Claude readings the user has used (for Settings → AI). */
export async function claudeReadingsToday(user: User) {
	const [{ used }] = await db
		.select({ used: count() })
		.from(quickAddUse)
		.where(
			and(
				eq(quickAddUse.userId, user.id),
				eq(quickAddUse.kind, 'claude'),
				gte(quickAddUse.createdAt, startOfDay(user.timezone))
			)
		);
	return { used, limit: CLAUDE_READINGS_PER_DAY };
}

/**
 * Records one use of `kind` if the user has fewer than `max` of that kind since each `since`.
 * One statement, so requests running side by side (the readings of one paste run in parallel)
 * can't all slip under the limit. True if it was recorded.
 */
async function recordUse(
	userId: string,
	kind: 'send' | 'claude',
	limits: { since: Date; max: number }[]
): Promise<boolean> {
	const under = limits.map(
		({ since, max }) =>
			sql`(SELECT count(*) FROM ${quickAddUse} WHERE ${quickAddUse.userId} = ${userId} AND ${quickAddUse.kind} = ${kind} AND ${quickAddUse.createdAt} >= ${since.getTime()}) < ${max}`
	);
	const result = await db.run(
		sql`INSERT INTO ${quickAddUse} (id, user_id, kind) SELECT ${crypto.randomUUID()}, ${userId}, ${kind} WHERE ${sql.join(under, sql` AND `)}`
	);
	return result.rowsAffected > 0;
}

/** Records an accepted paste, or says why it's refused (too many too fast). */
async function recordSend(userId: string): Promise<string | null> {
	const now = Date.now();
	const second = new Date(now - 1000);
	const recorded = await recordUse(userId, 'send', [
		{ since: second, max: SENDS_PER_SECOND },
		{ since: new Date(now - 60_000), max: SENDS_PER_MINUTE }
	]);
	// Clear this user's records from before yesterday; the limits never look that far back.
	await db
		.delete(quickAddUse)
		.where(
			and(eq(quickAddUse.userId, userId), lt(quickAddUse.createdAt, new Date(now - 2 * DAY_MS)))
		);
	if (recorded) return null;
	const [{ recent }] = await db
		.select({ recent: count() })
		.from(quickAddUse)
		.where(
			and(
				eq(quickAddUse.userId, userId),
				eq(quickAddUse.kind, 'send'),
				gte(quickAddUse.createdAt, second)
			)
		);
	return recent >= SENDS_PER_SECOND
		? 'Sent too quickly. Wait a moment and try again.'
		: 'That’s a lot of Quick adds at once. Wait a minute and try again.';
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** This user's own lists, loaded here so the model only ever sees (and picks from) their data.
 *  Also whether they've opted in to Claude (Settings → AI), read from the database rather than the
 *  session so a change applies to the very next reading. */
async function loadContext(
	user: User
): Promise<{ ctx: QuickAddContext; history: HistoryExample[]; aiEnabled: boolean }> {
	const today = todayIn(user.timezone ?? undefined);
	const [categories, methods, recent, past, [account]] = await Promise.all([
		listActiveCategories(user.id, 'expense'),
		listPaymentMethods(user.id),
		recentExpenses(user.id, today, 40),
		// Learning from history: each name's latest category ("Star Market" → Groceries).
		db
			.select({ name: expense.name, categoryId: expense.categoryId })
			.from(expense)
			.where(eq(expense.userId, user.id))
			.orderBy(desc(expense.purchaseDate), desc(expense.createdAt))
			.limit(HISTORY_ROWS),
		db
			.select({ aiEnabled: userTable.aiEnabled })
			.from(userTable)
			.where(eq(userTable.id, user.id))
			.limit(1)
	]);
	const pastSeen = new Set<string>();
	const pastCategories = past.filter(
		(r) => !pastSeen.has(r.name.toLowerCase()) && pastSeen.add(r.name.toLowerCase())
	);
	const seen = new Set<string>();
	const history = recent
		.filter((r) => !seen.has(r.name.toLowerCase()) && seen.add(r.name.toLowerCase()))
		.slice(0, HISTORY_EXAMPLES)
		.map((r) => ({ name: r.name, category: r.categoryName }));
	return {
		ctx: {
			categories: categories.map(({ id, name }) => ({ id, name })),
			paymentMethods: methods.map(({ id, kind, name, last4, closingDay }) => ({
				id,
				kind,
				name,
				last4,
				closingDay
			})),
			today,
			history: pastCategories
		},
		history,
		// No row (shouldn't happen) means no opt-in.
		aiEnabled: account?.aiEnabled ?? false
	};
}

/** What the reading found, ready to store. */
type Reading = {
	status: 'ready' | 'failed';
	readBy: 'parser' | 'claude' | null;
	isExpense: boolean;
	name: string | null;
	amountCents: number | null;
	purchaseDate: PlainDate | null;
	paymentMethodId: string | null;
	categoryId: string | null;
	note: string | null;
};

type Loaded = Awaited<ReturnType<typeof loadContext>>;

async function read(message: string, user: User, loaded?: Loaded): Promise<Reading> {
	const { ctx, history, aiEnabled } = loaded ?? (await loadContext(user));
	const local = parseQuickAdd(message, ctx);
	const fromParser = (note: string | null): Reading =>
		local.ok
			? {
					status: 'ready',
					readBy: 'parser',
					isExpense: true,
					name: local.expense.name,
					amountCents: local.expense.amountCents,
					purchaseDate: parseDate(local.expense.date),
					paymentMethodId: local.expense.paymentMethodId,
					categoryId: local.expense.categoryId,
					note
				}
			: {
					status: 'failed',
					readBy: null,
					isExpense: true,
					name: null,
					amountCents: null,
					purchaseDate: null,
					paymentMethodId: null,
					categoryId: null,
					note: `Couldn't read this. ${local.reason}${note ? ` ${note}` : ''}`
				};

	if (isComplete(local)) return fromParser(null);
	// Claude only for accounts that opted in, and only when the server has an API key. Otherwise
	// it's the patterns alone, which is the default.
	if (!aiEnabled || !modelAvailable()) return fromParser(local.ok ? whatsMissing(local) : null);
	const allowed = await recordUse(user.id, 'claude', [
		{ since: startOfDay(user.timezone), max: CLAUDE_READINGS_PER_DAY }
	]);
	if (!allowed)
		return fromParser(
			`You’ve used today’s ${CLAUDE_READINGS_PER_DAY} Claude readings, so Claude didn’t check this one. They reset at midnight.`
		);

	const model = await askClaude(message, ctx, local, history);
	if (!model.ok) return fromParser(`Claude couldn’t check this (${model.error})`);

	const a = model.answer;
	const fallback = local.ok ? local.expense : null;
	const amount = a.amount_cents ?? fallback?.amountCents ?? null;
	const notes = [
		a.confidence === 'low' && (a.note || 'Claude wasn’t sure about this one.'),
		...model.problems
	].filter(Boolean);
	return {
		status: 'ready',
		readBy: 'claude',
		isExpense: a.is_expense,
		name: (a.name ?? fallback?.name ?? null)?.slice(0, MAX_NAME_LENGTH) ?? null,
		// Only keep values that pass the same rules as a saved expense.
		amountCents: amount !== null && amount > 0 && model.problems.length === 0 ? amount : null,
		purchaseDate: parseDate(a.date ?? '') ?? parseDate(fallback?.date ?? ''),
		paymentMethodId: a.payment_method_id ?? fallback?.paymentMethodId ?? null,
		categoryId: a.category_id ?? fallback?.categoryId ?? null,
		note: a.is_expense ? notes.join(' ') || null : a.note || 'This doesn’t look like a purchase.'
	};
}

/** One line describing a read item, for the toast and the push. */
export function summary(item: {
	status: string;
	isExpense: boolean;
	name: string | null;
	amountCents: number | null;
	categoryName?: string | null;
}): string {
	if (item.status === 'failed') return 'Couldn’t read it. Open the inbox to enter it by hand.';
	if (!item.isExpense) return `${item.name ?? 'This'} doesn’t look like a purchase.`;
	return [
		item.name ?? 'Expense',
		item.amountCents ? formatCents(item.amountCents) : null,
		item.categoryName ? `${item.categoryName}?` : 'Pick a category'
	]
		.filter(Boolean)
		.join(' · ');
}

/**
 * Saves a paste to the inbox and reads it. A paste with several alerts or notes becomes one item
 * each (see splitMessages). Returns the stored items. When `pushEndpoint` is given (the device
 * that sent it), that device gets one push when they're all read; the service worker shows it as
 * a toast instead if the app is open there.
 */
export async function addToInbox(user: User, raw: string, pushEndpoint?: string) {
	const messages = splitMessages(raw);
	if (messages.length === 0) return { error: 'The message is empty.' } as const;
	const [{ total }] = await db
		.select({ total: count() })
		.from(pendingExpense)
		.where(eq(pendingExpense.userId, user.id));
	if (total + messages.length > MAX_PENDING)
		return {
			error: `The inbox holds ${MAX_PENDING} items and has ${total}. Add or dismiss some first.`
		} as const;
	const tooFast = await recordSend(user.id);
	if (tooFast) return { error: tooFast, status: 429 } as const;

	// Saved first (as "Reading…"), so nothing is lost if reading stops partway.
	const rows = await db
		.insert(pendingExpense)
		.values(messages.map((message) => ({ userId: user.id, message: message.slice(0, 2000) })))
		.returning({ id: pendingExpense.id, message: pendingExpense.message });
	const loaded = await loadContext(user);
	await Promise.all(rows.map((row) => readAndStore(user, row.id, row.message, loaded)));

	const ids = rows.map((r) => r.id);
	const items = (await listPending(user.id)).filter((i) => ids.includes(i.id));
	if (items.length && pushEndpoint) await tellDevice(user.id, items, pushEndpoint);
	return { items } as const;
}

async function readAndStore(user: User, id: string, message: string, loaded?: Loaded) {
	let reading: Reading;
	try {
		reading = await read(message, user, loaded);
	} catch (error) {
		console.error('Quick add: reading failed', error);
		reading = {
			status: 'failed',
			readBy: null,
			isExpense: true,
			name: null,
			amountCents: null,
			purchaseDate: null,
			paymentMethodId: null,
			categoryId: null,
			note: 'Something went wrong reading this. Enter it by hand, or dismiss it and try again.'
		};
	}
	await db
		.update(pendingExpense)
		.set(reading)
		.where(and(eq(pendingExpense.id, id), eq(pendingExpense.userId, user.id)));
	return (await listPending(user.id)).find((i) => i.id === id) ?? null;
}

/** The toast and push wording for a batch of read items (one push per paste). */
export function announcement(items: PendingItem[]) {
	const failed = items.filter((i) => i.status === 'failed').length;
	if (items.length === 1)
		return {
			title: failed ? 'Quick add needs a hand' : 'Quick add: ready to review',
			body: summary(items[0])
		};
	const lines = items.slice(0, 3).map((i) => summary(i));
	if (items.length > 3) lines.push(`and ${items.length - 3} more`);
	return {
		title: `Quick add: ${items.length} ready to review`,
		body: lines.join('\n')
	};
}

/** Identifies a batch of items in a toast or push, so each batch is announced once. */
export const batchKey = (items: { id: string }[]) => items.map((i) => i.id).join(',');

async function tellDevice(userId: string, items: PendingItem[], endpoint: string) {
	try {
		await notify(
			userId,
			{
				...announcement(items),
				url: '/inbox',
				tag: `quick-add-${items[0].id}`,
				quickAdd: { id: batchKey(items) }
			},
			{ endpoint }
		);
	} catch (error) {
		// A failed push isn't worth failing the request over: the items are in the inbox either way.
		console.error('Quick add: push failed', error);
	}
}

/** Reads again any of the user's items stopped partway (still 'reading' after a while). */
export async function retryStuck(user: User) {
	const stuck = await db
		.select({ id: pendingExpense.id, message: pendingExpense.message })
		.from(pendingExpense)
		.where(
			and(
				eq(pendingExpense.userId, user.id),
				eq(pendingExpense.status, 'reading'),
				lt(pendingExpense.updatedAt, new Date(Date.now() - STUCK_AFTER_MS))
			)
		)
		.limit(3);
	for (const row of stuck) await readAndStore(user, row.id, row.message);
	return stuck.length;
}

// -------------------------------------------------------------------------------------------------
// Listing

/** The user's inbox, oldest first, with category and method names for display. */
export function listPending(userId: string) {
	return db
		.select({
			id: pendingExpense.id,
			message: pendingExpense.message,
			status: pendingExpense.status,
			readBy: pendingExpense.readBy,
			isExpense: pendingExpense.isExpense,
			name: pendingExpense.name,
			amountCents: pendingExpense.amountCents,
			purchaseDate: pendingExpense.purchaseDate,
			paymentMethodId: pendingExpense.paymentMethodId,
			categoryId: pendingExpense.categoryId,
			note: pendingExpense.note,
			createdAt: pendingExpense.createdAt,
			categoryName: expenseCategory.name,
			categoryIcon: expenseCategory.icon
		})
		.from(pendingExpense)
		.leftJoin(expenseCategory, eq(pendingExpense.categoryId, expenseCategory.id))
		.where(eq(pendingExpense.userId, userId))
		.orderBy(asc(pendingExpense.createdAt));
}

export async function countPending(userId: string) {
	const [{ total }] = await db
		.select({ total: count() })
		.from(pendingExpense)
		.where(eq(pendingExpense.userId, userId));
	return total;
}

// -------------------------------------------------------------------------------------------------
// Adding and dismissing

export async function dismissPending(userId: string, id: string) {
	const removed = await db
		.delete(pendingExpense)
		.where(and(eq(pendingExpense.id, id), eq(pendingExpense.userId, userId)))
		.returning({ id: pendingExpense.id });
	return removed.length > 0;
}

export type AddFields = {
	name: string;
	amount: string;
	date: string;
	categoryId: string;
	paymentMethodId: string;
};

/**
 * Adds an inbox item as an expense with the (possibly edited) fields, checked like the Add form,
 * then removes it from the inbox. Returns the new expense's name and date, or field errors.
 */
export async function addPendingAsExpense(userId: string, id: string, fields: AddFields) {
	const [item] = await db
		.select({ id: pendingExpense.id })
		.from(pendingExpense)
		.where(and(eq(pendingExpense.id, id), eq(pendingExpense.userId, userId)));
	if (!item) return { error: 'That item is no longer in the inbox.' } as const;

	const name = fields.name.trim();
	const amountCents = parseAmount(fields.amount);
	const date = parseDate(fields.date.trim());
	if (!name) return { error: 'Give it a name.' } as const;
	if (name.length > MAX_NAME_LENGTH)
		return { error: `Keep the name under ${MAX_NAME_LENGTH} characters.` } as const;
	if (amountCents === null) return { error: 'Enter an amount above $0, like 12.50.' } as const;
	if (!date) return { error: 'Pick a date.' } as const;
	if (!fields.categoryId || !(await isActiveCategory(userId, 'expense', fields.categoryId)))
		return { error: 'Pick a category.' } as const;
	const paymentMethodId = fields.paymentMethodId || null;
	if (paymentMethodId && !(await isActivePaymentMethod(userId, paymentMethodId)))
		return { error: 'That payment method is no longer available.' } as const;

	await createTransaction(userId, 'expense', {
		name,
		date,
		amountCents,
		categoryId: fields.categoryId,
		notes: null,
		paymentMethodId
	});
	await dismissPending(userId, id);
	return { name, date } as const;
}

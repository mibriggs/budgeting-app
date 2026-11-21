// Quick add inbox: save a pasted alert or typed note, read it (patterns first, then Claude), keep
// the result until the user adds it as an expense or dismisses it, and tell them when it's ready.
//
// Reading happens inside the request that saved the message. If that request dies partway (the
// function is stopped, the model times out), the row stays 'reading' and is read again the next
// time the inbox is opened (retryStuck), so nothing is lost.

import { and, asc, count, eq, lt } from 'drizzle-orm';
import { today as todayIn, type PlainDate } from '#lib/dates.ts';
import { formatCents } from '#lib/money.ts';
import { clean, parseQuickAdd, type QuickAddContext } from '#lib/quick-add/parse.ts';
import { isComplete, whatsMissing, type HistoryExample } from '#lib/quick-add/prompt.ts';
import { isActiveCategory, listActiveCategories } from '#lib/server/budget/categories.ts';
import { recentExpenses } from '#lib/server/budget/dashboard.ts';
import { isActivePaymentMethod, listPaymentMethods } from '#lib/server/budget/payment-methods.ts';
import { createTransaction } from '#lib/server/budget/transactions.ts';
import { db } from '#lib/server/db/index.ts';
import { expenseCategory, pendingExpense } from '#lib/server/db/schema.ts';
import { notify } from '#lib/server/push.ts';
import { MAX_NAME_LENGTH, parseAmount, parseDate } from '#lib/transaction-input.ts';
import { askClaude, modelAvailable } from './claude.ts';

/** Most items one inbox may hold, so a stuck script can't fill the table. */
export const MAX_PENDING = 100;
/** A row still 'reading' after this long is assumed stopped partway, and read again. */
const STUCK_AFTER_MS = 2 * 60 * 1000;
/** Model calls allowed per user per hour (in memory, so per server instance): a guard against a
 *  stuck loop, not a hard limit. The workspace spend limit in the Claude Console is the hard one. */
const MODEL_CALLS_PER_HOUR = 30;
/** How many recent expenses go in the prompt as examples (distinct names only). */
const HISTORY_EXAMPLES = 15;

type User = { id: string; timezone?: string | null };

export type PendingItem = Awaited<ReturnType<typeof listPending>>[number];

// -------------------------------------------------------------------------------------------------
// Reading

const calls = new Map<string, number[]>();
function allowModelCall(userId: string): boolean {
	const now = Date.now();
	const recent = (calls.get(userId) ?? []).filter((t) => now - t < 60 * 60 * 1000);
	if (recent.length >= MODEL_CALLS_PER_HOUR) return false;
	calls.set(userId, [...recent, now]);
	return true;
}

/** This user's own lists, loaded here so the model only ever sees (and picks from) their data. */
async function loadContext(
	user: User
): Promise<{ ctx: QuickAddContext; history: HistoryExample[] }> {
	const today = todayIn(user.timezone ?? undefined);
	const [categories, methods, recent] = await Promise.all([
		listActiveCategories(user.id, 'expense'),
		listPaymentMethods(user.id),
		recentExpenses(user.id, today, 40)
	]);
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
			today
		},
		history
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

async function read(message: string, user: User): Promise<Reading> {
	const { ctx, history } = await loadContext(user);
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
	if (!modelAvailable()) return fromParser(local.ok ? whatsMissing(local) : null);
	if (!allowModelCall(user.id))
		return fromParser('Too many readings this hour, so Claude didn’t check this one.');

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
 * Saves a message to the inbox and reads it. Returns the stored item. When `pushEndpoint` is
 * given (the device that sent it), that device gets a push when the reading is done; the service
 * worker shows it as a toast instead if the app is open there.
 */
export async function addToInbox(user: User, rawMessage: string, pushEndpoint?: string) {
	const message = clean(rawMessage).slice(0, 2000);
	if (!message) return { error: 'The message is empty.' } as const;
	const [{ total }] = await db
		.select({ total: count() })
		.from(pendingExpense)
		.where(eq(pendingExpense.userId, user.id));
	if (total >= MAX_PENDING)
		return { error: `The inbox is full (${MAX_PENDING}). Add or dismiss some first.` } as const;

	const [row] = await db
		.insert(pendingExpense)
		.values({ userId: user.id, message })
		.returning({ id: pendingExpense.id });
	const item = await readAndStore(user, row.id, message);
	if (item && pushEndpoint) await tellDevice(user.id, item, pushEndpoint);
	return { item } as const;
}

async function readAndStore(user: User, id: string, message: string) {
	let reading: Reading;
	try {
		reading = await read(message, user);
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

async function tellDevice(userId: string, item: PendingItem, endpoint: string) {
	try {
		await notify(
			userId,
			{
				title: item.status === 'failed' ? 'Quick add needs a hand' : 'Quick add: ready to review',
				body: summary(item),
				url: '/inbox',
				tag: `quick-add-${item.id}`,
				quickAdd: { id: item.id }
			},
			{ endpoint }
		);
	} catch (error) {
		// A failed push isn't worth failing the request over: the item is in the inbox either way.
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

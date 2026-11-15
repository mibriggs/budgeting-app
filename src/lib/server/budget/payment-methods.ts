// Payment methods (Settings → Payment methods) and the "Paid with" link on expenses.
// Every user has one built-in Cash, made the first time their methods are read.

import { and, asc, between, desc, eq, inArray, isNotNull, isNull, sql, sum } from 'drizzle-orm';
import { Temporal, type PlainDate } from '#lib/dates.ts';
import { cardCycle, nextOnDay, type PaymentMethodInput } from '#lib/payment-methods.ts';
import { db } from '#lib/server/db/index.ts';
import { expense, paymentMethod } from '#lib/server/db/schema.ts';

/** Most methods one user can have (not counting removed ones). */
export const MAX_PAYMENT_METHODS = 30;

// Credit, then debit, then pay apps, then Cash; oldest first within each.
const kindOrder = sql`CASE ${paymentMethod.kind} WHEN 'credit' THEN 0 WHEN 'debit' THEN 1 WHEN 'p2p' THEN 2 ELSE 3 END`;

/** Makes the user's Cash if it isn't there yet. Safe to call on every read. */
async function ensureCash(userId: string) {
	await db
		.insert(paymentMethod)
		.values({ userId, kind: 'cash', name: 'Cash' })
		.onConflictDoNothing();
}

/** The user's methods that can be picked (removed ones left out), in display order. */
export async function listPaymentMethods(userId: string) {
	await ensureCash(userId);
	return db
		.select({
			id: paymentMethod.id,
			kind: paymentMethod.kind,
			name: paymentMethod.name,
			last4: paymentMethod.last4,
			limitCents: paymentMethod.limitCents,
			closingDay: paymentMethod.closingDay,
			dueDay: paymentMethod.dueDay,
			remindAtMinutes: paymentMethod.remindAtMinutes
		})
		.from(paymentMethod)
		.where(and(eq(paymentMethod.userId, userId), isNull(paymentMethod.archivedAt)))
		.orderBy(kindOrder, asc(paymentMethod.createdAt));
}

export type PaymentMethodRow = Awaited<ReturnType<typeof listPaymentMethods>>[number];

/** Spending through each method between two dates (inclusive), by method id. */
export async function spendingByPaymentMethod(userId: string, from: PlainDate, to: PlainDate) {
	const rows = await db
		.select({ id: expense.paymentMethodId, cents: sum(expense.amountCents).mapWith(Number) })
		.from(expense)
		.where(
			and(
				eq(expense.userId, userId),
				isNotNull(expense.paymentMethodId),
				between(expense.purchaseDate, from, to)
			)
		)
		.groupBy(expense.paymentMethodId);
	return new Map(rows.map((r) => [r.id as string, r.cents]));
}

/** The method on the user's most recently added expense, if it can still be picked. */
export async function lastUsedPaymentMethodId(userId: string): Promise<string | null> {
	const [row] = await db
		.select({ id: paymentMethod.id })
		.from(expense)
		.innerJoin(paymentMethod, eq(expense.paymentMethodId, paymentMethod.id))
		.where(and(eq(expense.userId, userId), isNull(paymentMethod.archivedAt)))
		.orderBy(desc(expense.createdAt))
		.limit(1);
	return row?.id ?? null;
}

/** True if the method belongs to the user and hasn't been removed. */
export async function isActivePaymentMethod(userId: string, id: string) {
	const [row] = await db
		.select({ id: paymentMethod.id })
		.from(paymentMethod)
		.where(
			and(
				eq(paymentMethod.id, id),
				eq(paymentMethod.userId, userId),
				isNull(paymentMethod.archivedAt)
			)
		)
		.limit(1);
	return Boolean(row);
}

/**
 * Adds a method, or updates one of the user's own (not Cash). Returns its id, or an error.
 * Inputs must already be checked with `parsePaymentMethod`.
 */
export async function savePaymentMethod(
	userId: string,
	id: string | null,
	input: PaymentMethodInput
): Promise<{ id: string } | { error: string }> {
	if (id) {
		const [row] = await db
			.update(paymentMethod)
			.set(input)
			.where(
				and(
					eq(paymentMethod.id, id),
					eq(paymentMethod.userId, userId),
					isNull(paymentMethod.archivedAt),
					sql`${paymentMethod.kind} <> 'cash'`
				)
			)
			.returning({ id: paymentMethod.id });
		return row ? { id: row.id } : { error: 'That payment method no longer exists.' };
	}

	const [{ n }] = await db
		.select({ n: sql<number>`count(*)` })
		.from(paymentMethod)
		.where(and(eq(paymentMethod.userId, userId), isNull(paymentMethod.archivedAt)));
	if (n >= MAX_PAYMENT_METHODS) {
		return { error: `You can have up to ${MAX_PAYMENT_METHODS} payment methods.` };
	}
	const [row] = await db
		.insert(paymentMethod)
		.values({ userId, ...input })
		.returning({ id: paymentMethod.id });
	return { id: row.id };
}

/**
 * Removes a method (not Cash). Expenses already paid with it keep showing it, so it's archived
 * rather than deleted. Returns false if it isn't the user's or is already gone.
 */
export async function removePaymentMethod(userId: string, id: string) {
	const rows = await db
		.update(paymentMethod)
		.set({ archivedAt: new Date() })
		.where(
			and(
				eq(paymentMethod.id, id),
				eq(paymentMethod.userId, userId),
				isNull(paymentMethod.archivedAt),
				sql`${paymentMethod.kind} <> 'cash'`
			)
		)
		.returning({ id: paymentMethod.id });
	return rows.length > 0;
}

/**
 * For each credit card: spending in the current billing cycle, the last statement's total and
 * when the next payment is due. Cards without a closing day only get this calendar month's
 * spending (and the due date, if known). Totals are only what's been recorded as "Paid with"
 * the card, not the bank's balance.
 */
export async function creditCardSummaries(
	userId: string,
	today: PlainDate,
	methods: Pick<
		PaymentMethodRow,
		'id' | 'kind' | 'name' | 'last4' | 'limitCents' | 'closingDay' | 'dueDay'
	>[]
) {
	const cards = methods.filter((m) => m.kind === 'credit');
	if (cards.length === 0) return [];

	const monthStart = today.with({ day: 1 });
	const dates = cards.map((c) => (c.closingDay ? cardCycle(today, c.closingDay, c.dueDay) : null));
	const earliest = dates.reduce(
		(min, d) =>
			d && Temporal.PlainDate.compare(d.statement.from, min) < 0 ? d.statement.from : min,
		monthStart
	);

	// Daily totals per card since the earliest date needed; bucketed below.
	const rows = await db
		.select({
			id: expense.paymentMethodId,
			date: expense.purchaseDate,
			cents: sum(expense.amountCents).mapWith(Number)
		})
		.from(expense)
		.where(
			and(
				eq(expense.userId, userId),
				inArray(
					expense.paymentMethodId,
					cards.map((c) => c.id)
				),
				between(expense.purchaseDate, earliest, today)
			)
		)
		.groupBy(expense.paymentMethodId, expense.purchaseDate);

	const within = (date: PlainDate, from: PlainDate, to: PlainDate) =>
		Temporal.PlainDate.compare(date, from) >= 0 && Temporal.PlainDate.compare(date, to) <= 0;
	const total = (id: string, from: PlainDate, to: PlainDate) =>
		rows.reduce((n, r) => (r.id === id && within(r.date, from, to) ? n + r.cents : n), 0);

	return cards.map((card, i) => {
		const d = dates[i];
		const cycle = d ? { ...d.cycle, spentCents: total(card.id, d.cycle.from, today) } : null;
		const statement = d
			? { ...d.statement, totalCents: total(card.id, d.statement.from, d.statement.to) }
			: null;

		// The next payment: the last statement's, while it isn't past due; then the current cycle's
		// (amount not known until it closes).
		let nextDue: { date: PlainDate; amountCents: number | null } | null = null;
		if (statement?.dueOn && Temporal.PlainDate.compare(statement.dueOn, today) >= 0)
			nextDue = { date: statement.dueOn, amountCents: statement.totalCents };
		else if (d?.nextDueOn) nextDue = { date: d.nextDueOn, amountCents: null };
		else if (!d && card.dueDay)
			nextDue = { date: nextOnDay(today, card.dueDay), amountCents: null };

		return {
			id: card.id,
			name: card.name,
			last4: card.last4,
			limitCents: card.limitCents,
			hasClosingDay: Boolean(card.closingDay),
			cycle,
			statement,
			nextDue,
			monthCents: total(card.id, monthStart, today)
		};
	});
}

export type CreditCardSummary = Awaited<ReturnType<typeof creditCardSummaries>>[number];

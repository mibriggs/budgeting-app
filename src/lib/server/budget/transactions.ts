import { and, between, desc, eq, inArray, sql } from 'drizzle-orm';
import type { PlainDate } from '#lib/dates.ts';
import { db } from '#lib/server/db/index.ts';
import type { PaymentMethodKind } from '#lib/payment-methods.ts';
import {
	expense,
	expenseCategory,
	income,
	incomeCategory,
	paymentMethod,
	recurringExpense,
	recurringSchedule
} from '#lib/server/db/schema.ts';

type Range = { from: PlainDate; to: PlainDate };

/** A user's expenses between two dates (inclusive), newest first. */
export function listExpenses(userId: string, { from, to }: Range) {
	return db
		.select({
			id: expense.id,
			name: expense.name,
			date: expense.purchaseDate,
			amountCents: expense.amountCents,
			notes: expense.notes,
			categoryId: expense.categoryId,
			categoryName: expenseCategory.name,
			categoryColor: expenseCategory.color,
			categoryIcon: expenseCategory.icon,
			// What it was paid with; all NULL when not recorded. Removed methods still show.
			paymentMethodKind: paymentMethod.kind,
			paymentMethodName: paymentMethod.name,
			paymentMethodLast4: paymentMethod.last4,
			paymentMethodId: expense.paymentMethodId,
			// Set when a recurring expense added this charge (its name, e.g. "Rent").
			recurringName: recurringExpense.name,
			createdAt: expense.createdAt
		})
		.from(expense)
		.innerJoin(expenseCategory, eq(expense.categoryId, expenseCategory.id))
		.leftJoin(paymentMethod, eq(expense.paymentMethodId, paymentMethod.id))
		.leftJoin(recurringSchedule, eq(expense.recurringScheduleId, recurringSchedule.id))
		.leftJoin(recurringExpense, eq(recurringSchedule.recurringExpenseId, recurringExpense.id))
		.where(and(eq(expense.userId, userId), between(expense.purchaseDate, from, to)))
		.orderBy(desc(expense.purchaseDate), desc(expense.createdAt));
}

/** A user's income between two dates (inclusive), newest first. */
export function listIncome(userId: string, { from, to }: Range) {
	return db
		.select({
			id: income.id,
			name: income.name,
			date: income.receivedDate,
			amountCents: income.amountCents,
			notes: income.notes,
			categoryId: income.categoryId,
			categoryName: incomeCategory.name,
			categoryColor: incomeCategory.color,
			categoryIcon: incomeCategory.icon,
			// Income has no payment method; same shape as expense rows.
			paymentMethodKind: sql<PaymentMethodKind | null>`NULL`,
			paymentMethodName: sql<string | null>`NULL`,
			paymentMethodLast4: sql<string | null>`NULL`,
			paymentMethodId: sql<string | null>`NULL`,
			recurringName: sql<string | null>`NULL`,
			createdAt: income.createdAt
		})
		.from(income)
		.innerJoin(incomeCategory, eq(income.categoryId, incomeCategory.id))
		.where(and(eq(income.userId, userId), between(income.receivedDate, from, to)))
		.orderBy(desc(income.receivedDate), desc(income.createdAt));
}

export type TransactionRow = Awaited<ReturnType<typeof listExpenses>>[number];

export type TransactionKind = 'expense' | 'income';

/** Most rows one delete request may remove. */
export const MAX_DELETE = 5000;

/**
 * Permanently deletes the given expenses or income rows. Only rows owned by `userId` are
 * touched; IDs that don't exist or belong to someone else are ignored. Returns the IDs deleted.
 */
export async function deleteTransactions(userId: string, kind: TransactionKind, ids: string[]) {
	if (ids.length === 0) return [];
	const table = kind === 'expense' ? expense : income;
	const deleted = await db
		.delete(table)
		.where(and(eq(table.userId, userId), inArray(table.id, ids)))
		.returning({ id: table.id });
	return deleted.map((row) => row.id);
}

export type NewTransaction = {
	name: string;
	date: PlainDate;
	amountCents: number;
	categoryId: string;
	notes: string | null;
	/** Expenses only: what it was paid with (already checked to be the user's), or null. */
	paymentMethodId?: string | null;
};

/** Adds an expense or income row for the user. Inputs must already be validated. Returns its ID. */
export async function createTransaction(
	userId: string,
	kind: TransactionKind,
	input: NewTransaction
) {
	const base = {
		userId,
		name: input.name,
		amountCents: input.amountCents,
		categoryId: input.categoryId,
		notes: input.notes
	};
	const [row] =
		kind === 'expense'
			? await db
					.insert(expense)
					.values({
						...base,
						purchaseDate: input.date,
						paymentMethodId: input.paymentMethodId ?? null
					})
					.returning({ id: expense.id })
			: await db
					.insert(income)
					.values({ ...base, receivedDate: input.date })
					.returning({ id: income.id });
	return row.id;
}

/**
 * The category and payment method an entry has now, or null if it isn't the user's. Used when
 * editing: an entry may keep an archived category or removed payment method it already has.
 */
export async function transactionRefs(userId: string, kind: TransactionKind, id: string) {
	const [row] =
		kind === 'expense'
			? await db
					.select({ categoryId: expense.categoryId, paymentMethodId: expense.paymentMethodId })
					.from(expense)
					.where(and(eq(expense.id, id), eq(expense.userId, userId)))
					.limit(1)
			: await db
					.select({
						categoryId: income.categoryId,
						paymentMethodId: sql<string | null>`NULL`
					})
					.from(income)
					.where(and(eq(income.id, id), eq(income.userId, userId)))
					.limit(1);
	return row ?? null;
}

/**
 * Changes an expense or income row. Only the user's own row is touched (id and user must both
 * match). Inputs must already be validated. A charge made by a recurring expense keeps its link,
 * so it isn't added again. Returns false if there was no such row.
 */
export async function updateTransaction(
	userId: string,
	kind: TransactionKind,
	id: string,
	input: NewTransaction
) {
	const base = {
		name: input.name,
		amountCents: input.amountCents,
		categoryId: input.categoryId,
		notes: input.notes
	};
	const rows =
		kind === 'expense'
			? await db
					.update(expense)
					.set({
						...base,
						purchaseDate: input.date,
						paymentMethodId: input.paymentMethodId ?? null
					})
					.where(and(eq(expense.id, id), eq(expense.userId, userId)))
					.returning({ id: expense.id })
			: await db
					.update(income)
					.set({ ...base, receivedDate: input.date })
					.where(and(eq(income.id, id), eq(income.userId, userId)))
					.returning({ id: income.id });
	return rows.length > 0;
}

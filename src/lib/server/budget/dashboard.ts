// Numbers for the home page charts. Each function is one grouped SQL query, so totals are
// computed in the database rather than by loading every row.

import { and, between, desc, eq, sql } from 'drizzle-orm';
import type { PlainDate } from '#lib/dates.ts';
import { db } from '#lib/server/db/index.ts';
import { expense, expenseCategory, income } from '#lib/server/db/schema.ts';

const cents = (column: typeof expense.amountCents | typeof income.amountCents) =>
	sql<number>`cast(coalesce(sum(${column}), 0) as integer)`;

/** Income and expense totals per month ('YYYY-MM'), for months that have any. */
export async function monthlyTotals(userId: string, from: PlainDate, to: PlainDate) {
	const expenseMonth = sql<string>`substr(${expense.purchaseDate}, 1, 7)`;
	const incomeMonth = sql<string>`substr(${income.receivedDate}, 1, 7)`;
	const [expenses, incomes] = await Promise.all([
		db
			.select({ month: expenseMonth, cents: cents(expense.amountCents) })
			.from(expense)
			.where(and(eq(expense.userId, userId), between(expense.purchaseDate, from, to)))
			.groupBy(expenseMonth),
		db
			.select({ month: incomeMonth, cents: cents(income.amountCents) })
			.from(income)
			.where(and(eq(income.userId, userId), between(income.receivedDate, from, to)))
			.groupBy(incomeMonth)
	]);
	return {
		expenses: new Map(expenses.map((row) => [row.month, row.cents])),
		incomes: new Map(incomes.map((row) => [row.month, row.cents]))
	};
}

/** Spending per expense category between two dates, largest first. */
export function spendingByCategory(userId: string, from: PlainDate, to: PlainDate) {
	const total = cents(expense.amountCents);
	return db
		.select({
			id: expenseCategory.id,
			name: expenseCategory.name,
			icon: expenseCategory.icon,
			cents: total
		})
		.from(expense)
		.innerJoin(expenseCategory, eq(expense.categoryId, expenseCategory.id))
		.where(and(eq(expense.userId, userId), between(expense.purchaseDate, from, to)))
		.groupBy(expenseCategory.id)
		.orderBy(desc(total));
}

/** Spending per day between two dates ('YYYY-MM-DD' → cents), days without spending omitted. */
export async function dailySpending(userId: string, from: PlainDate, to: PlainDate) {
	const rows = await db
		.select({ day: sql<string>`${expense.purchaseDate}`, cents: cents(expense.amountCents) })
		.from(expense)
		.where(and(eq(expense.userId, userId), between(expense.purchaseDate, from, to)))
		.groupBy(expense.purchaseDate);
	return new Map(rows.map((row) => [row.day, row.cents]));
}

export { fillMonths, paceByDay, topCategories } from '#lib/dashboard.ts';
export type { CategorySlice, MonthTotals, PacePoint } from '#lib/dashboard.ts';

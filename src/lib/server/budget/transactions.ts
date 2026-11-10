import { and, between, desc, eq } from 'drizzle-orm';
import type { PlainDate } from '#lib/dates.ts';
import { db } from '#lib/server/db/index.ts';
import { expense, expenseCategory, income, incomeCategory } from '#lib/server/db/schema.ts';

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
			createdAt: expense.createdAt
		})
		.from(expense)
		.innerJoin(expenseCategory, eq(expense.categoryId, expenseCategory.id))
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
			createdAt: income.createdAt
		})
		.from(income)
		.innerJoin(incomeCategory, eq(income.categoryId, incomeCategory.id))
		.where(and(eq(income.userId, userId), between(income.receivedDate, from, to)))
		.orderBy(desc(income.receivedDate), desc(income.createdAt));
}

export type TransactionRow = Awaited<ReturnType<typeof listExpenses>>[number];

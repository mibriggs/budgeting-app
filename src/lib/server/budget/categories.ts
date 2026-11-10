import { and, asc, eq, isNull } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { expenseCategory, incomeCategory } from '#lib/server/db/schema.ts';
import type { TransactionKind } from './transactions.ts';

const tables = { expense: expenseCategory, income: incomeCategory } as const;

/** A user's categories that can be picked for new entries (archived ones excluded), in their order. */
export function listActiveCategories(userId: string, kind: TransactionKind) {
	const table = tables[kind];
	return db
		.select({ id: table.id, name: table.name, icon: table.icon })
		.from(table)
		.where(and(eq(table.userId, userId), isNull(table.archivedAt)))
		.orderBy(asc(table.sortOrder), asc(table.name));
}

export type CategoryOption = Awaited<ReturnType<typeof listActiveCategories>>[number];

/** True if the category exists, belongs to the user, matches the kind and isn't archived. */
export async function isActiveCategory(userId: string, kind: TransactionKind, categoryId: string) {
	const table = tables[kind];
	const [row] = await db
		.select({ id: table.id })
		.from(table)
		.where(and(eq(table.id, categoryId), eq(table.userId, userId), isNull(table.archivedAt)))
		.limit(1);
	return Boolean(row);
}

// Monthly spending limits per expense category (Settings → Budgets).
//
// History rule (see expense_category_limit in budget.schema.ts): the limit for month M is the
// row with the latest effective_month <= M; NULL there, or no row at all, means no limit.
// Saving writes a row for the current month only, so earlier months keep the limit they had.

import { and, asc, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import type { Temporal } from '#lib/dates.ts';
import { db } from '#lib/server/db/index.ts';
import { expenseCategory, expenseCategoryLimit } from '#lib/server/db/schema.ts';

/** The limit (cents, or null for none) in effect for `month`, per active expense category. */
export function listBudgets(userId: string, month: Temporal.PlainYearMonth) {
	// Written with explicit table names: in a single-table select Drizzle prints columns without
	// their table, so `${expenseCategory.id}` here would read as the limit table's own `id`.
	const inEffect = sql<number | null>`(
		select l.limit_cents
		from expense_category_limit l
		where l.category_id = expense_category.id and l.effective_month <= ${month.toString()}
		order by l.effective_month desc
		limit 1
	)`;
	return db
		.select({
			id: expenseCategory.id,
			name: expenseCategory.name,
			icon: expenseCategory.icon,
			limitCents: inEffect
		})
		.from(expenseCategory)
		.where(and(eq(expenseCategory.userId, userId), isNull(expenseCategory.archivedAt)))
		.orderBy(asc(expenseCategory.sortOrder), asc(expenseCategory.name));
}

export type BudgetRow = Awaited<ReturnType<typeof listBudgets>>[number];

/**
 * Sets limits from `month` on. `changes` maps category id → cents or null (no limit); the ids
 * must already be checked as the user's active categories. All writes happen in one batch.
 *
 * When the new value equals what was in effect before `month`, this month's row is deleted
 * instead of written, so changing a limit and changing it back leaves no extra history.
 */
export async function saveBudgets(
	month: Temporal.PlainYearMonth,
	changes: Map<string, number | null>
) {
	if (changes.size === 0) return;
	const ids = [...changes.keys()];

	// The latest row before this month, per category: what applies if this month has no row.
	const earlier = await db
		.select({
			categoryId: expenseCategoryLimit.categoryId,
			limitCents: expenseCategoryLimit.limitCents,
			effectiveMonth: expenseCategoryLimit.effectiveMonth
		})
		.from(expenseCategoryLimit)
		.where(
			and(
				inArray(expenseCategoryLimit.categoryId, ids),
				lt(expenseCategoryLimit.effectiveMonth, month)
			)
		)
		.orderBy(desc(expenseCategoryLimit.effectiveMonth));
	const before = new Map<string, number | null>();
	for (const row of earlier) {
		if (!before.has(row.categoryId)) before.set(row.categoryId, row.limitCents);
	}

	const thisMonth = (categoryId: string) =>
		and(
			eq(expenseCategoryLimit.categoryId, categoryId),
			eq(expenseCategoryLimit.effectiveMonth, month)
		);

	const writes = ids.map((categoryId) => {
		const limitCents = changes.get(categoryId) ?? null;
		if (limitCents === (before.get(categoryId) ?? null)) {
			return db.delete(expenseCategoryLimit).where(thisMonth(categoryId));
		}
		return db
			.insert(expenseCategoryLimit)
			.values({ categoryId, effectiveMonth: month, limitCents })
			.onConflictDoUpdate({
				target: [expenseCategoryLimit.categoryId, expenseCategoryLimit.effectiveMonth],
				set: { limitCents, updatedAt: new Date() }
			});
	});
	const [first, ...rest] = writes;
	await db.batch([first, ...rest]);
}

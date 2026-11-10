import { db } from '#lib/server/db/index.ts';
import { expenseCategory, incomeCategory } from '#lib/server/db/schema.ts';

// Categories every new user starts with. They can rename, reorder, archive or add to them.
// Existing users got the same list from migration drizzle/0003_seed_default_categories.sql;
// changing this list only affects users created afterwards.

export const DEFAULT_EXPENSE_CATEGORIES = [
	'Rent',
	'Laundry',
	'Housing',
	'Groceries',
	'Transportation',
	'Entertainment & Eating Out',
	'Medical & Health',
	'Wellness',
	'Utilities',
	'Education',
	'Personal & Misc.',
	'Technology',
	'Savings',
	'Pet',
	'Gifts',
	'Subscriptions',
	'Date Night',
	'Snacks & Candy'
] as const;

export const DEFAULT_INCOME_CATEGORIES = ['Salary', 'Freelance'] as const;

/** Gives a user the default categories. Safe to call more than once. */
export async function createDefaultCategories(userId: string) {
	await db.batch([
		db
			.insert(expenseCategory)
			.values(DEFAULT_EXPENSE_CATEGORIES.map((name, sortOrder) => ({ userId, name, sortOrder })))
			.onConflictDoNothing(),
		db
			.insert(incomeCategory)
			.values(DEFAULT_INCOME_CATEGORIES.map((name, sortOrder) => ({ userId, name, sortOrder })))
			.onConflictDoNothing()
	]);
}

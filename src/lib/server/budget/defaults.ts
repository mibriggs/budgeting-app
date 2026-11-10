import type { CategoryIconName } from '#lib/category-icons.ts';
import { db } from '#lib/server/db/index.ts';
import { expenseCategory, incomeCategory } from '#lib/server/db/schema.ts';

// Categories every new user starts with. They can rename, reorder, archive or add to them.
// Existing users got the same list from migrations drizzle/0003_seed_default_categories.sql
// (names) and drizzle/0004_category_icons.sql (icons); changing this list only
// affects users created afterwards.

type DefaultCategory = { name: string; icon: CategoryIconName };

export const DEFAULT_EXPENSE_CATEGORIES: DefaultCategory[] = [
	{ name: 'Rent', icon: 'house' },
	{ name: 'Laundry', icon: 'washing-machine' },
	{ name: 'Housing', icon: 'sofa' },
	{ name: 'Groceries', icon: 'shopping-cart' },
	{ name: 'Transportation', icon: 'car' },
	{ name: 'Entertainment & Eating Out', icon: 'utensils-crossed' },
	{ name: 'Medical & Health', icon: 'stethoscope' },
	{ name: 'Wellness', icon: 'dumbbell' },
	{ name: 'Utilities', icon: 'zap' },
	{ name: 'Education', icon: 'graduation-cap' },
	{ name: 'Personal & Misc.', icon: 'shapes' },
	{ name: 'Technology', icon: 'laptop' },
	{ name: 'Savings', icon: 'piggy-bank' },
	{ name: 'Pet', icon: 'paw-print' },
	{ name: 'Gifts', icon: 'gift' },
	{ name: 'Subscriptions', icon: 'repeat' },
	{ name: 'Date Night', icon: 'heart' },
	{ name: 'Snacks & Candy', icon: 'candy' }
];

export const DEFAULT_INCOME_CATEGORIES: DefaultCategory[] = [
	{ name: 'Salary', icon: 'briefcase' },
	{ name: 'Freelance', icon: 'pen-tool' }
];

/** Gives a user the default categories. Safe to call more than once. */
export async function createDefaultCategories(userId: string) {
	await db.batch([
		db
			.insert(expenseCategory)
			.values(DEFAULT_EXPENSE_CATEGORIES.map((c, sortOrder) => ({ userId, ...c, sortOrder })))
			.onConflictDoNothing(),
		db
			.insert(incomeCategory)
			.values(DEFAULT_INCOME_CATEGORIES.map((c, sortOrder) => ({ userId, ...c, sortOrder })))
			.onConflictDoNothing()
	]);
}

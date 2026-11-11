import { redirect } from '@sveltejs/kit';
import { today } from '#lib/dates.ts';
import { listActiveCategories } from '#lib/server/budget/categories.ts';
import { displayName } from '#lib/server/user.ts';
import type { PageServerLoad } from './login/$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return redirect(302, '/login');
	}

	const userId = locals.user.id;
	// For the add expense / add income dialogs.
	const [expenseCategories, incomeCategories] = await Promise.all([
		listActiveCategories(userId, 'expense'),
		listActiveCategories(userId, 'income')
	]);

	return {
		displayName: displayName(locals.user),
		today: today(locals.user.timezone ?? undefined),
		categories: { expense: expenseCategories, income: incomeCategories }
	};
};

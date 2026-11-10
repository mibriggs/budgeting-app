import { redirect, type Actions } from '@sveltejs/kit';
import { today } from '#lib/dates.ts';
import { auth } from '#lib/server/auth.ts';
import { listActiveCategories } from '#lib/server/budget/categories.ts';
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
		// Fall back to the display name for accounts created before `username` existed.
		username: locals.user.username ?? locals.user.name,
		today: today(locals.user.timezone ?? undefined),
		categories: { expense: expenseCategories, income: incomeCategories }
	};
};

export const actions: Actions = {
	signOut: async ({ request }) => {
		await auth.api.signOut({ headers: request.headers });
		return redirect(302, '/login');
	}
};

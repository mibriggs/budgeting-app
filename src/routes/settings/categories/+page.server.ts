import { error, fail, redirect } from '@sveltejs/kit';
import { CHANGES_FIELD, parseCategoryChanges } from '#lib/category-changes.ts';
import {
	applyCategoryWrites,
	listCategoriesForSettings,
	planCategoryChanges,
	type CategorySaveErrors
} from '#lib/server/budget/categories.ts';
import type { Actions, PageServerLoad } from './$types';

// Settings → Categories: add, rename, change icon, reorder, remove (archive or delete) and
// restore expense and income categories. Everything is saved together by one Save.
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	const [expense, income] = await Promise.all([
		listCategoriesForSettings(locals.user.id, 'expense'),
		listCategoriesForSettings(locals.user.id, 'income')
	]);
	return { expense, income };
};

export const actions: Actions = {
	/** Saves both kinds in one batch; any problem refuses the whole save (nothing is written). */
	default: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const form = await request.formData();
		const changes = parseCategoryChanges(form.get(CHANGES_FIELD));
		if (!changes) error(400, 'Bad category changes');

		const [expense, income] = await Promise.all([
			planCategoryChanges(locals.user.id, 'expense', changes.expense),
			planCategoryChanges(locals.user.id, 'income', changes.income)
		]);
		if ('errors' in expense || 'errors' in income) {
			const errors: CategorySaveErrors = { rows: {} };
			for (const plan of [expense, income]) {
				if (!('errors' in plan)) continue;
				Object.assign(errors.rows, plan.errors.rows);
				errors.page ??= plan.errors.page;
			}
			return fail(400, { errors });
		}

		try {
			await applyCategoryWrites([...expense.writes, ...income.writes]);
		} catch (err) {
			// Most likely an entry was added to a category being deleted since the page loaded
			// (the database refuses), or a name was taken in another tab.
			console.error('Saving categories failed', err);
			return fail(409, {
				errors: {
					rows: {},
					page: 'Something changed since this page loaded. Reload it and try again.'
				} satisfies CategorySaveErrors
			});
		}
		return { saved: true };
	}
};

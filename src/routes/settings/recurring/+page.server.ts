import { error, fail, redirect } from '@sveltejs/kit';
import { today } from '#lib/dates.ts';
import { parseRecurring, RECURRING_FIELD, type RecurringErrors } from '#lib/recurring-input.ts';
import { listActiveCategories } from '#lib/server/budget/categories.ts';
import {
	deleteRecurring,
	generateDueCharges,
	listRecurring,
	saveRecurring
} from '#lib/server/budget/recurring.ts';
import type { Actions, PageServerLoad } from './$types';

// Settings → Recurring: expenses that repeat. Charges are created as ordinary expenses when
// they're due (see src/lib/server/budget/recurring.ts).
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	const todayForUser = today(locals.user.timezone ?? undefined);
	await generateDueCharges(locals.user.id, todayForUser);
	const [items, categories] = await Promise.all([
		listRecurring(locals.user.id),
		listActiveCategories(locals.user.id, 'expense')
	]);
	return { today: todayForUser, items, categories };
};

export const actions: Actions = {
	/** Adds or updates one recurring expense, then creates any charge due today. */
	save: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const todayForUser = today(locals.user.timezone ?? undefined);
		const parsed = parseRecurring((await request.formData()).get(RECURRING_FIELD));
		if ('errors' in parsed) return fail(400, { errors: parsed.errors });

		const result = await saveRecurring(locals.user.id, parsed.input, todayForUser);
		if ('error' in result) {
			const errors: RecurringErrors =
				result.error === 'category'
					? { category: 'Pick a category from the list.' }
					: { form: 'This recurring expense no longer exists. Reload the page.' };
			return fail(400, { errors });
		}
		// A charge due today (e.g. a new item starting today) is added right away.
		const added = await generateDueCharges(locals.user.id, todayForUser);
		return { saved: { name: parsed.input.name, created: !parsed.input.id, added } };
	},

	/** Deletes one recurring expense. Charges already added stay. */
	delete: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const raw = (await request.formData()).get(RECURRING_FIELD);
		let id: unknown;
		try {
			id = (JSON.parse(typeof raw === 'string' ? raw : '') as { id?: unknown }).id;
		} catch {
			id = null;
		}
		if (typeof id !== 'string' || !(await deleteRecurring(locals.user.id, id)))
			return fail(400, {
				errors: { form: 'This recurring expense no longer exists. Reload the page.' }
			});
		return { deleted: true };
	}
};

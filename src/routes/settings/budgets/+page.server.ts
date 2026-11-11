import { error, fail, redirect } from '@sveltejs/kit';
import { limitField, parseLimit } from '#lib/budget-input.ts';
import { currentMonth } from '#lib/dates.ts';
import { listBudgets, saveBudgets } from '#lib/server/budget/limits.ts';
import type { Actions, PageServerLoad } from './$types';

// Settings → Budgets: a monthly limit per expense category, changed from this month on.
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	const month = currentMonth(locals.user.timezone ?? undefined);
	return { month, budgets: await listBudgets(locals.user.id, month) };
};

export const actions: Actions = {
	/**
	 * Saves every limit box at once. Only boxes whose value differs from what's in effect are
	 * written. Any bad box fails the whole save (nothing is written) with an error per category.
	 */
	default: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const month = currentMonth(locals.user.timezone ?? undefined);
		const form = await request.formData();

		// Only the user's own active categories count; anything else in the form is ignored.
		const budgets = await listBudgets(locals.user.id, month);
		const changes = new Map<string, number | null>();
		const errors: Record<string, string> = {};
		for (const { id, limitCents } of budgets) {
			const value = form.get(limitField(id));
			if (typeof value !== 'string') continue;
			const next = parseLimit(value);
			if (next === 'invalid') errors[id] = 'Enter an amount like 600 or 12.50.';
			else if (next !== limitCents) changes.set(id, next);
		}
		if (Object.keys(errors).length > 0) return fail(400, { errors });

		await saveBudgets(month, changes);
		return { saved: changes.size };
	}
};

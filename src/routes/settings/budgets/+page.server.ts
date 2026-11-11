import { error, fail, redirect } from '@sveltejs/kit';
import { everydayField, limitField, parseLimit } from '#lib/budget-input.ts';
import { currentMonth } from '#lib/dates.ts';
import { listBudgets, saveBudgets, saveEveryday } from '#lib/server/budget/limits.ts';
import type { Actions, PageServerLoad } from './$types';

// Settings → Budgets: a monthly limit per expense category (changed from this month on), and
// whether each category is "everyday" spending (compared to the month's pace on the home page).
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
		const everydayChanges = new Map<string, boolean>();
		const errors: Record<string, string> = {};
		for (const { id, limitCents, everyday } of budgets) {
			const flag = form.get(everydayField(id));
			if (flag === '1' || flag === '0') {
				if ((flag === '1') !== everyday) everydayChanges.set(id, flag === '1');
			}
			const value = form.get(limitField(id));
			if (typeof value !== 'string') continue;
			const next = parseLimit(value);
			if (next === 'invalid') errors[id] = 'Enter an amount like 600 or 12.50.';
			else if (next !== limitCents) changes.set(id, next);
		}
		if (Object.keys(errors).length > 0) return fail(400, { errors });

		await Promise.all([saveBudgets(month, changes), saveEveryday(locals.user.id, everydayChanges)]);
		// Counted per category, so changing a limit and its switch together is one change.
		return { saved: new Set([...changes.keys(), ...everydayChanges.keys()]).size };
	}
};

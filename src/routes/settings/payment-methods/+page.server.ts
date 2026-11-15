import { error, fail, redirect } from '@sveltejs/kit';
import { today } from '#lib/dates.ts';
import { parsePaymentMethod } from '#lib/payment-methods.ts';
import {
	creditCardSummaries,
	listPaymentMethods,
	removePaymentMethod,
	savePaymentMethod,
	spendingByPaymentMethod
} from '#lib/server/budget/payment-methods.ts';
import { generateDueCharges } from '#lib/server/budget/recurring.ts';
import type { Actions, PageServerLoad } from './$types';

// Settings → Payment methods: cards and pay apps an expense can be "Paid with", plus the
// built-in Cash. Each row shows this month's spending through it. Every action works on the
// signed-in user's own methods only.
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	const userId = locals.user.id;
	const todayForUser = today(locals.user.timezone ?? undefined);
	const start = todayForUser.with({ day: 1 });
	const end = start.add({ months: 1 }).subtract({ days: 1 });

	// Same as the other pages that show spending: add any recurring charge that's due first.
	await generateDueCharges(userId, todayForUser);
	const [methods, spent] = await Promise.all([
		listPaymentMethods(userId),
		spendingByPaymentMethod(userId, start, end)
	]);
	const cards = new Map(
		(await creditCardSummaries(userId, todayForUser, methods)).map((c) => [c.id, c])
	);
	return {
		today: todayForUser,
		showCreditCards: locals.user.showCreditCards ?? true,
		methods: methods.map((m) => ({
			...m,
			spentCents: spent.get(m.id) ?? 0,
			card: cards.get(m.id) ?? null
		}))
	};
};

export const actions: Actions = {
	/** Adds a method, or updates one when `id` is posted. Returns per-field errors on bad input. */
	save: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const form = await request.formData();
		const field = (key: string) => {
			const value = form.get(key);
			return typeof value === 'string' ? value : '';
		};
		const parsed = parsePaymentMethod({
			kind: field('kind'),
			name: field('name'),
			last4: field('last4'),
			limit: field('limit'),
			closingDay: field('closingDay'),
			dueDay: field('dueDay')
		});
		if ('errors' in parsed) return fail(400, { errors: parsed.errors });

		const id = field('id') || null;
		const result = await savePaymentMethod(locals.user.id, id, parsed.value);
		if ('error' in result) return fail(400, { error: result.error });
		return { saved: { name: parsed.value.name, created: !id } };
	},

	/** Removes a method (not Cash). Expenses already paid with it keep showing it. */
	remove: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const id = (await request.formData()).get('id');
		if (typeof id !== 'string' || !(await removePaymentMethod(locals.user.id, id)))
			return fail(404, { error: 'That payment method was already removed.' });
		return { removed: true };
	}
};

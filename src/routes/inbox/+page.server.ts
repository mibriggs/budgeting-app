// Quick add inbox: everything pasted or typed into Quick add, read and waiting to be added as an
// expense or dismissed. See #lib/server/quick-add/inbox.ts.

import { error, fail, redirect } from '@sveltejs/kit';
import { today } from '#lib/dates.ts';
import { listActiveCategories } from '#lib/server/budget/categories.ts';
import { listPaymentMethods } from '#lib/server/budget/payment-methods.ts';
import {
	addPendingAsExpense,
	dismissPending,
	listPending,
	retryStuck
} from '#lib/server/quick-add/inbox.ts';
import { displayName } from '#lib/server/user.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return redirect(302, '/login');
	}
	const userId = locals.user.id;
	// Items whose reading was stopped partway (still "Reading…" after a while) get another go.
	await retryStuck(locals.user);
	const [items, categories, methods] = await Promise.all([
		listPending(userId),
		listActiveCategories(userId, 'expense'),
		listPaymentMethods(userId)
	]);
	return {
		displayName: displayName(locals.user),
		today: today(locals.user.timezone ?? undefined),
		items,
		categories,
		paymentMethods: methods.map(({ id, kind, name, last4, closingDay }) => ({
			id,
			kind,
			name,
			last4,
			closingDay
		}))
	};
};

const text = (form: FormData, key: string) => {
	const value = form.get(key);
	return typeof value === 'string' ? value : '';
};

export const actions: Actions = {
	/** Adds an inbox item as an expense, with the fields as the user left them. */
	add: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const form = await request.formData();
		const result = await addPendingAsExpense(locals.user.id, text(form, 'id'), {
			name: text(form, 'name'),
			amount: text(form, 'amount'),
			date: text(form, 'date'),
			categoryId: text(form, 'categoryId'),
			paymentMethodId: text(form, 'paymentMethodId')
		});
		if ('error' in result) return fail(400, { error: result.error });
		return { added: result.name };
	},

	/** Removes an inbox item without adding anything. */
	dismiss: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const form = await request.formData();
		if (!(await dismissPending(locals.user.id, text(form, 'id'))))
			return fail(404, { error: 'That item is no longer in the inbox.' });
		return { dismissed: true };
	}
};

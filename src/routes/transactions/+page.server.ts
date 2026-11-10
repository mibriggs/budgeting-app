import { error, fail, redirect } from '@sveltejs/kit';
import { today } from '#lib/dates.ts';
import { resolveRange } from '#lib/date-range.ts';
import {
	deleteTransactions,
	listExpenses,
	listIncome,
	MAX_DELETE,
	type TransactionKind
} from '#lib/server/budget/transactions.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		return redirect(302, '/login');
	}

	const range = resolveRange(url.searchParams, today(locals.user.timezone ?? undefined));
	const [expenses, incomes] = await Promise.all([
		listExpenses(locals.user.id, range),
		listIncome(locals.user.id, range)
	]);

	return { range, expenses, incomes };
};

export const actions: Actions = {
	/** Deletes the expenses or income rows whose IDs are posted as repeated `id` fields. */
	delete: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');

		const form = await request.formData();
		const kind = form.get('kind');
		const ids = [...new Set(form.getAll('id').filter((id) => typeof id === 'string'))];

		if (kind !== 'expense' && kind !== 'income') {
			return fail(400, { error: 'Unknown transaction type.' });
		}
		if (ids.length === 0) {
			return fail(400, { error: 'Nothing was selected.' });
		}
		if (ids.length > MAX_DELETE) {
			return fail(400, { error: `You can delete up to ${MAX_DELETE} rows at once.` });
		}

		const deleted = await deleteTransactions(locals.user.id, kind as TransactionKind, ids);
		return { deleted: deleted.length, kind: kind as TransactionKind };
	}
};

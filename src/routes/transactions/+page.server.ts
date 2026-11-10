import { redirect } from '@sveltejs/kit';
import { today } from '#lib/dates.ts';
import { resolveRange } from '#lib/date-range.ts';
import { listExpenses, listIncome } from '#lib/server/budget/transactions.ts';
import type { PageServerLoad } from './$types';

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

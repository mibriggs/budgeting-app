import { redirect } from '@sveltejs/kit';
import { today } from '#lib/dates.ts';
import { chargesPerMonth, upcoming } from '#lib/recurring-schedule.ts';
import { listActiveCategories } from '#lib/server/budget/categories.ts';
import { spendingByCategory } from '#lib/server/budget/dashboard.ts';
import { listBudgets } from '#lib/server/budget/limits.ts';
import { generateDueCharges, listRecurring } from '#lib/server/budget/recurring.ts';
import { listDevices, pushConfigured } from '#lib/server/push.ts';
import type { PageServerLoad } from './$types';

// Settings overview: a card per section with a short summary of what's in it. Everything is
// read in parallel; each summary is worked out here so the page only formats numbers.
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	const userId = locals.user.id;
	const todayForUser = today(locals.user.timezone ?? undefined);
	const start = todayForUser.with({ day: 1 });
	const end = start.add({ months: 1 }).subtract({ days: 1 });

	// Same as the other pages that show spending: add any recurring charge that's due first.
	await generateDueCharges(userId, todayForUser);
	const [budgets, spent, recurring, expenseCategories, incomeCategories, devices] =
		await Promise.all([
			listBudgets(userId, todayForUser.toPlainYearMonth()),
			spendingByCategory(userId, start, end),
			listRecurring(userId),
			listActiveCategories(userId, 'expense'),
			listActiveCategories(userId, 'income'),
			listDevices(userId)
		]);

	// Budgets: total of the limits set, and spending in just those categories (so the bar compares
	// like with like).
	const spentById = new Map(spent.map((s) => [s.id, s.cents]));
	const withLimit = budgets.filter((b) => b.limitCents !== null);
	const budgetSummary = {
		count: withLimit.length,
		budgetedCents: withLimit.reduce((sum, b) => sum + (b.limitCents ?? 0), 0),
		spentCents: withLimit.reduce((sum, b) => sum + (spentById.get(b.id) ?? 0), 0),
		daysLeft: end.day - todayForUser.day
	};

	// Recurring: active ones (not paused, not ended), their monthly cost, and the next charge.
	let monthlyCents = 0;
	let active = 0;
	let next: { name: string; amountCents: number; date: typeof todayForUser } | null = null;
	for (const item of recurring) {
		if (item.paused) continue;
		const date = upcoming(item.cadences, todayForUser, 1, item.endDate)[0]?.date;
		if (!date) continue;
		active++;
		monthlyCents += Math.round(
			item.cadences.reduce((sum, c) => sum + chargesPerMonth(c), 0) * item.amountCents
		);
		if (!next || date.until(next.date).days > 0)
			next = { name: item.name, amountCents: item.amountCents, date };
	}

	return {
		today: todayForUser,
		budgets: budgetSummary,
		recurring: { active, inactive: recurring.length - active, monthlyCents, next },
		categories: { expense: expenseCategories.length, income: incomeCategories.length },
		// Endpoints let the page tell whether this browser is one of them ("On for this device").
		notifications: { configured: pushConfigured, endpoints: devices.map((d) => d.endpoint) }
	};
};

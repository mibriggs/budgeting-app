import { redirect } from '@sveltejs/kit';
import { summarizeBudgets } from '#lib/budget-status.ts';
import { today } from '#lib/dates.ts';
import { listActiveCategories } from '#lib/server/budget/categories.ts';
import { generateDueCharges } from '#lib/server/budget/recurring.ts';
import {
	dailySpending,
	fillMonths,
	monthlyTotals,
	paceByDay,
	spendingByCategory,
	topCategories
} from '#lib/server/budget/dashboard.ts';
import { listBudgets } from '#lib/server/budget/limits.ts';
import { displayName } from '#lib/server/user.ts';
import type { PageServerLoad } from './login/$types';

/** How many months the "income vs expenses" chart covers, including this one. */
const TREND_MONTHS = 6;

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return redirect(302, '/login');
	}

	const userId = locals.user.id;
	const todayForUser = today(locals.user.timezone ?? undefined);
	const thisStart = todayForUser.with({ day: 1 });
	const thisEnd = thisStart.add({ months: 1 }).subtract({ days: 1 });
	const lastStart = thisStart.subtract({ months: 1 });
	const lastEnd = thisStart.subtract({ days: 1 });
	const trendStart = thisStart.subtract({ months: TREND_MONTHS - 1 });

	// Add any recurring charges that came due (e.g. rent on the 1st) before reading expenses.
	await generateDueCharges(userId, todayForUser);

	const [expenseCategories, incomeCategories, months, byCategory, thisDaily, lastDaily, limits] =
		await Promise.all([
			// For the add expense / add income dialogs.
			listActiveCategories(userId, 'expense'),
			listActiveCategories(userId, 'income'),
			// For the charts.
			monthlyTotals(userId, trendStart, thisEnd),
			spendingByCategory(userId, thisStart, thisEnd),
			dailySpending(userId, thisStart, todayForUser),
			dailySpending(userId, lastStart, lastEnd),
			listBudgets(userId, thisStart.toPlainYearMonth())
		]);

	const trend = fillMonths(trendStart.toPlainYearMonth(), thisStart.toPlainYearMonth(), months);
	const thisMonth = trend.at(-1)!;
	const pace = paceByDay(todayForUser, thisDaily, lastDaily);
	// Last month's spending up to the same day of the month, for a fair comparison.
	const sameDayLastMonth = Math.min(todayForUser.day, lastStart.daysInMonth);
	const lastMonthToDate = pace[sameDayLastMonth - 1]?.lastMonth ?? 0;

	return {
		displayName: displayName(locals.user),
		today: todayForUser,
		categories: { expense: expenseCategories, income: incomeCategories },
		dashboard: {
			month: thisStart.toPlainYearMonth(),
			tiles: {
				income: thisMonth.income,
				expenses: thisMonth.expenses,
				net: thisMonth.net,
				lastMonthToDate,
				dayOfMonth: todayForUser.day
			},
			byCategory,
			slices: topCategories(byCategory),
			trend,
			pace,
			budgets: summarizeBudgets(
				limits,
				new Map(byCategory.map((row) => [row.id, row.cents])),
				todayForUser
			)
		}
	};
};

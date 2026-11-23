import { redirect } from '@sveltejs/kit';
import { summarizeBudgets } from '#lib/budget-status.ts';
import { resolveRange } from '#lib/date-range.ts';
import { today } from '#lib/dates.ts';
import { listActiveCategories } from '#lib/server/budget/categories.ts';
import { creditCardSummaries, listPaymentMethods } from '#lib/server/budget/payment-methods.ts';
import { generateDueCharges, listRecurring } from '#lib/server/budget/recurring.ts';
import {
	cashFlow,
	dailySpending,
	fillMonths,
	monthlyTotals,
	paceByDay,
	recentExpenses,
	spendingByCategory,
	topCategories,
	totalIncome,
	upcomingCharges
} from '#lib/server/budget/dashboard.ts';
import { listBudgets } from '#lib/server/budget/limits.ts';
import { listPending } from '#lib/server/quick-add/inbox.ts';
import { displayName } from '#lib/server/user.ts';
import type { PageServerLoad } from './login/$types';

/** How many months the "income vs expenses" chart covers, including this one. */
const TREND_MONTHS = 6;

export const load: PageServerLoad = async ({ locals, url, depends }) => {
	if (!locals.user) {
		return redirect(302, '/login');
	}
	// The inbox preview: refreshed with the count when the app comes back on screen.
	depends('app:inbox');

	const userId = locals.user.id;
	const todayForUser = today(locals.user.timezone ?? undefined);
	const thisStart = todayForUser.with({ day: 1 });
	const thisEnd = thisStart.add({ months: 1 }).subtract({ days: 1 });
	const lastStart = thisStart.subtract({ months: 1 });
	const lastEnd = thisStart.subtract({ days: 1 });
	const trendStart = thisStart.subtract({ months: TREND_MONTHS - 1 });
	// "Cash Flow" period from ?range= (same values as the transactions page); last 6 months by default.
	const flowRange = resolveRange(url.searchParams, todayForUser, '6m');

	// Add any recurring charges that came due (e.g. rent on the 1st) before reading expenses.
	await generateDueCharges(userId, todayForUser);

	const [
		expenseCategories,
		incomeCategories,
		paymentMethods,
		months,
		byCategory,
		thisDaily,
		lastDaily,
		limits,
		recent,
		recurring,
		flowIncome,
		flowByCategory
	] = await Promise.all([
		// For the add expense / add income dialogs.
		listActiveCategories(userId, 'expense'),
		listActiveCategories(userId, 'income'),
		listPaymentMethods(userId),
		// For the charts.
		monthlyTotals(userId, trendStart, thisEnd),
		spendingByCategory(userId, thisStart, thisEnd),
		dailySpending(userId, thisStart, todayForUser),
		dailySpending(userId, lastStart, lastEnd),
		listBudgets(userId, thisStart.toPlainYearMonth()),
		// For the "Recent Expenses" and "Upcoming Payments" cards.
		recentExpenses(userId, todayForUser),
		listRecurring(userId),
		// For the "Cash Flow" chart.
		totalIncome(userId, flowRange.from, flowRange.to),
		spendingByCategory(userId, flowRange.from, flowRange.to)
	]);

	const [cards, pending] = await Promise.all([
		creditCardSummaries(userId, todayForUser, paymentMethods),
		listPending(userId)
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
		paymentMethods: paymentMethods.map(({ id, kind, name, last4, closingDay }) => ({
			id,
			kind,
			name,
			last4,
			closingDay
		})),
		// Home page "Credit Cards" card: on unless hidden (saved per account).
		showCreditCards: locals.user.showCreditCards ?? true,
		// Quick add inbox card: the first few waiting items (the count comes from the layout).
		inboxPreview: pending.slice(0, 3).map((p) => ({
			id: p.id,
			status: p.status,
			isExpense: p.isExpense,
			name: p.name,
			message: p.message,
			amountCents: p.amountCents,
			purchaseDate: p.purchaseDate,
			categoryName: p.categoryName,
			categoryIcon: p.categoryIcon,
			note: p.note
		})),
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
			flow: cashFlow(flowIncome, flowByCategory),
			flowRange,
			cards,
			recent: recent.map((row) => ({ ...row, kind: 'expense' as const })),
			upcoming: upcomingCharges(recurring, todayForUser),
			budgets: summarizeBudgets(
				limits,
				new Map(byCategory.map((row) => [row.id, row.cents])),
				todayForUser
			)
		}
	};
};

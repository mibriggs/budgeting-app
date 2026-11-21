// Sample home page data for the inbox mock, so the inbox can be seen in place among the real
// dashboard cards. Built with the same helpers the home page uses (src/routes/+page.server.ts),
// fed made-up numbers instead of database queries.

import { summarizeBudgets } from '#lib/budget-status.ts';
import { cashFlow, fillMonths, paceByDay, topCategories, upcomingCharges } from '#lib/dashboard.ts';
import { resolveRange } from '#lib/date-range.ts';
import { Temporal, type PlainDate } from '#lib/dates.ts';
import { cardCycle, nextOnDay } from '#lib/payment-methods.ts';
import type { RecentItem } from '#lib/components/dashboard/RecentExpensesCard.svelte';

/** Spending this month by category, largest first (ids match the inbox mock's categories). */
const byCategory = [
	{ id: 'rent', name: 'Rent', icon: 'house', cents: 230_000 },
	{ id: 'groceries', name: 'Groceries', icon: 'shopping-cart', cents: 35_166 },
	{ id: 'eating-out', name: 'Eating Out', icon: 'utensils-crossed', cents: 29_435 },
	{ id: 'gas', name: 'Gas', icon: 'fuel', cents: 18_420 },
	{ id: 'subscriptions', name: 'Subscriptions', icon: 'repeat', cents: 9_196 },
	{ id: 'shopping', name: 'Shopping', icon: 'shopping-bag', cents: 6_499 },
	{ id: 'coffee', name: 'Coffee', icon: 'coffee', cents: 3_250 }
];

const limits: Record<string, { limitCents: number | null; everyday: boolean }> = {
	rent: { limitCents: 230_000, everyday: false },
	groceries: { limitCents: 50_000, everyday: true },
	'eating-out': { limitCents: 35_000, everyday: true },
	gas: { limitCents: 20_000, everyday: true },
	subscriptions: { limitCents: null, everyday: false },
	shopping: { limitCents: 15_000, everyday: true },
	coffee: { limitCents: 4_000, everyday: true }
};

/** Made-up but steady daily spending: rent on the 1st, then a few purchases most days. */
function daily(month: Temporal.PlainYearMonth, lastDay: number, seed: number) {
	const map = new Map<string, number>();
	let x = seed;
	for (let day = 1; day <= lastDay; day++) {
		x = (x * 9301 + 49297) % 233280;
		const cents = (day === 1 ? 230_000 : 0) + Math.round((x / 233280) * 9_000);
		map.set(month.toPlainDate({ day }).toString(), cents);
	}
	return map;
}

export function mockHome(today: PlainDate) {
	const thisMonth = today.toPlainYearMonth();
	const lastMonth = thisMonth.subtract({ months: 1 });
	const expenses = byCategory.reduce((n, r) => n + r.cents, 0);
	const income = 520_000;

	const thisDaily = daily(thisMonth, today.day, 7);
	const lastDaily = daily(lastMonth, lastMonth.daysInMonth, 11);
	const pace = paceByDay(today, thisDaily, lastDaily);
	const sameDay = Math.min(today.day, lastMonth.daysInMonth);

	const trend = fillMonths(thisMonth.subtract({ months: 5 }), thisMonth, {
		expenses: new Map([
			['2026-06', 410_000],
			['2026-07', 455_000],
			['2026-08', 520_000],
			['2026-09', 430_000],
			['2026-10', 470_000],
			[thisMonth.toString(), expenses]
		]),
		incomes: new Map([
			['2026-06', 480_000],
			['2026-07', 480_000],
			['2026-08', 495_000],
			['2026-09', 480_000],
			['2026-10', 510_000],
			[thisMonth.toString(), income]
		])
	});

	const d = (s: string) => Temporal.PlainDate.from(s);
	const recent: RecentItem[] = [
		['Star Market', '2026-11-19', 4_210, 'Groceries', 'shopping-cart', 'Discover it'],
		['Netflix', '2026-11-18', 1_549, 'Subscriptions', 'repeat', 'Chase Sapphire'],
		['Shell', '2026-11-17', 4_862, 'Gas', 'fuel', 'Chase Sapphire'],
		['Tacos El Gordo', '2026-11-16', 2_380, 'Eating Out', 'utensils-crossed', 'Apple Card'],
		['Target', '2026-11-15', 3_699, 'Shopping', 'shopping-bag', 'Discover it'],
		['Blue Bottle Coffee', '2026-11-14', 625, 'Coffee', 'coffee', 'Chase Sapphire']
	].map(([name, date, amountCents, categoryName, categoryIcon, method], i) => ({
		id: `r${i}`,
		kind: 'expense' as const,
		name: name as string,
		date: d(date as string),
		amountCents: amountCents as number,
		categoryName: categoryName as string,
		categoryIcon: categoryIcon as string,
		paymentMethodKind: 'credit' as const,
		paymentMethodName: method as string,
		recurring: name === 'Netflix'
	}));

	const monthly = (id: string, start: string) => [
		{ id, startDate: d(start), count: 1, unit: 'month' as const }
	];
	const upcoming = upcomingCharges(
		[
			{
				name: 'Rent',
				amountCents: 230_000,
				category: { name: 'Rent', icon: 'house' },
				cadences: monthly('c1', '2026-01-01'),
				paymentMethod: null
			},
			{
				name: 'Netflix',
				amountCents: 1_549,
				category: { name: 'Subscriptions', icon: 'repeat' },
				cadences: monthly('c2', '2026-01-18'),
				paymentMethod: { kind: 'credit' as const, name: 'Chase Sapphire' }
			},
			{
				name: 'Spotify',
				amountCents: 1_199,
				category: { name: 'Subscriptions', icon: 'repeat' },
				cadences: monthly('c3', '2026-01-27'),
				paymentMethod: { kind: 'credit' as const, name: 'Apple Card' }
			},
			{
				name: 'Gym',
				amountCents: 4_500,
				category: { name: 'Shopping', icon: 'shopping-bag' },
				cadences: monthly('c4', '2026-01-05'),
				paymentMethod: { kind: 'credit' as const, name: 'Discover it' }
			}
		].map((r) => ({ ...r, endDate: null, paused: false })),
		today
	);

	// Credit cards, built like creditCardSummaries with made-up totals.
	const cards = [
		{
			id: 'chase',
			name: 'Chase Sapphire',
			last4: '4417',
			limitCents: 1_200_000,
			closingDay: 25,
			dueDay: 22,
			month: 98_400,
			cycleSpent: 64_210,
			statement: 118_330
		},
		{
			id: 'discover',
			name: 'Discover it',
			last4: '0921',
			limitCents: 600_000,
			closingDay: 10,
			dueDay: 5,
			month: 41_020,
			cycleSpent: 22_870,
			statement: 51_460
		},
		{
			id: 'apple',
			name: 'Apple Card',
			last4: null,
			limitCents: 300_000,
			closingDay: null,
			dueDay: 30,
			month: 12_310,
			cycleSpent: 0,
			statement: 0
		}
	].map((c) => {
		const dates = c.closingDay ? cardCycle(today, c.closingDay, c.dueDay) : null;
		const statement = dates ? { ...dates.statement, totalCents: c.statement } : null;
		let nextDue: { date: PlainDate; amountCents: number | null } | null = null;
		if (statement?.dueOn && Temporal.PlainDate.compare(statement.dueOn, today) >= 0)
			nextDue = { date: statement.dueOn, amountCents: statement.totalCents };
		else if (dates?.nextDueOn) nextDue = { date: dates.nextDueOn, amountCents: null };
		else if (!dates && c.dueDay) nextDue = { date: nextOnDay(today, c.dueDay), amountCents: null };
		return {
			id: c.id,
			name: c.name,
			last4: c.last4,
			limitCents: c.limitCents,
			hasClosingDay: Boolean(c.closingDay),
			cycle: dates ? { ...dates.cycle, spentCents: c.cycleSpent } : null,
			statement,
			nextDue,
			monthCents: c.month
		};
	});

	return {
		month: thisMonth,
		tiles: {
			income,
			expenses,
			net: income - expenses,
			lastMonthToDate: pace[sameDay - 1]?.lastMonth ?? 0,
			dayOfMonth: today.day
		},
		byCategory,
		slices: topCategories(byCategory),
		trend,
		pace,
		flow: cashFlow(income, byCategory),
		flowRange: resolveRange(new URLSearchParams(), today, 'month'),
		cards,
		recent,
		upcoming,
		budgets: summarizeBudgets(
			byCategory.map((c) => ({ ...c, ...limits[c.id] })),
			new Map(byCategory.map((c) => [c.id, c.cents])),
			today
		)
	};
}

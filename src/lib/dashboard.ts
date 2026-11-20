// Pure helpers that shape the home page chart data. No database access, so they run anywhere
// (server load, the dev preview page, a quick Node check).

import { Temporal, type PlainDate } from '#lib/dates.ts';
import type { PaymentMethodKind } from '#lib/payment-methods.ts';
import { describeSchedule, occurrencesFrom, type Cadence } from '#lib/recurring-schedule.ts';

export type CategorySlice = { name: string; icon: string | null; cents: number };
export type MonthTotals = {
	month: string;
	label: string;
	income: number;
	expenses: number;
	net: number;
};
export type PacePoint = { day: number; thisMonth: number | null; lastMonth: number | null };

const MAX_SLICES = 6;

/**
 * Inner padding for the line and bar charts. LayerChart's default leaves 20px for the y-axis,
 * which "$2,500"-style labels overrun; 48px fits them inside the card. Bottom is the x-axis (20)
 * plus the legend (32), as in the default.
 */
export const CHART_PADDING = { top: 4, right: 8, bottom: 52, left: 48 };

/** Top categories plus everything else folded into "Other", so the pie stays readable. */
export function topCategories(rows: CategorySlice[]): CategorySlice[] {
	if (rows.length <= MAX_SLICES + 1) return rows;
	const top = rows.slice(0, MAX_SLICES);
	const rest = rows.slice(MAX_SLICES).reduce((sum, row) => sum + row.cents, 0);
	return [...top, { name: 'Other', icon: null, cents: rest }];
}

/** How many categories the cash flow chart names; the rest are folded into "Other". */
export const FLOW_TOP = 5;

export type FlowNodeKind = 'income' | 'overspent' | 'spending' | 'category' | 'leftOver';
export type FlowNode = {
	id: string;
	name: string;
	cents: number;
	kind: FlowNodeKind;
	color: string;
};
export type FlowLink = { source: string; target: string; cents: number };
export type CashFlow = {
	incomeCents: number;
	spendingCents: number;
	nodes: FlowNode[];
	links: FlowLink[];
};

/**
 * Nodes and links for the "Cash Flow" Sankey: all income as one lump, flowing out to the top
 * categories, "Other" for the rest, and "Left over" for income that wasn't spent.
 *
 * When spending is more than income, the income alone can't cover the outflows, so the gap is
 * shown as its own source ("Overspent") and both join in a "Spending" node that fans out.
 */
export function cashFlow(incomeCents: number, byCategory: CategorySlice[]): CashFlow {
	const spendingCents = byCategory.reduce((sum, row) => sum + row.cents, 0);
	// "Other" only when it would hold two or more categories; a single one keeps its name.
	const named = byCategory.length <= FLOW_TOP + 1 ? byCategory : byCategory.slice(0, FLOW_TOP);
	const rest = byCategory.slice(named.length).reduce((sum, row) => sum + row.cents, 0);

	const targets: FlowNode[] = named
		.filter((row) => row.cents > 0)
		.map((row, i) => ({
			id: `category:${row.name}`,
			name: row.name,
			cents: row.cents,
			kind: 'category',
			color: `var(--chart-${i + 1})`
		}));
	if (rest > 0)
		targets.push({
			id: 'other',
			name: 'Other',
			cents: rest,
			kind: 'category',
			color: 'var(--chart-other)'
		});

	const income: FlowNode = {
		id: 'income',
		name: 'Income',
		cents: incomeCents,
		kind: 'income',
		color: 'var(--chart-6)'
	};
	const leftOver = incomeCents - spendingCents;

	if (leftOver >= 0) {
		if (leftOver > 0)
			targets.push({
				id: 'left-over',
				name: 'Left over',
				cents: leftOver,
				kind: 'leftOver',
				color: 'var(--chart-6)'
			});
		return {
			incomeCents,
			spendingCents,
			nodes: incomeCents > 0 ? [income, ...targets] : [],
			links: targets.map((t) => ({ source: income.id, target: t.id, cents: t.cents }))
		};
	}

	const over: FlowNode = {
		id: 'overspent',
		name: 'Overspent',
		cents: -leftOver,
		kind: 'overspent',
		color: 'var(--color-red-500)'
	};
	const spending: FlowNode = {
		id: 'spending',
		name: 'Spending',
		cents: spendingCents,
		kind: 'spending',
		color: 'var(--chart-other)'
	};
	const sources = incomeCents > 0 ? [income, over] : [over];
	return {
		incomeCents,
		spendingCents,
		nodes: [...sources, spending, ...targets],
		links: [
			...sources.map((s) => ({ source: s.id, target: spending.id, cents: s.cents })),
			...targets.map((t) => ({ source: spending.id, target: t.id, cents: t.cents }))
		]
	};
}

/** Every month from `first` to `last` inclusive, with zeros where there was nothing. */
export function fillMonths(
	first: Temporal.PlainYearMonth,
	last: Temporal.PlainYearMonth,
	totals: { expenses: Map<string, number>; incomes: Map<string, number> }
): MonthTotals[] {
	const months: MonthTotals[] = [];
	for (let m = first; Temporal.PlainYearMonth.compare(m, last) <= 0; m = m.add({ months: 1 })) {
		const key = m.toString();
		const incomeCents = totals.incomes.get(key) ?? 0;
		const expenseCents = totals.expenses.get(key) ?? 0;
		months.push({
			month: key,
			label: m.toLocaleString('en-US', { month: 'short', calendar: 'iso8601' }),
			income: incomeCents,
			expenses: expenseCents,
			net: incomeCents - expenseCents
		});
	}
	return months;
}

/**
 * Running total of spending by day of month: this month up to today, last month in full.
 * Days past today (this month) or past the end of last month are null, so lines stop there.
 */
export function paceByDay(
	today: PlainDate,
	thisMonthDaily: Map<string, number>,
	lastMonthDaily: Map<string, number>
): PacePoint[] {
	const thisStart = today.with({ day: 1 });
	const lastStart = thisStart.subtract({ months: 1 });
	const days = Math.max(thisStart.daysInMonth, lastStart.daysInMonth);
	let thisTotal = 0;
	let lastTotal = 0;
	const points: PacePoint[] = [];
	for (let day = 1; day <= days; day++) {
		let thisMonth: number | null = null;
		if (day <= today.day) {
			thisTotal += thisMonthDaily.get(thisStart.with({ day }).toString()) ?? 0;
			thisMonth = thisTotal;
		}
		let lastMonth: number | null = null;
		if (day <= lastStart.daysInMonth) {
			lastTotal += lastMonthDaily.get(lastStart.with({ day }).toString()) ?? 0;
			lastMonth = lastTotal;
		}
		points.push({ day, thisMonth, lastMonth });
	}
	return points;
}

/** How far ahead the home page "Upcoming Payments" card looks. */
export const UPCOMING_DAYS = 30;

/** One charge a recurring expense will add, for the "Upcoming Payments" card. */
export type UpcomingCharge = {
	/** Cadence id plus date (a weekly schedule appears more than once). */
	id: string;
	name: string;
	date: PlainDate;
	amountCents: number;
	/** "Monthly on the 1st", from describeSchedule. */
	schedule: string;
	categoryName: string;
	categoryIcon: string | null;
	paymentMethodKind: PaymentMethodKind | null;
	paymentMethodName: string | null;
};

/** The parts of a recurring expense (see listRecurring) the upcoming list needs. */
type RecurringLike = {
	name: string;
	amountCents: number;
	category: { name: string; icon: string | null };
	endDate: PlainDate | null;
	paused: boolean;
	paymentMethod: { kind: PaymentMethodKind; name: string } | null;
	cadences: (Cadence & { id: string })[];
};

/**
 * Every charge from tomorrow through `days` days ahead, soonest first (same day: bigger first).
 * Today's charges are left out: they've already been added and show as recent expenses.
 * Paused items are skipped. `nextLater` is the first charge after the window, so the card can
 * name it when nothing falls inside.
 */
export function upcomingCharges(
	items: RecurringLike[],
	today: PlainDate,
	days = UPCOMING_DAYS
): { charges: UpcomingCharge[]; nextLater: UpcomingCharge | null } {
	const from = today.add({ days: 1 });
	const last = today.add({ days });
	const charges: UpcomingCharge[] = [];
	let nextLater: UpcomingCharge | null = null;
	for (const item of items) {
		if (item.paused) continue;
		const base = {
			name: item.name,
			amountCents: item.amountCents,
			schedule: describeSchedule(item.cadences),
			categoryName: item.category.name,
			categoryIcon: item.category.icon,
			paymentMethodKind: item.paymentMethod?.kind ?? null,
			paymentMethodName: item.paymentMethod?.name ?? null
		};
		const until =
			item.endDate && Temporal.PlainDate.compare(item.endDate, last) < 0 ? item.endDate : last;
		for (const c of item.cadences) {
			for (const date of occurrencesFrom(c, from, days, until))
				charges.push({ ...base, id: `${c.id}:${date}`, date });
			const [later] = occurrencesFrom(c, last.add({ days: 1 }), 1, item.endDate);
			if (later && (!nextLater || Temporal.PlainDate.compare(later, nextLater.date) < 0))
				nextLater = { ...base, id: `${c.id}:${later}`, date: later };
		}
	}
	charges.sort(
		(a, b) => Temporal.PlainDate.compare(a.date, b.date) || b.amountCents - a.amountCents
	);
	return { charges, nextLater: charges.length ? null : nextLater };
}

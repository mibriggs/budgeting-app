// Pure helpers that shape the home page chart data. No database access, so they run anywhere
// (server load, the dev preview page, a quick Node check).

import { Temporal, type PlainDate } from '#lib/dates.ts';

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

/** Top categories plus everything else folded into "Other", so the pie stays readable. */
export function topCategories(rows: CategorySlice[]): CategorySlice[] {
	if (rows.length <= MAX_SLICES + 1) return rows;
	const top = rows.slice(0, MAX_SLICES);
	const rest = rows.slice(MAX_SLICES).reduce((sum, row) => sum + row.cents, 0);
	return [...top, { name: 'Other', icon: null, cents: rest }];
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

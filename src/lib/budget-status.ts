// How each budget is doing this month, for the home page Budgets card. Pure (no database), so
// the rules can be checked in isolation and reused.
//
// Status, worst first:
// - over:    spent more than the limit
// - close:   80% or more of the limit used (for a bill, paying exactly the limit is "ok": that's
//            the expected outcome, not a warning)
// - heading: an "everyday" category that, at its rate so far, would pass the limit by month end
// - ok:      everything else
// "Everyday" categories (groceries, eating out) are spread through the month, so they're
// compared to the month's pace; bills paid once (rent) aren't, or they'd always look alarming.

import type { PlainDate } from '#lib/dates.ts';

export type BudgetStatus = 'over' | 'close' | 'heading' | 'ok';

export type BudgetLine = {
	id: string;
	name: string;
	icon: string | null;
	everyday: boolean;
	/** Cents spent this month so far. */
	spent: number;
	/** Cents allowed this month. */
	limit: number;
	/** spent / limit (Infinity when the limit is $0 and something was spent). */
	share: number;
	/** Cents left; negative when over. */
	left: number;
	/** Straight-line month-end estimate for everyday categories, else null. */
	projected: number | null;
	status: BudgetStatus;
};

export type BudgetSummary = {
	/** Categories with a limit, most used first. */
	lines: BudgetLine[];
	/** Categories with spending this month but no limit, largest first. */
	unbudgeted: { id: string; name: string; spent: number }[];
	totalSpent: number;
	totalLimit: number;
	counts: { over: number; atRisk: number; ok: number };
	day: number;
	daysInMonth: number;
};

/** Share of the limit at which a budget counts as "close". */
export const CLOSE_AT = 0.8;
/**
 * Before this day of the month, a few days of spending say little about the rest of the month
 * (one big shop on the 2nd would "project" to 15 of them), so nothing is "heading over" yet.
 */
export const PROJECT_FROM_DAY = 7;

export function summarizeBudgets(
	categories: {
		id: string;
		name: string;
		icon: string | null;
		everyday: boolean;
		limitCents: number | null;
	}[],
	spentById: Map<string, number>,
	today: PlainDate
): BudgetSummary {
	const day = today.day;
	const daysInMonth = today.daysInMonth;
	const lines: BudgetLine[] = [];
	const unbudgeted: BudgetSummary['unbudgeted'] = [];

	for (const c of categories) {
		const spent = spentById.get(c.id) ?? 0;
		if (c.limitCents === null) {
			if (spent > 0) unbudgeted.push({ id: c.id, name: c.name, spent });
			continue;
		}
		const limit = c.limitCents;
		const share = limit > 0 ? spent / limit : spent > 0 ? Infinity : 0;
		const left = limit - spent;
		const projected = c.everyday ? Math.round((spent / day) * daysInMonth) : null;
		let status: BudgetStatus;
		if (left < 0) status = 'over';
		else if (!c.everyday && limit > 0 && left === 0) status = 'ok';
		else if (limit > 0 && share >= CLOSE_AT) status = 'close';
		else if (projected !== null && day >= PROJECT_FROM_DAY && projected > limit) status = 'heading';
		else status = 'ok';
		lines.push({ ...c, spent, limit, share, left, projected, status });
	}

	lines.sort((a, b) => b.share - a.share || a.name.localeCompare(b.name));
	unbudgeted.sort((a, b) => b.spent - a.spent);

	return {
		lines,
		unbudgeted,
		totalSpent: lines.reduce((sum, l) => sum + l.spent, 0),
		totalLimit: lines.reduce((sum, l) => sum + l.limit, 0),
		counts: {
			over: lines.filter((l) => l.status === 'over').length,
			atRisk: lines.filter((l) => l.status === 'close' || l.status === 'heading').length,
			ok: lines.filter((l) => l.status === 'ok').length
		},
		day,
		daysInMonth
	};
}

// When a recurring expense is charged: one or more cadences, each a start date plus "every N
// days / weeks / months / years". Pure date math, shared by the page (previews) and, later, the
// server's generator. See .claude/future-plans.md, "Recurring expenses".
//
// Occurrence n is always counted from the start date (start + n × interval), never from the
// previous one, so the day doesn't drift: monthly from Jan 31 gives Feb 28, Mar 31, Apr 30.

import { Temporal, type PlainDate } from '#lib/dates.ts';

export type IntervalUnit = 'day' | 'week' | 'month' | 'year';
export const INTERVAL_UNITS: IntervalUnit[] = ['day', 'week', 'month', 'year'];
export const MAX_INTERVAL = 99;

export type Cadence = { startDate: PlainDate; count: number; unit: IntervalUnit };

const PLURAL = { day: 'days', week: 'weeks', month: 'months', year: 'years' } as const;

/** "day" / "days" to match the number shown next to it. */
export function unitLabel(unit: IntervalUnit, count: number): string {
	return count === 1 ? unit : PLURAL[unit];
}

/** The n-th charge (n = 0 is the start date). Short months clamp to their last day. */
export function occurrence(c: Cadence, n: number): PlainDate {
	return c.startDate.add({ [PLURAL[c.unit]]: n * c.count });
}

const compare = Temporal.PlainDate.compare;

/** Up to `limit` charges on or after `from` (and not after `until`), in order. */
export function occurrencesFrom(
	c: Cadence,
	from: PlainDate,
	limit: number,
	until?: PlainDate | null
): PlainDate[] {
	// Jump close to `from` instead of stepping from a start date years back.
	let n = 0;
	if (compare(c.startDate, from) < 0) {
		const elapsed = c.startDate.until(from, { largestUnit: PLURAL[c.unit] })[PLURAL[c.unit]];
		n = Math.max(0, Math.floor(elapsed / c.count) - 1);
	}
	const out: PlainDate[] = [];
	for (let guard = 0; out.length < limit && guard < 1000; guard++, n++) {
		const d = occurrence(c, n);
		if (until && compare(d, until) > 0) break;
		if (compare(d, from) >= 0) out.push(d);
	}
	return out;
}

/**
 * The next `limit` charge days across all cadences, with how many charges fall on each (two
 * cadences landing on the same day charge twice).
 */
export function upcoming(
	cadences: Cadence[],
	from: PlainDate,
	limit: number,
	until?: PlainDate | null
): { date: PlainDate; count: number }[] {
	const all = cadences.flatMap((c) => occurrencesFrom(c, from, limit, until));
	all.sort(compare);
	const out: { date: PlainDate; count: number }[] = [];
	for (const d of all) {
		const last = out.at(-1);
		if (last && last.date.equals(d)) last.count++;
		else if (out.length < limit) out.push({ date: d, count: 1 });
		else break;
	}
	return out;
}

export function ordinal(n: number): string {
	const s = ['th', 'st', 'nd', 'rd'];
	const v = n % 100;
	return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

const list = new Intl.ListFormat('en-US', { type: 'conjunction' });

/** "Monthly on the 1st", "Every 2 weeks on Fridays", "Yearly on Mar 4", "Every 10 days". */
export function describeCadence({ startDate, count, unit }: Cadence): string {
	const every = (word: string) => (count === 1 ? word : `Every ${count} ${PLURAL[unit]}`);
	switch (unit) {
		case 'day':
			return count === 1 ? 'Every day' : `Every ${count} days`;
		case 'week':
			return `${every('Weekly')} on ${startDate.toLocaleString('en-US', { weekday: 'long' })}s`;
		case 'month':
			return `${every('Monthly')} on the ${ordinal(startDate.day)}`;
		case 'year':
			return `${every('Yearly')} on ${startDate.toLocaleString('en-US', { month: 'short', day: 'numeric' })}`;
	}
}

/** One line for the whole schedule: "Monthly on the 1st and 15th", or each cadence joined. */
export function describeSchedule(cadences: Cadence[]): string {
	if (cadences.length > 1 && cadences.every((c) => c.unit === 'month' && c.count === 1)) {
		const days = [...new Set(cadences.map((c) => c.startDate.day))].sort((a, b) => a - b);
		return `Monthly on the ${list.format(days.map(ordinal))}`;
	}
	const parts = cadences.map(describeCadence);
	return list.format(parts.map((p, i) => (i === 0 ? p : p[0].toLowerCase() + p.slice(1))));
}

/** True when a monthly or yearly cadence starts on a day some months don't have (29th–31st). */
export function clampsInShortMonths(c: Cadence): boolean {
	return (
		(c.unit === 'month' && c.startDate.day > 28) ||
		(c.unit === 'year' && c.startDate.month === 2 && c.startDate.day === 29)
	);
}

/** Average charges per month, for a rough monthly total. */
export function chargesPerMonth({ count, unit }: Cadence): number {
	const perMonth = { day: 365.25 / 12, week: 365.25 / 12 / 7, month: 1, year: 1 / 12 }[unit];
	return perMonth / count;
}

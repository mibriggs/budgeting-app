// Date ranges for the transactions page, kept in the URL:
//   (none) or ?range=month      this month
//   ?range=3m | 6m | 12m        this month plus the previous 2 / 5 / 11 months
//   ?range=custom&from=YYYY-MM-DD&to=YYYY-MM-DD
// Month-based ranges always cover whole months, so totals line up with monthly limits.

import { Temporal, type PlainDate } from '#lib/dates.ts';

export const RANGE_PRESETS = [
	{ value: 'month', label: 'This month', months: 1 },
	{ value: '3m', label: 'Last 3 months', months: 3 },
	{ value: '6m', label: 'Last 6 months', months: 6 },
	{ value: '12m', label: 'Last 12 months', months: 12 }
] as const;

export type RangePreset = (typeof RANGE_PRESETS)[number]['value'];

export type DateRange = {
	preset: RangePreset | 'custom';
	from: PlainDate;
	to: PlainDate;
	/** Set when the URL asked for something invalid and the default was used instead. */
	error?: string;
};

export function resolveRange(params: URLSearchParams, today: PlainDate): DateRange {
	const range = params.get('range') ?? 'month';

	if (range === 'custom') {
		const from = parseDate(params.get('from'));
		const to = parseDate(params.get('to'));
		if (!from || !to) {
			return { ...presetRange('month', today), error: 'Pick a valid start and end date.' };
		}
		// Accept a reversed range rather than showing an error.
		return Temporal.PlainDate.compare(from, to) <= 0
			? { preset: 'custom', from, to }
			: { preset: 'custom', from: to, to: from };
	}

	const preset = RANGE_PRESETS.find((p) => p.value === range);
	return preset ? presetRange(preset.value, today) : presetRange('month', today);
}

function presetRange(value: RangePreset, today: PlainDate): DateRange {
	const { months } = RANGE_PRESETS.find((p) => p.value === value)!;
	const startOfThisMonth = today.with({ day: 1 });
	return {
		preset: value,
		from: startOfThisMonth.subtract({ months: months - 1 }),
		to: startOfThisMonth.add({ months: 1 }).subtract({ days: 1 })
	};
}

function parseDate(value: string | null): PlainDate | null {
	if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
	try {
		return Temporal.PlainDate.from(value, { overflow: 'reject' });
	} catch {
		return null;
	}
}

/**
 * Query params (for `updateQuery`) that show the month containing `date` on the transactions
 * page: the default "This month" when it's the current month, otherwise a custom range for it.
 */
export function monthRangeParams(
	date: PlainDate,
	today: PlainDate
): Record<'range' | 'from' | 'to', string | null> {
	if (date.year === today.year && date.month === today.month) {
		return { range: null, from: null, to: null };
	}
	const start = date.with({ day: 1 });
	return {
		range: 'custom',
		from: start.toString(),
		to: start.add({ months: 1 }).subtract({ days: 1 }).toString()
	};
}

/** "November 2026", or "November" with `{ year: false }`. */
export function formatMonth(month: Temporal.PlainYearMonth, { year = true } = {}): string {
	return new Intl.DateTimeFormat('en-US', {
		month: 'long',
		year: year ? 'numeric' : undefined,
		timeZone: 'UTC'
	}).format(new Date(Date.UTC(month.year, month.month - 1, 1)));
}

/** "Nov 1 – 30, 2026" style label for a range. */
export function formatRange({ from, to }: Pick<DateRange, 'from' | 'to'>): string {
	const format = new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		timeZone: 'UTC'
	});
	return format.formatRange(toUtcDate(from), toUtcDate(to));
}

/** "Nov 10, 2026" */
export function formatDate(date: PlainDate): string {
	return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "01/31/2026" */
export function formatNumericDate(date: PlainDate): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${pad(date.month)}/${pad(date.day)}/${date.year}`;
}

function toUtcDate(date: PlainDate) {
	return new Date(Date.UTC(date.year, date.month - 1, date.day));
}

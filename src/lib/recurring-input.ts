// What Settings → Recurring sends when you save a recurring expense: the whole item as JSON in
// one form field (it has a variable number of cadences). Checked here; shared by the page (for
// types) and the server (which trusts nothing from the browser).

import { Temporal, type PlainDate } from '#lib/dates.ts';
import { INTERVAL_UNITS, MAX_INTERVAL, type IntervalUnit } from '#lib/recurring-schedule.ts';
import { MAX_NAME_LENGTH, MAX_NOTES_LENGTH, parseAmount } from '#lib/transaction-input.ts';

/** The form field holding the JSON. */
export const RECURRING_FIELD = 'recurring';
/** Most cadences one recurring expense can have. */
export const MAX_CADENCES = 10;

/** As sent by the page (strings for dates and the amount, as typed or picked). */
export type RecurringPayload = {
	id: string | null;
	name: string;
	amount: string;
	categoryId: string;
	cadences: { id: string | null; startDate: string; count: number; unit: string }[];
	endDate: string | null;
	paused: boolean;
	remindAtMinutes: number;
	notes: string;
};

/** Checked and converted. */
export type RecurringInput = {
	id: string | null;
	name: string;
	amountCents: number;
	categoryId: string;
	cadences: { id: string | null; startDate: PlainDate; count: number; unit: IntervalUnit }[];
	endDate: PlainDate | null;
	paused: boolean;
	remindAtMinutes: number;
	notes: string | null;
};

export type RecurringField = 'name' | 'amount' | 'category' | 'cadences' | 'end' | 'notes' | 'form';
export type RecurringErrors = Partial<Record<RecurringField, string>>;

const isString = (v: unknown): v is string => typeof v === 'string';

function toDate(s: unknown): PlainDate | null {
	if (!isString(s) || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
	try {
		return Temporal.PlainDate.from(s, { overflow: 'reject' });
	} catch {
		return null;
	}
}

/** Reads and checks the JSON from the form. */
export function parseRecurring(
	text: unknown
): { input: RecurringInput } | { errors: RecurringErrors } {
	let raw: Record<string, unknown>;
	try {
		raw = JSON.parse(isString(text) ? text : '') as Record<string, unknown>;
		if (typeof raw !== 'object' || raw === null) throw new Error();
	} catch {
		return { errors: { form: 'Something went wrong. Reload the page and try again.' } };
	}

	const errors: RecurringErrors = {};
	const id = isString(raw.id) && raw.id ? raw.id : null;

	const name = isString(raw.name) ? raw.name.trim() : '';
	if (!name) errors.name = 'Enter a name.';
	else if (name.length > MAX_NAME_LENGTH)
		errors.name = `Keep it under ${MAX_NAME_LENGTH} characters.`;

	const amountCents = isString(raw.amount) ? parseAmount(raw.amount) : null;
	if (amountCents === null) errors.amount = 'Enter an amount above $0, like 15.49.';

	const categoryId = isString(raw.categoryId) ? raw.categoryId : '';
	if (!categoryId) errors.category = 'Pick a category.';

	const cadences: RecurringInput['cadences'] = [];
	const rawCadences = Array.isArray(raw.cadences) ? raw.cadences : [];
	if (rawCadences.length === 0) errors.cadences = 'Add at least one cadence.';
	else if (rawCadences.length > MAX_CADENCES)
		errors.cadences = `Use at most ${MAX_CADENCES} cadences.`;
	for (const c of rawCadences as Record<string, unknown>[]) {
		const startDate = toDate(c?.startDate);
		const count = c?.count;
		const unit = c?.unit;
		if (!startDate) {
			errors.cadences ??= 'Pick a start date for each cadence.';
			continue;
		}
		if (
			typeof count !== 'number' ||
			!Number.isInteger(count) ||
			count < 1 ||
			count > MAX_INTERVAL
		) {
			errors.cadences ??= `Repeat every 1 to ${MAX_INTERVAL}.`;
			continue;
		}
		if (!INTERVAL_UNITS.includes(unit as IntervalUnit)) {
			errors.cadences ??= 'Pick days, weeks, months or years.';
			continue;
		}
		cadences.push({
			id: isString(c.id) && c.id ? c.id : null,
			startDate,
			count,
			unit: unit as IntervalUnit
		});
	}

	let endDate: PlainDate | null = null;
	if (raw.endDate !== null && raw.endDate !== undefined && raw.endDate !== '') {
		endDate = toDate(raw.endDate);
		if (!endDate) errors.end = 'Pick an end date.';
		else if (cadences.some((c) => Temporal.PlainDate.compare(endDate!, c.startDate) < 0))
			errors.end = 'The end date can’t be before a start date.';
	}

	const remindAtMinutes = raw.remindAtMinutes;
	if (
		typeof remindAtMinutes !== 'number' ||
		!Number.isInteger(remindAtMinutes) ||
		remindAtMinutes < 0 ||
		remindAtMinutes > 1439
	)
		errors.form = 'Pick a reminder time.';

	const notes = isString(raw.notes) ? raw.notes.trim() : '';
	if (notes.length > MAX_NOTES_LENGTH)
		errors.notes = `Keep notes under ${MAX_NOTES_LENGTH} characters.`;

	if (Object.keys(errors).length > 0) return { errors };
	return {
		input: {
			id,
			name,
			amountCents: amountCents!,
			categoryId,
			cadences,
			endDate,
			paused: raw.paused === true,
			remindAtMinutes: remindAtMinutes as number,
			notes: notes || null
		}
	};
}

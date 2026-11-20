// Payment methods: rules and helpers shared by the browser and the server (Settings → Payment
// Methods, and "Paid with" on the add-expense form).

import { Temporal, type PlainDate } from '#lib/dates.ts';
import { parseAmount } from '#lib/transaction-input.ts';

export type PaymentMethodKind = 'credit' | 'debit' | 'p2p' | 'cash';
/** Kinds a user can add; Cash is built in. */
export type AddableKind = Exclude<PaymentMethodKind, 'cash'>;
export const ADDABLE_KINDS: AddableKind[] = ['credit', 'debit', 'p2p'];
export const isAddableKind = (value: unknown): value is AddableKind =>
	ADDABLE_KINDS.includes(value as AddableKind);

export const PAYMENT_METHOD_NAME_MAX = 40;
/** Due-date reminders go out at noon unless the card says otherwise. */
export const DEFAULT_REMIND_AT_MINUTES = 12 * 60;

export const KIND_LABEL: Record<PaymentMethodKind, string> = {
	credit: 'Credit card',
	debit: 'Debit card',
	p2p: 'Pay app',
	cash: 'Cash'
};

/** What the browser shows for a method in lists and pickers. */
export type PaymentMethodOption = {
	id: string;
	kind: PaymentMethodKind;
	name: string;
	last4: string | null;
	/** Credit cards: day of the month the statement closes, if known. */
	closingDay: number | null;
};

export type PaymentMethodInput = {
	kind: AddableKind;
	name: string;
	last4: string | null;
	limitCents: number | null;
	closingDay: number | null;
	dueDay: number | null;
	/** When the due-date reminders go out, in minutes after midnight (noon unless set). */
	remindAtMinutes: number;
};
export type PaymentMethodField = 'kind' | 'name' | 'last4' | 'limit' | 'closingDay' | 'dueDay';
export type PaymentMethodErrors = Partial<Record<PaymentMethodField, string>>;

function parseDay(raw: string): number | null | undefined {
	if (!raw) return null;
	const day = Number(raw);
	return Number.isInteger(day) && day >= 1 && day <= 31 ? day : undefined;
}

/**
 * Checks the add/edit form. Fields that don't apply to the kind (a limit on a debit card, last 4
 * digits on a pay app) are dropped rather than refused, since the form hides them.
 */
export function parsePaymentMethod(raw: {
	kind: string;
	name: string;
	last4: string;
	limit: string;
	closingDay: string;
	dueDay: string;
	/** Hour of the day, "0"–"23"; only used for a credit card with a due date. */
	remindHour?: string;
}): { value: PaymentMethodInput } | { errors: PaymentMethodErrors } {
	const errors: PaymentMethodErrors = {};
	const kind = raw.kind;
	if (!isAddableKind(kind)) return { errors: { kind: 'Pick a type.' } };

	const name = raw.name.trim().replace(/\s+/g, ' ');
	if (!name) errors.name = 'Give it a name.';
	else if (name.length > PAYMENT_METHOD_NAME_MAX)
		errors.name = `Keep it under ${PAYMENT_METHOD_NAME_MAX} characters.`;

	const card = kind === 'credit' || kind === 'debit';
	const credit = kind === 'credit';

	const last4 = card ? raw.last4.trim() : '';
	if (last4 && !/^\d{4}$/.test(last4)) errors.last4 = 'Just the last 4 digits.';

	const limitText = credit ? raw.limit.trim() : '';
	const limitCents = limitText ? parseAmount(limitText) : null;
	if (limitText && limitCents === null) errors.limit = 'Enter an amount, like 5000.';

	const closingDay = credit ? parseDay(raw.closingDay.trim()) : null;
	if (closingDay === undefined) errors.closingDay = 'Pick a date.';
	const dueDay = credit ? parseDay(raw.dueDay.trim()) : null;
	if (dueDay === undefined) errors.dueDay = 'Pick a date.';

	// Any other value (or none) means the default, noon.
	const hourText = raw.remindHour?.trim() ?? '';
	const hour = hourText === '' ? NaN : Number(hourText);
	const remindAtMinutes =
		credit && dueDay && Number.isInteger(hour) && hour >= 0 && hour <= 23
			? hour * 60
			: DEFAULT_REMIND_AT_MINUTES;

	if (Object.keys(errors).length > 0) return { errors };
	return {
		value: {
			kind,
			name,
			last4: last4 || null,
			limitCents,
			closingDay: closingDay ?? null,
			dueDay: dueDay ?? null,
			remindAtMinutes
		}
	};
}

/** `day` of the given month, or the month's last day when it's shorter (31st → Feb 28). */
function onDay(month: Temporal.PlainYearMonth, day: number): PlainDate {
	return month.toPlainDate({ day: Math.min(day, month.daysInMonth) });
}

/** The first date on or after `from` that falls on `day` of its month (clamped as above). */
export function nextOnDay(from: PlainDate, day: number): PlainDate {
	const month = from.toPlainYearMonth();
	const here = onDay(month, day);
	return Temporal.PlainDate.compare(here, from) >= 0 ? here : onDay(month.add({ months: 1 }), day);
}

/** "•• 4821" for cards with last 4 digits. */
export const last4Label = (last4: string | null) => (last4 ? `•• ${last4}` : '');

/**
 * A credit card's billing dates around `today`, from its closing day (and due day, if known).
 * - The current cycle runs from the day after the last closing date up to the next one; on a
 *   closing day, that day is the last of the current cycle.
 * - The last statement is the cycle before it; its payment is due on the first due day after it
 *   closed (US cards: usually 21–25 days later, so the following month).
 */
export function cardCycle(today: PlainDate, closingDay: number, dueDay: number | null) {
	const closesOn = nextOnDay(today, closingDay);
	const month = closesOn.toPlainYearMonth();
	const lastClosed = onDay(month.subtract({ months: 1 }), closingDay);
	const closedBefore = onDay(month.subtract({ months: 2 }), closingDay);
	return {
		cycle: { from: lastClosed.add({ days: 1 }), closesOn },
		statement: {
			from: closedBefore.add({ days: 1 }),
			to: lastClosed,
			dueOn: dueDay ? nextOnDay(lastClosed.add({ days: 1 }), dueDay) : null
		},
		/** When the current cycle's own bill will be due. */
		nextDueOn: dueDay ? nextOnDay(closesOn.add({ days: 1 }), dueDay) : null
	};
}

/** Share of a credit limit at or above which the bar turns amber (a common rule of thumb). */
export const UTILIZATION_WARN = 0.3;

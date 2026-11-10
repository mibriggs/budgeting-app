// Parsing and limits for the add expense / add income form. Shared by the form (hints) and the
// server action (the real check). The database enforces the same rules as a last line of defence.

import { Temporal, type PlainDate } from '#lib/dates.ts';

export const MAX_NAME_LENGTH = 120;
export const MAX_NOTES_LENGTH = 1000;
/** $99,999,999.99 — far beyond any real entry, but keeps sums well inside safe integers. */
export const MAX_AMOUNT_CENTS = 9_999_999_999;

/**
 * Dollars as typed ("12", "12.5", "$1,234.56") → whole cents (1200, 1250, 123456).
 * Returns null for anything else: negatives, more than two decimals, letters, zero.
 * Works on the digits directly, so there's no floating-point rounding.
 */
export function parseAmount(input: string): number | null {
	const cleaned = input.trim().replace(/^\$/, '').replaceAll(',', '').trim();
	// Digits, optionally a dot and up to two more; at least one digit somewhere (".5", "12." are fine).
	const match = /^(?=.*\d)(\d*)(?:\.(\d{0,2}))?$/.exec(cleaned);
	if (!match) return null;
	const cents = Number(match[1] || 0) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
	return cents > 0 && cents <= MAX_AMOUNT_CENTS ? cents : null;
}

/** "YYYY-MM-DD" → PlainDate, or null if it isn't a real date (e.g. 2026-02-30). */
export function parseDate(input: string): PlainDate | null {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
	try {
		return Temporal.PlainDate.from(input, { overflow: 'reject' });
	} catch {
		return null;
	}
}

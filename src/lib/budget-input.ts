// Parsing for the budget (monthly limit) boxes in Settings → Budgets. Shared by the page (to
// flag bad input and count changes) and the save action (the real check).

import { MAX_AMOUNT_CENTS, parseAmount } from '#lib/transaction-input.ts';

/**
 * What's typed in a limit box → whole cents, null for an empty box (no limit), or 'invalid'.
 * Unlike transaction amounts, $0 is allowed: "spend nothing on this".
 */
export function parseLimit(input: string): number | null | 'invalid' {
	const text = input.trim();
	if (text === '') return null;
	// "0", "$0", "0.00": parseAmount rejects zero, so handle it here.
	if (/^\$?\s*0*(\.0{0,2})?$/.test(text) && /\d/.test(text)) return 0;
	const cents = parseAmount(text);
	return cents === null || cents > MAX_AMOUNT_CENTS ? 'invalid' : cents;
}

/** Form field name for one category's limit box. */
export const limitField = (categoryId: string) => `limit:${categoryId}`;

/** Form field name for one category's "everyday" switch ("1" on, "0" off). */
export const everydayField = (categoryId: string) => `everyday:${categoryId}`;

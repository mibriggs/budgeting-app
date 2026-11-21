// Sketch of the quick-add parser for the inbox mock. Reads one message (a pasted or forwarded
// bank alert, or a typed shorthand like "5.06 apple card snacks") into a pending expense.
// No model: regex for the known bank formats, a tiny grammar for shorthand. Runs in the browser
// here; the real one would run on the server and use the user's own rules and history.

import { Temporal, type PlainDate } from '#lib/dates.ts';
import type { MerchantRule, MockCategory, MockPaymentMethod } from './+page.server';

export type ParseContext = {
	categories: MockCategory[];
	paymentMethods: MockPaymentMethod[];
	rules: MerchantRule[];
	today: PlainDate;
};

export type Parsed =
	| {
			ok: true;
			source: 'Chase alert' | 'Discover alert' | 'Typed';
			amountCents: number;
			date: PlainDate;
			name: string;
			paymentMethodId: string | null;
			/** Category IDs, best guess first, then the rest in the user's usual order. */
			suggestions: string[];
			/** How the first suggestion was found: a saved merchant rule (trusted), a keyword in
			 *  the text (a guess), or nothing (just the user's usual order). */
			categoryFrom: 'rule' | 'keyword' | null;
	  }
	| { ok: false; reason: string };

/** Largest amount accepted, so a stray number can't become a huge expense. */
const MAX_CENTS = 10_000_00;
const MONEY = String.raw`\$?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?`;
const DATE = String.raw`([A-Za-z]{3,9}\.? \d{1,2}, \d{4})`;

// "Chase Sapphire Preferred Visa: You made a $2 transaction with STAR OSCO 3588 on Nov 20, 2026 at 8:03 PM ET."
const CHASE = new RegExp(
	String.raw`^(.+?): You made a ${MONEY} transaction with (.+?) on ${DATE}(?: at [^.]*)?\.?\s*$`,
	'i'
);
// "Discover Card Alert: A transaction of $10.61 at STAR OSCO 3588 on November 20, 2026. No Action needed. ..."
const DISCOVER = new RegExp(
	String.raw`^Discover Card Alert: A transaction of ${MONEY} at (.+?) on ${DATE}`,
	'i'
);
// Starts like a bank alert but isn't a purchase we know (statements, payments, refunds...).
const BANKISH = /^(chase|discover)\b.*:/i;

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Strip control characters, collapse whitespace, cap the length. */
export function clean(text: string): string {
	return (
		text
			// eslint-disable-next-line no-control-regex
			.replace(/[\u0000-\u001f\u007f]/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, 1000)
	);
}

function toCents(whole: string, fraction = ''): number {
	return Number(whole.replaceAll(',', '')) * 100 + Number(fraction.padEnd(2, '0'));
}

/** "Nov 20, 2026" or "November 20, 2026" → a date, or null if it isn't a real one. */
function monthDayYear(text: string): PlainDate | null {
	const m = text.match(/^([A-Za-z]{3})[a-z]*\.? (\d{1,2}), (\d{4})$/);
	if (!m) return null;
	const month = MONTHS.indexOf(m[1].toLowerCase()) + 1;
	if (!month) return null;
	try {
		return Temporal.PlainDate.from(
			{ year: Number(m[3]), month, day: Number(m[2]) },
			{ overflow: 'reject' }
		);
	} catch {
		return null;
	}
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The payment method a piece of text names, longest alias first ("apple card" before "apple"). */
function findMethod(text: string, methods: MockPaymentMethod[]) {
	const aliases = methods
		.flatMap((m) => m.aliases.map((alias) => ({ id: m.id, alias })))
		.sort((a, b) => b.alias.length - a.alias.length);
	for (const { id, alias } of aliases) {
		const re = new RegExp(String.raw`\b${escape(alias)}\b`, 'i');
		if (re.test(text)) return { id, re };
	}
	return null;
}

/** "SQ *BLUE BOTTLE 0412" → "BLUE BOTTLE": drops payment-processor prefixes and store numbers. */
function normalizeMerchant(raw: string): string {
	return raw
		.toUpperCase()
		.replace(/^(SQ|TST|SP|PY|PAYPAL)\s?\*\s*/, '')
		.replace(/\s*#?\d{2,}\s*$/, '')
		.trim();
}

const titleCase = (s: string) =>
	s
		.toLowerCase()
		.replace(/(^|[\s'-])([a-z])/g, (_, gap: string, c: string) => gap + c.toUpperCase());

function suggest(
	text: string,
	ctx: ParseContext
): { name: string | null; suggestions: string[]; categoryFrom: 'rule' | 'keyword' | null } {
	const upper = text.toUpperCase();
	const rule = ctx.rules.find((r) => upper.includes(r.match));
	const keyword = rule
		? undefined
		: ctx.categories.find((c) =>
				c.keywords.some((k) => new RegExp(String.raw`\b${escape(k)}`, 'i').test(text))
			);
	const first = rule?.categoryId ?? keyword?.id;
	const rest = ctx.categories.map((c) => c.id).filter((id) => id !== first);
	return {
		name: rule?.name ?? null,
		suggestions: first ? [first, ...rest] : rest,
		categoryFrom: rule ? 'rule' : keyword ? 'keyword' : null
	};
}

export function parseMessage(input: string, ctx: ParseContext): Parsed {
	const text = clean(input);
	if (!text) return { ok: false, reason: 'The message is empty.' };

	const chase = text.match(CHASE);
	const discover = chase ? null : text.match(DISCOVER);
	const bank = chase
		? {
				source: 'Chase alert' as const,
				card: chase[1],
				whole: chase[2],
				frac: chase[3],
				merchant: chase[4],
				date: chase[5]
			}
		: discover
			? {
					source: 'Discover alert' as const,
					card: 'discover',
					whole: discover[1],
					frac: discover[2],
					merchant: discover[3],
					date: discover[4]
				}
			: null;

	if (bank) {
		const amountCents = toCents(bank.whole, bank.frac);
		const date = monthDayYear(bank.date);
		if (!date) return { ok: false, reason: `"${bank.date}" isn't a date CentJar can read.` };
		if (amountCents <= 0 || amountCents > MAX_CENTS)
			return { ok: false, reason: 'The amount is zero or too large.' };
		const merchant = normalizeMerchant(bank.merchant);
		const s = suggest(merchant, ctx);
		return {
			ok: true,
			source: bank.source,
			amountCents,
			date,
			name: s.name ?? titleCase(merchant),
			paymentMethodId: findMethod(bank.card, ctx.paymentMethods)?.id ?? null,
			suggestions: s.suggestions,
			categoryFrom: s.categoryFrom
		};
	}

	if (BANKISH.test(text))
		return {
			ok: false,
			reason: 'It looks like a bank alert, but not a purchase CentJar knows how to read.'
		};

	// Shorthand: an amount, optionally a card and "today"/"yesterday", and what it was for.
	let rest = ` ${text} `;
	let date = ctx.today;
	rest = rest.replace(/\b(yesterday|today)\b/i, (word) => {
		if (word.toLowerCase() === 'yesterday') date = date.subtract({ days: 1 });
		return ' ';
	});
	const money = rest.match(new RegExp(String.raw`\s${MONEY}(?=[\s,;])`));
	if (!money)
		return { ok: false, reason: 'No amount found. Try something like "5.06 apple card snacks".' };
	const amountCents = toCents(money[1], money[2]);
	if (amountCents <= 0 || amountCents > MAX_CENTS)
		return { ok: false, reason: 'The amount is zero or too large.' };
	rest = rest.replace(money[0], ' ');

	const method = findMethod(rest, ctx.paymentMethods);
	if (method) rest = rest.replace(method.re, ' ');

	const description = rest
		.replace(/[,;]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/^(at|on|for)\s+/i, '');
	const s = suggest(description, ctx);
	const name = s.name ?? (description ? description[0].toUpperCase() + description.slice(1) : '');

	return {
		ok: true,
		source: 'Typed',
		amountCents,
		date,
		name: name || 'Untitled',
		paymentMethodId: method?.id ?? null,
		suggestions: s.suggestions,
		categoryFrom: s.categoryFrom
	};
}

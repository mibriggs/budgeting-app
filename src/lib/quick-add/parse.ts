// Quick add, step one: read a pasted bank alert or a typed note into a proposed expense, without a
// model. Handles the bank alert formats below and shorthand like "5.06 apple card snacks" or
// "12 lunch yesterday". Anything else returns `needsModel` (the Claude fallback isn't built yet).
//
// Runs in the browser with what the home page already has: the user's expense categories, payment
// methods and today's date in their time zone. The result is checked with `proposedExpenseSchema`,
// which also makes sure any category or payment method belongs to this user.

import { z } from 'zod';
import { Temporal, type PlainDate } from '#lib/dates.ts';
import type { PaymentMethodOption } from '#lib/payment-methods.ts';
import { CARD_ISSUERS, CARD_NETWORKS, PAY_APPS } from './cards.ts';
import { CATEGORY_HINTS, MERCHANT_NAMES, PHARMACY_CATEGORY_WORDS } from './merchants.ts';

export type QuickAddContext = {
	categories: { id: string; name: string }[];
	paymentMethods: PaymentMethodOption[];
	today: PlainDate;
};

/** Largest amount accepted ($100,000), so a stray number can't become a huge expense. */
export const MAX_CENTS = 10_000_000;

export const SOURCES = ['chase-alert', 'discover-alert', 'shorthand'] as const;

/** A proposed expense, checked against this user's own categories and payment methods. */
export function proposedExpenseSchema(ctx: QuickAddContext) {
	const categoryIds = new Set(ctx.categories.map((c) => c.id));
	const methodIds = new Set(ctx.paymentMethods.map((m) => m.id));
	return z.object({
		source: z.enum(SOURCES),
		name: z.string().trim().min(1).max(100),
		amountCents: z.number().int().positive().max(MAX_CENTS),
		date: z.iso.date(),
		paymentMethodId: z
			.string()
			.nullable()
			.refine((id) => id === null || methodIds.has(id), 'Not one of your payment methods'),
		categoryId: z
			.string()
			.nullable()
			.refine((id) => id === null || categoryIds.has(id), 'Not one of your categories'),
		/** How the payment method was found, for checking the parser's work. */
		paymentMatchedBy: z.enum(['last4', 'name', 'card', 'pay-app']).nullable(),
		/** How the category was found: one of the user's category names, or a common word. */
		categoryMatchedBy: z.enum(['name', 'keyword']).nullable(),
		/** The merchant exactly as the bank wrote it ("STAR OSCO 3588"); null for shorthand. */
		merchantRaw: z.string().nullable()
	});
}

export type ProposedExpense = z.infer<ReturnType<typeof proposedExpenseSchema>>;

export type ParseResult =
	{ ok: true; expense: ProposedExpense } | { ok: false; needsModel: true; reason: string };

// -------------------------------------------------------------------------------------------------
// Helpers

const MONEY = String.raw`\$?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?`;
const MONTH_DAY_YEAR = String.raw`([A-Za-z]{3,9}\.? \d{1,2}, \d{4})`;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Strip control characters, collapse whitespace (copied alerts often wrap), cap the length. */
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

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Case-insensitive, whole-word match for a phrase. */
const wordRe = (phrase: string) => new RegExp(String.raw`(?<![\w])${escape(phrase)}(?![\w])`, 'i');

function toCents(whole: string, fraction = ''): number {
	return Number(whole.replaceAll(',', '')) * 100 + Number(fraction.padEnd(2, '0'));
}

/** "Nov 20, 2026" or "November 20, 2026" → a date; null if it isn't a real one. */
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

/** "SQ *BLUE BOTTLE 0412" → "BLUE BOTTLE", "NETFLIX.COM" → "NETFLIX": drops payment-processor
 *  prefixes, web suffixes and store numbers. */
function normalizeMerchant(raw: string): string {
	return raw
		.toUpperCase()
		.replace(/^(SQ|TST|SP|PY|PAYPAL|DD|IC)\s?\*\s*/, '')
		.replace(/\s*#?\d{2,}\s*$/, '')
		.replace(/\.(COM|NET|ORG|IO)\b/g, '')
		.trim();
}

/** The everyday brand name for a merchant ("STAR OSCO" → "Star Market"), if it's a known one. */
function brandName(merchant: string): string | null {
	return (
		MERCHANT_NAMES.find((m) => m.match.some((alias) => wordRe(alias).test(merchant)))?.name ?? null
	);
}

const titleCase = (s: string) =>
	s
		.toLowerCase()
		.replace(/(^|[\s'&-])([a-z])/g, (_, gap: string, c: string) => gap + c.toUpperCase());

// -------------------------------------------------------------------------------------------------
// Payment method

type Mention = { issuer?: string; product?: string; network?: string; payApp?: string };
type Found = { mention: Mention; spans: string[] };

/** The longest alias in `options` that appears in `text`. */
function longestAlias<T>(text: string, options: { value: T; aliases: string[] }[]) {
	let best: { value: T; alias: string } | null = null;
	for (const { value, aliases } of options)
		for (const alias of aliases)
			if ((!best || alias.length > best.alias.length) && wordRe(alias).test(text))
				best = { value, alias };
	return best;
}

/** Which issuer, card name, network and pay app a piece of text mentions. */
function mentions(text: string): Found {
	const found: Found = { mention: {}, spans: [] };
	const issuer = longestAlias(
		text,
		CARD_ISSUERS.map((i) => ({ value: i.name, aliases: i.aliases }))
	);
	const product = longestAlias(
		text,
		CARD_ISSUERS.flatMap((i) => i.products.map((p) => ({ value: p.name, aliases: p.aliases })))
	);
	const network = longestAlias(
		text,
		CARD_NETWORKS.map((n) => ({ value: n.name, aliases: n.aliases }))
	);
	const payApp = longestAlias(
		text,
		PAY_APPS.map((a) => ({ value: a.name, aliases: a.aliases }))
	);
	for (const [key, hit] of [
		['issuer', issuer],
		['product', product],
		['network', network],
		['payApp', payApp]
	] as const) {
		if (!hit) continue;
		found.mention[key] = hit.value;
		found.spans.push(hit.alias);
	}
	return found;
}

/** Card names share a word: "Sapphire Preferred" and "Sapphire" (generic) count as related. */
function sameProduct(a: string, b: string) {
	const x = a.toLowerCase();
	const y = b.toLowerCase();
	return x === y ? 2 : x.includes(y) || y.includes(x) ? 1 : 0;
}

/**
 * Which of the user's payment methods `text` means, and the words that said so (to take out of a
 * shorthand's description). Tried in order: the last 4 digits, the method's own name, then the
 * issuer / card name / network / pay app it shares with the text. Null when nothing matches or two
 * methods match equally well.
 */
function matchPaymentMethod(
	text: string,
	methods: PaymentMethodOption[]
): { id: string; by: 'last4' | 'name' | 'card' | 'pay-app'; spans: string[] } | null {
	const digits = text.match(/(?:ending(?: in)?|x|\*|…|\.{3})\s?(\d{4})\b/i)?.[1];
	if (digits) {
		const byDigits = methods.filter((m) => m.last4 === digits);
		if (byDigits.length === 1) return { id: byDigits[0].id, by: 'last4', spans: [] };
	}

	const byName = methods
		.filter((m) => wordRe(m.name).test(text))
		.sort((a, b) => b.name.length - a.name.length);
	if (byName.length) return { id: byName[0].id, by: 'name', spans: [byName[0].name] };

	const inText = mentions(text);
	const { issuer, product, network, payApp } = inText.mention;
	if (!issuer && !product && !network && !payApp) return null;

	const scored = methods
		.map((m) => {
			const own = mentions(m.name).mention;
			let score = 0;
			if (payApp && own.payApp === payApp) score += 4;
			if (product && own.product) score += 2 * sameProduct(product, own.product);
			if (issuer && own.issuer === issuer) score += 2;
			if (network && own.network === network) score += 1;
			return { m, score };
		})
		.filter((s) => s.score > 0)
		.sort((a, b) => b.score - a.score);
	if (!scored.length || scored[1]?.score === scored[0].score) return null;
	const by = payApp && mentions(scored[0].m.name).mention.payApp === payApp ? 'pay-app' : 'card';
	return { id: scored[0].m.id, by, spans: inText.spans };
}

// -------------------------------------------------------------------------------------------------
// Category

/** A category for `text`: one whose name it mentions, else one a common word points to. */
function matchCategory(
	text: string,
	categories: { id: string; name: string }[]
): { id: string; by: 'name' | 'keyword' } | null {
	const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
	const stem = (w: string) => w.replace(/(ies|es|s)$/, '');

	// A grocery store that could also count as a pharmacy ("STAR OSCO", "JEWEL OSCO PHARMACY")
	// defaults to groceries, even if a pharmacy or health category name matches below.
	const groceryHint = CATEGORY_HINTS.find((h) => h.names.includes('grocer'));
	const pharmacyLike = (name: string) =>
		PHARMACY_CATEGORY_WORDS.some((w) => name.toLowerCase().includes(w));
	const grocery = groceryHint?.words.some((h) => wordRe(h).test(text))
		? categories.find((c) => groceryHint.names.some((n) => c.name.toLowerCase().includes(n)))
		: undefined;

	for (const c of categories) {
		const nameWords = (c.name.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => w.length >= 3);
		if (nameWords.some((n) => words.some((w) => w.length >= 3 && stem(w) === stem(n)))) {
			if (grocery && pharmacyLike(c.name)) return { id: grocery.id, by: 'keyword' };
			return { id: c.id, by: 'name' };
		}
	}
	for (const hint of CATEGORY_HINTS) {
		if (!hint.words.some((h) => wordRe(h).test(text))) continue;
		// The hint's names in order of preference: "subscription" before "entertainment".
		for (const n of hint.names) {
			const c = categories.find((c) => c.name.toLowerCase().includes(n));
			if (c) return { id: c.id, by: 'keyword' };
		}
	}
	return null;
}

// -------------------------------------------------------------------------------------------------
// Formats

// "Chase Sapphire Preferred Visa: You made a $2 transaction with STAR OSCO 3588 on Nov 20, 2026 at 8:03 PM ET."
const CHASE = new RegExp(
	String.raw`^(.+?): You made a ${MONEY} transaction with (.+?) on ${MONTH_DAY_YEAR}(?: at [^.]*)?\.?\s*$`,
	'i'
);
// "Discover Card Alert: A transaction of $10.61 at STAR OSCO 3588 on November 20, 2026. No Action needed. ..."
const DISCOVER = new RegExp(
	String.raw`^Discover Card Alert: A transaction of ${MONEY} at (.+?) on ${MONTH_DAY_YEAR}`,
	'i'
);
/** Starts like a bank alert ("Chase …:", "Discover Card Alert:") but isn't a purchase we know. */
const BANK_LIKE = new RegExp(
	String.raw`^(?:${CARD_ISSUERS.flatMap((i) => i.aliases)
		.map(escape)
		.join('|')})\b[^:]{0,60}:`,
	'i'
);

function fromBankAlert(
	source: 'chase-alert' | 'discover-alert',
	cardText: string,
	whole: string,
	fraction: string | undefined,
	merchantRaw: string,
	dateText: string,
	ctx: QuickAddContext
): ParseResult {
	const date = monthDayYear(dateText);
	if (!date)
		return { ok: false, needsModel: true, reason: `Couldn't read the date "${dateText}".` };
	const merchant = normalizeMerchant(merchantRaw);
	const method = matchPaymentMethod(cardText, ctx.paymentMethods);
	const category = matchCategory(merchant, ctx.categories);
	return {
		ok: true,
		expense: {
			source,
			name: brandName(merchant) ?? (titleCase(merchant) || merchantRaw.trim()),
			amountCents: toCents(whole, fraction),
			date: date.toString(),
			paymentMethodId: method?.id ?? null,
			categoryId: category?.id ?? null,
			paymentMatchedBy: method?.by ?? null,
			categoryMatchedBy: category?.by ?? null,
			merchantRaw: merchantRaw.trim()
		}
	};
}

/** "5.06 apple card snacks", "$12 lunch yesterday", "18.50 venmo dinner 11/18". */
function fromShorthand(text: string, ctx: QuickAddContext): ParseResult {
	let rest = ` ${text} `;
	let date = ctx.today;

	// A date first, so "11/18" isn't read as an amount.
	rest = rest.replace(/\b(yesterday|today)\b/i, (word) => {
		if (word.toLowerCase() === 'yesterday') date = ctx.today.subtract({ days: 1 });
		return ' ';
	});
	const slash = rest.match(/\s(\d{1,2})\/(\d{1,2})(?=[\s,;])/);
	if (slash) {
		try {
			let d = Temporal.PlainDate.from(
				{ year: ctx.today.year, month: Number(slash[1]), day: Number(slash[2]) },
				{ overflow: 'reject' }
			);
			// A date later this year most likely means last year.
			if (Temporal.PlainDate.compare(d, ctx.today) > 0) d = d.subtract({ years: 1 });
			date = d;
			rest = rest.replace(slash[0], ' ');
		} catch {
			// Not a real date: leave it in the text.
		}
	}

	// The amount: "$5", "5.06", else the first plain number.
	const money =
		rest.match(new RegExp(String.raw`\s\$(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?(?=[\s,;])`)) ??
		rest.match(new RegExp(String.raw`\s(\d{1,3}(?:,\d{3})+|\d+)\.(\d{1,2})(?=[\s,;])`)) ??
		rest.match(new RegExp(String.raw`\s(\d{1,3}(?:,\d{3})+|\d+)()(?=[\s,;])`));
	if (!money) return { ok: false, needsModel: true, reason: 'No amount found.' };
	const amountCents = toCents(money[1], money[2]);
	rest = rest.replace(money[0], ' ');

	const method = matchPaymentMethod(rest, ctx.paymentMethods);
	for (const span of method?.spans ?? []) rest = rest.replace(wordRe(span), ' ');

	const description = rest
		.replace(/[,;]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/^(at|on|for)\s+/i, '');
	if (!description) return { ok: false, needsModel: true, reason: 'No description found.' };
	const category = matchCategory(description, ctx.categories);

	return {
		ok: true,
		expense: {
			source: 'shorthand',
			name: description[0].toUpperCase() + description.slice(1),
			amountCents,
			date: date.toString(),
			paymentMethodId: method?.id ?? null,
			categoryId: category?.id ?? null,
			paymentMatchedBy: method?.by ?? null,
			categoryMatchedBy: category?.by ?? null,
			merchantRaw: null
		}
	};
}

// -------------------------------------------------------------------------------------------------

/**
 * Reads one message. `ok` results have already passed `proposedExpenseSchema`; anything the
 * patterns can't read, or that fails the schema, comes back as `needsModel` with the reason.
 */
export function parseQuickAdd(input: string, ctx: QuickAddContext): ParseResult {
	const text = clean(input);
	if (!text) return { ok: false, needsModel: true, reason: 'The message is empty.' };

	const chase = text.match(CHASE);
	const discover = chase ? null : text.match(DISCOVER);
	const result: ParseResult = chase
		? fromBankAlert('chase-alert', chase[1], chase[2], chase[3], chase[4], chase[5], ctx)
		: discover
			? fromBankAlert(
					'discover-alert',
					'discover',
					discover[1],
					discover[2],
					discover[3],
					discover[4],
					ctx
				)
			: BANK_LIKE.test(text)
				? {
						ok: false,
						needsModel: true,
						reason: 'Looks like a bank message, but not a purchase format this knows.'
					}
				: fromShorthand(text, ctx);
	if (!result.ok) return result;

	const checked = proposedExpenseSchema(ctx).safeParse(result.expense);
	if (!checked.success)
		return {
			ok: false,
			needsModel: true,
			reason: checked.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
		};
	return { ok: true, expense: checked.data };
}

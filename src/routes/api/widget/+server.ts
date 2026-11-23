import { eq } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import { Temporal } from '#lib/dates.ts';
import { userIdForToken } from '#lib/server/api-token.ts';
import { monthlyTotals, spendingByCategory } from '#lib/server/budget/dashboard.ts';
import { listBudgets } from '#lib/server/budget/limits.ts';
import { generateDueCharges } from '#lib/server/budget/recurring.ts';
import { db } from '#lib/server/db/index.ts';
import { user } from '#lib/server/db/schema.ts';
import { sfSymbolFor } from '#lib/server/sf-symbols.ts';
import type { RequestHandler } from './$types';

// GET /api/widget: this month's numbers for the Home Screen widget (Scriptable), with
// `Authorization: Bearer cj_…` (a token from Settings → Widget). Read-only. Shape agreed in
// future-plans ("Home Screen widget"): money in integer cents, the script formats it.

/** The response. Keep in step with the Scriptable scripts on Settings → Widget. */
export type WidgetResponse = {
	/** When this was worked out, in the user's time zone, e.g. "2026-11-13T13:49:00-05:00". */
	asOf: string;
	month: string;
	monthLabel: string;
	net: { incomeCents: number; expenseCents: number; netCents: number };
	/** Up to 3, most spent first (ties by name). Fewer when fewer categories have spending. */
	topCategories: WidgetCategory[];
	/**
	 * Ranks 4–7, for the large widget. Separate from `topCategories` so scripts made before it
	 * (which draw every entry of `topCategories`) still show 3.
	 */
	moreCategories: WidgetCategory[];
	/** The last 6 months including this one, oldest first, for the large net widget. */
	months: { month: string; label: string; incomeCents: number; expenseCents: number }[];
	/** What tapping the widget opens. */
	url: string;
};

type WidgetCategory = {
	rank: number;
	name: string;
	sfSymbol: string;
	spentCents: number;
	/** Of all expenses this month, 0 to 1. */
	shareOfSpending: number;
	/** This month's budget for the category, or null when it has none. */
	limitCents: number | null;
	/** Budget left (negative when over), or null when it has none. */
	leftCents: number | null;
};

/** How many categories the widgets get in all (3 in `topCategories`, the rest in `moreCategories`). */
const MAX_CATEGORIES = 7;
const TOP = 3;
/** Months in the large net widget's chart, this one included. */
const MONTHS = 6;

const noStore = { 'cache-control': 'no-store' };

export const GET: RequestHandler = async ({ request, url }) => {
	const userId = await userIdForToken(request.headers.get('authorization'), 'widget');
	if (!userId)
		return json(
			{ error: 'Unauthorized' },
			{ status: 401, headers: { ...noStore, 'www-authenticate': 'Bearer' } }
		);

	const [owner] = await db
		.select({ timezone: user.timezone })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	let now: Temporal.ZonedDateTime;
	try {
		now = Temporal.Now.zonedDateTimeISO(owner?.timezone ?? Temporal.Now.timeZoneId());
	} catch {
		now = Temporal.Now.zonedDateTimeISO(Temporal.Now.timeZoneId());
	}
	const today = now.toPlainDate();
	const start = today.with({ day: 1 });
	const end = start.add({ months: 1 }).subtract({ days: 1 });

	// Same as the pages that show spending: add any recurring charge that's due first.
	await generateDueCharges(userId, today);
	const firstMonth = start.subtract({ months: MONTHS - 1 });
	const [totals, spending, budgets] = await Promise.all([
		monthlyTotals(userId, firstMonth, end),
		spendingByCategory(userId, start, end),
		listBudgets(userId, start.toPlainYearMonth())
	]);
	const limitById = new Map(budgets.map((b) => [b.id, b.limitCents]));

	const month = today.toPlainYearMonth().toString();
	const incomeCents = totals.incomes.get(month) ?? 0;
	const expenseCents = totals.expenses.get(month) ?? 0;
	const top = spending
		.filter((s) => s.cents > 0)
		.sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name))
		.slice(0, MAX_CATEGORIES)
		.map((s, i) => ({
			rank: i + 1,
			name: s.name,
			sfSymbol: sfSymbolFor(s.icon),
			spentCents: s.cents,
			shareOfSpending: expenseCents > 0 ? Math.round((s.cents / expenseCents) * 1000) / 1000 : 0,
			limitCents: limitById.get(s.id) ?? null,
			leftCents: (() => {
				const limit = limitById.get(s.id);
				return limit === null || limit === undefined ? null : limit - s.cents;
			})()
		}));
	const months = Array.from({ length: MONTHS }, (_, i) => {
		const m = firstMonth.add({ months: i }).toPlainYearMonth();
		const key = m.toString();
		return {
			month: key,
			label: m.toPlainDate({ day: 1 }).toLocaleString('en-US', { month: 'short' }),
			incomeCents: totals.incomes.get(key) ?? 0,
			expenseCents: totals.expenses.get(key) ?? 0
		};
	});

	const body: WidgetResponse = {
		asOf: now.round('second').toString({ timeZoneName: 'never' }),
		month,
		monthLabel: today.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
		net: { incomeCents, expenseCents, netCents: incomeCents - expenseCents },
		topCategories: top.slice(0, TOP),
		moreCategories: top.slice(TOP),
		months,
		url: `${url.origin}/`
	};
	return json(body, { headers: noStore });
};

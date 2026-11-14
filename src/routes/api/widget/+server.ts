import { eq } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import { Temporal } from '#lib/dates.ts';
import { userIdForToken } from '#lib/server/api-token.ts';
import { monthlyTotals, spendingByCategory } from '#lib/server/budget/dashboard.ts';
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
	topCategories: {
		rank: number;
		name: string;
		sfSymbol: string;
		spentCents: number;
		/** Of all expenses this month, 0 to 1. */
		shareOfSpending: number;
	}[];
	/** What tapping the widget opens. */
	url: string;
};

const noStore = { 'cache-control': 'no-store' };

export const GET: RequestHandler = async ({ request, url }) => {
	const userId = await userIdForToken(request.headers.get('authorization'));
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
	const [totals, spending] = await Promise.all([
		monthlyTotals(userId, start, end),
		spendingByCategory(userId, start, end)
	]);

	const month = today.toPlainYearMonth().toString();
	const incomeCents = totals.incomes.get(month) ?? 0;
	const expenseCents = totals.expenses.get(month) ?? 0;
	const top = spending
		.filter((s) => s.cents > 0)
		.sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name))
		.slice(0, 3);

	const body: WidgetResponse = {
		asOf: now.round('second').toString({ timeZoneName: 'never' }),
		month,
		monthLabel: today.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
		net: { incomeCents, expenseCents, netCents: incomeCents - expenseCents },
		topCategories: top.map((s, i) => ({
			rank: i + 1,
			name: s.name,
			sfSymbol: sfSymbolFor(s.icon),
			spentCents: s.cents,
			shareOfSpending: expenseCents > 0 ? Math.round((s.cents / expenseCents) * 1000) / 1000 : 0
		})),
		url: `${url.origin}/`
	};
	return json(body, { headers: noStore });
};

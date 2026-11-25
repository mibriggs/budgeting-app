// Dev-only mock of the Home Screen widgets (Scriptable), drawn in HTML at iPhone widget sizes.
// Sample data uses the `/api/widget` response shape (src/routes/api/widget/+server.ts).
// No database, no sign-in. 404 outside `npm run dev`.

import { error } from '@sveltejs/kit';
import { dev } from '$app/env';
import type { PageServerLoad } from './$types';

/** The `/api/widget` response, plus mock-only fields. Money is integer cents. */
export type WidgetData = {
	asOf: string;
	month: string;
	monthLabel: string;
	net: { incomeCents: number; expenseCents: number; netCents: number };
	topCategories: {
		rank: number;
		name: string;
		/** SF Symbol name the script draws. */
		sfSymbol: string;
		/** Mock only: the Lucide key, since a browser can't show SF Symbols. */
		icon: string | null;
		spentCents: number;
		limitCents: number | null;
		leftCents: number | null;
		shareOfSpending: number;
	}[];
	/** Ranks 4–7 (large widget only), same shape as topCategories. */
	moreCategories: WidgetData['topCategories'];
	/** The last 6 months, oldest first (this month last), for the large net widget. */
	months: { month: string; label: string; incomeCents: number; expenseCents: number }[];
	/**
	 * Proposed for the Budget widget (2026-11-25): this month's limits added up across every
	 * category with one (spent or not), and what was spent in those categories. Spending with no
	 * budget is `net.expenseCents - spentCents`. Per-category limits already come with the
	 * categories above.
	 */
	budget: { limitCents: number; spentCents: number };
	url: string;
};

const topCategories: WidgetData['topCategories'] = [
	{
		rank: 1,
		name: 'Rent',
		sfSymbol: 'house',
		icon: 'house',
		spentCents: 230_000,
		limitCents: 230_000,
		leftCents: 0,
		shareOfSpending: 0.55
	},
	{
		rank: 2,
		name: 'Groceries',
		sfSymbol: 'cart',
		icon: 'shopping-cart',
		spentCents: 41_266,
		limitCents: 40_000,
		leftCents: -1_266,
		shareOfSpending: 0.08
	},
	{
		rank: 3,
		name: 'Entertainment & Eating Out',
		sfSymbol: 'fork.knife',
		icon: 'utensils-crossed',
		spentCents: 29_435,
		limitCents: null,
		leftCents: null,
		shareOfSpending: 0.07
	},
	...(
		[
			['Gas', 'fuelpump', 'fuel', 18_420, 20_000, 0.044],
			['Subscriptions', 'repeat', 'repeat', 9_196, null, 0.022],
			['Pets', 'pawprint', 'paw-print', 8_200, 10_000, 0.02],
			['Shopping', 'bag', 'shopping-bag', 6_499, 15_000, 0.015],
			['Coffee', 'cup.and.saucer', 'coffee', 3_250, null, 0.008]
		] as const
	).map(([name, sfSymbol, icon, spentCents, limitCents, shareOfSpending], i) => ({
		rank: i + 4,
		name,
		sfSymbol,
		icon,
		spentCents,
		limitCents,
		leftCents: limitCents === null ? null : limitCents - spentCents,
		shareOfSpending
	}))
];

// Last 6 months for the large net widget (made up; this month last).
const months: WidgetData['months'] = [
	['2026-06', 'Jun', 480_000, 410_000],
	['2026-07', 'Jul', 480_000, 455_000],
	['2026-08', 'Aug', 495_000, 520_000],
	['2026-09', 'Sep', 480_000, 430_000],
	['2026-10', 'Oct', 510_000, 470_000]
].map(([month, label, incomeCents, expenseCents]) => ({
	month: month as string,
	label: label as string,
	incomeCents: incomeCents as number,
	expenseCents: expenseCents as number
}));

const base = {
	asOf: '2026-11-13T13:49:00-05:00',
	month: '2026-11',
	monthLabel: 'Nov 2026',
	// Like the endpoint: 3 here, ranks 4–7 separately (the 8th sample category isn't sent).
	topCategories: topCategories.slice(0, 3),
	moreCategories: topCategories.slice(3, 7),
	// Budgeted: Rent, Groceries, Gas, Pets, Shopping above, plus Utilities ($250, nothing spent
	// yet, so not in the lists): why the endpoint sends the sum rather than adding up the lists.
	budget: { limitCents: 340_000, spentCents: 304_385 },
	url: 'https://centjar.vercel.app/'
};

export const load: PageServerLoad = () => {
	if (!dev) error(404, 'Not found');

	const nov = (incomeCents: number, expenseCents: number) => [
		...months,
		{ month: '2026-11', label: 'Nov', incomeCents, expenseCents }
	];
	const earnedMore: WidgetData = {
		...base,
		months: nov(520_000, 420_000),
		net: { incomeCents: 520_000, expenseCents: 420_000, netCents: 100_000 }
	};
	const spentMore: WidgetData = {
		...base,
		months: nov(320_000, 420_000),
		net: { incomeCents: 320_000, expenseCents: 420_000, netCents: -100_000 }
	};
	return { earnedMore, spentMore };
};

// Dev-only mock of the Home Screen widgets (Scriptable), drawn in HTML at iPhone widget sizes.
// Sample data uses the planned `/api/widget` response shape (future-plans, "Home Screen widget").
// No database, no sign-in. 404 outside `npm run dev`.

import { error } from '@sveltejs/kit';
import { dev } from '$app/env';
import type { PageServerLoad } from './$types';

/** The planned `/api/widget` response. Money is integer cents. */
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
		spentCents: 35_166,
		limitCents: 40_000,
		leftCents: 4_834,
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
	}
];

const base = {
	asOf: '2026-11-13T13:49:00-05:00',
	month: '2026-11',
	monthLabel: 'Nov 2026',
	topCategories,
	url: 'https://centjar.vercel.app/'
};

export const load: PageServerLoad = () => {
	if (!dev) error(404, 'Not found');

	const earnedMore: WidgetData = {
		...base,
		net: { incomeCents: 520_000, expenseCents: 420_000, netCents: 100_000 }
	};
	const spentMore: WidgetData = {
		...base,
		net: { incomeCents: 320_000, expenseCents: 420_000, netCents: -100_000 }
	};
	return { earnedMore, spentMore };
};

// Dev-only preview of the transaction list/table with made-up rows. No database, no sign-in,
// so components can be checked in a browser without a GitHub session. 404 outside `npm run dev`.

import { error } from '@sveltejs/kit';
import { dev } from '$app/env';
import { DEFAULT_EXPENSE_CATEGORIES } from '#lib/server/budget/defaults.ts';
import type { TransactionRow } from '#lib/server/budget/transactions.ts';
import { today } from '#lib/dates.ts';
import { resolveRange } from '#lib/date-range.ts';
import type { PageServerLoad } from './$types';

const NAMES = [
	'Trader Joe’s',
	'Rent',
	'Uber',
	'Spotify',
	'A very long purchase name that should truncate on phones',
	'Vet visit',
	'Coffee'
];
const NOTES = [
	null,
	null,
	'Split with friend',
	null,
	'Used coupon — saved about $4 with the store app'
];

export const load: PageServerLoad = ({ url }) => {
	if (!dev) error(404, 'Not found');

	const count = Math.min(Number(url.searchParams.get('rows') ?? 40) || 40, 5000);
	const start = today();
	const rows: TransactionRow[] = Array.from({ length: count }, (_, i) => {
		const category = DEFAULT_EXPENSE_CATEGORIES[i % DEFAULT_EXPENSE_CATEGORIES.length];
		return {
			id: `preview-${i}`,
			name: NAMES[i % NAMES.length],
			date: start.subtract({ days: Math.floor(i / 3) }),
			amountCents: 199 + ((i * 7919) % 25000),
			notes: NOTES[i % NOTES.length],
			categoryId: `category-${i % DEFAULT_EXPENSE_CATEGORIES.length}`,
			categoryName: category.name,
			categoryColor: null,
			categoryIcon: i % 11 === 10 ? null : category.icon,
			paymentMethodKind: i % 4 === 3 ? null : (['credit', 'debit', 'cash'] as const)[i % 3],
			paymentMethodName: i % 4 === 3 ? null : ['Chase Sapphire', 'Checking', 'Cash'][i % 3],
			paymentMethodLast4: i % 4 === 3 || i % 3 === 2 ? null : ['4821', '5532'][i % 3],
			createdAt: new Date()
		};
	});

	// For previewing the range picker and the add dialog (which can't save here).
	const categories = DEFAULT_EXPENSE_CATEGORIES.map((c, i) => ({
		id: `category-${i}`,
		name: c.name,
		icon: c.icon
	}));
	const range = resolveRange(url.searchParams, start);

	return { rows, categories, today: start, range };
};

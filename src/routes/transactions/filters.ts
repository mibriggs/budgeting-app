// Expense filters on the transactions page: by category and by payment method ("Paid with").
// They apply to the rows already loaded for the date range, in the browser. Within one filter any
// ticked value matches (Groceries OR Dining out); across filters both must match.
// Kept in the URL (?category=a,b&method=c,none) so reloads, links and date changes keep them.

import type { PaymentMethodKind, PaymentMethodOption } from '#lib/payment-methods.ts';
import type { CategoryOption } from '#lib/server/budget/categories.ts';
import type { TransactionRow } from '#lib/server/budget/transactions.ts';

/** Stands for "Paid with: Not recorded" in the method filter (and the URL). */
export const NOT_RECORDED = 'none';

export type ExpenseFilters = { categories: ReadonlySet<string>; methods: ReadonlySet<string> };

export type FilterKind = keyof ExpenseFilters;

export type FilterOption = {
	id: string;
	label: string;
	/** Shown small after the label, e.g. "•• 4821". */
	detail?: string;
	/** Rows this option would match, given the other filter. */
	count: number;
	icon: { category: string | null } | { method: PaymentMethodKind } | null;
};

const list = (params: Pick<URLSearchParams, 'get'>, key: string) =>
	new Set(params.get(key)?.split(',').filter(Boolean) ?? []);

export function readFilters(params: Pick<URLSearchParams, 'get'>): ExpenseFilters {
	return { categories: list(params, 'category'), methods: list(params, 'method') };
}

/** The URL params for these filters (null removes one), for `updateQuery`. */
export function filterParams(filters: ExpenseFilters) {
	const join = (set: ReadonlySet<string>) => (set.size ? [...set].join(',') : null);
	return { category: join(filters.categories), method: join(filters.methods) };
}

export const NO_FILTERS = { category: null, method: null };

export const isFiltering = (filters: ExpenseFilters) =>
	filters.categories.size > 0 || filters.methods.size > 0;

const methodKey = (paymentMethodId: string | null) => paymentMethodId ?? NOT_RECORDED;

/** Whether an expense with this category and payment method passes the filters. */
export function matches(
	filters: ExpenseFilters,
	expense: { categoryId: string; paymentMethodId: string | null }
) {
	return matchesCategory(filters, expense) && matchesMethod(filters, expense);
}
function matchesCategory(filters: ExpenseFilters, expense: { categoryId: string }) {
	return filters.categories.size === 0 || filters.categories.has(expense.categoryId);
}
function matchesMethod(filters: ExpenseFilters, expense: { paymentMethodId: string | null }) {
	return filters.methods.size === 0 || filters.methods.has(methodKey(expense.paymentMethodId));
}

function countBy(rows: TransactionRow[], key: (row: TransactionRow) => string) {
	const counts = new Map<string, number>();
	for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
	return counts;
}

/**
 * What each filter offers: values found in the loaded rows, plus any ticked ones that exist
 * elsewhere (an active category or payment method). Also returns the filters with unknown IDs
 * (say, a deleted card in an old link) dropped, so they can't hide every row with nothing to untick.
 */
export function filterOptions(
	rows: TransactionRow[],
	requested: ExpenseFilters,
	known: { categories: CategoryOption[]; paymentMethods: PaymentMethodOption[] }
) {
	const categoryInfo = new Map<string, { name: string; icon: string | null }>();
	for (const c of known.categories) categoryInfo.set(c.id, c);
	const methodInfo = new Map<
		string,
		{ kind: PaymentMethodKind; name: string; last4: string | null }
	>();
	for (const m of known.paymentMethods) methodInfo.set(m.id, m);
	// Rows also carry archived categories and removed methods (the lists above win for the rest).
	const presentCategories = new Set<string>();
	const presentMethods = new Set<string>();
	for (const row of rows) {
		presentCategories.add(row.categoryId);
		if (!categoryInfo.has(row.categoryId))
			categoryInfo.set(row.categoryId, { name: row.categoryName, icon: row.categoryIcon });
		presentMethods.add(methodKey(row.paymentMethodId));
		if (
			row.paymentMethodId &&
			row.paymentMethodKind &&
			row.paymentMethodName &&
			!methodInfo.has(row.paymentMethodId)
		)
			methodInfo.set(row.paymentMethodId, {
				kind: row.paymentMethodKind,
				name: row.paymentMethodName,
				last4: row.paymentMethodLast4
			});
	}

	const filters: ExpenseFilters = {
		categories: new Set([...requested.categories].filter((id) => categoryInfo.has(id))),
		methods: new Set(
			[...requested.methods].filter((id) => id === NOT_RECORDED || methodInfo.has(id))
		)
	};

	const categoryCounts = countBy(
		rows.filter((row) => matchesMethod(filters, row)),
		(row) => row.categoryId
	);
	const categories: FilterOption[] = [...categoryInfo]
		.filter(([id]) => presentCategories.has(id) || filters.categories.has(id))
		.map(([id, c]) => ({
			id,
			label: c.name,
			count: categoryCounts.get(id) ?? 0,
			icon: { category: c.icon }
		}))
		.sort((a, b) => a.label.localeCompare(b.label));

	const methodCounts = countBy(
		rows.filter((row) => matchesCategory(filters, row)),
		(row) => methodKey(row.paymentMethodId)
	);
	// Methods keep their Settings order (known list first), then removed ones found in rows.
	const methods: FilterOption[] = [...methodInfo]
		.filter(([id]) => presentMethods.has(id) || filters.methods.has(id))
		.map(([id, m]) => ({
			id,
			label: m.name,
			detail: m.last4 ? `•• ${m.last4}` : undefined,
			count: methodCounts.get(id) ?? 0,
			icon: { method: m.kind }
		}));
	if (presentMethods.has(NOT_RECORDED) || filters.methods.has(NOT_RECORDED))
		methods.push({
			id: NOT_RECORDED,
			label: 'Not recorded',
			count: methodCounts.get(NOT_RECORDED) ?? 0,
			icon: null
		});

	return { filters, categories, methods };
}

/** "Groceries", "Groceries +2", or `fallback` (the filter's name) when nothing is ticked. */
export function filterSummary(
	options: FilterOption[],
	ticked: ReadonlySet<string>,
	fallback: string
) {
	const on = options.filter((o) => ticked.has(o.id));
	if (on.length === 0) return fallback;
	return on.length === 1 ? on[0].label : `${on[0].label} +${on.length - 1}`;
}

/** The filter buttons' look (outlined; dark when something is ticked, via `data-active`). */
export const FILTER_BUTTON = [
	'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm whitespace-nowrap transition',
	'border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800',
	'data-active:border-gray-900 data-active:bg-gray-900 data-active:text-white data-active:hover:bg-gray-700',
	'dark:data-active:border-white dark:data-active:bg-white dark:data-active:text-gray-900 dark:data-active:hover:bg-gray-200'
].join(' ');

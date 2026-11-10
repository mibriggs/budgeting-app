import { Temporal } from '#lib/dates.ts';
import type { TransactionRow } from '#lib/server/budget/transactions.ts';

export type SortKey = 'date' | 'name' | 'categoryName' | 'amountCents' | 'notes';
export type Sort = { key: SortKey; direction: 'asc' | 'desc' } | null;

const text = new Intl.Collator('en-US', { sensitivity: 'base', numeric: true });

const compare: Record<SortKey, (a: TransactionRow, b: TransactionRow) => number> = {
	date: (a, b) => Temporal.PlainDate.compare(a.date, b.date),
	name: (a, b) => text.compare(a.name, b.name),
	categoryName: (a, b) => text.compare(a.categoryName, b.categoryName),
	amountCents: (a, b) => a.amountCents - b.amountCents,
	notes: (a, b) => text.compare(a.notes ?? '', b.notes ?? '')
};

/** Sorted copy of `rows`. Empty notes always go last; ties keep the original (newest first) order. */
export function sortRows(rows: TransactionRow[], sort: Sort): TransactionRow[] {
	if (!sort) return rows;
	const sign = sort.direction === 'asc' ? 1 : -1;
	return rows.toSorted((a, b) => {
		if (sort.key === 'notes' && !a.notes !== !b.notes) return a.notes ? -1 : 1;
		return sign * compare[sort.key](a, b);
	});
}

/** Clicking a header cycles: ascending → descending → original order. */
export function nextSort(current: Sort, key: SortKey): Sort {
	if (current?.key !== key) return { key, direction: 'asc' };
	return current.direction === 'asc' ? { key, direction: 'desc' } : null;
}

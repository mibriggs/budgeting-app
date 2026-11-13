// What Settings → Categories sends when you press Save: the whole desired list per kind, as
// JSON in one form field. The server compares it with what's stored and works out the writes.

import type { TransactionKind } from '#lib/server/budget/transactions.ts';

/** The form field holding the JSON. */
export const CHANGES_FIELD = 'changes';

/** Ids of categories added on the page (not stored yet) start with this. */
export const NEW_CATEGORY_PREFIX = 'new:';

/** Longest name allowed. */
export const CATEGORY_NAME_MAX = 40;

export type CategoryDraft = { id: string; name: string; icon: string | null };

export type KindChanges = {
	/** Every category that stays active (or is added), in the order to store. */
	active: CategoryDraft[];
	/** Stored categories to remove: archived if they have entries, otherwise deleted. */
	remove: string[];
	/** Archived categories to bring back (added to the end of the list). */
	restore: string[];
};

export type CategoryChanges = Record<TransactionKind, KindChanges>;

const isString = (v: unknown): v is string => typeof v === 'string';
const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every(isString);

function parseKind(v: unknown): KindChanges | null {
	if (typeof v !== 'object' || v === null) return null;
	const { active, remove, restore } = v as Record<string, unknown>;
	if (!Array.isArray(active) || !isStringList(remove) || !isStringList(restore)) return null;
	const rows: CategoryDraft[] = [];
	for (const row of active) {
		if (typeof row !== 'object' || row === null) return null;
		const { id, name, icon } = row as Record<string, unknown>;
		if (!isString(id) || !isString(name) || !(icon === null || isString(icon))) return null;
		rows.push({ id, name, icon });
	}
	return { active: rows, remove, restore };
}

/** Reads the JSON from the form; null when it's missing or the wrong shape. */
export function parseCategoryChanges(text: unknown): CategoryChanges | null {
	if (!isString(text)) return null;
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		return null;
	}
	if (typeof value !== 'object' || value === null) return null;
	const expense = parseKind((value as Record<string, unknown>).expense);
	const income = parseKind((value as Record<string, unknown>).income);
	return expense && income ? { expense, income } : null;
}

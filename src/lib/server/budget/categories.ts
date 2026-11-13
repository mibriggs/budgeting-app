import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { CATEGORY_NAME_MAX, NEW_CATEGORY_PREFIX, type KindChanges } from '#lib/category-changes.ts';
import { isCategoryIconName } from '#lib/category-icons.ts';
import { categoryNameKey, tidyCategoryName } from '#lib/category-name.ts';
import { db } from '#lib/server/db/index.ts';
import { expenseCategory, incomeCategory } from '#lib/server/db/schema.ts';
import type { TransactionKind } from './transactions.ts';

const tables = { expense: expenseCategory, income: incomeCategory } as const;

/** A user's categories that can be picked for new entries (archived ones excluded), in their order. */
export function listActiveCategories(userId: string, kind: TransactionKind) {
	const table = tables[kind];
	return db
		.select({ id: table.id, name: table.name, icon: table.icon })
		.from(table)
		.where(and(eq(table.userId, userId), isNull(table.archivedAt)))
		.orderBy(asc(table.sortOrder), asc(table.name));
}

export type CategoryOption = Awaited<ReturnType<typeof listActiveCategories>>[number];

/** True if the category exists, belongs to the user, matches the kind and isn't archived. */
export async function isActiveCategory(userId: string, kind: TransactionKind, categoryId: string) {
	const table = tables[kind];
	const [row] = await db
		.select({ id: table.id })
		.from(table)
		.where(and(eq(table.id, categoryId), eq(table.userId, userId), isNull(table.archivedAt)))
		.limit(1);
	return Boolean(row);
}

// ---------------------------------------------------------------------------
// Settings → Categories

/**
 * All of a user's categories of one kind for the Categories page: active ones in their order,
 * then archived ones by name, each with how many entries use it.
 */
export async function listCategoriesForSettings(userId: string, kind: TransactionKind) {
	const table = tables[kind];
	// Explicit table names: in a single-table select Drizzle prints columns unqualified, which
	// would make `category_id = id` compare the entry's own id. (Both names are constants.)
	const uses = sql<number>`(
		select count(*) from ${sql.raw(kind)} e where e.category_id = ${sql.raw(`${kind}_category`)}.id
	)`;
	const rows = await db
		.select({
			id: table.id,
			name: table.name,
			icon: table.icon,
			archived: sql<boolean>`${table.archivedAt} is not null`.mapWith(Boolean),
			uses
		})
		.from(table)
		.where(eq(table.userId, userId))
		.orderBy(asc(table.sortOrder), asc(table.name));
	return {
		active: rows.filter((r) => !r.archived),
		archived: rows.filter((r) => r.archived).sort((a, b) => a.name.localeCompare(b.name))
	};
}

export type SettingsCategory = Awaited<
	ReturnType<typeof listCategoriesForSettings>
>['active'][number];

/** Why a save was refused: per-category messages, or one for the whole page. */
export type CategorySaveErrors = { rows: Record<string, string>; page?: string };

/**
 * Checks one kind's changes against what's stored and returns the writes, or why they can't be
 * made. Nothing is written here, so both kinds can be checked before either is saved.
 */
export async function planCategoryChanges(
	userId: string,
	kind: TransactionKind,
	changes: KindChanges
): Promise<{ writes: BatchItem<'sqlite'>[] } | { errors: CategorySaveErrors }> {
	const table = tables[kind];
	const stored = await listCategoriesForSettings(userId, kind);
	const byId = new Map([...stored.active, ...stored.archived].map((c) => [c.id, c]));
	const isNew = (id: string) => id.startsWith(NEW_CATEGORY_PREFIX);

	// The page must describe exactly the stored categories: each active one kept or removed,
	// nothing unknown, nothing twice. Otherwise it's out of date (e.g. edited in another tab).
	const stale = {
		errors: { rows: {}, page: 'This page is out of date. Reload it and make your changes again.' }
	};
	const seen = new Set<string>();
	for (const id of [...changes.active.map((r) => r.id), ...changes.remove, ...changes.restore]) {
		if (seen.has(id)) return stale;
		seen.add(id);
	}
	if (changes.active.some((r) => !isNew(r.id) && byId.get(r.id)?.archived !== false)) return stale;
	if (changes.remove.some((id) => byId.get(id)?.archived !== false)) return stale;
	if (changes.restore.some((id) => byId.get(id)?.archived !== true)) return stale;
	if (stored.active.some((c) => !seen.has(c.id))) return stale;

	const rows: Record<string, string> = {};
	const active = changes.active.map((r) => ({ ...r, name: tidyCategoryName(r.name) }));
	for (const r of active) {
		if (!r.name) rows[r.id] = 'Enter a name.';
		else if (!categoryNameKey(r.name)) rows[r.id] = 'Use at least one letter or number.';
		else if (r.name.length > CATEGORY_NAME_MAX)
			rows[r.id] = `Keep it to ${CATEGORY_NAME_MAX} characters.`;
		else if (r.icon !== null && !isCategoryIconName(r.icon))
			rows[r.id] = 'Pick an icon from the list.';
	}

	// Names must stay distinct (ignoring case, spaces and punctuation) across everything that
	// will exist afterwards, archived categories included. Only new or renamed ones are blamed.
	const removed = new Set(changes.remove);
	const restored = new Set(changes.restore);
	const others = [...stored.archived, ...stored.active.filter((c) => removed.has(c.id))].filter(
		(c) => (c.archived ? !restored.has(c.id) : c.uses > 0)
	);
	const existing = [
		...active.map((r) => ({ id: r.id, name: r.name, archived: false })),
		...[...restored].map((id) => ({ id, name: byId.get(id)!.name, archived: false })),
		...others.map((c) => ({ id: c.id, name: c.name, archived: true }))
	];
	for (const r of active) {
		if (rows[r.id]) continue;
		const changed = isNew(r.id) || byId.get(r.id)!.name !== r.name;
		if (!changed) continue;
		const key = categoryNameKey(r.name);
		const clash = existing.find((o) => o.id !== r.id && categoryNameKey(o.name) === key);
		if (clash)
			rows[r.id] = clash.archived
				? `You have an archived “${clash.name}”. Restore it instead.`
				: `You already have “${clash.name}”.`;
	}
	if (Object.keys(rows).length > 0) return { errors: { rows } };

	const mine = (id: string) => and(eq(table.id, id), eq(table.userId, userId));
	const now = new Date();
	const writes: BatchItem<'sqlite'>[] = [];
	// Removals first, so a removed (deleted) name can be reused by a new category.
	for (const id of changes.remove) {
		writes.push(
			byId.get(id)!.uses > 0
				? db.update(table).set({ archivedAt: now }).where(mine(id))
				: db.delete(table).where(mine(id))
		);
	}
	// Renames go through a placeholder first, so swapping two names doesn't trip the unique
	// index halfway through.
	const renamed = active.filter((r) => !isNew(r.id) && byId.get(r.id)!.name !== r.name);
	for (const r of renamed)
		writes.push(
			db
				.update(table)
				.set({ name: `~${r.id}` })
				.where(mine(r.id))
		);
	// Stored order isn't returned, so every kept row is written with its position; unchanged rows
	// in an unchanged order still cost one cheap update each.
	active.forEach((r, sortOrder) => {
		writes.push(
			isNew(r.id)
				? db.insert(table).values({ userId, name: r.name, icon: r.icon, sortOrder })
				: db.update(table).set({ name: r.name, icon: r.icon, sortOrder }).where(mine(r.id))
		);
	});
	changes.restore.forEach((id, i) => {
		writes.push(
			db
				.update(table)
				.set({ archivedAt: null, sortOrder: active.length + i })
				.where(mine(id))
		);
	});
	return { writes };
}

/** Runs the writes from planCategoryChanges in one batch (all or nothing). */
export async function applyCategoryWrites(writes: BatchItem<'sqlite'>[]) {
	if (writes.length === 0) return;
	const [first, ...rest] = writes;
	await db.batch([first, ...rest]);
}

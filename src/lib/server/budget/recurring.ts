// Recurring expenses: listing and saving them (Settings → Recurring), and creating their charges
// as ordinary expenses once they're due. Date rules live in src/lib/recurring-schedule.ts.
//
// Charges are created by generateDueCharges(), which runs when the home, transactions and
// recurring pages load (and, later, from a scheduled job). It's safe to run any number of times
// at once: a unique index on (recurring_schedule_id, occurrence_date) means a charge is only
// ever inserted once, and each cadence's generated_through only moves forward.

import { and, asc, eq, inArray, isNull, lt, or } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import type { PlainDate } from '#lib/dates.ts';
import type { RecurringInput } from '#lib/recurring-input.ts';
import { occurrencesBetween, type IntervalUnit } from '#lib/recurring-schedule.ts';
import { db } from '#lib/server/db/index.ts';
import {
	expense,
	expenseCategory,
	recurringExpense,
	recurringSchedule
} from '#lib/server/db/schema.ts';
import { isActiveCategory } from './categories.ts';

// ---------------------------------------------------------------------------
// Listing

/** A user's recurring expenses with their cadences and category, by name. One query. */
export async function listRecurring(userId: string) {
	const rows = await db
		.select({
			id: recurringExpense.id,
			name: recurringExpense.name,
			amountCents: recurringExpense.amountCents,
			categoryId: recurringExpense.categoryId,
			categoryName: expenseCategory.name,
			categoryIcon: expenseCategory.icon,
			categoryArchived: expenseCategory.archivedAt,
			notes: recurringExpense.notes,
			endDate: recurringExpense.endDate,
			pausedAt: recurringExpense.pausedAt,
			remindAtMinutes: recurringExpense.remindAtMinutes,
			scheduleId: recurringSchedule.id,
			startDate: recurringSchedule.startDate,
			count: recurringSchedule.intervalCount,
			unit: recurringSchedule.intervalUnit
		})
		.from(recurringExpense)
		.innerJoin(expenseCategory, eq(recurringExpense.categoryId, expenseCategory.id))
		.innerJoin(recurringSchedule, eq(recurringSchedule.recurringExpenseId, recurringExpense.id))
		.where(eq(recurringExpense.userId, userId))
		.orderBy(asc(recurringExpense.name), asc(recurringSchedule.startDate));

	const items = new Map<string, RecurringItem>();
	for (const r of rows) {
		let item = items.get(r.id);
		if (!item) {
			item = {
				id: r.id,
				name: r.name,
				amountCents: r.amountCents,
				category: {
					id: r.categoryId,
					name: r.categoryName,
					icon: r.categoryIcon,
					archived: r.categoryArchived !== null
				},
				notes: r.notes ?? '',
				endDate: r.endDate,
				paused: r.pausedAt !== null,
				remindAtMinutes: r.remindAtMinutes,
				cadences: []
			};
			items.set(r.id, item);
		}
		item.cadences.push({ id: r.scheduleId, startDate: r.startDate, count: r.count, unit: r.unit });
	}
	return [...items.values()];
}

export type RecurringItem = {
	id: string;
	name: string;
	amountCents: number;
	category: { id: string; name: string; icon: string | null; archived: boolean };
	notes: string;
	endDate: PlainDate | null;
	paused: boolean;
	remindAtMinutes: number;
	cadences: { id: string; startDate: PlainDate; count: number; unit: IntervalUnit }[];
};

// ---------------------------------------------------------------------------
// Saving

/**
 * Adds or updates one recurring expense and its cadences in one batch. Returns the id, or null
 * when `input.id` isn't one of the user's (or names a cadence that isn't this item's), or the
 * category isn't usable.
 *
 * New cadences start with generated_through = yesterday, so charges before today are never
 * added. Edits keep it, so changing a schedule never creates past charges either. Resuming
 * after a pause moves it to yesterday, so charges missed while paused aren't added.
 */
export async function saveRecurring(
	userId: string,
	input: RecurringInput,
	today: PlainDate
): Promise<{ id: string } | { error: 'not-found' | 'category' }> {
	const yesterday = today.subtract({ days: 1 });

	let existing: { categoryId: string; pausedAt: Date | null; cadenceIds: Set<string> } | null =
		null;
	if (input.id) {
		const rows = await db
			.select({
				categoryId: recurringExpense.categoryId,
				pausedAt: recurringExpense.pausedAt,
				scheduleId: recurringSchedule.id
			})
			.from(recurringExpense)
			.innerJoin(recurringSchedule, eq(recurringSchedule.recurringExpenseId, recurringExpense.id))
			.where(and(eq(recurringExpense.id, input.id), eq(recurringExpense.userId, userId)));
		if (rows.length === 0) return { error: 'not-found' };
		existing = {
			categoryId: rows[0].categoryId,
			pausedAt: rows[0].pausedAt,
			cadenceIds: new Set(rows.map((r) => r.scheduleId))
		};
		if (input.cadences.some((c) => c.id && !existing!.cadenceIds.has(c.id)))
			return { error: 'not-found' };
	}

	// An active expense category, or the one the item already has (even if since archived).
	const categoryOk =
		input.categoryId === existing?.categoryId ||
		(await isActiveCategory(userId, 'expense', input.categoryId));
	if (!categoryOk) return { error: 'category' };

	const id = input.id ?? crypto.randomUUID();
	const values = {
		name: input.name,
		amountCents: input.amountCents,
		categoryId: input.categoryId,
		notes: input.notes,
		endDate: input.endDate,
		remindAtMinutes: input.remindAtMinutes,
		pausedAt: input.paused ? (existing?.pausedAt ?? new Date()) : null
	};
	const resuming = existing?.pausedAt != null && !input.paused;
	const kept = new Set(input.cadences.flatMap((c) => (c.id ? [c.id] : [])));

	const writes: BatchItem<'sqlite'>[] = [
		existing
			? db
					.update(recurringExpense)
					.set(values)
					.where(and(eq(recurringExpense.id, id), eq(recurringExpense.userId, userId)))
			: db.insert(recurringExpense).values({ id, userId, ...values })
	];
	// Removed cadences: their past charges stay (the link is cleared by the foreign key).
	const removed = [...(existing?.cadenceIds ?? [])].filter((c) => !kept.has(c));
	if (removed.length > 0)
		writes.push(db.delete(recurringSchedule).where(inArray(recurringSchedule.id, removed)));
	for (const c of input.cadences) {
		const schedule = { startDate: c.startDate, intervalCount: c.count, intervalUnit: c.unit };
		if (!c.id) {
			writes.push(
				db
					.insert(recurringSchedule)
					.values({ recurringExpenseId: id, ...schedule, generatedThrough: yesterday })
			);
			continue;
		}
		writes.push(
			db
				.update(recurringSchedule)
				.set(schedule)
				.where(and(eq(recurringSchedule.id, c.id), eq(recurringSchedule.recurringExpenseId, id)))
		);
		if (resuming)
			writes.push(
				db
					.update(recurringSchedule)
					.set({ generatedThrough: yesterday })
					.where(
						and(
							eq(recurringSchedule.id, c.id),
							or(
								isNull(recurringSchedule.generatedThrough),
								lt(recurringSchedule.generatedThrough, yesterday)
							)
						)
					)
			);
	}

	const [first, ...rest] = writes;
	await db.batch([first, ...rest]);
	return { id };
}

/** Deletes one of the user's recurring expenses. Charges already added stay as expenses. */
export async function deleteRecurring(userId: string, id: string) {
	const result = await db
		.delete(recurringExpense)
		.where(and(eq(recurringExpense.id, id), eq(recurringExpense.userId, userId)));
	return result.rowsAffected > 0;
}

// ---------------------------------------------------------------------------
// Creating charges

/** One cadence with what's needed to create its charges. */
export type DueRow = {
	scheduleId: string;
	userId: string;
	categoryId: string;
	name: string;
	amountCents: number;
	startDate: PlainDate;
	count: number;
	unit: IntervalUnit;
	endDate: PlainDate | null;
	generatedThrough: PlainDate | null;
};

/**
 * Pure: the charges due by `today` for each cadence and where each cadence's progress moves to.
 * No I/O, so the scheduled job can reuse it for all users at once.
 */
export function planCharges<R extends DueRow>(rows: R[], todayFor: (row: R) => PlainDate) {
	const charges: (typeof expense.$inferInsert)[] = [];
	const progress: { scheduleId: string; through: PlainDate }[] = [];
	for (const row of rows) {
		const today = todayFor(row);
		const dates = occurrencesBetween(
			{ startDate: row.startDate, count: row.count, unit: row.unit },
			{ after: row.generatedThrough, through: today, until: row.endDate }
		);
		if (dates.length === 0) continue;
		for (const date of dates)
			charges.push({
				userId: row.userId,
				categoryId: row.categoryId,
				name: row.name,
				amountCents: row.amountCents,
				purchaseDate: date,
				recurringScheduleId: row.scheduleId,
				occurrenceDate: date
			});
		progress.push({ scheduleId: row.scheduleId, through: today });
	}
	return { charges, progress };
}

/**
 * Creates every charge of the user's active recurring expenses due on or before `today` (their
 * own day) that hasn't been created yet. One read; one batch write only when something is due.
 * Returns how many charges were due.
 */
export async function generateDueCharges(userId: string, today: PlainDate) {
	const rows = await db
		.select({
			scheduleId: recurringSchedule.id,
			userId: recurringExpense.userId,
			categoryId: recurringExpense.categoryId,
			name: recurringExpense.name,
			amountCents: recurringExpense.amountCents,
			startDate: recurringSchedule.startDate,
			count: recurringSchedule.intervalCount,
			unit: recurringSchedule.intervalUnit,
			endDate: recurringExpense.endDate,
			generatedThrough: recurringSchedule.generatedThrough
		})
		.from(recurringSchedule)
		.innerJoin(recurringExpense, eq(recurringSchedule.recurringExpenseId, recurringExpense.id))
		.where(
			and(
				eq(recurringExpense.userId, userId),
				isNull(recurringExpense.pausedAt),
				or(
					isNull(recurringSchedule.generatedThrough),
					lt(recurringSchedule.generatedThrough, today)
				)
			)
		);

	const { charges, progress } = planCharges(rows, () => today);
	if (charges.length === 0) return 0;
	await db.batch([
		// A charge that already exists (another request got there first) is skipped.
		db.insert(expense).values(charges).onConflictDoNothing(),
		...progress.map((p) =>
			db
				.update(recurringSchedule)
				.set({ generatedThrough: p.through })
				.where(eq(recurringSchedule.id, p.scheduleId))
		)
	]);
	return charges.length;
}

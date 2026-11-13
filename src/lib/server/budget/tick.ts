// The scheduled tick (POST /api/cron/recurring, called every few minutes by cron-job.org):
// creates every user's due recurring charges and sends the day-before and day-of reminders at
// each item's reminder time, in each user's own time zone.
//
// Batched from the start: one read covers every user, then one batch write for charges, one
// insert to claim reminders, a few reads only for users who have a reminder going out, and all
// pushes in parallel. Safe to run late, twice, or at the same time as another tick:
// - charges are unique per (cadence, day), and progress only moves forward;
// - a reminder is claimed in `reminder_sent` (unique per cadence, day and kind) before it's
//   sent, and only the call that claimed it sends it;
// - a reminder whose time has passed today is still sent by a later tick (late, not lost).

import { eq, isNull } from 'drizzle-orm';
import { Temporal, type PlainDate } from '#lib/dates.ts';
import { monthRangeParams } from '#lib/date-range.ts';
import { formatCents, formatCentsWhole } from '#lib/money.ts';
import { isOccurrence } from '#lib/recurring-schedule.ts';
import { db } from '#lib/server/db/index.ts';
import {
	expense,
	expenseCategory,
	recurringExpense,
	recurringSchedule,
	reminderSent,
	user
} from '#lib/server/db/schema.ts';
import { notifyMany, pushConfigured, type PushPayload } from '#lib/server/push.ts';
import { spendingByCategory } from './dashboard.ts';
import { listBudgets } from './limits.ts';
import { planCharges } from './recurring.ts';

type Kind = 'day-before' | 'day-of';

export type TickResult = {
	charges: number;
	reminders: number;
	sent: number;
	failed: number;
	removed: number;
};

export async function runTick(now: Temporal.Instant = Temporal.Now.instant()): Promise<TickResult> {
	// 1. One read: every active cadence, with its item, owner's time zone and category name.
	const rows = await db
		.select({
			scheduleId: recurringSchedule.id,
			userId: recurringExpense.userId,
			categoryId: recurringExpense.categoryId,
			categoryName: expenseCategory.name,
			name: recurringExpense.name,
			amountCents: recurringExpense.amountCents,
			startDate: recurringSchedule.startDate,
			count: recurringSchedule.intervalCount,
			unit: recurringSchedule.intervalUnit,
			endDate: recurringExpense.endDate,
			generatedThrough: recurringSchedule.generatedThrough,
			remindAtMinutes: recurringExpense.remindAtMinutes,
			timezone: user.timezone
		})
		.from(recurringSchedule)
		.innerJoin(recurringExpense, eq(recurringSchedule.recurringExpenseId, recurringExpense.id))
		.innerJoin(user, eq(user.id, recurringExpense.userId))
		.innerJoin(expenseCategory, eq(expenseCategory.id, recurringExpense.categoryId))
		.where(isNull(recurringExpense.pausedAt));

	// "Now" in each user's zone (users without one use the server's, like the page loads do).
	const fallbackZone = Temporal.Now.timeZoneId();
	const localNow = new Map<string, Temporal.ZonedDateTime>();
	const nowFor = (tz: string | null) => {
		const zone = tz ?? fallbackZone;
		let zoned = localNow.get(zone);
		if (!zoned) {
			try {
				zoned = now.toZonedDateTimeISO(zone);
			} catch {
				zoned = now.toZonedDateTimeISO(fallbackZone);
			}
			localNow.set(zone, zoned);
		}
		return zoned;
	};

	// 2. Charges: plan in memory, write in one batch (before reminders, so "added" is true).
	const { charges, progress } = planCharges(rows, (r) => nowFor(r.timezone).toPlainDate());
	if (charges.length > 0) {
		await db.batch([
			db.insert(expense).values(charges).onConflictDoNothing(),
			...progress.map((p) =>
				db
					.update(recurringSchedule)
					.set({ generatedThrough: p.through })
					.where(eq(recurringSchedule.id, p.scheduleId))
			)
		]);
	}
	const result: TickResult = {
		charges: charges.length,
		reminders: 0,
		sent: 0,
		failed: 0,
		removed: 0
	};
	if (!pushConfigured) return result;

	// 3. Reminders whose time has come today: tomorrow's charges (day before), today's (day of).
	const due: { row: (typeof rows)[number]; kind: Kind; date: PlainDate; today: PlainDate }[] = [];
	for (const row of rows) {
		const local = nowFor(row.timezone);
		if (local.hour * 60 + local.minute < row.remindAtMinutes) continue;
		const today = local.toPlainDate();
		const cadence = { startDate: row.startDate, count: row.count, unit: row.unit };
		const tomorrow = today.add({ days: 1 });
		if (isOccurrence(cadence, tomorrow, row.endDate))
			due.push({ row, kind: 'day-before', date: tomorrow, today });
		if (isOccurrence(cadence, today, row.endDate))
			due.push({ row, kind: 'day-of', date: today, today });
	}
	if (due.length === 0) return result;

	// 4. Claim them in one insert; keep only the ones this call claimed.
	const claimed = await db
		.insert(reminderSent)
		.values(
			due.map((d) => ({ scheduleId: d.row.scheduleId, occurrenceDate: d.date, kind: d.kind }))
		)
		.onConflictDoNothing()
		.returning({
			scheduleId: reminderSent.scheduleId,
			occurrenceDate: reminderSent.occurrenceDate,
			kind: reminderSent.kind
		});
	const key = (scheduleId: string, date: PlainDate, kind: string) =>
		`${scheduleId}|${date.toString()}|${kind}`;
	const mine = new Set(claimed.map((c) => key(c.scheduleId, c.occurrenceDate, c.kind)));
	const toSend = due.filter((d) => mine.has(key(d.row.scheduleId, d.date, d.kind)));
	result.reminders = toSend.length;
	if (toSend.length === 0) return result;

	// 5. Budget left this month, only for users with a day-of reminder (all fetched at once).
	const budgetUsers = [
		...new Set(toSend.filter((d) => d.kind === 'day-of').map((d) => d.row.userId))
	];
	const leftByUser = new Map<string, Map<string, number>>();
	await Promise.all(
		budgetUsers.map(async (userId) => {
			const today = toSend.find((d) => d.row.userId === userId)!.today;
			const start = today.with({ day: 1 });
			const end = start.add({ months: 1 }).subtract({ days: 1 });
			const [limits, spent] = await Promise.all([
				listBudgets(userId, start.toPlainYearMonth()),
				spendingByCategory(userId, start, end)
			]);
			const spentById = new Map(spent.map((s) => [s.id, s.cents]));
			const left = new Map<string, number>();
			for (const l of limits)
				if (l.limitCents !== null) left.set(l.id, l.limitCents - (spentById.get(l.id) ?? 0));
			leftByUser.set(userId, left);
		})
	);

	// 6. Send everything in parallel.
	const messages = toSend.map(({ row, kind, date, today }) => ({
		userId: row.userId,
		payload: reminderPayload(
			row,
			kind,
			date,
			today,
			leftByUser.get(row.userId)?.get(row.categoryId)
		)
	}));
	const sent = await notifyMany(messages);
	return { ...result, ...sent };
}

/** The notification for one reminder (wording decided in future-plans, "Reminder wording"). */
function reminderPayload(
	row: { scheduleId: string; name: string; amountCents: number; categoryName: string },
	kind: Kind,
	date: PlainDate,
	today: PlainDate,
	leftCents: number | undefined
): PushPayload {
	const amount = formatCents(row.amountCents);
	const params = new URLSearchParams(
		Object.entries(monthRangeParams(date, today)).filter(
			(e): e is [string, string] => e[1] !== null
		)
	);
	const url = `/transactions${params.size > 0 ? `?${params}` : ''}`;
	// Same tag for both reminders of one charge, so the day-of one replaces the day-before one.
	const tag = `recurring-${row.scheduleId}-${date.toString()}`;
	if (kind === 'day-before')
		return {
			title: 'Recurring expense tomorrow',
			body: `${row.name} — ${amount} will be added tomorrow.`,
			url,
			tag
		};
	const budget =
		leftCents === undefined
			? ''
			: leftCents >= 0
				? ` · ${formatCentsWhole(leftCents)} left this month`
				: ` · ${formatCentsWhole(-leftCents)} over budget this month`;
	return {
		title: 'Recurring expense added',
		body: `${row.name} — ${amount} was added to ${row.categoryName}${budget}.`,
		url,
		tag
	};
}

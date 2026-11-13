// Budget tables. Rules are enforced by the database where SQLite allows it:
// - Every row belongs to a user; deleting the user deletes their data.
// - An expense/income can only use a category owned by the same user
//   (composite foreign key on (category_id, user_id)).
// - A category that still has expenses/income can't be deleted. Archive it instead.
// - Category names are unique per user, ignoring case, and can't be blank.
// - Amounts are whole cents and greater than zero; limits are zero or more (or NULL = none).
// - Dates must be real calendar dates ('YYYY-MM-DD'); months must be 'YYYY-MM'.
// - Colors must be '#rrggbb'.

import { sql, type SQL } from 'drizzle-orm';
import {
	check,
	foreignKey,
	index,
	integer,
	sqliteTable,
	text,
	unique,
	uniqueIndex,
	type AnySQLiteColumn
} from 'drizzle-orm/sqlite-core';
import { user } from './auth.schema';
import { plainDate, plainYearMonth, timestamps, uuid } from './columns';

const notBlank = (column: AnySQLiteColumn): SQL => sql`length(trim(${column})) > 0`;
const isCalendarDate = (column: AnySQLiteColumn): SQL => sql`date(${column}) IS ${column}`;
const isYearMonth = (column: AnySQLiteColumn): SQL =>
	sql`date(${column} || '-01') IS ${column} || '-01'`;
// Lowercase letters, digits and dashes, e.g. "shopping-cart".
const isIconName = (column: AnySQLiteColumn): SQL =>
	sql`${column} IS NULL OR (length(${column}) > 0 AND ${column} NOT GLOB '*[^a-z0-9-]*')`;
const isHexColor = (column: AnySQLiteColumn): SQL =>
	sql`${column} IS NULL OR ${column} GLOB '#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]'`;

// ---------------------------------------------------------------------------
// Categories

export const expenseCategory = sqliteTable(
	'expense_category',
	{
		id: text('id').primaryKey().$defaultFn(uuid),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		sortOrder: integer('sort_order').notNull().default(0),
		color: text('color'),
		// Lucide icon name; see src/lib/category-icons.ts. Null shows a generic tag icon.
		icon: text('icon'),
		// "Everyday" spending is spread through the month (groceries, eating out), so budgets
		// compare it to the month's pace. Off for bills paid once a month (rent, subscriptions).
		everyday: integer('everyday', { mode: 'boolean' }).notNull().default(true),
		archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
		...timestamps
	},
	(t) => [
		uniqueIndex('expense_category_user_name_unique').on(t.userId, sql`lower(${t.name})`),
		// Target for the composite foreign keys below.
		unique('expense_category_id_user_unique').on(t.id, t.userId),
		check('expense_category_name_not_blank', notBlank(t.name)),
		check('expense_category_color_hex', isHexColor(t.color)),
		check('expense_category_icon_name', isIconName(t.icon)),
		check('expense_category_everyday_bool', sql`${t.everyday} IN (0, 1)`)
	]
);

export const incomeCategory = sqliteTable(
	'income_category',
	{
		id: text('id').primaryKey().$defaultFn(uuid),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		sortOrder: integer('sort_order').notNull().default(0),
		color: text('color'),
		// Lucide icon name; see src/lib/category-icons.ts. Null shows a generic tag icon.
		icon: text('icon'),
		archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
		...timestamps
	},
	(t) => [
		uniqueIndex('income_category_user_name_unique').on(t.userId, sql`lower(${t.name})`),
		unique('income_category_id_user_unique').on(t.id, t.userId),
		check('income_category_name_not_blank', notBlank(t.name)),
		check('income_category_color_hex', isHexColor(t.color)),
		check('income_category_icon_name', isIconName(t.icon))
	]
);

// ---------------------------------------------------------------------------
// Monthly spend limits, with history.
//
// A row applies from `effectiveMonth` onward until a later row replaces it, so
// changing a limit adds a row for the current month and past months keep their
// old limit. The limit for month M is the row with the latest effectiveMonth <= M.
// A row with limitCents NULL means "no limit from this month on" (removing a limit that an
// earlier row set). No row at all also means no limit.

export const expenseCategoryLimit = sqliteTable(
	'expense_category_limit',
	{
		id: text('id').primaryKey().$defaultFn(uuid),
		categoryId: text('category_id')
			.notNull()
			.references(() => expenseCategory.id, { onDelete: 'cascade' }),
		effectiveMonth: plainYearMonth('effective_month').notNull(),
		limitCents: integer('limit_cents'),
		...timestamps
	},
	(t) => [
		unique('expense_category_limit_month_unique').on(t.categoryId, t.effectiveMonth),
		check('expense_category_limit_month_valid', isYearMonth(t.effectiveMonth)),
		check(
			'expense_category_limit_not_negative',
			sql`${t.limitCents} IS NULL OR ${t.limitCents} >= 0`
		)
	]
);

// ---------------------------------------------------------------------------
// Transactions

export const expense = sqliteTable(
	'expense',
	{
		id: text('id').primaryKey().$defaultFn(uuid),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		categoryId: text('category_id').notNull(),
		name: text('name').notNull(),
		purchaseDate: plainDate('purchase_date').notNull(),
		amountCents: integer('amount_cents').notNull(),
		notes: text('notes'),
		// Set when a recurring expense created this charge (see recurring_schedule below). Removing
		// the cadence keeps the expense and clears the link. Single-column FK, checked in code,
		// because adding a composite one would mean rebuilding this table.
		recurringScheduleId: text('recurring_schedule_id').references(() => recurringSchedule.id, {
			onDelete: 'set null'
		}),
		occurrenceDate: plainDate('occurrence_date'),
		...timestamps
	},
	(t) => [
		// NO ACTION (not RESTRICT): deleting a category with expenses fails, but deleting
		// the user still works because both cascades finish before the check runs.
		foreignKey({
			name: 'expense_category_owner_fk',
			columns: [t.categoryId, t.userId],
			foreignColumns: [expenseCategory.id, expenseCategory.userId]
		}).onDelete('no action'),
		index('expense_user_date_idx').on(t.userId, t.purchaseDate),
		index('expense_category_date_idx').on(t.categoryId, t.purchaseDate),
		check('expense_name_not_blank', notBlank(t.name)),
		check('expense_amount_positive', sql`${t.amountCents} > 0`),
		check('expense_purchase_date_valid', isCalendarDate(t.purchaseDate)),
		check('expense_occurrence_date_valid', isCalendarDate(t.occurrenceDate)),
		// A recurring charge can only be created once, however many times generation runs.
		uniqueIndex('expense_recurring_occurrence_unique').on(t.recurringScheduleId, t.occurrenceDate)
	]
);

export const income = sqliteTable(
	'income',
	{
		id: text('id').primaryKey().$defaultFn(uuid),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		categoryId: text('category_id').notNull(),
		name: text('name').notNull(),
		receivedDate: plainDate('received_date').notNull(),
		amountCents: integer('amount_cents').notNull(),
		notes: text('notes'),
		...timestamps
	},
	(t) => [
		foreignKey({
			name: 'income_category_owner_fk',
			columns: [t.categoryId, t.userId],
			foreignColumns: [incomeCategory.id, incomeCategory.userId]
		}).onDelete('no action'),
		index('income_user_date_idx').on(t.userId, t.receivedDate),
		index('income_category_date_idx').on(t.categoryId, t.receivedDate),
		check('income_name_not_blank', notBlank(t.name)),
		check('income_amount_positive', sql`${t.amountCents} > 0`),
		check('income_received_date_valid', isCalendarDate(t.receivedDate))
	]
);

// ---------------------------------------------------------------------------
// Recurring expenses
//
// What repeats (recurring_expense) and when (recurring_schedule: one or more cadences, each a
// start date plus "every N days/weeks/months/years"). Charges are created as ordinary expenses
// linked back to their cadence. See src/lib/recurring-schedule.ts for the date rules.

export const recurringExpense = sqliteTable(
	'recurring_expense',
	{
		id: text('id').primaryKey().$defaultFn(uuid),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		categoryId: text('category_id').notNull(),
		name: text('name').notNull(),
		amountCents: integer('amount_cents').notNull(),
		notes: text('notes'),
		/** No charges after this day. */
		endDate: plainDate('end_date'),
		/** Set while paused: no charges or reminders. */
		pausedAt: integer('paused_at', { mode: 'timestamp_ms' }),
		/** When reminders go out, in minutes after midnight in the user's time zone (720 = noon). */
		remindAtMinutes: integer('remind_at_minutes').notNull().default(720),
		...timestamps
	},
	(t) => [
		// A category with recurring expenses can't be deleted (archive it instead).
		foreignKey({
			name: 'recurring_expense_category_owner_fk',
			columns: [t.categoryId, t.userId],
			foreignColumns: [expenseCategory.id, expenseCategory.userId]
		}).onDelete('no action'),
		index('recurring_expense_user_idx').on(t.userId),
		check('recurring_expense_name_not_blank', notBlank(t.name)),
		check('recurring_expense_amount_positive', sql`${t.amountCents} > 0`),
		check('recurring_expense_end_date_valid', isCalendarDate(t.endDate)),
		check('recurring_expense_remind_at_valid', sql`${t.remindAtMinutes} BETWEEN 0 AND 1439`)
	]
);

export const recurringSchedule = sqliteTable(
	'recurring_schedule',
	{
		id: text('id').primaryKey().$defaultFn(uuid),
		recurringExpenseId: text('recurring_expense_id')
			.notNull()
			.references(() => recurringExpense.id, { onDelete: 'cascade' }),
		startDate: plainDate('start_date').notNull(),
		intervalCount: integer('interval_count').notNull(),
		intervalUnit: text('interval_unit', { enum: ['day', 'week', 'month', 'year'] }).notNull(),
		/**
		 * Charges on or before this day have been created (or deliberately skipped). Set to the day
		 * before a cadence is saved, so past charges are never added.
		 */
		generatedThrough: plainDate('generated_through'),
		...timestamps
	},
	(t) => [
		index('recurring_schedule_expense_idx').on(t.recurringExpenseId),
		check('recurring_schedule_start_valid', isCalendarDate(t.startDate)),
		check('recurring_schedule_generated_valid', isCalendarDate(t.generatedThrough)),
		check('recurring_schedule_count_range', sql`${t.intervalCount} BETWEEN 1 AND 99`),
		check(
			'recurring_schedule_unit_valid',
			sql`${t.intervalUnit} IN ('day', 'week', 'month', 'year')`
		)
	]
);

/** One row per reminder sent, claimed before sending so a reminder goes out only once. */
export const reminderSent = sqliteTable(
	'reminder_sent',
	{
		id: text('id').primaryKey().$defaultFn(uuid),
		scheduleId: text('schedule_id')
			.notNull()
			.references(() => recurringSchedule.id, { onDelete: 'cascade' }),
		occurrenceDate: plainDate('occurrence_date').notNull(),
		kind: text('kind', { enum: ['day-before', 'day-of'] }).notNull(),
		...timestamps
	},
	(t) => [
		unique('reminder_sent_once').on(t.scheduleId, t.occurrenceDate, t.kind),
		check('reminder_sent_date_valid', isCalendarDate(t.occurrenceDate)),
		check('reminder_sent_kind_valid', sql`${t.kind} IN ('day-before', 'day-of')`)
	]
);

// ---------------------------------------------------------------------------
// Push notifications
//
// One row per browser on a device that turned notifications on (Settings → Notifications).
// The endpoint is the browser's unique push address, so it identifies the device; if another
// account turns it on in the same browser, the row moves to that account.

export const pushSubscription = sqliteTable(
	'push_subscription',
	{
		id: text('id').primaryKey().$defaultFn(uuid),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		endpoint: text('endpoint').notNull().unique(),
		/** The browser's public key and auth secret, used to encrypt each message to it. */
		p256dh: text('p256dh').notNull(),
		auth: text('auth').notNull(),
		/** e.g. "iPhone · Safari", from the browser's user agent when it was turned on. */
		label: text('label').notNull(),
		...timestamps
	},
	(t) => [
		index('push_subscription_user_idx').on(t.userId),
		check('push_subscription_endpoint_https', sql`${t.endpoint} LIKE 'https://%'`)
	]
);

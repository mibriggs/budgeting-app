// Budget tables. Rules are enforced by the database where SQLite allows it:
// - Every row belongs to a user; deleting the user deletes their data.
// - An expense/income can only use a category owned by the same user
//   (composite foreign key on (category_id, user_id)).
// - A category that still has expenses/income can't be deleted. Archive it instead.
// - Category names are unique per user, ignoring case, and can't be blank.
// - Amounts are whole cents and greater than zero; limits are zero or more.
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
		archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
		...timestamps
	},
	(t) => [
		uniqueIndex('expense_category_user_name_unique').on(t.userId, sql`lower(${t.name})`),
		// Target for the composite foreign keys below.
		unique('expense_category_id_user_unique').on(t.id, t.userId),
		check('expense_category_name_not_blank', notBlank(t.name)),
		check('expense_category_color_hex', isHexColor(t.color))
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
		archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
		...timestamps
	},
	(t) => [
		uniqueIndex('income_category_user_name_unique').on(t.userId, sql`lower(${t.name})`),
		unique('income_category_id_user_unique').on(t.id, t.userId),
		check('income_category_name_not_blank', notBlank(t.name)),
		check('income_category_color_hex', isHexColor(t.color))
	]
);

// ---------------------------------------------------------------------------
// Monthly spend limits, with history.
//
// A row applies from `effectiveMonth` onward until a later row replaces it, so
// changing a limit adds a row for the current month and past months keep their
// old limit. The limit for month M is the row with the latest effectiveMonth <= M.
// No row at all means "no limit set".

export const expenseCategoryLimit = sqliteTable(
	'expense_category_limit',
	{
		id: text('id').primaryKey().$defaultFn(uuid),
		categoryId: text('category_id')
			.notNull()
			.references(() => expenseCategory.id, { onDelete: 'cascade' }),
		effectiveMonth: plainYearMonth('effective_month').notNull(),
		limitCents: integer('limit_cents').notNull(),
		...timestamps
	},
	(t) => [
		unique('expense_category_limit_month_unique').on(t.categoryId, t.effectiveMonth),
		check('expense_category_limit_month_valid', isYearMonth(t.effectiveMonth)),
		check('expense_category_limit_not_negative', sql`${t.limitCents} >= 0`)
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
		check('expense_purchase_date_valid', isCalendarDate(t.purchaseDate))
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

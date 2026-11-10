import { sql } from 'drizzle-orm';
import { customType, integer } from 'drizzle-orm/sqlite-core';
import { Temporal } from '#lib/dates.ts';

/** A calendar date stored as 'YYYY-MM-DD' text and read back as a Temporal.PlainDate. */
export const plainDate = customType<{ data: Temporal.PlainDate; driverData: string }>({
	dataType: () => 'text',
	toDriver: (value) => value.toString(),
	fromDriver: (value) => Temporal.PlainDate.from(value)
});

/** A month stored as 'YYYY-MM' text and read back as a Temporal.PlainYearMonth. */
export const plainYearMonth = customType<{ data: Temporal.PlainYearMonth; driverData: string }>({
	dataType: () => 'text',
	toDriver: (value) => value.toString(),
	fromDriver: (value) => Temporal.PlainYearMonth.from(value)
});

const nowMs = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

/** createdAt/updatedAt columns, matching the style Better Auth generates. */
export const timestamps = {
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(nowMs).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.default(nowMs)
		.$onUpdate(() => new Date())
		.notNull()
};

/** Text primary key holding a random UUID, generated in app code so IDs can be made offline later. */
export const uuid = () => crypto.randomUUID();

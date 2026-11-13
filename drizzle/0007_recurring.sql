CREATE TABLE `recurring_expense` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category_id` text NOT NULL,
	`name` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`notes` text,
	`end_date` text,
	`paused_at` integer,
	`remind_at_minutes` integer DEFAULT 720 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`,`user_id`) REFERENCES `expense_category`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "recurring_expense_name_not_blank" CHECK(length(trim("recurring_expense"."name")) > 0),
	CONSTRAINT "recurring_expense_amount_positive" CHECK("recurring_expense"."amount_cents" > 0),
	CONSTRAINT "recurring_expense_end_date_valid" CHECK(date("recurring_expense"."end_date") IS "recurring_expense"."end_date"),
	CONSTRAINT "recurring_expense_remind_at_valid" CHECK("recurring_expense"."remind_at_minutes" BETWEEN 0 AND 1439)
);
--> statement-breakpoint
CREATE INDEX `recurring_expense_user_idx` ON `recurring_expense` (`user_id`);--> statement-breakpoint
CREATE TABLE `recurring_schedule` (
	`id` text PRIMARY KEY NOT NULL,
	`recurring_expense_id` text NOT NULL,
	`start_date` text NOT NULL,
	`interval_count` integer NOT NULL,
	`interval_unit` text NOT NULL,
	`generated_through` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`recurring_expense_id`) REFERENCES `recurring_expense`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "recurring_schedule_start_valid" CHECK(date("recurring_schedule"."start_date") IS "recurring_schedule"."start_date"),
	CONSTRAINT "recurring_schedule_generated_valid" CHECK(date("recurring_schedule"."generated_through") IS "recurring_schedule"."generated_through"),
	CONSTRAINT "recurring_schedule_count_range" CHECK("recurring_schedule"."interval_count" BETWEEN 1 AND 99),
	CONSTRAINT "recurring_schedule_unit_valid" CHECK("recurring_schedule"."interval_unit" IN ('day', 'week', 'month', 'year'))
);
--> statement-breakpoint
CREATE INDEX `recurring_schedule_expense_idx` ON `recurring_schedule` (`recurring_expense_id`);--> statement-breakpoint
CREATE TABLE `reminder_sent` (
	`id` text PRIMARY KEY NOT NULL,
	`schedule_id` text NOT NULL,
	`occurrence_date` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`schedule_id`) REFERENCES `recurring_schedule`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "reminder_sent_date_valid" CHECK(date("reminder_sent"."occurrence_date") IS "reminder_sent"."occurrence_date"),
	CONSTRAINT "reminder_sent_kind_valid" CHECK("reminder_sent"."kind" IN ('day-before', 'day-of'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reminder_sent_once` ON `reminder_sent` (`schedule_id`,`occurrence_date`,`kind`);--> statement-breakpoint
-- Hand-written from here: drizzle-kit generated a rebuild of `expense` (copy, drop, rename) to
-- add the two link columns. Dropping `expense` is what the earlier hand-written migrations avoid
-- (see 0004 and 0006). Adding nullable columns in place is equivalent and keeps every row,
-- index and foreign key. SQLite allows ADD COLUMN with a REFERENCES clause when the default is
-- NULL.
ALTER TABLE `expense` ADD `recurring_schedule_id` text
	REFERENCES `recurring_schedule`(`id`) ON UPDATE no action ON DELETE set null;--> statement-breakpoint
ALTER TABLE `expense` ADD `occurrence_date` text
	CONSTRAINT `expense_occurrence_date_valid` CHECK (date(`occurrence_date`) IS `occurrence_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `expense_recurring_occurrence_unique` ON `expense` (`recurring_schedule_id`,`occurrence_date`);

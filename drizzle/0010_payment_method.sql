CREATE TABLE `payment_method` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`last4` text,
	`limit_cents` integer,
	`closing_day` integer,
	`due_day` integer,
	`remind_at_minutes` integer DEFAULT 720 NOT NULL,
	`archived_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "payment_method_kind_valid" CHECK("payment_method"."kind" IN ('credit', 'debit', 'p2p', 'cash')),
	CONSTRAINT "payment_method_name_not_blank" CHECK(length(trim("payment_method"."name")) > 0),
	CONSTRAINT "payment_method_name_length" CHECK(length("payment_method"."name") <= 40),
	CONSTRAINT "payment_method_last4_valid" CHECK("payment_method"."last4" IS NULL OR ("payment_method"."kind" IN ('credit', 'debit') AND "payment_method"."last4" GLOB '[0-9][0-9][0-9][0-9]')),
	CONSTRAINT "payment_method_credit_only" CHECK("payment_method"."kind" = 'credit' OR ("payment_method"."limit_cents" IS NULL AND "payment_method"."closing_day" IS NULL AND "payment_method"."due_day" IS NULL)),
	CONSTRAINT "payment_method_limit_positive" CHECK("payment_method"."limit_cents" IS NULL OR "payment_method"."limit_cents" > 0),
	CONSTRAINT "payment_method_closing_day_valid" CHECK("payment_method"."closing_day" IS NULL OR "payment_method"."closing_day" BETWEEN 1 AND 31),
	CONSTRAINT "payment_method_due_day_valid" CHECK("payment_method"."due_day" IS NULL OR "payment_method"."due_day" BETWEEN 1 AND 31),
	CONSTRAINT "payment_method_remind_at_valid" CHECK("payment_method"."remind_at_minutes" BETWEEN 0 AND 1439)
);
--> statement-breakpoint
CREATE INDEX `payment_method_user_idx` ON `payment_method` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `payment_method_one_cash` ON `payment_method` (`user_id`) WHERE kind = 'cash';--> statement-breakpoint
-- Edited by hand: drizzle-kit left out ON DELETE SET NULL. Adding a nullable column in place
-- (no table rebuild) like 0007; SQLite allows ADD COLUMN with REFERENCES when the default is NULL.
ALTER TABLE `expense` ADD `payment_method_id` text
	REFERENCES `payment_method`(`id`) ON UPDATE no action ON DELETE set null;--> statement-breakpoint
CREATE INDEX `expense_payment_method_date_idx` ON `expense` (`payment_method_id`,`purchase_date`);
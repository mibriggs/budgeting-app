-- Lets expense_category_limit.limit_cents be NULL ("no limit from this month on").
-- SQLite cannot drop NOT NULL in place, so the table is rebuilt and its rows copied.
-- Nothing references this table, so dropping the old copy is safe. (Hand-edited: the CHECKs
-- name columns without the temporary table prefix, so they read the same after the rename.)

PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_expense_category_limit` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text NOT NULL,
	`effective_month` text NOT NULL,
	`limit_cents` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `expense_category`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "expense_category_limit_month_valid" CHECK(date("effective_month" || '-01') IS "effective_month" || '-01'),
	CONSTRAINT "expense_category_limit_not_negative" CHECK("limit_cents" IS NULL OR "limit_cents" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_expense_category_limit`("id", "category_id", "effective_month", "limit_cents", "created_at", "updated_at") SELECT "id", "category_id", "effective_month", "limit_cents", "created_at", "updated_at" FROM `expense_category_limit`;--> statement-breakpoint
DROP TABLE `expense_category_limit`;--> statement-breakpoint
ALTER TABLE `__new_expense_category_limit` RENAME TO `expense_category_limit`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `expense_category_limit_month_unique` ON `expense_category_limit` (`category_id`,`effective_month`);
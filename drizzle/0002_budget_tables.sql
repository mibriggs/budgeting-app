CREATE TABLE `expense` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category_id` text NOT NULL,
	`name` text NOT NULL,
	`purchase_date` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`,`user_id`) REFERENCES `expense_category`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "expense_name_not_blank" CHECK(length(trim("expense"."name")) > 0),
	CONSTRAINT "expense_amount_positive" CHECK("expense"."amount_cents" > 0),
	CONSTRAINT "expense_purchase_date_valid" CHECK(date("expense"."purchase_date") IS "expense"."purchase_date")
);
--> statement-breakpoint
CREATE INDEX `expense_user_date_idx` ON `expense` (`user_id`,`purchase_date`);--> statement-breakpoint
CREATE INDEX `expense_category_date_idx` ON `expense` (`category_id`,`purchase_date`);--> statement-breakpoint
CREATE TABLE `expense_category` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`color` text,
	`archived_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "expense_category_name_not_blank" CHECK(length(trim("expense_category"."name")) > 0),
	CONSTRAINT "expense_category_color_hex" CHECK("expense_category"."color" IS NULL OR "expense_category"."color" GLOB '#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `expense_category_user_name_unique` ON `expense_category` (`user_id`,lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX `expense_category_id_user_unique` ON `expense_category` (`id`,`user_id`);--> statement-breakpoint
CREATE TABLE `expense_category_limit` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text NOT NULL,
	`effective_month` text NOT NULL,
	`limit_cents` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `expense_category`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "expense_category_limit_month_valid" CHECK(date("expense_category_limit"."effective_month" || '-01') IS "expense_category_limit"."effective_month" || '-01'),
	CONSTRAINT "expense_category_limit_not_negative" CHECK("expense_category_limit"."limit_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `expense_category_limit_month_unique` ON `expense_category_limit` (`category_id`,`effective_month`);--> statement-breakpoint
CREATE TABLE `income` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category_id` text NOT NULL,
	`name` text NOT NULL,
	`received_date` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`,`user_id`) REFERENCES `income_category`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "income_name_not_blank" CHECK(length(trim("income"."name")) > 0),
	CONSTRAINT "income_amount_positive" CHECK("income"."amount_cents" > 0),
	CONSTRAINT "income_received_date_valid" CHECK(date("income"."received_date") IS "income"."received_date")
);
--> statement-breakpoint
CREATE INDEX `income_user_date_idx` ON `income` (`user_id`,`received_date`);--> statement-breakpoint
CREATE INDEX `income_category_date_idx` ON `income` (`category_id`,`received_date`);--> statement-breakpoint
CREATE TABLE `income_category` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`color` text,
	`archived_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "income_category_name_not_blank" CHECK(length(trim("income_category"."name")) > 0),
	CONSTRAINT "income_category_color_hex" CHECK("income_category"."color" IS NULL OR "income_category"."color" GLOB '#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `income_category_user_name_unique` ON `income_category` (`user_id`,lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX `income_category_id_user_unique` ON `income_category` (`id`,`user_id`);--> statement-breakpoint
ALTER TABLE `user` ADD `timezone` text;
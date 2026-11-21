CREATE TABLE `pending_expense` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'reading' NOT NULL,
	`read_by` text,
	`is_expense` integer DEFAULT true NOT NULL,
	`name` text,
	`amount_cents` integer,
	`purchase_date` text,
	`payment_method_id` text,
	`category_id` text,
	`note` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`payment_method_id`) REFERENCES `payment_method`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`category_id`) REFERENCES `expense_category`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "pending_expense_status_valid" CHECK("pending_expense"."status" IN ('reading', 'ready', 'failed')),
	CONSTRAINT "pending_expense_read_by_valid" CHECK("pending_expense"."read_by" IS NULL OR "pending_expense"."read_by" IN ('parser', 'claude')),
	CONSTRAINT "pending_expense_message_length" CHECK(length("pending_expense"."message") BETWEEN 1 AND 2000),
	CONSTRAINT "pending_expense_amount_positive" CHECK("pending_expense"."amount_cents" IS NULL OR "pending_expense"."amount_cents" > 0),
	CONSTRAINT "pending_expense_date_valid" CHECK("pending_expense"."purchase_date" IS NULL OR date("pending_expense"."purchase_date") IS "pending_expense"."purchase_date"),
	CONSTRAINT "pending_expense_is_expense_bool" CHECK("pending_expense"."is_expense" IN (0, 1))
);
--> statement-breakpoint
CREATE INDEX `pending_expense_user_idx` ON `pending_expense` (`user_id`,`created_at`);
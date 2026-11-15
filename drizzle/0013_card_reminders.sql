CREATE TABLE `card_reminder_sent` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_method_id` text NOT NULL,
	`due_date` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`payment_method_id`) REFERENCES `payment_method`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "card_reminder_sent_date_valid" CHECK(date("card_reminder_sent"."due_date") IS "card_reminder_sent"."due_date"),
	CONSTRAINT "card_reminder_sent_kind_valid" CHECK("card_reminder_sent"."kind" IN ('day-before', 'day-of'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `card_reminder_sent_once` ON `card_reminder_sent` (`payment_method_id`,`due_date`,`kind`);
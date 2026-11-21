CREATE TABLE `quick_add_use` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "quick_add_use_kind_valid" CHECK("quick_add_use"."kind" IN ('send', 'claude'))
);
--> statement-breakpoint
CREATE INDEX `quick_add_use_user_idx` ON `quick_add_use` (`user_id`,`kind`,`created_at`);
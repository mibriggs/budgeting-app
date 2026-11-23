-- Existing tokens were all made for the widget, so they get scope 'widget' (hand-edited: the
-- generated copy read a scope column the old table doesn't have).
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_api_token` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`scope` text DEFAULT 'widget' NOT NULL,
	`token_hash` text NOT NULL,
	`hint` text NOT NULL,
	`last_used_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "api_token_name_not_blank" CHECK(length(trim("__new_api_token"."name")) > 0),
	CONSTRAINT "api_token_name_length" CHECK(length("__new_api_token"."name") <= 40),
	CONSTRAINT "api_token_hash_format" CHECK(length("__new_api_token"."token_hash") = 64),
	CONSTRAINT "api_token_scope_valid" CHECK("__new_api_token"."scope" IN ('widget', 'quick-add'))
);
--> statement-breakpoint
INSERT INTO `__new_api_token`("id", "user_id", "name", "scope", "token_hash", "hint", "last_used_at", "created_at", "updated_at") SELECT "id", "user_id", "name", 'widget', "token_hash", "hint", "last_used_at", "created_at", "updated_at" FROM `api_token`;--> statement-breakpoint
DROP TABLE `api_token`;--> statement-breakpoint
ALTER TABLE `__new_api_token` RENAME TO `api_token`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `api_token_token_hash_unique` ON `api_token` (`token_hash`);--> statement-breakpoint
CREATE INDEX `api_token_user_idx` ON `api_token` (`user_id`,`scope`);
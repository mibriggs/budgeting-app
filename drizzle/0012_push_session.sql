-- Edited by hand: drizzle-kit left out ON DELETE SET NULL. Nullable column added in place (no
-- table rebuild), like 0007 and 0010.
ALTER TABLE `push_subscription` ADD `session_id` text
	REFERENCES `session`(`id`) ON UPDATE no action ON DELETE set null;

-- Edited by hand: drizzle-kit left out ON DELETE SET NULL. Nullable column added in place (no
-- table rebuild), like 0010.
ALTER TABLE `recurring_expense` ADD `payment_method_id` text
	REFERENCES `payment_method`(`id`) ON UPDATE no action ON DELETE set null;

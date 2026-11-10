-- Gives users that existed before the budget tables the default categories.
-- New users get them from createDefaultCategories() in src/lib/server/budget/defaults.ts.
-- Users that already have categories are skipped. IDs are random UUIDs (version 4 format).
WITH defaults(name, sort_order) AS (
	VALUES
		('Rent', 0),
		('Laundry', 1),
		('Housing', 2),
		('Groceries', 3),
		('Transportation', 4),
		('Entertainment & Eating Out', 5),
		('Medical & Health', 6),
		('Wellness', 7),
		('Utilities', 8),
		('Education', 9),
		('Personal & Misc.', 10),
		('Technology', 11),
		('Savings', 12),
		('Pet', 13),
		('Gifts', 14),
		('Subscriptions', 15),
		('Date Night', 16),
		('Snacks & Candy', 17)
)
INSERT INTO `expense_category` (`id`, `user_id`, `name`, `sort_order`)
SELECT
	lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
		substr(lower(hex(randomblob(2))), 2) || '-' ||
		substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' ||
		lower(hex(randomblob(6))),
	u.id,
	d.name,
	d.sort_order
FROM `user` u, defaults d
WHERE NOT EXISTS (SELECT 1 FROM `expense_category` c WHERE c.user_id = u.id);
--> statement-breakpoint
WITH defaults(name, sort_order) AS (
	VALUES
		('Salary', 0),
		('Freelance', 1)
)
INSERT INTO `income_category` (`id`, `user_id`, `name`, `sort_order`)
SELECT
	lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
		substr(lower(hex(randomblob(2))), 2) || '-' ||
		substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' ||
		lower(hex(randomblob(6))),
	u.id,
	d.name,
	d.sort_order
FROM `user` u, defaults d
WHERE NOT EXISTS (SELECT 1 FROM `income_category` c WHERE c.user_id = u.id);

-- Hand-written: drizzle-kit generated a table rebuild here (to add the CHECK), which would
-- drop expense_category while expenses reference it and cascade-delete spend limits, and it
-- also mangled the lower(name) unique index. Adding the column with an inline CHECK is
-- equivalent and keeps every existing row, index and foreign key untouched.
ALTER TABLE `expense_category` ADD `icon` text
	CONSTRAINT `expense_category_icon_name`
	CHECK (`icon` IS NULL OR (length(`icon`) > 0 AND `icon` NOT GLOB '*[^a-z0-9-]*'));
--> statement-breakpoint
ALTER TABLE `income_category` ADD `icon` text
	CONSTRAINT `income_category_icon_name`
	CHECK (`icon` IS NULL OR (length(`icon`) > 0 AND `icon` NOT GLOB '*[^a-z0-9-]*'));
--> statement-breakpoint
-- Icons for the default categories (matches src/lib/server/budget/defaults.ts).
UPDATE `expense_category` SET `icon` = CASE `name`
	WHEN 'Rent' THEN 'house'
	WHEN 'Laundry' THEN 'washing-machine'
	WHEN 'Housing' THEN 'sofa'
	WHEN 'Groceries' THEN 'shopping-cart'
	WHEN 'Transportation' THEN 'car'
	WHEN 'Entertainment & Eating Out' THEN 'utensils-crossed'
	WHEN 'Medical & Health' THEN 'stethoscope'
	WHEN 'Wellness' THEN 'dumbbell'
	WHEN 'Utilities' THEN 'zap'
	WHEN 'Education' THEN 'graduation-cap'
	WHEN 'Personal & Misc.' THEN 'shapes'
	WHEN 'Technology' THEN 'laptop'
	WHEN 'Savings' THEN 'piggy-bank'
	WHEN 'Pet' THEN 'paw-print'
	WHEN 'Gifts' THEN 'gift'
	WHEN 'Subscriptions' THEN 'repeat'
	WHEN 'Date Night' THEN 'heart'
	WHEN 'Snacks & Candy' THEN 'candy'
END
WHERE `icon` IS NULL;
--> statement-breakpoint
UPDATE `income_category` SET `icon` = CASE `name`
	WHEN 'Salary' THEN 'briefcase'
	WHEN 'Freelance' THEN 'pen-tool'
END
WHERE `icon` IS NULL;

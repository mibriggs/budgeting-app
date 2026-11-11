-- Hand-written: drizzle-kit generated a table rebuild here (to add the CHECK), which would drop
-- expense_category while expenses reference it and cascade-delete spend limits. Adding the
-- column with an inline CHECK is equivalent and keeps every row, index and foreign key.
ALTER TABLE `expense_category` ADD `everyday` integer DEFAULT true NOT NULL
	CONSTRAINT `expense_category_everyday_bool` CHECK (`everyday` IN (0, 1));
--> statement-breakpoint
-- Bills paid once a month aren't "everyday" (matches src/lib/server/budget/defaults.ts).
UPDATE `expense_category` SET `everyday` = 0
	WHERE `name` IN ('Rent', 'Housing', 'Utilities', 'Education', 'Savings', 'Subscriptions');

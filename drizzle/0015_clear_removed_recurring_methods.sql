-- Recurring expenses never keep a removed payment method: removing one now clears it from them
-- (see removePaymentMethod). This clears any that were set before that rule.
UPDATE `recurring_expense` SET `payment_method_id` = NULL
WHERE `payment_method_id` IN (SELECT `id` FROM `payment_method` WHERE `archived_at` IS NOT NULL);

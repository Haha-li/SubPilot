ALTER TABLE subscriptions ADD COLUMN non_self_paid_unit TEXT DEFAULT 'month';
UPDATE subscriptions SET non_self_paid_unit = COALESCE(price_unit, 'month');

ALTER TABLE subscriptions ADD COLUMN non_self_paid REAL DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN non_self_paid_currency TEXT DEFAULT 'CNY';

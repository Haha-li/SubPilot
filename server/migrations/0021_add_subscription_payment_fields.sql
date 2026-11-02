ALTER TABLE subscriptions ADD COLUMN subscription_channel TEXT DEFAULT '';
ALTER TABLE subscriptions ADD COLUMN payment_method TEXT DEFAULT '';
ALTER TABLE subscriptions ADD COLUMN subscription_account TEXT DEFAULT '';
ALTER TABLE subscriptions ADD COLUMN account_balance REAL;
ALTER TABLE subscriptions ADD COLUMN balance_currency TEXT DEFAULT 'CNY';
ALTER TABLE subscriptions ADD COLUMN payment_reference TEXT DEFAULT '';

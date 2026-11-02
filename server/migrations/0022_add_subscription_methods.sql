CREATE TABLE IF NOT EXISTS subscription_methods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  channel TEXT NOT NULL DEFAULT '',
  payment_method TEXT NOT NULL DEFAULT '',
  account TEXT NOT NULL DEFAULT '',
  balance REAL,
  balance_currency TEXT NOT NULL DEFAULT 'CNY',
  payment_reference TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE subscriptions ADD COLUMN subscription_method_id INTEGER;

INSERT INTO subscription_methods (
  name, channel, payment_method, account, balance, balance_currency, payment_reference
)
SELECT
  '已有方式 #' || id,
  trim(coalesce(subscription_channel, '')),
  trim(coalesce(payment_method, '')),
  trim(coalesce(subscription_account, '')),
  account_balance,
  CASE
    WHEN length(trim(coalesce(balance_currency, ''))) = 3 THEN upper(trim(balance_currency))
    ELSE 'CNY'
  END,
  trim(coalesce(payment_reference, ''))
FROM subscriptions
WHERE subscription_method_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM subscription_methods WHERE name = '已有方式 #' || subscriptions.id
  )
  AND (
    trim(coalesce(subscription_channel, '')) <> ''
    OR trim(coalesce(payment_method, '')) <> ''
    OR trim(coalesce(subscription_account, '')) <> ''
    OR account_balance IS NOT NULL
    OR trim(coalesce(payment_reference, '')) <> ''
  );

UPDATE subscriptions
SET subscription_method_id = (
  SELECT id FROM subscription_methods WHERE name = '已有方式 #' || subscriptions.id
)
WHERE subscription_method_id IS NULL
  AND EXISTS (
    SELECT 1 FROM subscription_methods WHERE name = '已有方式 #' || subscriptions.id
  );

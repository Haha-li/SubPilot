CREATE TABLE IF NOT EXISTS subscription_method_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_method_id INTEGER NOT NULL,
  subscription_id INTEGER,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  before_balance REAL NOT NULL,
  after_balance REAL NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_subscription_method_logs_method_created
  ON subscription_method_logs (subscription_method_id, created_at DESC);

INSERT INTO subscription_method_logs (
  subscription_method_id, type, amount, before_balance, after_balance, note, created_at
)
SELECT id, 'initial', balance, 0, balance, '迁移时记录的初始余额', coalesce(created_at, datetime('now'))
FROM subscription_methods
WHERE balance IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM subscription_method_logs
    WHERE subscription_method_id = subscription_methods.id AND type = 'initial'
  );

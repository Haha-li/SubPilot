CREATE TABLE IF NOT EXISTS renewal_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INTEGER NOT NULL,
  renewed_at TEXT NOT NULL,
  price REAL DEFAULT 0,
  currency TEXT DEFAULT 'CNY',
  period_value INTEGER DEFAULT 1,
  period_unit TEXT DEFAULT 'month',
  notes TEXT DEFAULT '',
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
);

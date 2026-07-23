CREATE TABLE IF NOT EXISTS common_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  website TEXT NOT NULL DEFAULT '',
  icon_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_common_subscriptions_website
  ON common_subscriptions (website COLLATE NOCASE)
  WHERE website <> '';

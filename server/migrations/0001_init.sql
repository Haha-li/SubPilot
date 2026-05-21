CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  custom_type TEXT DEFAULT '',
  category TEXT DEFAULT '',
  start_date TEXT,
  expiry_date TEXT NOT NULL,
  period_value INTEGER DEFAULT 1,
  period_unit TEXT DEFAULT 'month',
  reminder_value INTEGER DEFAULT 7,
  reminder_unit TEXT DEFAULT 'day',
  is_active INTEGER DEFAULT 1,
  auto_renew INTEGER DEFAULT 1,
  use_lunar INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notify_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INTEGER,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Default admin user (password: password)
INSERT OR IGNORE INTO users (username, password_hash) VALUES ('admin', '$2a$10$Ez0XUYU8xc2oxwpXCVH.degeXGIWvWoTLn9RqXQNq5C2t.tIuM1bC');

-- Default config
INSERT OR IGNORE INTO config (key, value) VALUES ('timezone', 'Asia/Shanghai');
INSERT OR IGNORE INTO config (key, value) VALUES ('cron_expression', '0 0 * * *');
INSERT OR IGNORE INTO config (key, value) VALUES ('notify_hours', '');
INSERT OR IGNORE INTO config (key, value) VALUES ('notify_channels', '');
INSERT OR IGNORE INTO config (key, value) VALUES ('telegram_bot_token', '');
INSERT OR IGNORE INTO config (key, value) VALUES ('telegram_chat_id', '');
INSERT OR IGNORE INTO config (key, value) VALUES ('wechat_webhook', '');
INSERT OR IGNORE INTO config (key, value) VALUES ('bark_url', 'https://api.day.app');
INSERT OR IGNORE INTO config (key, value) VALUES ('bark_key', '');
INSERT OR IGNORE INTO config (key, value) VALUES ('webhook_url', '');
INSERT OR IGNORE INTO config (key, value) VALUES ('webhook_method', 'POST');
INSERT OR IGNORE INTO config (key, value) VALUES ('webhook_headers', '{}');
INSERT OR IGNORE INTO config (key, value) VALUES ('webhook_template', '{{formattedMessage}}');
INSERT OR IGNORE INTO config (key, value) VALUES ('email_api_key', '');
INSERT OR IGNORE INTO config (key, value) VALUES ('email_from', '');
INSERT OR IGNORE INTO config (key, value) VALUES ('email_to', '');
INSERT OR IGNORE INTO config (key, value) VALUES ('notifyx_api_key', '');

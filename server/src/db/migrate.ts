import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const dbPath = process.env.DB_PATH || './data/subpilot.db';
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// Create tables
sqlite.exec(`
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
`);

// Insert default admin user if not exists
const existingUser = sqlite.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!existingUser) {
  const hash = bcrypt.hashSync('password', 10);
  sqlite.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('admin', hash);
  console.log('Default admin user created (username: admin, password: password)');
}

// Insert default config if not exists
const defaultConfig: Record<string, string> = {
  timezone: 'Asia/Shanghai',
  cron_expression: '0 0 * * *',
  notify_hours: '8',
  notify_channels: '',
  telegram_bot_token: '',
  telegram_chat_id: '',
  wechat_webhook: '',
  bark_url: 'https://api.day.app',
  bark_key: '',
  webhook_url: '',
  webhook_method: 'POST',
  webhook_headers: '{}',
  webhook_template: '{{formattedMessage}}',
  email_api_key: '',
  email_from: '',
  email_to: '',
  notifyx_api_key: '',
};

const insertConfig = sqlite.prepare('INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)');
for (const [key, value] of Object.entries(defaultConfig)) {
  insertConfig.run(key, value);
}

// Add price column if not exists
try {
  sqlite.exec('ALTER TABLE subscriptions ADD COLUMN price REAL DEFAULT 0');
} catch (e: any) {
  if (!e.message.includes('duplicate column name')) throw e;
}
try {
  sqlite.exec("ALTER TABLE subscriptions ADD COLUMN price_unit TEXT DEFAULT 'month'");
} catch (e: any) {
  if (!e.message.includes('duplicate column name')) throw e;
}

console.log('Database migration completed successfully');
sqlite.close();

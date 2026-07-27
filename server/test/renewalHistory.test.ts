import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

const migrationPaths = [
  '0017_add_renewal_source.sql',
  '0018_add_renewal_previous_expiry.sql',
  '0019_add_renewal_new_expiry.sql',
  '0020_add_renewal_periods_advanced.sql',
].map((filename) => resolve(process.cwd(), 'migrations', filename));

test('续费历史迁移为自动续费来源和日期变化增加字段', () => {
  const database = new DatabaseSync(':memory:');
  database.exec(`
    CREATE TABLE renewal_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subscription_id INTEGER NOT NULL,
      renewed_at TEXT NOT NULL,
      price REAL DEFAULT 0,
      currency TEXT DEFAULT 'CNY',
      period_value INTEGER DEFAULT 1,
      period_unit TEXT DEFAULT 'month',
      notes TEXT DEFAULT ''
    );
  `);
  for (const migrationPath of migrationPaths) {
    database.exec(readFileSync(migrationPath, 'utf8'));
  }

  const columns = database.prepare('PRAGMA table_info(renewal_logs)').all() as any[];
  const names = columns.map((column) => column.name);
  assert.equal(names.includes('source'), true);
  assert.equal(names.includes('previous_expiry_date'), true);
  assert.equal(names.includes('new_expiry_date'), true);
  assert.equal(names.includes('periods_advanced'), true);

  database.exec("INSERT INTO renewal_logs (subscription_id, renewed_at) VALUES (1, '2026-01-01T00:00:00.000Z')");
  const row = database.prepare('SELECT source, periods_advanced FROM renewal_logs').get() as any;
  assert.equal(row.source, 'manual');
  assert.equal(row.periods_advanced, 1);
  database.close();
});

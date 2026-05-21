import * as schema from './schema';
export { schema };

export let db: any;

export function setDb(instance: any) {
  db = instance;
}

export function initNodeDb() {
  const Database = require('better-sqlite3');
  const { drizzle } = require('drizzle-orm/better-sqlite3');
  const path = require('path');
  const fs = require('fs');

  const dbPath = process.env.DB_PATH || './data/subpilot.db';
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  setDb(drizzle(sqlite, { schema }));
}

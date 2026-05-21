import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').default(new Date().toISOString()),
});

export const subscriptions = sqliteTable('subscriptions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  customType: text('custom_type').default(''),
  category: text('category').default(''),
  startDate: text('start_date'),
  expiryDate: text('expiry_date').notNull(),
  periodValue: integer('period_value').default(1),
  periodUnit: text('period_unit').default('month'),
  reminderValue: integer('reminder_value').default(7),
  reminderUnit: text('reminder_unit').default('day'),
  isActive: integer('is_active').default(1),
  autoRenew: integer('auto_renew').default(1),
  useLunar: integer('use_lunar').default(0),
  notes: text('notes').default(''),
  createdAt: text('created_at').default(new Date().toISOString()),
  updatedAt: text('updated_at').default(new Date().toISOString()),
});

export const config = sqliteTable('config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const notifyLogs = sqliteTable('notify_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  subscriptionId: integer('subscription_id'),
  channel: text('channel').notNull(),
  status: text('status').notNull(),
  message: text('message'),
  createdAt: text('created_at').default(new Date().toISOString()),
});

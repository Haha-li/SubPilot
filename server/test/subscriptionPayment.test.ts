import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { schema, setDb } from '../src/db';
import {
  createSubscriptionHandler,
  updateSubscriptionHandler,
} from '../src/handlers/subscription';
import {
  adjustSubscriptionMethodBalanceHandler,
  createSubscriptionMethodHandler,
  deleteSubscriptionMethodHandler,
  listSubscriptionMethodLogsHandler,
  setSubscriptionMethodSubscriptionsHandler,
  updateSubscriptionMethodHandler,
} from '../src/handlers/subscriptionMethod';

function createMemoryDb() {
  const subscriptions: any[] = [];
  const methods: any[] = [];
  const logs: any[] = [];
  let nextSubscriptionId = 1;
  let nextMethodId = 1;
  let nextLogId = 1;

  function rowsFor(table: unknown) {
    if (table === schema.subscriptionMethods) return methods;
    if (table === schema.subscriptionMethodLogs) return logs;
    return subscriptions;
  }

  function selectQuery(table: unknown) {
    let reverse = false;
    let maxRows = Number.POSITIVE_INFINITY;
    const query: any = {
      orderBy: () => {
        reverse = true;
        return query;
      },
      where: () => query,
      limit: (value: number) => {
        maxRows = value;
        return query;
      },
      then: (resolveResult: (value: any[]) => void, rejectResult: (reason: unknown) => void) => {
        const rows = reverse ? [...rowsFor(table)].reverse() : [...rowsFor(table)];
        Promise.resolve(rows.slice(0, maxRows)).then(resolveResult, rejectResult);
      },
    };
    return query;
  }

  return {
    subscriptions,
    methods,
    logs,
    instance: {
      select: () => ({ from: (table: unknown) => selectQuery(table) }),
      insert: (table: unknown) => ({
        values: async (value: any) => {
          if (table === schema.subscriptionMethods) methods.push({ id: nextMethodId++, ...value });
          else if (table === schema.subscriptionMethodLogs) logs.push({ id: nextLogId++, ...value });
          else subscriptions.push({ id: nextSubscriptionId++, ...value });
        },
      }),
      update: (table: unknown) => ({
        set: (value: any) => ({
          where: async () => Object.assign(rowsFor(table)[0], value),
        }),
      }),
      delete: (table: unknown) => ({
        where: async () => {
          rowsFor(table).splice(0, 1);
        },
      }),
    },
  };
}

test('订阅只保存所选订阅方式，方式本身集中维护', async () => {
  const database = createMemoryDb();
  setDb(database.instance);

  const method = await createSubscriptionMethodHandler({
    name: ' 美区 Apple ID ',
    channel: ' iOS App Store ',
    paymentMethod: 'Apple 账户余额',
    account: 'example@icloud.com',
    balance: 0,
    balanceCurrency: 'usd',
    paymentReference: '礼品卡',
  });
  assert.equal(method.status, 201);
  assert.equal(database.methods[0].name, '美区 Apple ID');
  assert.equal(database.methods[0].balance, 0);
  assert.equal(database.methods[0].balanceCurrency, 'USD');
  assert.equal(database.logs[0].type, 'initial');

  const adjusted = await adjustSubscriptionMethodBalanceHandler(database.methods[0].id, {
    amount: 25,
    note: '礼品卡充值',
  });
  assert.equal(adjusted.status, 200);
  assert.equal(database.methods[0].balance, 25);
  assert.equal(database.logs[1].type, 'manual_adjustment');
  assert.equal(database.logs[1].note, '礼品卡充值');
  const listedLogs = await listSubscriptionMethodLogsHandler(database.methods[0].id);
  assert.equal(listedLogs.status, 200);
  assert.equal((listedLogs.body as any[]).length, 2);

  const keptLedger = await updateSubscriptionMethodHandler(database.methods[0].id, {
    balance: 999,
    balanceCurrency: 'CNY',
  });
  assert.equal(keptLedger.status, 200);
  assert.equal(database.methods[0].balance, 25);
  assert.equal(database.methods[0].balanceCurrency, 'USD');

  const created = await createSubscriptionHandler({
    name: 'App Store 订阅',
    expiryDate: '2027-01-01',
    subscriptionMethodId: database.methods[0].id,
  });
  assert.equal(created.status, 200);
  assert.equal(database.subscriptions[0].subscriptionMethodId, database.methods[0].id);

  const unlinked = await setSubscriptionMethodSubscriptionsHandler(database.methods[0].id, {
    subscriptionIds: [],
  });
  assert.equal(unlinked.status, 200);
  assert.equal(database.subscriptions[0].subscriptionMethodId, null);
  const relinked = await setSubscriptionMethodSubscriptionsHandler(database.methods[0].id, {
    subscriptionIds: [database.subscriptions[0].id],
  });
  assert.equal(relinked.status, 200);
  assert.equal(database.subscriptions[0].subscriptionMethodId, database.methods[0].id);

  const updated = await updateSubscriptionHandler(database.subscriptions[0].id, { notes: '保留方式' });
  assert.equal(updated.status, 200);
  assert.equal(database.subscriptions[0].subscriptionMethodId, database.methods[0].id);

  const blocked = await deleteSubscriptionMethodHandler(database.methods[0].id);
  assert.equal(blocked.status, 409);
  assert.equal(database.methods.length, 1);
});

test('不存在的订阅方式和非数字余额会被拒绝，负数余额允许保存', async () => {
  const database = createMemoryDb();
  setDb(database.instance);

  const missing = await createSubscriptionHandler({
    name: '未选择有效方式',
    expiryDate: '2027-01-01',
    subscriptionMethodId: 9,
  });
  assert.equal(missing.status, 400);
  assert.equal((missing.body as any).message, '订阅方式不存在');

  const negativeBalance = await createSubscriptionMethodHandler({
    name: '欠费账户',
    balance: -1,
  });
  assert.equal(negativeBalance.status, 201);
  assert.equal(database.methods[0].balance, -1);

  const invalidBalance = await createSubscriptionMethodHandler({
    name: '错误余额',
    balance: 'abc',
  });
  assert.equal(invalidBalance.status, 400);
  assert.equal((invalidBalance.body as any).message, '账户余额必须是数字');
  assert.equal(database.subscriptions.length, 0);
  assert.equal(database.methods.length, 1);
});

test('D1 迁移把已有支付信息归入订阅方式', () => {
  const database = new DatabaseSync(':memory:');
  database.exec(`CREATE TABLE subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_channel TEXT DEFAULT '',
    payment_method TEXT DEFAULT '',
    subscription_account TEXT DEFAULT '',
    account_balance REAL,
    balance_currency TEXT DEFAULT 'CNY',
    payment_reference TEXT DEFAULT ''
  )`);
  database.exec(`INSERT INTO subscriptions (
    subscription_channel, payment_method, subscription_account, account_balance, balance_currency, payment_reference
  ) VALUES ('iOS App Store', 'Apple 账户余额', 'example@icloud.com', 20, 'usd', '美区')`);
  database.exec(readFileSync(
    resolve(process.cwd(), 'migrations/0022_add_subscription_methods.sql'),
    'utf8',
  ));

  const method = database.prepare('SELECT name, channel, balance, balance_currency FROM subscription_methods').get() as any;
  const subscription = database.prepare('SELECT subscription_method_id FROM subscriptions').get() as any;
  assert.equal(method.name, '已有方式 #1');
  assert.equal(method.channel, 'iOS App Store');
  assert.equal(method.balance, 20);
  assert.equal(method.balance_currency, 'USD');
  assert.equal(subscription.subscription_method_id, 1);

  database.exec(readFileSync(
    resolve(process.cwd(), 'migrations/0023_create_subscription_method_logs.sql'),
    'utf8',
  ));
  const log = database.prepare(
    'SELECT type, amount, before_balance, after_balance FROM subscription_method_logs',
  ).get() as any;
  assert.equal(log.type, 'initial');
  assert.equal(log.amount, 20);
  assert.equal(log.before_balance, 0);
  assert.equal(log.after_balance, 20);
  database.close();
});

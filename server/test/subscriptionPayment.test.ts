import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { setDb } from '../src/db';
import {
  createSubscriptionHandler,
  updateSubscriptionHandler,
} from '../src/handlers/subscription';

function createMemoryDb() {
  const rows: any[] = [];
  let nextId = 1;

  function selectQuery() {
    let maxRows = Number.POSITIVE_INFINITY;
    const query: any = {
      orderBy: () => query,
      where: () => query,
      limit: (value: number) => {
        maxRows = value;
        return query;
      },
      then: (resolveResult: (value: any[]) => void, rejectResult: (reason: unknown) => void) => {
        Promise.resolve(rows.slice(0, maxRows)).then(resolveResult, rejectResult);
      },
    };
    return query;
  }

  return {
    rows,
    instance: {
      select: () => ({ from: () => selectQuery() }),
      insert: () => ({
        values: async (value: any) => rows.push({ id: nextId++, ...value }),
      }),
      update: () => ({
        set: (value: any) => ({
          where: async () => Object.assign(rows[0], value),
        }),
      }),
    },
  };
}

test('订阅新增与更新会保存订阅渠道、支付信息和账户余额', async () => {
  const database = createMemoryDb();
  setDb(database.instance);

  const created = await createSubscriptionHandler({
    name: 'App Store 订阅',
    expiryDate: '2027-01-01',
    currency: 'CNY',
    subscriptionChannel: ' iOS App Store ',
    paymentMethod: 'Apple 账户余额',
    subscriptionAccount: 'example@icloud.com',
    accountBalance: 0,
    balanceCurrency: 'usd',
    paymentReference: '美区 Apple ID',
  });

  assert.equal(created.status, 200);
  assert.equal(database.rows[0].subscriptionChannel, 'iOS App Store');
  assert.equal(database.rows[0].paymentMethod, 'Apple 账户余额');
  assert.equal(database.rows[0].subscriptionAccount, 'example@icloud.com');
  assert.equal(database.rows[0].accountBalance, 0);
  assert.equal(database.rows[0].balanceCurrency, 'USD');
  assert.equal(database.rows[0].paymentReference, '美区 Apple ID');

  const updated = await updateSubscriptionHandler(database.rows[0].id, { notes: '保留支付信息' });
  assert.equal(updated.status, 200);
  assert.equal(database.rows[0].subscriptionChannel, 'iOS App Store');
  assert.equal(database.rows[0].accountBalance, 0);

  const cleared = await updateSubscriptionHandler(database.rows[0].id, { accountBalance: null });
  assert.equal(cleared.status, 200);
  assert.equal(database.rows[0].accountBalance, null);
});

test('账户余额和余额币种拒绝无效值', async () => {
  const database = createMemoryDb();
  setDb(database.instance);

  const invalidBalance = await createSubscriptionHandler({
    name: '错误余额',
    expiryDate: '2027-01-01',
    accountBalance: -1,
  });
  assert.equal(invalidBalance.status, 400);
  assert.equal((invalidBalance.body as any).message, '账户余额必须是非负数');

  const invalidCurrency = await createSubscriptionHandler({
    name: '错误币种',
    expiryDate: '2027-01-01',
    balanceCurrency: 'US',
  });
  assert.equal(invalidCurrency.status, 400);
  assert.equal((invalidCurrency.body as any).message, '余额币种必须是 3 位币种代码');
  assert.equal(database.rows.length, 0);
});

test('D1 迁移增加订阅与支付字段', () => {
  const database = new DatabaseSync(':memory:');
  database.exec('CREATE TABLE subscriptions (id INTEGER PRIMARY KEY AUTOINCREMENT)');
  database.exec(readFileSync(
    resolve(process.cwd(), 'migrations/0021_add_subscription_payment_fields.sql'),
    'utf8',
  ));

  const columns = database.prepare('PRAGMA table_info(subscriptions)').all() as any[];
  const names = new Set(columns.map((column) => column.name));
  for (const name of [
    'subscription_channel',
    'payment_method',
    'subscription_account',
    'account_balance',
    'balance_currency',
    'payment_reference',
  ]) {
    assert.equal(names.has(name), true);
  }

  database.exec('INSERT INTO subscriptions DEFAULT VALUES');
  const row = database.prepare(
    'SELECT account_balance, balance_currency FROM subscriptions LIMIT 1',
  ).get() as any;
  assert.equal(row.account_balance, null);
  assert.equal(row.balance_currency, 'CNY');
  database.close();
});

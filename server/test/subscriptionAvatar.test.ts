import assert from 'node:assert/strict';
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
    select: () => ({ from: () => selectQuery() }),
    insert: () => ({
      values: async (value: any) => rows.push({ id: nextId++, ...value }),
    }),
    update: () => ({
      set: (value: any) => ({
        where: async () => Object.assign(rows[0], value),
      }),
    }),
  };
}

test('订阅新增与更新会持久化常用头像快照', async () => {
  setDb(createMemoryDb());

  const created = await createSubscriptionHandler({
    name: 'Netflix',
    expiryDate: '2027-01-01',
    iconUrl: 'cdn.simpleicons.org/netflix',
    iconBackgroundColor: '#111827',
  });
  assert.equal(created.status, 200);
  assert.equal((created.body as any).subscription.iconUrl, 'https://cdn.simpleicons.org/netflix');
  assert.equal((created.body as any).subscription.iconBackgroundColor, '#111827');

  const id = (created.body as any).subscription.id as number;
  const updated = await updateSubscriptionHandler(id, { iconBackgroundColor: '' });
  assert.equal(updated.status, 200);
  assert.equal((updated.body as any).subscription.iconUrl, 'https://cdn.simpleicons.org/netflix');
  assert.equal((updated.body as any).subscription.iconBackgroundColor, '');
});

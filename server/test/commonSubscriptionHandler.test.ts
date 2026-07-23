import assert from 'node:assert/strict';
import test from 'node:test';
import { setDb } from '../src/db';
import {
  createCommonSubscriptionHandler,
  deleteCommonSubscriptionHandler,
  listCommonSubscriptionsHandler,
  updateCommonSubscriptionHandler,
} from '../src/handlers/commonSubscription';

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
      values: async (value: any) => {
        rows.push({ id: nextId++, ...value });
      },
    }),
    update: () => ({
      set: (value: any) => ({
        where: async () => Object.assign(rows[0], value),
      }),
    }),
    delete: () => ({
      where: async () => rows.splice(0, 1),
    }),
  };
}

test('常用订阅 API 完成增查改删与重复拦截', async () => {
  setDb(createMemoryDb());

  const created = await createCommonSubscriptionHandler({
    name: ' Netflix ',
    website: 'netflix.com',
    iconUrl: '',
    backgroundColor: '#2563eb',
  });
  assert.equal(created.status, 201);
  assert.equal((created.body as any).commonSubscription.name, 'Netflix');
  assert.equal((created.body as any).commonSubscription.website, 'https://netflix.com/');
  assert.equal((created.body as any).commonSubscription.backgroundColor, '#2563EB');

  const listed = await listCommonSubscriptionsHandler({ search: 'NETFLIX.COM' });
  assert.equal(listed.status, 200);
  assert.equal((listed.body as any[]).length, 1);

  const duplicate = await createCommonSubscriptionHandler({
    name: 'Netflix 国际版',
    website: 'https://NETFLIX.com',
  });
  assert.equal(duplicate.status, 409);
  assert.equal((duplicate.body as any).message, '该网站已存在');

  const id = (created.body as any).commonSubscription.id as number;
  const updated = await updateCommonSubscriptionHandler(id, {
    name: 'Netflix Premium',
    iconUrl: 'https://cdn.example.com/netflix.png',
    backgroundColor: '',
  });
  assert.equal(updated.status, 200);
  assert.equal((updated.body as any).commonSubscription.name, 'Netflix Premium');
  assert.equal(
    (updated.body as any).commonSubscription.iconUrl,
    'https://cdn.example.com/netflix.png',
  );
  assert.equal((updated.body as any).commonSubscription.backgroundColor, '');

  const removed = await deleteCommonSubscriptionHandler(id);
  assert.equal(removed.status, 200);
  const empty = await listCommonSubscriptionsHandler({});
  assert.deepStrictEqual(empty.body, []);

});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import {
  findDuplicateCommonSubscription,
  normalizeCommonSubscriptionInput,
} from '../src/utils/commonSubscription';
import { normalizeAvatarFields } from '../src/utils/avatar';
import {
  buildBrandSearchQueries,
  buildWebsiteFaviconUrl,
  getWebsiteHostname,
} from '../../client/src/utils/brandIcon';

function expectEqual<T>(expected: T, actual: T) {
  assert.deepStrictEqual(actual, expected);
}

test('规范常用订阅名称、网站与头像地址', () => {
  const result = normalizeCommonSubscriptionInput({
    name: '  Netflix  ',
    website: 'netflix.com',
    iconUrl: 'cdn.example.com/netflix.png',
    backgroundColor: ' #2563eb ',
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  expectEqual({
    name: 'Netflix',
    website: 'https://netflix.com/',
    iconUrl: 'https://cdn.example.com/netflix.png',
    backgroundColor: '#2563EB',
  }, result.value);
});

test('名称必填且限制字段长度', () => {
  expectEqual(
    { success: false, message: '名称为必填项' },
    normalizeCommonSubscriptionInput({ name: '   ' }),
  );
  expectEqual(
    { success: false, message: '名称不能超过 100 个字符' },
    normalizeCommonSubscriptionInput({ name: 'a'.repeat(101) }),
  );
});

test('网站与头像仅允许 http 或 https', () => {
  expectEqual(
    { success: false, message: '网站地址仅支持 http 或 https' },
    normalizeCommonSubscriptionInput({ name: '示例', website: 'javascript:alert(1)' }),
  );
  expectEqual(
    { success: false, message: '头像地址仅支持 http 或 https' },
    normalizeCommonSubscriptionInput({ name: '示例', iconUrl: 'data:image/png;base64,abc' }),
  );
});

test('头像背景色可为空且仅接受 6 位十六进制颜色', () => {
  assert.deepStrictEqual(
    normalizeAvatarFields({ iconUrl: '', backgroundColor: '' }),
    { success: true, value: { iconUrl: '', backgroundColor: '' } },
  );
  assert.deepStrictEqual(
    normalizeAvatarFields({ iconUrl: 'icons.example.com/app.png', backgroundColor: '#7c3aed' }),
    {
      success: true,
      value: { iconUrl: 'https://icons.example.com/app.png', backgroundColor: '#7C3AED' },
    },
  );
  assert.deepStrictEqual(
    normalizeAvatarFields({ backgroundColor: 'purple' }),
    { success: false, message: '头像背景色必须是 6 位十六进制颜色' },
  );
});

test('更新时保留未提交字段并移除网址片段', () => {
  const result = normalizeCommonSubscriptionInput(
    { website: 'https://Example.com/products#pricing' },
    {
      name: 'Example',
      website: 'https://example.com/',
      iconUrl: 'https://example.com/icon.png',
      backgroundColor: '#111827',
    },
  );

  assert.equal(result.success, true);
  if (!result.success) return;
  expectEqual({
    name: 'Example',
    website: 'https://example.com/products',
    iconUrl: 'https://example.com/icon.png',
    backgroundColor: '#111827',
  }, result.value);
});

test('按名称或非空网站识别重复项，编辑时忽略自身', () => {
  const entries = [
    { id: 1, name: 'Netflix', website: 'https://netflix.com/' },
    { id: 2, name: '本地 App', website: '' },
  ];

  expectEqual(
    { field: 'name', item: entries[0] },
    findDuplicateCommonSubscription(entries, { name: ' netflix ', website: '' }),
  );
  expectEqual(
    { field: 'website', item: entries[0] },
    findDuplicateCommonSubscription(entries, {
      name: 'Netflix 国际版',
      website: 'https://NETFLIX.com',
    }),
  );
  expectEqual(null, findDuplicateCommonSubscription(entries, entries[0], 1));
  expectEqual(null, findDuplicateCommonSubscription(entries, { name: '新 App', website: '' }));
});

test('D1 迁移创建常用订阅表、头像背景与唯一约束', () => {
  const database = new DatabaseSync(':memory:');
  database.exec(readFileSync(resolve(process.cwd(), 'migrations/0013_create_common_subscriptions.sql'), 'utf8'));
  database.exec(readFileSync(resolve(process.cwd(), 'migrations/0014_add_common_subscription_background.sql'), 'utf8'));

  database.prepare(
    'INSERT INTO common_subscriptions (name, website, icon_url, background_color) VALUES (?, ?, ?, ?)',
  ).run('Netflix', 'https://netflix.com/', 'https://example.com/netflix.png', '#111827');

  const row = database.prepare(
    'SELECT name, website, icon_url, background_color, created_at, updated_at FROM common_subscriptions LIMIT 1',
  ).get() as Record<string, unknown>;
  expectEqual('Netflix', row.name);
  expectEqual('https://netflix.com/', row.website);
  expectEqual('https://example.com/netflix.png', row.icon_url);
  expectEqual('#111827', row.background_color);
  assert.equal(typeof row.created_at, 'string');
  assert.equal(typeof row.updated_at, 'string');

  assert.throws(() => {
    database.prepare(
      'INSERT INTO common_subscriptions (name, website) VALUES (?, ?)',
    ).run('netflix', 'https://other.example/');
  });
  assert.throws(() => {
    database.prepare(
      'INSERT INTO common_subscriptions (name, website) VALUES (?, ?)',
    ).run('Netflix 2', 'https://NETFLIX.com/');
  });

  database.close();
});

test('D1 迁移为订阅保存头像 URL 与背景色快照', () => {
  const database = new DatabaseSync(':memory:');
  database.exec('CREATE TABLE subscriptions (id INTEGER PRIMARY KEY AUTOINCREMENT)');
  database.exec(readFileSync(resolve(process.cwd(), 'migrations/0015_add_subscription_icon_url.sql'), 'utf8'));
  database.exec(readFileSync(resolve(process.cwd(), 'migrations/0016_add_subscription_icon_background.sql'), 'utf8'));
  database.exec('INSERT INTO subscriptions DEFAULT VALUES');

  const row = database.prepare(
    'SELECT icon_url, icon_background_color FROM subscriptions LIMIT 1',
  ).get() as Record<string, unknown>;
  expectEqual('', row.icon_url);
  expectEqual('', row.icon_background_color);
  database.close();
});

test('头像搜索同时使用精简名称与网站域名', () => {
  const queries = buildBrandSearchQueries('Netflix 会员', 'https://www.netflix.com/zh-cn');
  assert.ok(queries.some((query) => query.toLocaleLowerCase() === 'netflix'));
  assert.ok(queries.some((query) => query === 'Netflix 会员'));
  assert.ok(queries.some((query) => query === 'netflix.com'));
});

test('从无协议网站生成安全的 favicon 查询地址', () => {
  expectEqual('netflix.com', getWebsiteHostname('netflix.com'));
  expectEqual(null, getWebsiteHostname('javascript:alert(1)'));

  const faviconUrl = buildWebsiteFaviconUrl('netflix.com');
  assert.ok(faviconUrl);
  const parsed = new URL(faviconUrl);
  expectEqual('www.google.com', parsed.hostname);
  expectEqual('netflix.com', parsed.searchParams.get('domain'));
  expectEqual('128', parsed.searchParams.get('sz'));
});

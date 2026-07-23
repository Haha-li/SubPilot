import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchCommonSubscriptionIconHandler } from '../src/handlers/commonSubscription';
import {
  extractWebsiteIconUrl,
  fetchWebsiteIcon,
  type WebsiteIconFetch,
} from '../src/utils/websiteIcon';

test('从 link rel="icon" 解析绝对与相对头像地址', () => {
  assert.equal(
    extractWebsiteIconUrl(
      '<link href="/assets/favicon.png" sizes="32x32" rel="icon">',
      'https://example.com/account/',
    ),
    'https://example.com/assets/favicon.png',
  );
  assert.equal(
    extractWebsiteIconUrl(
      "<LINK REL='shortcut icon' HREF='https://cdn.example.com/app.ico'>",
      'https://example.com/',
    ),
    'https://cdn.example.com/app.ico',
  );
});

test('忽略非网页协议与非 icon 的 link 标签', () => {
  const html = [
    '<link rel="stylesheet" href="/app.css">',
    '<link rel="apple-touch-icon" href="/apple.png">',
    '<link rel="icon" href="data:image/png;base64,abc">',
    '<link rel="icon" href="http://127.0.0.1/private.png">',
  ].join('');
  assert.equal(extractWebsiteIconUrl(html, 'https://example.com/'), null);
});

test('跟随受控重定向并以最终网页地址解析相对头像', async () => {
  const calls: string[] = [];
  const fetcher: WebsiteIconFetch = async (input) => {
    const url = input.toString();
    calls.push(url);
    if (calls.length === 1) {
      return new Response(null, { status: 302, headers: { location: '/app/' } });
    }
    return new Response('<html><link rel="icon" href="icons/app.svg"></html>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  };

  const result = await fetchWebsiteIcon('public.example.com', fetcher);
  assert.deepStrictEqual(result, {
    success: true,
    value: {
      websiteUrl: 'https://public.example.com/app/',
      iconUrl: 'https://public.example.com/app/icons/app.svg',
    },
  });
  assert.deepStrictEqual(calls, [
    'https://public.example.com/',
    'https://public.example.com/app/',
  ]);
});

test('拒绝访问本机和私网网站', async () => {
  let called = false;
  const fetcher: WebsiteIconFetch = async () => {
    called = true;
    return new Response('');
  };

  for (const website of ['http://localhost:3000', 'http://127.0.0.1', 'http://192.168.1.10']) {
    const result = await fetchWebsiteIcon(website, fetcher);
    assert.equal(result.success, false);
    if (!result.success) assert.equal(result.status, 400);
  }
  assert.equal(called, false);
});

test('拒绝跟随指向私网的网页重定向', async () => {
  let calls = 0;
  const result = await fetchWebsiteIcon('https://public.example.com', async () => {
    calls += 1;
    return new Response(null, {
      status: 302,
      headers: { location: 'http://127.0.0.1/admin' },
    });
  });

  assert.deepStrictEqual(result, {
    success: false,
    status: 400,
    message: '网站重定向到了本机或私网地址',
  });
  assert.equal(calls, 1);
});

test('获取头像接口返回解析结果或未找到提示', async () => {
  const found = await fetchCommonSubscriptionIconHandler(
    { website: 'https://www.example.com/product' },
    async () => new Response('<link rel="icon" href="/favicon.ico">', {
      headers: { 'content-type': 'text/html' },
    }),
  );
  assert.equal(found.status, 200);
  assert.equal((found.body as any).iconUrl, 'https://www.example.com/favicon.ico');

  const missing = await fetchCommonSubscriptionIconHandler(
    { website: 'https://www.example.com' },
    async () => new Response('<html><head></head></html>', {
      headers: { 'content-type': 'text/html' },
    }),
  );
  assert.equal(missing.status, 404);
  assert.equal((missing.body as any).message, '网站没有声明 rel="icon" 图标');
});

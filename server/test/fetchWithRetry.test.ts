import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchWithRetry } from '../src/services/notifiers/fetchWithRetry';

function mockResponse(status: number): Response {
  return { ok: status >= 200 && status < 300, status } as Response;
}

test('成功请求只调用一次 fetch', async () => {
  let calls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = (async () => { calls++; return mockResponse(200); }) as typeof fetch;
  try {
    const res = await fetchWithRetry('https://example.com', {}, { baseDelayMs: 1 });
    assert.equal(res.status, 200);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test('429 限流后重试成功', async () => {
  let calls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    calls++;
    return mockResponse(calls === 1 ? 429 : 200);
  }) as typeof fetch;
  try {
    const res = await fetchWithRetry('https://example.com', {}, { baseDelayMs: 1 });
    assert.equal(res.status, 200);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = original; }
});

test('网络异常后重试成功', async () => {
  let calls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    calls++;
    if (calls === 1) throw new TypeError('fetch failed');
    return mockResponse(200);
  }) as typeof fetch;
  try {
    const res = await fetchWithRetry('https://example.com', {}, { baseDelayMs: 1 });
    assert.equal(res.status, 200);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = original; }
});

test('5xx 重试耗尽后抛出错误', async () => {
  let calls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = (async () => { calls++; return mockResponse(503); }) as typeof fetch;
  try {
    await assert.rejects(
      fetchWithRetry('https://example.com', {}, { retries: 2, baseDelayMs: 1 }),
      /上游服务返回 503/,
    );
    assert.equal(calls, 3);
  } finally { globalThis.fetch = original; }
});

test('4xx 视为永久失败不重试', async () => {
  let calls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = (async () => { calls++; return mockResponse(401); }) as typeof fetch;
  try {
    const res = await fetchWithRetry('https://example.com', {}, { baseDelayMs: 1 });
    assert.equal(res.status, 401);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

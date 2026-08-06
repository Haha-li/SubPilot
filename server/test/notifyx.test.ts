import assert from 'node:assert/strict';
import test from 'node:test';
import { sendNotifyX } from '../src/services/notifiers/notifyx';

function mockFetch(response: { ok: boolean; status: number; body: unknown } | Error) {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    if (response instanceof Error) throw response;
    return {
      ok: response.ok,
      status: response.status,
      json: async () => response.body,
    } as Response;
  }) as typeof fetch;
  return () => { globalThis.fetch = original; };
}

test('NotifyX: 官方返回 queued 视为发送成功', async () => {
  const restore = mockFetch({ ok: true, status: 200, body: { id: 1, message: '消息已加入队列', status: 'queued' } });
  try {
    assert.equal(await sendNotifyX('key', 'msg'), true);
  } finally { restore(); }
});

test('NotifyX: 返回 success 视为发送成功', async () => {
  const restore = mockFetch({ ok: true, status: 200, body: { status: 'success' } });
  try {
    assert.equal(await sendNotifyX('key', 'msg'), true);
  } finally { restore(); }
});

test('NotifyX: 返回空 key 直接失败', async () => {
  assert.equal(await sendNotifyX('', 'msg'), false);
});

test('NotifyX: HTTP 错误状态码视为失败', async () => {
  const restore = mockFetch({ ok: false, status: 401, body: { error: '无效的API密钥' } });
  try {
    assert.equal(await sendNotifyX('bad-key', 'msg'), false);
  } finally { restore(); }
});

test('NotifyX: HTTP 2xx 但未知状态仍视为成功（以状态码为准）', async () => {
  const restore = mockFetch({ ok: true, status: 200, body: { status: 'unknown' } });
  try {
    assert.equal(await sendNotifyX('key', 'msg'), true);
  } finally { restore(); }
});

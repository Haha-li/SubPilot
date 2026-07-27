import assert from 'node:assert/strict';
import test from 'node:test';
import { app } from '../src/hono';
import { verifyToken } from '../src/utils/auth';

const jwtSecret = 'a-secure-random-jwt-secret-with-more-than-32-characters';
const adminPassword = 'a-strong-admin-password';
const frontendOrigin = 'https://subpilot-frontend.pages.dev';

function createEnv(overrides: Record<string, unknown> = {}) {
  return {
    DB: {},
    JWT_SECRET: jwtSecret,
    ADMIN_PASSWORD: adminPassword,
    FRONTEND_ORIGINS: frontendOrigin,
    ...overrides,
  };
}

test('Workers 登录使用绑定的 JWT_SECRET 并返回白名单 CORS 来源', async () => {
  const response = await app.request('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: frontendOrigin,
    },
    body: JSON.stringify({ password: adminPassword }),
  }, createEnv());

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), frontendOrigin);
  assert.equal(response.headers.get('access-control-allow-credentials'), null);
  const body = await response.json() as any;
  assert.deepStrictEqual(verifyToken(body.token, jwtSecret), { userId: 1, username: 'admin' });
});

test('Workers CORS 不向未授权来源返回允许头', async () => {
  const response = await app.request('/api/auth/login', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://evil.example',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  }, createEnv());

  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.equal(response.headers.get('access-control-allow-credentials'), null);
});

test('Workers 缺少 JWT_SECRET 时登录失败关闭', async () => {
  const response = await app.request('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: frontendOrigin,
    },
    body: JSON.stringify({ password: adminPassword }),
  }, createEnv({ JWT_SECRET: undefined }));

  assert.equal(response.status, 500);
  assert.deepStrictEqual(await response.json(), {
    success: false,
    message: '服务端认证配置无效',
  });
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { loginHandler } from '../src/handlers/auth';
import { generateToken, verifyToken } from '../src/utils/auth';
import {
  assertAuthConfiguration,
  requireAdminPassword,
  requireJwtSecret,
} from '../src/utils/securityConfig';
import {
  parseFrontendOrigins,
  resolveAllowedCorsOrigin,
} from '../src/utils/cors';

const jwtSecret = 'a-secure-random-jwt-secret-with-more-than-32-characters';
const anotherJwtSecret = 'another-secure-random-secret-with-more-than-32-characters';
const adminPassword = 'a-strong-admin-password';

test('JWT 只接受当前环境注入的密钥与固定签名参数', () => {
  const token = generateToken(1, 'admin', jwtSecret);
  assert.deepStrictEqual(verifyToken(token, jwtSecret), { userId: 1, username: 'admin' });
  assert.equal(verifyToken(token, anotherJwtSecret), null);
});

test('认证配置拒绝缺失、过短和项目默认密钥', () => {
  assert.throws(() => requireJwtSecret(undefined), /JWT_SECRET 未配置/);
  assert.throws(() => requireJwtSecret('too-short'), /至少为 32/);
  assert.throws(
    () => requireJwtSecret('subpilot-default-secret-change-me'),
    /不能使用项目默认值/,
  );
  assert.throws(() => requireAdminPassword('password'), /不能使用默认或常见弱密码/);
  assert.doesNotThrow(() => assertAuthConfiguration({ jwtSecret, adminPassword }));
});

test('登录处理器使用 Workers 传入的 JWT_SECRET 签发令牌', async () => {
  const result = await loginHandler(
    { password: adminPassword },
    { adminPassword, jwtSecret },
  );
  assert.equal(result.status, 200);
  const token = (result.body as any).token as string;
  assert.deepStrictEqual(verifyToken(token, jwtSecret), { userId: 1, username: 'admin' });
  assert.equal(verifyToken(token, anotherJwtSecret), null);
});

test('缺少认证 Secret 时登录接口失败关闭而不是使用默认值', async () => {
  const result = await loginHandler(
    { password: adminPassword },
    { adminPassword, jwtSecret: undefined },
  );
  assert.equal(result.status, 500);
  assert.deepStrictEqual(result.body, { success: false, message: '服务端认证配置无效' });
});

test('CORS 只返回配置中的精确前端来源', () => {
  const configured = 'https://subpilot-frontend.pages.dev/, https://subpilot.example.com';
  assert.deepStrictEqual(parseFrontendOrigins(configured), [
    'https://subpilot-frontend.pages.dev',
    'https://subpilot.example.com',
  ]);
  assert.equal(
    resolveAllowedCorsOrigin('https://subpilot-frontend.pages.dev', configured),
    'https://subpilot-frontend.pages.dev',
  );
  assert.equal(
    resolveAllowedCorsOrigin('https://evil.example', configured),
    undefined,
  );
  assert.equal(
    resolveAllowedCorsOrigin('https://subpilot-frontend.pages.dev.evil.example', configured),
    undefined,
  );
});

import { generateToken } from '../utils/auth';
import {
  requireAdminPassword,
  requireJwtSecret,
  SecurityConfigError,
} from '../utils/securityConfig';

export interface LoginAuthConfig {
  adminPassword: string | undefined;
  jwtSecret: string | undefined;
}

export async function loginHandler(body: any, authConfig: LoginAuthConfig) {
  try {
    const { password } = body || {};

    if (!password || typeof password !== 'string') {
      return { status: 400, body: { success: false, message: '请输入密码' } };
    }

    const expected = requireAdminPassword(authConfig.adminPassword);
    const jwtSecret = requireJwtSecret(authConfig.jwtSecret);

    if (password !== expected) {
      return { status: 401, body: { success: false, message: '密码错误' } };
    }

    const token = generateToken(1, 'admin', jwtSecret);
    return { status: 200, body: { success: true, token, username: 'admin' } };
  } catch (error) {
    if (error instanceof SecurityConfigError) {
      console.error(`Authentication configuration error: ${error.message}`);
      return { status: 500, body: { success: false, message: '服务端认证配置无效' } };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { status: 500, body: { success: false, message } };
  }
}

export async function getMeHandler(_userId: number) {
  return { status: 200, body: { success: true, user: { id: 1, username: 'admin' } } };
}

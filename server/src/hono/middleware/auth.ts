import { Context, Next } from 'hono';
import type { WorkerEnv } from '../../types/env';
import { verifyToken } from '../../utils/auth';
import { requireJwtSecret, SecurityConfigError } from '../../utils/securityConfig';

export async function honoAuth(c: Context<WorkerEnv>, next: Next) {
  const authorization = c.req.header('Authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  const token = match?.[1];

  if (!token) {
    return c.json({ success: false, message: '未登录' }, 401);
  }

  let jwtSecret: string;
  try {
    jwtSecret = requireJwtSecret(c.env.JWT_SECRET);
  } catch (error) {
    if (error instanceof SecurityConfigError) {
      console.error(`Authentication configuration error: ${error.message}`);
    }
    return c.json({ success: false, message: '服务端认证配置无效' }, 500);
  }

  const decoded = verifyToken(token, jwtSecret);
  if (!decoded) {
    return c.json({ success: false, message: '登录已过期' }, 401);
  }

  c.set('userId', decoded.userId);
  c.set('username', decoded.username);
  await next();
}

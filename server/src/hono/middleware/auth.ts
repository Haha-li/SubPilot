import { Context, Next } from 'hono';
import { verifyToken } from '../../utils/auth';

export async function honoAuth(c: Context, next: Next) {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return c.json({ success: false, message: '未登录' }, 401);
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return c.json({ success: false, message: '登录已过期' }, 401);
  }

  c.set('userId', decoded.userId);
  c.set('username', decoded.username);
  await next();
}

import { Hono } from 'hono';
import { honoAuth } from '../middleware/auth';
import { loginHandler, getMeHandler, changePasswordHandler } from '../../handlers/auth';

const auth = new Hono();

// Login
auth.post('/login', async (c) => {
  const body = await c.req.json();
  const result = await loginHandler(body);
  return c.json(result.body, result.status as any);
});

// Logout
auth.post('/logout', (c) => {
  return c.json({ success: true });
});

// Get current user
auth.get('/me', honoAuth, async (c) => {
  const userId = c.get('userId' as never) as unknown as number;
  const result = await getMeHandler(userId);
  return c.json(result.body, result.status as any);
});

// Change password
auth.put('/password', honoAuth, async (c) => {
  const userId = c.get('userId' as never) as unknown as number;
  const body = await c.req.json();
  const result = await changePasswordHandler(userId, body);
  return c.json(result.body, result.status as any);
});

export { auth as authRoutes };

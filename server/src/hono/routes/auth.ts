import { Hono } from 'hono';
import type { WorkerEnv } from '../../types/env';
import { honoAuth } from '../middleware/auth';
import { loginHandler, getMeHandler } from '../../handlers/auth';

const auth = new Hono<WorkerEnv>();

// Login
auth.post('/login', async (c) => {
  const body = await c.req.json();
  const result = await loginHandler(body, {
    adminPassword: c.env.ADMIN_PASSWORD,
    jwtSecret: c.env.JWT_SECRET,
  });
  return c.json(result.body, result.status as any);
});

// Logout
auth.post('/logout', (c) => {
  return c.json({ success: true });
});

// Get current user
auth.get('/me', honoAuth, async (c) => {
  const userId = c.get('userId');
  const result = await getMeHandler(userId);
  return c.json(result.body, result.status as any);
});

export { auth as authRoutes };

import { Hono } from 'hono';
import { honoAuth } from '../middleware/auth';
import {
  getConfigHandler,
  getSchedulerStatusHandler,
  runSchedulerNowHandler,
  testNotifyConfigHandler,
  updateConfigHandler,
} from '../../handlers/config';

const config = new Hono();

// Get all config
config.get('/', honoAuth, async (c) => {
  const result = await getConfigHandler();
  return c.json(result.body, result.status as any);
});

config.get('/scheduler-status', honoAuth, async (c) => {
  const result = await getSchedulerStatusHandler();
  return c.json(result.body, result.status as any);
});

// Update config
config.put('/', honoAuth, async (c) => {
  const body = await c.req.json();
  const result = await updateConfigHandler(body);
  return c.json(result.body, result.status as any);
});

// Test notification channel
config.post('/test-notify', honoAuth, async (c) => {
  const body = await c.req.json();
  const result = await testNotifyConfigHandler(body);
  return c.json(result.body, result.status as any);
});

config.post('/run-scheduler', honoAuth, async (c) => {
  const result = await runSchedulerNowHandler();
  return c.json(result.body, result.status as any);
});

export { config as configRoutes };

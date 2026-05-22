import { Hono } from 'hono';
import { honoAuth } from '../middleware/auth';
import { listNotifyLogsHandler, clearNotifyLogsHandler } from '../../handlers/notifyLogs';

const logs = new Hono();

// Get notify logs with filters and pagination
logs.get('/', honoAuth, async (c) => {
  const query: any = {};
  const keys = ['subscriptionId', 'channel', 'status', 'startDate', 'endDate', 'page', 'pageSize'];
  for (const k of keys) {
    const v = c.req.query(k);
    if (v) query[k] = v;
  }
  const result = await listNotifyLogsHandler(query);
  return c.json(result.body, result.status as any);
});

// Clear all notify logs
logs.delete('/', honoAuth, async (c) => {
  const result = await clearNotifyLogsHandler();
  return c.json(result.body, result.status as any);
});

export { logs as notifyLogsRoutes };

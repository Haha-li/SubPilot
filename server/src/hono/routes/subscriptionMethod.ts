import { Hono } from 'hono';
import type { WorkerEnv } from '../../types/env';
import { honoAuth } from '../middleware/auth';
import {
  adjustSubscriptionMethodBalanceHandler,
  createSubscriptionMethodHandler,
  deleteSubscriptionMethodHandler,
  listSubscriptionMethodLogsHandler,
  listSubscriptionMethodsHandler,
  setSubscriptionMethodSubscriptionsHandler,
  updateSubscriptionMethodHandler,
} from '../../handlers/subscriptionMethod';

const methods = new Hono<WorkerEnv>();

methods.get('/', honoAuth, async (c) => {
  const result = await listSubscriptionMethodsHandler();
  return c.json(result.body, result.status as any);
});

methods.post('/', honoAuth, async (c) => {
  const result = await createSubscriptionMethodHandler(await c.req.json());
  return c.json(result.body, result.status as any);
});

methods.get('/:id/logs', honoAuth, async (c) => {
  const result = await listSubscriptionMethodLogsHandler(Number(c.req.param('id')));
  return c.json(result.body, result.status as any);
});

methods.post('/:id/adjust', honoAuth, async (c) => {
  const result = await adjustSubscriptionMethodBalanceHandler(
    Number(c.req.param('id')),
    await c.req.json(),
  );
  return c.json(result.body, result.status as any);
});

methods.put('/:id/subscriptions', honoAuth, async (c) => {
  const result = await setSubscriptionMethodSubscriptionsHandler(
    Number(c.req.param('id')),
    await c.req.json(),
  );
  return c.json(result.body, result.status as any);
});

methods.put('/:id', honoAuth, async (c) => {
  const result = await updateSubscriptionMethodHandler(Number(c.req.param('id')), await c.req.json());
  return c.json(result.body, result.status as any);
});

methods.delete('/:id', honoAuth, async (c) => {
  const result = await deleteSubscriptionMethodHandler(Number(c.req.param('id')));
  return c.json(result.body, result.status as any);
});

export { methods as subscriptionMethodRoutes };

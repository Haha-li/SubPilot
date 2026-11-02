import { Hono } from 'hono';
import type { WorkerEnv } from '../../types/env';
import { honoAuth } from '../middleware/auth';
import {
  createSubscriptionMethodHandler,
  deleteSubscriptionMethodHandler,
  listSubscriptionMethodsHandler,
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

methods.put('/:id', honoAuth, async (c) => {
  const result = await updateSubscriptionMethodHandler(Number(c.req.param('id')), await c.req.json());
  return c.json(result.body, result.status as any);
});

methods.delete('/:id', honoAuth, async (c) => {
  const result = await deleteSubscriptionMethodHandler(Number(c.req.param('id')));
  return c.json(result.body, result.status as any);
});

export { methods as subscriptionMethodRoutes };

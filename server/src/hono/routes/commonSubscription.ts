import { Hono } from 'hono';
import { honoAuth } from '../middleware/auth';
import {
  createCommonSubscriptionHandler,
  deleteCommonSubscriptionHandler,
  listCommonSubscriptionsHandler,
  updateCommonSubscriptionHandler,
} from '../../handlers/commonSubscription';

const commonSubscriptions = new Hono();

commonSubscriptions.get('/', honoAuth, async (c) => {
  const result = await listCommonSubscriptionsHandler({ search: c.req.query('search') });
  return c.json(result.body, result.status as any);
});

commonSubscriptions.post('/', honoAuth, async (c) => {
  const result = await createCommonSubscriptionHandler(await c.req.json());
  return c.json(result.body, result.status as any);
});

commonSubscriptions.put('/:id', honoAuth, async (c) => {
  const result = await updateCommonSubscriptionHandler(
    Number(c.req.param('id')),
    await c.req.json(),
  );
  return c.json(result.body, result.status as any);
});

commonSubscriptions.delete('/:id', honoAuth, async (c) => {
  const result = await deleteCommonSubscriptionHandler(Number(c.req.param('id')));
  return c.json(result.body, result.status as any);
});

export { commonSubscriptions as commonSubscriptionRoutes };

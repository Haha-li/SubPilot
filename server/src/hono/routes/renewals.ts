import { Hono } from 'hono';
import type { WorkerEnv } from '../../types/env';
import { honoAuth } from '../middleware/auth';
import {
  batchRenewalsHandler,
  listRenewalHistoryHandler,
  listSubscriptionRenewalsHandler,
  renewSubscriptionHandler,
} from '../../handlers/renewals';

const renewals = new Hono<WorkerEnv>();

renewals.get('/', honoAuth, async (c) => {
  const result = await listRenewalHistoryHandler({
    page: c.req.query('page'),
    pageSize: c.req.query('pageSize'),
    source: c.req.query('source'),
    search: c.req.query('search'),
    subscriptionId: c.req.query('subscriptionId'),
  });
  return c.json(result.body, result.status as any);
});

renewals.post('/batch', honoAuth, async (c) => {
  const result = await batchRenewalsHandler(await c.req.json());
  return c.json(result.body, result.status as any);
});

renewals.post('/:id/renew', honoAuth, async (c) => {
  const result = await renewSubscriptionHandler(Number(c.req.param('id')), await c.req.json());
  return c.json(result.body, result.status as any);
});

renewals.get('/:id', honoAuth, async (c) => {
  const result = await listSubscriptionRenewalsHandler(Number(c.req.param('id')));
  return c.json(result.body, result.status as any);
});

export { renewals as renewalRoutes };

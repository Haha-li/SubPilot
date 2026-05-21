import { Hono } from 'hono';
import { honoAuth } from '../middleware/auth';
import {
  listSubscriptionsHandler,
  createSubscriptionHandler,
  updateSubscriptionHandler,
  deleteSubscriptionHandler,
  toggleSubscriptionHandler,
  testNotifySubscriptionHandler,
} from '../../handlers/subscription';

const subs = new Hono();

// Get all subscriptions
subs.get('/', honoAuth, async (c) => {
  const query: any = {};
  const search = c.req.query('search');
  const category = c.req.query('category');
  if (search) query.search = search;
  if (category) query.category = category;
  const result = await listSubscriptionsHandler(query);
  return c.json(result.body, result.status as any);
});

// Create subscription
subs.post('/', honoAuth, async (c) => {
  const body = await c.req.json();
  const result = await createSubscriptionHandler(body);
  return c.json(result.body, result.status as any);
});

// Update subscription
subs.put('/:id', honoAuth, async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  const result = await updateSubscriptionHandler(id, body);
  return c.json(result.body, result.status as any);
});

// Delete subscription
subs.delete('/:id', honoAuth, async (c) => {
  const id = Number(c.req.param('id'));
  const result = await deleteSubscriptionHandler(id);
  return c.json(result.body, result.status as any);
});

// Toggle subscription status
subs.post('/:id/toggle', honoAuth, async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  const result = await toggleSubscriptionHandler(id, body);
  return c.json(result.body, result.status as any);
});

// Test notification for a subscription
subs.post('/:id/test-notify', honoAuth, async (c) => {
  const id = Number(c.req.param('id'));
  const result = await testNotifySubscriptionHandler(id);
  return c.json(result.body, result.status as any);
});

export { subs as subscriptionRoutes };

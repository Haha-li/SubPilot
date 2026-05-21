import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import {
  listSubscriptionsHandler,
  createSubscriptionHandler,
  updateSubscriptionHandler,
  deleteSubscriptionHandler,
  toggleSubscriptionHandler,
  testNotifySubscriptionHandler,
} from '../handlers/subscription';

const router = Router();

// Get all subscriptions
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const result = await listSubscriptionsHandler(req.query);
  res.status(result.status).json(result.body);
});

// Create subscription
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const result = await createSubscriptionHandler(req.body);
  res.status(result.status).json(result.body);
});

// Update subscription
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const result = await updateSubscriptionHandler(Number(req.params.id), req.body);
  res.status(result.status).json(result.body);
});

// Delete subscription
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const result = await deleteSubscriptionHandler(Number(req.params.id));
  res.status(result.status).json(result.body);
});

// Toggle subscription status
router.post('/:id/toggle', authMiddleware, async (req: AuthRequest, res: Response) => {
  const result = await toggleSubscriptionHandler(Number(req.params.id), req.body);
  res.status(result.status).json(result.body);
});

// Test notification for a subscription
router.post('/:id/test-notify', authMiddleware, async (req: AuthRequest, res: Response) => {
  const result = await testNotifySubscriptionHandler(Number(req.params.id));
  res.status(result.status).json(result.body);
});

export default router;

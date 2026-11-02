import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import {
  createSubscriptionMethodHandler,
  deleteSubscriptionMethodHandler,
  listSubscriptionMethodsHandler,
  updateSubscriptionMethodHandler,
} from '../handlers/subscriptionMethod';

const router = Router();

router.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const result = await listSubscriptionMethodsHandler();
  res.status(result.status).json(result.body);
});

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const result = await createSubscriptionMethodHandler(req.body);
  res.status(result.status).json(result.body);
});

router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const result = await updateSubscriptionMethodHandler(Number(req.params.id), req.body);
  res.status(result.status).json(result.body);
});

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const result = await deleteSubscriptionMethodHandler(Number(req.params.id));
  res.status(result.status).json(result.body);
});

export default router;

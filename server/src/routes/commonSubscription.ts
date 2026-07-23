import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import {
  createCommonSubscriptionHandler,
  deleteCommonSubscriptionHandler,
  fetchCommonSubscriptionIconHandler,
  listCommonSubscriptionsHandler,
  updateCommonSubscriptionHandler,
} from '../handlers/commonSubscription';

const router = Router();

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const result = await listCommonSubscriptionsHandler(req.query);
  res.status(result.status).json(result.body);
});

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const result = await createCommonSubscriptionHandler(req.body);
  res.status(result.status).json(result.body);
});

router.post('/fetch-icon', authMiddleware, async (req: AuthRequest, res: Response) => {
  const result = await fetchCommonSubscriptionIconHandler(req.body);
  res.status(result.status).json(result.body);
});

router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const result = await updateCommonSubscriptionHandler(Number(req.params.id), req.body);
  res.status(result.status).json(result.body);
});

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const result = await deleteCommonSubscriptionHandler(Number(req.params.id));
  res.status(result.status).json(result.body);
});

export default router;

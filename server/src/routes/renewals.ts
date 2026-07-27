import { Router, type Response } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth';
import {
  batchRenewalsHandler,
  listRenewalHistoryHandler,
  listSubscriptionRenewalsHandler,
  renewSubscriptionHandler,
} from '../handlers/renewals';

const router = Router();

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const result = await listRenewalHistoryHandler(req.query);
  res.status(result.status).json(result.body);
});

router.post('/batch', authMiddleware, async (req: AuthRequest, res: Response) => {
  const result = await batchRenewalsHandler(req.body);
  res.status(result.status).json(result.body);
});

router.post('/:id/renew', authMiddleware, async (req: AuthRequest, res: Response) => {
  const result = await renewSubscriptionHandler(Number(req.params.id), req.body);
  res.status(result.status).json(result.body);
});

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const result = await listSubscriptionRenewalsHandler(Number(req.params.id));
  res.status(result.status).json(result.body);
});

export default router;

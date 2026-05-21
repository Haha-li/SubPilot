import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth';
export { generateToken } from '../utils/auth';

export interface AuthRequest extends Request {
  userId?: number;
  username?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ success: false, message: '未登录' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ success: false, message: '登录已过期' });
  }

  req.userId = decoded.userId;
  req.username = decoded.username;
  next();
}

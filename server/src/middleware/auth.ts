import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth';
import { requireJwtSecret, SecurityConfigError } from '../utils/securityConfig';

export interface AuthRequest extends Request {
  userId?: number;
  username?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ success: false, message: '未登录' });
  }

  let jwtSecret: string;
  try {
    jwtSecret = requireJwtSecret(process.env.JWT_SECRET);
  } catch (error) {
    if (error instanceof SecurityConfigError) {
      console.error(`Authentication configuration error: ${error.message}`);
    }
    return res.status(500).json({ success: false, message: '服务端认证配置无效' });
  }

  const decoded = verifyToken(token, jwtSecret);
  if (!decoded) {
    return res.status(401).json({ success: false, message: '登录已过期' });
  }

  req.userId = decoded.userId;
  req.username = decoded.username;
  next();
}

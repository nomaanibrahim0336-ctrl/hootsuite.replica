import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me';

export interface AuthedRequest extends Request {
  userId?: string;
}

export function signTokens(userId: string) {
  const accessToken = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '1h' });
  const refreshToken = jwt.sign({ sub: userId }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

export function verifyRefresh(token: string): string | null {
  try {
    const payload = jwt.verify(token, JWT_REFRESH_SECRET) as { sub: string };
    return payload.sub;
  } catch {
    return null;
  }
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Missing or invalid Authorization header' });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as { sub: string };
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

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

export function signResetToken(userId: string): string {
  return jwt.sign({ sub: userId, purpose: 'reset' }, JWT_SECRET, { expiresIn: '15m' });
}

export function verifyResetToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; purpose?: string };
    return payload.purpose === 'reset' ? payload.sub : null;
  } catch {
    return null;
  }
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  // EventSource (used for the live-inbox stream) can't set custom headers,
  // so it authenticates via a ?token= query param instead — same JWT,
  // verified the same way, just a different carrier.
  const token = header?.startsWith('Bearer ') ? header.slice(7) : (req.query.token as string | undefined);
  if (!token) {
    return res.status(401).json({ success: false, error: 'Missing or invalid Authorization header' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

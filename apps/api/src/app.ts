import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { requireAuth } from './auth';
import { prisma } from './prisma';
import authRoutes from './routes/auth';
import networkRoutes from './routes/networks';
import postRoutes from './routes/posts';
import inboxRoutes from './routes/inbox';
import listeningRoutes from './routes/listening';
import analyticsRoutes from './routes/analytics';
import aiRoutes from './routes/ai';
import teamRoutes from './routes/teams';
import advocacyRoutes from './routes/advocacy';
import auditRoutes from './routes/audit';
import oauthRoutes from './routes/oauth';
import ayrshareRoutes from './routes/ayrshare';
import zernioRoutes from './routes/zernio';
import webhookRoutes from './routes/webhooks';

export function createApp() {
  const app = express();

  // Railway (and most PaaS) sit behind a reverse proxy that sets X-Forwarded-For;
  // without this express-rate-limit throws on every request.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({
    origin: (origin, cb) => {
      const allowed = process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
        : ['http://localhost:3000'];
      if (!origin || allowed.some(o => origin === o || origin.endsWith('.vercel.app'))) {
        cb(null, true);
      } else {
        cb(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }));
  // Capture the raw request body alongside Express's parsed JSON — webhook
  // signatures (e.g. Zernio's X-Zernio-Signature) are computed over the exact
  // bytes received, which the parsed object can't reliably reproduce.
  app.use(express.json({
    limit: '2mb',
    verify: (req: any, _res, buf) => { req.rawBody = buf; },
  }));

  // Safety net: bound any request (e.g. an unhandled async rejection that never
  // sends a response) to 15s so a stuck handler can't hold the connection open.
  // Exempts the inbox SSE stream, which is a deliberately long-lived connection.
  if (process.env.NODE_ENV !== 'test') {
    app.use((req, res, next) => {
      if (req.path === '/api/inbox/stream') return next();
      res.setTimeout(15000, () => {
        if (!res.headersSent) res.status(503).json({ success: false, error: 'Request timed out' });
      });
      next();
    });
  }

  // Rate limiting: 100 req/min per IP on the API surface. Disabled under test.
  if (process.env.NODE_ENV !== 'test') {
    app.use(
      '/api',
      rateLimit({
        windowMs: 60 * 1000,
        max: 100,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, error: 'Too many requests, please try again later.' },
      })
    );
  }

  app.get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok', uptime: process.uptime() } }));

  // Deep health check: actually round-trips to the database so the diagnostics
  // panel can distinguish "API up but DB unreachable" from a healthy stack, and
  // surface the real Postgres/Prisma error text (e.g. bad DATABASE_URL, pooler
  // prepared-statement errors) instead of a generic failure. Public on purpose
  // so it works even when auth is misconfigured.
  app.get('/health/db', async (_req, res) => {
    const startedAt = Date.now();
    try {
      const users = await prisma.user.count();
      res.json({
        success: true,
        data: { status: 'ok', latencyMs: Date.now() - startedAt, users },
      });
    } catch (e: any) {
      res.status(503).json({
        success: false,
        error: e?.message?.slice(0, 500) || 'Database query failed',
        data: { status: 'error', latencyMs: Date.now() - startedAt },
      });
    }
  });

  // Public
  app.use('/api/auth', authRoutes);
  app.use('/api/oauth', oauthRoutes); // OAuth callbacks must be public (no JWT)
  app.use('/api/webhooks', webhookRoutes); // Third-party callbacks — verified by signature, not a session

  // Protected
  app.use('/api/networks', requireAuth, networkRoutes);
  app.use('/api/posts', requireAuth, postRoutes);
  app.use('/api/inbox', requireAuth, inboxRoutes);
  app.use('/api/listening', requireAuth, listeningRoutes);
  app.use('/api/analytics', requireAuth, analyticsRoutes);
  app.use('/api/ai', requireAuth, aiRoutes);
  app.use('/api/teams', requireAuth, teamRoutes);
  app.use('/api/advocacy', requireAuth, advocacyRoutes);
  app.use('/api/audit', requireAuth, auditRoutes);
  app.use('/api/ayrshare', requireAuth, ayrshareRoutes);
  app.use('/api/zernio', requireAuth, zernioRoutes);

  app.use((_req, res) => res.status(404).json({ success: false, error: 'Not found' }));

  // Centralized error handler. Malformed JSON → 400; everything else → 500.
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
      return res.status(400).json({ success: false, error: 'Invalid JSON body' });
    }
    console.error(err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  });

  return app;
}

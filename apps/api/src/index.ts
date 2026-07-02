import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { requireAuth } from './auth';
import authRoutes from './routes/auth';
import networkRoutes from './routes/networks';
import postRoutes from './routes/posts';
import inboxRoutes from './routes/inbox';
import listeningRoutes from './routes/listening';
import analyticsRoutes from './routes/analytics';
import aiRoutes from './routes/ai';
import teamRoutes from './routes/teams';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Rate limiting: 100 req/min per IP on the API surface.
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

app.get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok', uptime: process.uptime() } }));

// Public
app.use('/api/auth', authRoutes);

// Protected
app.use('/api/networks', requireAuth, networkRoutes);
app.use('/api/posts', requireAuth, postRoutes);
app.use('/api/inbox', requireAuth, inboxRoutes);
app.use('/api/listening', requireAuth, listeningRoutes);
app.use('/api/analytics', requireAuth, analyticsRoutes);
app.use('/api/ai', requireAuth, aiRoutes);
app.use('/api/teams', requireAuth, teamRoutes);

app.use((_req, res) => res.status(404).json({ success: false, error: 'Not found' }));

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 SocialHub API listening on http://localhost:${PORT}`);
});

export default app;

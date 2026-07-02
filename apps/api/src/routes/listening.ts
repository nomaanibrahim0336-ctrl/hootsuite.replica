import { Router } from 'express';
import { db, uid, sentimentTrend } from '../data';

const router = Router();

router.get('/streams', (_req, res) => res.json({ success: true, data: db.streams }));

router.post('/streams', (req, res) => {
  const { name, keywords = [], sources = [] } = req.body ?? {};
  if (!name) return res.status(400).json({ success: false, error: 'name is required' });
  const stream = {
    id: uid(), name,
    keywords: Array.isArray(keywords) ? keywords : String(keywords).split(',').map((k) => k.trim()),
    sources, isActive: true, mentionCount: 0, createdAt: new Date().toISOString(),
  };
  db.streams.unshift(stream);
  res.status(201).json({ success: true, data: stream });
});

router.get('/mentions', (req, res) => {
  const { streamId, sentiment } = req.query;
  let data = db.mentions;
  if (streamId) data = data.filter((m) => m.streamId === streamId);
  if (sentiment) data = data.filter((m) => m.sentiment === sentiment);
  res.json({ success: true, data, total: data.length });
});

router.get('/sentiment', (_req, res) => {
  const total = db.mentions.length || 1;
  const pos = db.mentions.filter((m) => m.sentiment === 'positive').length;
  const neg = db.mentions.filter((m) => m.sentiment === 'negative').length;
  res.json({
    success: true,
    data: {
      trend: sentimentTrend(),
      summary: {
        positive: Math.round((pos / total) * 100),
        negative: Math.round((neg / total) * 100),
        neutral: Math.round(((total - pos - neg) / total) * 100),
      },
    },
  });
});

export default router;

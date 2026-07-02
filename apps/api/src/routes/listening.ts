import { Router } from 'express';
import { prisma, mapStream, mapMention, toJson } from '../prisma';
import { sentimentTrend } from '../analytics';

const router = Router();

router.get('/streams', async (_req, res) => {
  const rows = await prisma.stream.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ success: true, data: rows.map(mapStream) });
});

router.post('/streams', async (req, res) => {
  const { name, keywords = [], sources = [] } = req.body ?? {};
  if (!name) return res.status(400).json({ success: false, error: 'name is required' });
  const kw = Array.isArray(keywords) ? keywords : String(keywords).split(',').map((k) => k.trim());
  const s = await prisma.stream.create({
    data: { name, keywords: toJson(kw), sources: toJson(sources), isActive: true, mentionCount: 0 },
  });
  res.status(201).json({ success: true, data: mapStream(s) });
});

router.get('/mentions', async (req, res) => {
  const { streamId, sentiment } = req.query;
  const rows = await prisma.mention.findMany({
    where: {
      ...(streamId ? { streamId: String(streamId) } : {}),
      ...(sentiment ? { sentiment: String(sentiment) } : {}),
    },
    orderBy: { timestamp: 'desc' },
  });
  const data = rows.map(mapMention);
  res.json({ success: true, data, total: data.length });
});

router.get('/sentiment', async (_req, res) => {
  const all = await prisma.mention.findMany();
  const total = all.length || 1;
  const pos = all.filter((m) => m.sentiment === 'positive').length;
  const neg = all.filter((m) => m.sentiment === 'negative').length;
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

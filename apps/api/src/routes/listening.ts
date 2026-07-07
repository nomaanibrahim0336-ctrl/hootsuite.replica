import { Router } from 'express';
import { prisma, mapStream, mapMention, toJson } from '../prisma';
import { sentimentTrend } from '../analytics';
import { classifySentiment } from '../sentiment';
import { syncZernioListening } from '../zernioListeningSync';

const router = Router();

// Sample corpus the ingestion pipeline draws from (stands in for live crawl/API pull).
const SAMPLE_MENTIONS = [
  { author: 'Ava Patel', user: '@avap', text: 'Just switched to @socialhub and I love the new dashboard!' },
  { author: 'Noah Kim', user: '@noahk', text: 'socialhub support is amazing, thanks for the quick help 🙌' },
  { author: 'Mia Torres', user: '@miat', text: 'Not happy with the latest pricing, feels expensive.' },
  { author: 'Lucas Brown', user: '@lucasb', text: 'socialhub vs competitors — which do you recommend?' },
  { author: 'Emma Watson', user: '@emma_w', text: 'The scheduling feature saved me hours this week.' },
  { author: 'James Carter', user: '@jcarter', text: 'Hit a bug in the analytics report, pretty disappointed.' },
];
const NETWORKS = ['twitter', 'instagram', 'facebook', 'linkedin'];
const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];

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

// Ingestion pipeline: pull sample mentions, classify sentiment, store, update count.
router.post('/streams/:id/ingest', async (req, res) => {
  const stream = await prisma.stream.findUnique({ where: { id: req.params.id } });
  if (!stream) return res.status(404).json({ success: false, error: 'Stream not found' });
  const count = Math.min(Number(req.body?.count) || 3, 20);

  const created = [];
  for (let i = 0; i < count; i++) {
    const sample = pick(SAMPLE_MENTIONS);
    const m = await prisma.mention.create({
      data: {
        streamId: stream.id,
        network: pick(NETWORKS),
        authorName: sample.author,
        authorUser: sample.user,
        content: sample.text,
        sentiment: classifySentiment(sample.text),
        likes: Math.floor(Math.random() * 80),
        shares: Math.floor(Math.random() * 20),
        comments: Math.floor(Math.random() * 15),
      },
    });
    created.push(mapMention(m));
  }
  await prisma.stream.update({ where: { id: stream.id }, data: { mentionCount: { increment: count } } });
  res.status(201).json({ success: true, data: created, total: created.length });
});

// View a single stream.
router.get('/streams/:id', async (req, res) => {
  const stream = await prisma.stream.findUnique({ where: { id: req.params.id } });
  if (!stream) return res.status(404).json({ success: false, error: 'Stream not found' });
  res.json({ success: true, data: mapStream(stream) });
});

// Edit a stream (name, keywords, sources, active state).
router.put('/streams/:id', async (req, res) => {
  const exists = await prisma.stream.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ success: false, error: 'Stream not found' });
  const b = req.body ?? {};
  const kw = b.keywords === undefined
    ? undefined
    : Array.isArray(b.keywords) ? b.keywords : String(b.keywords).split(',').map((k: string) => k.trim()).filter(Boolean);
  const stream = await prisma.stream.update({
    where: { id: req.params.id },
    data: {
      ...(b.name !== undefined ? { name: b.name } : {}),
      ...(kw !== undefined ? { keywords: toJson(kw) } : {}),
      ...(b.sources !== undefined ? { sources: toJson(b.sources) } : {}),
      ...(typeof b.isActive === 'boolean' ? { isActive: b.isActive } : {}),
    },
  });
  res.json({ success: true, data: mapStream(stream) });
});

// Delete a stream and its mentions.
router.delete('/streams/:id', async (req, res) => {
  const exists = await prisma.stream.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ success: false, error: 'Stream not found' });
  // Mention.streamId has no cascade — clear its mentions first to avoid an FK error.
  await prisma.$transaction([
    prisma.mention.deleteMany({ where: { streamId: req.params.id } }),
    prisma.stream.delete({ where: { id: req.params.id } }),
  ]);
  res.json({ success: true, data: mapStream(exists) });
});

router.get('/mentions', async (req, res) => {
  // Fire-and-forget: pull fresh brand mentions/comments from Zernio without
  // blocking the response (mirrors the inbox sync). Data lags by at most one
  // request.
  syncZernioListening().catch((e: any) => console.error('[listening] Zernio sync failed:', e.message));

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

import { Router } from 'express';
import { prisma, mapPost, toJson } from '../prisma';

const router = Router();

router.get('/', async (req, res) => {
  const { status } = req.query;
  const rows = await prisma.post.findMany({
    where: status ? { status: String(status) } : undefined,
    orderBy: { createdAt: 'desc' },
  });
  const data = rows.map(mapPost);
  res.json({ success: true, data, total: data.length });
});

router.get('/calendar', async (_req, res) => {
  const rows = await prisma.post.findMany({
    where: { OR: [{ scheduledAt: { not: null } }, { publishedAt: { not: null } }] },
  });
  const data = rows.map((p) => {
    const m = mapPost(p);
    return { id: m.id, content: m.content, networks: m.networks, status: m.status, date: m.scheduledAt || m.publishedAt };
  });
  res.json({ success: true, data });
});

router.get('/:id', async (req, res) => {
  const p = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!p) return res.status(404).json({ success: false, error: 'Post not found' });
  res.json({ success: true, data: mapPost(p) });
});

router.post('/', async (req, res) => {
  const { content, networks = [], status = 'draft', scheduledAt, hashtags } = req.body ?? {};
  if (!content) return res.status(400).json({ success: false, error: 'content is required' });
  const p = await prisma.post.create({
    data: {
      content,
      networks: toJson(networks),
      status,
      hashtags: hashtags ? toJson(hashtags) : null,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      publishedAt: status === 'published' ? new Date() : null,
    },
  });
  res.status(201).json({ success: true, data: mapPost(p) });
});

router.post('/bulk', async (req, res) => {
  const items = Array.isArray(req.body?.posts) ? req.body.posts : [];
  const created = [];
  for (const it of items) {
    const p = await prisma.post.create({
      data: {
        content: it.content ?? '',
        networks: toJson(it.networks ?? []),
        status: it.status ?? 'scheduled',
        scheduledAt: it.scheduledAt ? new Date(it.scheduledAt) : null,
      },
    });
    created.push(mapPost(p));
  }
  res.status(201).json({ success: true, data: created, total: created.length });
});

router.put('/:id', async (req, res) => {
  const exists = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ success: false, error: 'Post not found' });
  const b = req.body ?? {};
  const p = await prisma.post.update({
    where: { id: req.params.id },
    data: {
      ...(b.content !== undefined ? { content: b.content } : {}),
      ...(b.networks !== undefined ? { networks: toJson(b.networks) } : {}),
      ...(b.status !== undefined ? { status: b.status } : {}),
      ...(b.hashtags !== undefined ? { hashtags: toJson(b.hashtags) } : {}),
      ...(b.scheduledAt !== undefined ? { scheduledAt: b.scheduledAt ? new Date(b.scheduledAt) : null } : {}),
    },
  });
  res.json({ success: true, data: mapPost(p) });
});

router.delete('/:id', async (req, res) => {
  const exists = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ success: false, error: 'Post not found' });
  await prisma.post.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: mapPost(exists) });
});

router.post('/:id/schedule', async (req, res) => {
  const exists = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ success: false, error: 'Post not found' });
  const p = await prisma.post.update({
    where: { id: req.params.id },
    data: {
      status: 'scheduled',
      scheduledAt: req.body?.scheduledAt ? new Date(req.body.scheduledAt) : exists.scheduledAt ?? new Date(Date.now() + 3600000),
    },
  });
  res.json({ success: true, data: mapPost(p) });
});

router.post('/:id/publish', async (req, res) => {
  const exists = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ success: false, error: 'Post not found' });
  const p = await prisma.post.update({
    where: { id: req.params.id },
    data: { status: 'published', publishedAt: new Date(), engagements: toJson({ likes: 0, comments: 0, shares: 0, impressions: 0 }) },
  });
  res.json({ success: true, data: mapPost(p) });
});

export default router;

import { Router } from 'express';
import { db, uid } from '../data';

const router = Router();

router.get('/', (req, res) => {
  const { status } = req.query;
  let data = db.posts;
  if (status) data = data.filter((p) => p.status === status);
  res.json({ success: true, data, total: data.length });
});

router.get('/calendar', (req, res) => {
  const data = db.posts
    .filter((p) => p.scheduledAt || p.publishedAt)
    .map((p) => ({ id: p.id, content: p.content, networks: p.networks, status: p.status, date: p.scheduledAt || p.publishedAt }));
  res.json({ success: true, data });
});

router.get('/:id', (req, res) => {
  const p = db.posts.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ success: false, error: 'Post not found' });
  res.json({ success: true, data: p });
});

router.post('/', (req, res) => {
  const { content, networks = [], status = 'draft', scheduledAt, hashtags } = req.body ?? {};
  if (!content) return res.status(400).json({ success: false, error: 'content is required' });
  const post = {
    id: uid(), content, networks, status, scheduledAt, hashtags,
    publishedAt: status === 'published' ? new Date().toISOString() : undefined,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  db.posts.unshift(post);
  res.status(201).json({ success: true, data: post });
});

router.post('/bulk', (req, res) => {
  const items = Array.isArray(req.body?.posts) ? req.body.posts : [];
  const created = items.map((it: any) => {
    const post = {
      id: uid(), content: it.content ?? '', networks: it.networks ?? [], status: it.status ?? 'scheduled',
      scheduledAt: it.scheduledAt, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    db.posts.unshift(post);
    return post;
  });
  res.status(201).json({ success: true, data: created, total: created.length });
});

router.put('/:id', (req, res) => {
  const p = db.posts.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ success: false, error: 'Post not found' });
  Object.assign(p, req.body, { updatedAt: new Date().toISOString() });
  res.json({ success: true, data: p });
});

router.delete('/:id', (req, res) => {
  const i = db.posts.findIndex((x) => x.id === req.params.id);
  if (i === -1) return res.status(404).json({ success: false, error: 'Post not found' });
  const [removed] = db.posts.splice(i, 1);
  res.json({ success: true, data: removed });
});

router.post('/:id/schedule', (req, res) => {
  const p = db.posts.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ success: false, error: 'Post not found' });
  p.status = 'scheduled';
  p.scheduledAt = req.body?.scheduledAt ?? p.scheduledAt ?? new Date(Date.now() + 3600000).toISOString();
  p.updatedAt = new Date().toISOString();
  res.json({ success: true, data: p });
});

router.post('/:id/publish', (req, res) => {
  const p = db.posts.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ success: false, error: 'Post not found' });
  p.status = 'published';
  p.publishedAt = new Date().toISOString();
  p.engagements = { likes: 0, comments: 0, shares: 0, impressions: 0 };
  p.updatedAt = new Date().toISOString();
  res.json({ success: true, data: p });
});

export default router;

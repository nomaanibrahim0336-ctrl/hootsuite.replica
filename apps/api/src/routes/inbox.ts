import { Router } from 'express';
import { db, uid } from '../data';

const router = Router();

router.get('/', (req, res) => {
  const { status, network } = req.query;
  let data = db.messages;
  if (status) data = data.filter((m) => m.status === status);
  if (network) data = data.filter((m) => m.network === network);
  res.json({ success: true, data, total: data.length });
});

router.get('/saved-replies', (_req, res) => res.json({ success: true, data: db.savedReplies }));

router.post('/saved-replies', (req, res) => {
  const { title, content } = req.body ?? {};
  if (!title || !content) return res.status(400).json({ success: false, error: 'title and content are required' });
  const reply = { id: uid(), title, content };
  db.savedReplies.push(reply);
  res.status(201).json({ success: true, data: reply });
});

router.put('/:id/read', (req, res) => {
  const m = db.messages.find((x) => x.id === req.params.id);
  if (!m) return res.status(404).json({ success: false, error: 'Message not found' });
  m.isRead = true;
  res.json({ success: true, data: m });
});

router.put('/:id/assign', (req, res) => {
  const m = db.messages.find((x) => x.id === req.params.id);
  if (!m) return res.status(404).json({ success: false, error: 'Message not found' });
  m.assignedTo = req.body?.assignedTo ?? 'Unassigned';
  m.status = 'assigned';
  res.json({ success: true, data: m });
});

router.post('/:id/reply', (req, res) => {
  const m = db.messages.find((x) => x.id === req.params.id);
  if (!m) return res.status(404).json({ success: false, error: 'Message not found' });
  const { content } = req.body ?? {};
  if (!content) return res.status(400).json({ success: false, error: 'content is required' });
  m.thread = m.thread ?? [];
  m.thread.push({ id: uid(), content, isFromUs: true, timestamp: new Date().toISOString() });
  m.status = 'resolved';
  res.json({ success: true, data: m });
});

export default router;

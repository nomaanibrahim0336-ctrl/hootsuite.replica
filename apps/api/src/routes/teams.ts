import { Router } from 'express';
import { db, uid } from '../data';

const router = Router();

router.get('/', (_req, res) => res.json({ success: true, data: db.team }));
router.get('/members', (_req, res) => res.json({ success: true, data: db.team }));

router.post('/members', (req, res) => {
  const { name, email, role = 'viewer' } = req.body ?? {};
  if (!name || !email) return res.status(400).json({ success: false, error: 'name and email are required' });
  const member = { id: uid(), name, email, role, joinedAt: new Date().toISOString() };
  db.team.push(member);
  res.status(201).json({ success: true, data: member });
});

router.put('/members/:id', (req, res) => {
  const m = db.team.find((x) => x.id === req.params.id);
  if (!m) return res.status(404).json({ success: false, error: 'Member not found' });
  Object.assign(m, req.body);
  res.json({ success: true, data: m });
});

router.delete('/members/:id', (req, res) => {
  const i = db.team.findIndex((x) => x.id === req.params.id);
  if (i === -1) return res.status(404).json({ success: false, error: 'Member not found' });
  const [removed] = db.team.splice(i, 1);
  res.json({ success: true, data: removed });
});

export default router;

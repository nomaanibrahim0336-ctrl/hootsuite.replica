import { Router } from 'express';
import { db, uid } from '../data';

const router = Router();

router.get('/', (_req, res) => res.json({ success: true, data: db.networks }));

router.post('/', (req, res) => {
  const { type, name, username } = req.body ?? {};
  if (!type) return res.status(400).json({ success: false, error: 'type is required' });
  const existing = db.networks.find((n) => n.type === type);
  if (existing) {
    existing.connected = true;
    existing.name = name ?? existing.name;
    existing.username = username ?? existing.username;
    existing.followers = existing.followers || Math.floor(Math.random() * 40000 + 5000);
    existing.connectedAt = new Date().toISOString();
    return res.json({ success: true, data: existing });
  }
  const network = {
    id: uid(), type, name: name ?? type, username: username ?? '@handle',
    followers: Math.floor(Math.random() * 40000 + 5000), connected: true,
    connectedAt: new Date().toISOString(),
  };
  db.networks.push(network);
  res.status(201).json({ success: true, data: network });
});

router.delete('/:id', (req, res) => {
  const n = db.networks.find((x) => x.id === req.params.id);
  if (!n) return res.status(404).json({ success: false, error: 'Network not found' });
  n.connected = false;
  n.followers = 0;
  res.json({ success: true, data: n });
});

router.get('/:id/status', (req, res) => {
  const n = db.networks.find((x) => x.id === req.params.id);
  if (!n) return res.status(404).json({ success: false, error: 'Network not found' });
  res.json({ success: true, data: { id: n.id, connected: n.connected } });
});

export default router;

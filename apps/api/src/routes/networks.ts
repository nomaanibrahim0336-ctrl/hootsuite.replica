import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

router.get('/', async (_req, res) => {
  const data = await prisma.network.findMany({ orderBy: { connectedAt: 'asc' } });
  res.json({ success: true, data });
});

router.post('/', async (req, res) => {
  const { type, name, username } = req.body ?? {};
  if (!type) return res.status(400).json({ success: false, error: 'type is required' });
  const existing = await prisma.network.findFirst({ where: { type } });
  if (existing) {
    const updated = await prisma.network.update({
      where: { id: existing.id },
      data: {
        connected: true,
        name: name ?? existing.name,
        username: username ?? existing.username,
        followers: existing.followers || Math.floor(Math.random() * 40000 + 5000),
        connectedAt: new Date(),
      },
    });
    return res.json({ success: true, data: updated });
  }
  const network = await prisma.network.create({
    data: {
      type, name: name ?? type, username: username ?? '@handle',
      followers: Math.floor(Math.random() * 40000 + 5000), connected: true,
    },
  });
  res.status(201).json({ success: true, data: network });
});

router.delete('/:id', async (req, res) => {
  const n = await prisma.network.findUnique({ where: { id: req.params.id } });
  if (!n) return res.status(404).json({ success: false, error: 'Network not found' });
  const updated = await prisma.network.update({ where: { id: n.id }, data: { connected: false, followers: 0 } });
  res.json({ success: true, data: updated });
});

router.get('/:id/status', async (req, res) => {
  const n = await prisma.network.findUnique({ where: { id: req.params.id } });
  if (!n) return res.status(404).json({ success: false, error: 'Network not found' });
  res.json({ success: true, data: { id: n.id, connected: n.connected } });
});

export default router;

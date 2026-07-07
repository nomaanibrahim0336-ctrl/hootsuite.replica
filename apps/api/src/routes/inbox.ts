import { Router } from 'express';
import { prisma, mapMessage } from '../prisma';
import * as zernio from '../lib/zernio';
import { syncZernioInbox } from '../zernioInboxSync';

const router = Router();

router.get('/', async (req, res) => {
  // Fire-and-forget: with real accounts this can make several sequential
  // calls to Zernio (one per conversation) and must never block the
  // response — awaiting it here risked tripping the server's global 15s
  // request timeout once there were more than a handful of conversations.
  // Data lags by at most one request; that's an acceptable trade for a
  // response that's always fast.
  syncZernioInbox().catch((e: any) => console.error('[inbox] Zernio sync failed:', e.message));

  const { status, network } = req.query;
  const rows = await prisma.message.findMany({
    where: {
      ...(status ? { status: String(status) } : {}),
      ...(network ? { network: String(network) } : {}),
    },
    include: { replies: true },
    orderBy: { timestamp: 'desc' },
  });
  const data = rows.map(mapMessage);
  res.json({ success: true, data, total: data.length });
});

router.get('/saved-replies', async (_req, res) => {
  const data = await prisma.savedReply.findMany();
  res.json({ success: true, data });
});

router.post('/saved-replies', async (req, res) => {
  const { title, content } = req.body ?? {};
  if (!title || !content) return res.status(400).json({ success: false, error: 'title and content are required' });
  const reply = await prisma.savedReply.create({ data: { title, content } });
  res.status(201).json({ success: true, data: reply });
});

// View a single saved reply.
router.get('/saved-replies/:id', async (req, res) => {
  const reply = await prisma.savedReply.findUnique({ where: { id: req.params.id } });
  if (!reply) return res.status(404).json({ success: false, error: 'Saved reply not found' });
  res.json({ success: true, data: reply });
});

// Edit a saved reply.
router.put('/saved-replies/:id', async (req, res) => {
  const exists = await prisma.savedReply.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ success: false, error: 'Saved reply not found' });
  const { title, content } = req.body ?? {};
  const reply = await prisma.savedReply.update({
    where: { id: req.params.id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(content !== undefined ? { content } : {}),
    },
  });
  res.json({ success: true, data: reply });
});

// Delete a saved reply.
router.delete('/saved-replies/:id', async (req, res) => {
  const exists = await prisma.savedReply.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ success: false, error: 'Saved reply not found' });
  await prisma.savedReply.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: exists });
});

router.put('/:id/read', async (req, res) => {
  const m = await prisma.message.findUnique({ where: { id: req.params.id } });
  if (!m) return res.status(404).json({ success: false, error: 'Message not found' });
  if (m.externalId && m.accountId && zernio.isConfigured()) {
    zernio.markConversationRead(m.externalId, m.accountId).catch((e) => {
      console.error('[inbox] markConversationRead failed:', e.message);
    });
  }
  const updated = await prisma.message.update({ where: { id: m.id }, data: { isRead: true }, include: { replies: true } });
  res.json({ success: true, data: mapMessage(updated) });
});

router.put('/:id/assign', async (req, res) => {
  const m = await prisma.message.findUnique({ where: { id: req.params.id } });
  if (!m) return res.status(404).json({ success: false, error: 'Message not found' });
  const updated = await prisma.message.update({
    where: { id: m.id },
    data: { assignedTo: req.body?.assignedTo ?? 'Unassigned', status: 'assigned' },
    include: { replies: true },
  });
  res.json({ success: true, data: mapMessage(updated) });
});

router.put('/:id/resolve', async (req, res) => {
  const m = await prisma.message.findUnique({ where: { id: req.params.id } });
  if (!m) return res.status(404).json({ success: false, error: 'Message not found' });
  const updated = await prisma.message.update({ where: { id: m.id }, data: { status: 'resolved' }, include: { replies: true } });
  res.json({ success: true, data: mapMessage(updated) });
});

router.put('/:id/note', async (req, res) => {
  const m = await prisma.message.findUnique({ where: { id: req.params.id } });
  if (!m) return res.status(404).json({ success: false, error: 'Message not found' });
  const updated = await prisma.message.update({
    where: { id: m.id },
    data: { notes: req.body?.note ?? '' },
    include: { replies: true },
  });
  res.json({ success: true, data: mapMessage(updated) });
});

router.post('/:id/reply', async (req, res) => {
  const m = await prisma.message.findUnique({ where: { id: req.params.id } });
  if (!m) return res.status(404).json({ success: false, error: 'Message not found' });
  const { content } = req.body ?? {};
  if (!content) return res.status(400).json({ success: false, error: 'content is required' });

  // Synced-from-Zernio conversation — actually deliver the reply to the real platform.
  if (m.externalId && m.accountId) {
    if (!zernio.isConfigured()) {
      return res.status(503).json({ success: false, error: 'Zernio is not configured — cannot deliver this reply' });
    }
    try {
      await zernio.sendInboxMessage(m.externalId, m.accountId, content);
    } catch (e: any) {
      return res.status(502).json({ success: false, error: `Could not deliver reply via Zernio: ${e.message}` });
    }
  }

  await prisma.messageReply.create({ data: { messageId: m.id, content, isFromUs: true } });
  const updated = await prisma.message.update({ where: { id: m.id }, data: { status: 'resolved' }, include: { replies: true } });
  res.json({ success: true, data: mapMessage(updated) });
});

export default router;

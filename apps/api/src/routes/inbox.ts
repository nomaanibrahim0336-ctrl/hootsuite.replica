import { Router } from 'express';
import { prisma, mapMessage } from '../prisma';
import * as zernio from '../lib/zernio';
import { syncZernioInbox } from '../zernioInboxSync';
import { subscribeInboxEvents, publishInboxEvent } from '../realtime';

const router = Router();

// Live stream — pushes a `message` event the instant a new DM arrives via the
// Zernio webhook (routes/webhooks.ts), or the instant a reply is sent from
// any open tab. This is what makes the Inbox feel instant instead of relying
// on the polling sync. Standard Server-Sent Events: one long-lived GET, no
// client library needed (the browser's built-in EventSource handles it,
// including automatic reconnection if the connection drops).
router.get('/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // disable nginx/Railway proxy buffering so events flush immediately
  });
  res.write(': connected\n\n');

  const unsubscribe = subscribeInboxEvents((event) => {
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify('data' in event ? event.data : {})}\n\n`);
  });

  // Keep intermediary proxies from timing out an idle connection.
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

// Explicit, user-triggered "Sync now" — awaited, so the client knows exactly
// when fresh data has landed instead of guessing with a fixed delay. Bounded
// to 12s (under the server's global 15s request timeout): if Zernio is slow,
// we return `stillSyncing: true` rather than let the raw 503 timeout fire —
// the sync itself keeps running in the background either way.
router.post('/sync', async (_req, res) => {
  const sync = syncZernioInbox({ force: true });
  const timedOut = Symbol('timeout');
  const result = await Promise.race([sync, new Promise((r) => setTimeout(() => r(timedOut), 12_000))]);
  res.json({ success: true, data: { stillSyncing: result === timedOut } });
});

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
  const mapped = mapMessage(updated);
  publishInboxEvent({ type: 'message', data: mapped }); // other open tabs/sessions see the reply instantly too
  res.json({ success: true, data: mapped });
});

export default router;

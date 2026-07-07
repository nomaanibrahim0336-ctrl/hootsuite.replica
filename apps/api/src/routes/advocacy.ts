import { Router } from 'express';
import { prisma } from '../prisma';
import { requirePermission, PERMISSIONS } from '../rbac';
import { logAudit } from '../audit';
import { AuthedRequest } from '../auth';

const router = Router();

// Content hub — list brand-approved content available for employees to share.
router.get('/content', async (_req, res) => {
  const rows = await prisma.advocacyContent.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { shares: true } } },
  });
  const data = rows.map((c: any) => ({
    id: c.id, title: c.title, body: c.body, category: c.category,
    shareCount: c._count.shares, createdAt: c.createdAt,
  }));
  res.json({ success: true, data });
});

router.post('/content', requirePermission(PERMISSIONS.MANAGE_ADVOCACY), async (req: AuthedRequest, res) => {
  const { title, body, category = 'General' } = req.body ?? {};
  if (!title || !body) return res.status(400).json({ success: false, error: 'title and body are required' });
  const c = await prisma.advocacyContent.create({ data: { title, body, category } });
  await logAudit(req.userId, 'advocacy.create', 'advocacyContent', c.id);
  res.status(201).json({ success: true, data: c });
});

// View a single content item (with its share count).
router.get('/content/:id', async (req, res) => {
  const c: any = await prisma.advocacyContent.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { shares: true } } },
  });
  if (!c) return res.status(404).json({ success: false, error: 'Content not found' });
  res.json({
    success: true,
    data: { id: c.id, title: c.title, body: c.body, category: c.category, shareCount: c._count.shares, createdAt: c.createdAt },
  });
});

// Edit a content item.
router.put('/content/:id', requirePermission(PERMISSIONS.MANAGE_ADVOCACY), async (req: AuthedRequest, res) => {
  const exists = await prisma.advocacyContent.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ success: false, error: 'Content not found' });
  const b = req.body ?? {};
  const c = await prisma.advocacyContent.update({
    where: { id: req.params.id },
    data: {
      ...(b.title !== undefined ? { title: b.title } : {}),
      ...(b.body !== undefined ? { body: b.body } : {}),
      ...(b.category !== undefined ? { category: b.category } : {}),
    },
  });
  await logAudit(req.userId, 'advocacy.update', 'advocacyContent', c.id);
  res.json({ success: true, data: c });
});

// Delete a content item (its shares cascade).
router.delete('/content/:id', requirePermission(PERMISSIONS.MANAGE_ADVOCACY), async (req: AuthedRequest, res) => {
  const exists = await prisma.advocacyContent.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ success: false, error: 'Content not found' });
  await prisma.advocacyContent.delete({ where: { id: req.params.id } });
  await logAudit(req.userId, 'advocacy.delete', 'advocacyContent', req.params.id);
  res.json({ success: true, data: exists });
});

// One-click share by an employee.
router.post('/content/:id/share', async (req: AuthedRequest, res) => {
  const content = await prisma.advocacyContent.findUnique({ where: { id: req.params.id } });
  if (!content) return res.status(404).json({ success: false, error: 'Content not found' });
  const { employeeName = 'Employee', employeeEmail = 'employee@socialhub.app' } = req.body ?? {};
  const share = await prisma.advocacyShare.create({
    data: { contentId: content.id, employeeName, employeeEmail, reach: Math.floor(Math.random() * 5000 + 500) },
  });
  await logAudit(req.userId, 'advocacy.share', 'advocacyContent', content.id, { employeeEmail });
  res.status(201).json({ success: true, data: share });
});

// Advocacy analytics: totals + leaderboard.
router.get('/analytics', async (_req, res) => {
  const shares = await prisma.advocacyShare.findMany();
  const totalReach = shares.reduce((s, x) => s + x.reach, 0);
  const board: Record<string, { name: string; shares: number; reach: number }> = {};
  for (const s of shares) {
    board[s.employeeEmail] ??= { name: s.employeeName, shares: 0, reach: 0 };
    board[s.employeeEmail].shares++;
    board[s.employeeEmail].reach += s.reach;
  }
  const leaderboard = Object.values(board).sort((a, b) => b.reach - a.reach);
  res.json({ success: true, data: { totalShares: shares.length, totalReach, leaderboard } });
});

export default router;

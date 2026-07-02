import { Router } from 'express';
import { prisma } from '../prisma';
import { requirePermission, PERMISSIONS } from '../rbac';
import { logAudit } from '../audit';
import { AuthedRequest } from '../auth';

const router = Router();

const list = async (_req: any, res: any) => {
  const data = await prisma.teamMember.findMany({ orderBy: { joinedAt: 'asc' } });
  res.json({ success: true, data });
};

router.get('/', list);
router.get('/members', list);

router.post('/members', requirePermission(PERMISSIONS.MANAGE_TEAM), async (req: AuthedRequest, res) => {
  const { name, email, role = 'viewer' } = req.body ?? {};
  if (!name || !email) return res.status(400).json({ success: false, error: 'name and email are required' });
  const member = await prisma.teamMember.create({ data: { name, email, role } });
  await logAudit(req.userId, 'team.invite', 'teamMember', member.id, { email, role });
  res.status(201).json({ success: true, data: member });
});

router.put('/members/:id', requirePermission(PERMISSIONS.MANAGE_TEAM), async (req: AuthedRequest, res) => {
  const m = await prisma.teamMember.findUnique({ where: { id: req.params.id } });
  if (!m) return res.status(404).json({ success: false, error: 'Member not found' });
  // Whitelist updatable fields — never spread the raw body into Prisma.
  const b = req.body ?? {};
  const data: { name?: string; email?: string; role?: string } = {};
  if (typeof b.name === 'string') data.name = b.name;
  if (typeof b.email === 'string') data.email = b.email;
  if (typeof b.role === 'string') data.role = b.role;
  const updated = await prisma.teamMember.update({ where: { id: m.id }, data });
  await logAudit(req.userId, 'team.update', 'teamMember', m.id);
  res.json({ success: true, data: updated });
});

router.delete('/members/:id', requirePermission(PERMISSIONS.MANAGE_TEAM), async (req: AuthedRequest, res) => {
  const m = await prisma.teamMember.findUnique({ where: { id: req.params.id } });
  if (!m) return res.status(404).json({ success: false, error: 'Member not found' });
  await prisma.teamMember.delete({ where: { id: m.id } });
  await logAudit(req.userId, 'team.remove', 'teamMember', m.id);
  res.json({ success: true, data: m });
});

export default router;

import { Router } from 'express';
import { prisma, fromJson } from '../prisma';
import { requirePermission, PERMISSIONS } from '../rbac';

const router = Router();

router.get('/', requirePermission(PERMISSIONS.VIEW_AUDIT), async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const rows = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
  const data = rows.map((r) => ({
    id: r.id, action: r.action, entity: r.entity, entityId: r.entityId ?? undefined,
    userId: r.userId ?? undefined, meta: fromJson<any>(r.meta, undefined), createdAt: r.createdAt,
  }));
  res.json({ success: true, data, total: data.length });
});

export default router;

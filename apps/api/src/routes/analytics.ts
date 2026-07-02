import { Router } from 'express';
import { prisma, mapReport, toJson } from '../prisma';
import { analyticsTrend, analyticsMetrics, networkBreakdown } from '../analytics';

const router = Router();

router.get('/metrics', (_req, res) => {
  res.json({
    success: true,
    data: { metrics: analyticsMetrics, trend: analyticsTrend(), networkBreakdown },
  });
});

router.get('/reports', async (_req, res) => {
  const rows = await prisma.report.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ success: true, data: rows.map(mapReport) });
});

router.post('/reports', async (req, res) => {
  const { name, type = 'custom', networks = [] } = req.body ?? {};
  if (!name) return res.status(400).json({ success: false, error: 'name is required' });
  const r = await prisma.report.create({ data: { name, type, networks: toJson(networks) } });
  res.status(201).json({ success: true, data: mapReport(r) });
});

router.get('/reports/:id', async (req, res) => {
  const r = await prisma.report.findUnique({ where: { id: req.params.id } });
  if (!r) return res.status(404).json({ success: false, error: 'Report not found' });
  res.json({ success: true, data: mapReport(r) });
});

router.put('/reports/:id', async (req, res) => {
  const exists = await prisma.report.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ success: false, error: 'Report not found' });
  const b = req.body ?? {};
  const r = await prisma.report.update({
    where: { id: req.params.id },
    data: {
      ...(b.name !== undefined ? { name: b.name } : {}),
      ...(b.type !== undefined ? { type: b.type } : {}),
      ...(b.networks !== undefined ? { networks: toJson(b.networks) } : {}),
    },
  });
  res.json({ success: true, data: mapReport(r) });
});

router.delete('/reports/:id', async (req, res) => {
  const exists = await prisma.report.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ success: false, error: 'Report not found' });
  await prisma.report.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: mapReport(exists) });
});

router.post('/reports/:id/export', async (req, res) => {
  const r = await prisma.report.findUnique({ where: { id: req.params.id } });
  if (!r) return res.status(404).json({ success: false, error: 'Report not found' });
  const format = (req.body?.format ?? 'pdf').toLowerCase();
  res.json({
    success: true,
    data: { url: `https://cdn.socialhub.app/exports/${r.id}.${format}`, format, generatedAt: new Date().toISOString() },
  });
});

export default router;

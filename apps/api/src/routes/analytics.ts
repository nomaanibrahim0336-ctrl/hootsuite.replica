import { Router } from 'express';
import { db, uid, analyticsTrend, analyticsMetrics, networkBreakdown } from '../data';

const router = Router();

router.get('/metrics', (_req, res) => {
  res.json({
    success: true,
    data: { metrics: analyticsMetrics, trend: analyticsTrend(), networkBreakdown },
  });
});

router.get('/reports', (_req, res) => res.json({ success: true, data: db.reports }));

router.post('/reports', (req, res) => {
  const { name, type = 'custom', networks = [] } = req.body ?? {};
  if (!name) return res.status(400).json({ success: false, error: 'name is required' });
  const report = { id: uid(), name, type, networks, createdAt: new Date().toISOString() };
  db.reports.unshift(report);
  res.status(201).json({ success: true, data: report });
});

router.get('/reports/:id', (req, res) => {
  const r = db.reports.find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ success: false, error: 'Report not found' });
  res.json({ success: true, data: r });
});

router.put('/reports/:id', (req, res) => {
  const r = db.reports.find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ success: false, error: 'Report not found' });
  Object.assign(r, req.body);
  res.json({ success: true, data: r });
});

router.delete('/reports/:id', (req, res) => {
  const i = db.reports.findIndex((x) => x.id === req.params.id);
  if (i === -1) return res.status(404).json({ success: false, error: 'Report not found' });
  const [removed] = db.reports.splice(i, 1);
  res.json({ success: true, data: removed });
});

router.post('/reports/:id/export', (req, res) => {
  const r = db.reports.find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ success: false, error: 'Report not found' });
  const format = (req.body?.format ?? 'pdf').toLowerCase();
  res.json({
    success: true,
    data: { url: `https://cdn.socialhub.app/exports/${r.id}.${format}`, format, generatedAt: new Date().toISOString() },
  });
});

export default router;

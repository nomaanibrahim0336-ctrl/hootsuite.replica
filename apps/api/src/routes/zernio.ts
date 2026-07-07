import { Router } from 'express';
import * as zernio from '../lib/zernio';
import { prisma } from '../prisma';

const router = Router();

const NETWORK_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  twitter: 'X (Twitter)',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
};

/** Mirror Zernio's live account list into the app's own Network table, so the
 *  rest of the app (Dashboard, Composer, Publisher, Analytics) — which only
 *  ever reads from Network, not from Zernio directly — sees the connection. */
async function syncAccountsToNetworks(accounts: zernio.ZernioAccount[]): Promise<void> {
  await Promise.all(
    accounts.map(async (a) => {
      const existing = await prisma.network.findFirst({ where: { type: a.platform } });
      const data = {
        connected: a.connected,
        name: NETWORK_LABELS[a.platform] ?? a.platform,
        username: a.handle.startsWith('@') ? a.handle : `@${a.handle}`,
        followers: a.followers ?? existing?.followers ?? 0,
        connectedAt: a.connected ? new Date() : existing?.connectedAt,
      };
      if (existing) {
        await prisma.network.update({ where: { id: existing.id }, data });
      } else {
        await prisma.network.create({ data: { type: a.platform, ...data, connectedAt: data.connectedAt ?? new Date() } });
      }
    })
  );
}

/** GET /api/zernio/status — configured flag + list of connected accounts.
 *  Also syncs Zernio's account state into the Network table as a side effect. */
router.get('/status', async (_req, res) => {
  if (!zernio.isConfigured()) {
    return res.json({ success: true, data: { configured: false, accounts: [] } });
  }
  try {
    const accounts = await zernio.listAccounts();
    try {
      await syncAccountsToNetworks(accounts);
    } catch (e: any) {
      console.error('[zernio] Network sync failed:', e.message);
    }
    res.json({ success: true, data: { configured: true, accounts } });
  } catch (e: any) {
    res.json({ success: true, data: { configured: true, accounts: [], error: e.message } });
  }
});

/** POST /api/zernio/connect  { platform, returnTo }
 *  Returns a hosted URL where the end user completes the OAuth flow. */
router.post('/connect', async (req, res) => {
  if (!zernio.isConfigured()) {
    return res.status(503).json({ success: false, error: 'Zernio API key not configured. Add ZERNIO_API_KEY to Railway env vars.' });
  }
  const { platform, returnTo } = req.body ?? {};
  if (!platform) return res.status(400).json({ success: false, error: 'platform is required' });
  try {
    const { url } = await zernio.generateConnectUrl(platform, returnTo || '');
    res.json({ success: true, data: { url } });
  } catch (e: any) {
    res.status(502).json({ success: false, error: e.message });
  }
});

/** DELETE /api/zernio/accounts/:platform — disconnect a platform. */
router.delete('/accounts/:platform', async (req, res) => {
  if (!zernio.isConfigured()) return res.status(503).json({ success: false, error: 'Zernio not configured' });
  try {
    await zernio.disconnect(req.params.platform);
    const existing = await prisma.network.findFirst({ where: { type: req.params.platform } });
    if (existing) {
      await prisma.network.update({ where: { id: existing.id }, data: { connected: false } });
    }
    res.json({ success: true, data: null });
  } catch (e: any) {
    res.status(502).json({ success: false, error: e.message });
  }
});

export default router;

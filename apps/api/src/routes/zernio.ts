import { Router } from 'express';
import * as zernio from '../lib/zernio';

const router = Router();

/** GET /api/zernio/status — configured flag + list of connected accounts. */
router.get('/status', async (_req, res) => {
  if (!zernio.isConfigured()) {
    return res.json({ success: true, data: { configured: false, accounts: [] } });
  }
  try {
    const accounts = await zernio.listAccounts();
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
    res.json({ success: true, data: null });
  } catch (e: any) {
    res.status(502).json({ success: false, error: e.message });
  }
});

export default router;

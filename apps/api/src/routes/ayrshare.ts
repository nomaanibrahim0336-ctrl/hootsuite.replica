import { Router } from 'express';
import * as ayrshare from '../lib/ayrshare';

const router = Router();

const AYRSHARE_DASHBOARD = 'https://app.ayrshare.com';

/** GET /api/ayrshare/status
 *  Returns whether Ayrshare is configured and which networks are connected. */
router.get('/status', async (_req, res) => {
  if (!ayrshare.isConfigured()) {
    return res.json({ success: true, data: { configured: false, connected: false, activeSocialAccounts: [] } });
  }
  try {
    const user = await ayrshare.getUser();
    return res.json({
      success: true,
      data: {
        configured: true,
        connected: (user.activeSocialAccounts?.length ?? 0) > 0,
        activeSocialAccounts: user.activeSocialAccounts ?? [],
        dashboardUrl: AYRSHARE_DASHBOARD,
      },
    });
  } catch (e: any) {
    return res.json({
      success: true,
      data: { configured: true, connected: false, activeSocialAccounts: [], error: e.message },
    });
  }
});

/** GET /api/ayrshare/networks
 *  Returns the list of social accounts connected via Ayrshare. */
router.get('/networks', async (_req, res) => {
  if (!ayrshare.isConfigured()) return res.json({ success: true, data: [] });
  try {
    const user = await ayrshare.getUser();
    return res.json({ success: true, data: user.activeSocialAccounts ?? [] });
  } catch (e: any) {
    return res.status(502).json({ success: false, error: e.message });
  }
});

export default router;

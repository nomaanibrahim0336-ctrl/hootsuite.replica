import { Router } from 'express';
import { prisma } from '../prisma';
import * as ayrshare from '../lib/ayrshare';

const router = Router();

/** GET /api/ayrshare/status
 *  Returns whether Ayrshare is configured + the current user's profile info. */
router.get('/status', async (req, res) => {
  const configured = ayrshare.isConfigured();
  if (!configured) {
    return res.json({ success: true, data: { configured: false, connected: false, activeSocialAccounts: [] } });
  }

  const user = await prisma.user.findUnique({ where: { id: (req as any).userId } });
  if (!user?.ayrshareProfileKey) {
    return res.json({ success: true, data: { configured, connected: false, activeSocialAccounts: [] } });
  }

  try {
    const profile = await ayrshare.getProfile(user.ayrshareProfileKey);
    return res.json({
      success: true,
      data: {
        configured,
        connected: true,
        profileKey: user.ayrshareProfileKey,
        activeSocialAccounts: profile.activeSocialAccounts ?? [],
      },
    });
  } catch (e: any) {
    return res.json({
      success: true,
      data: { configured, connected: true, profileKey: user.ayrshareProfileKey, activeSocialAccounts: [], error: e.message },
    });
  }
});

/** POST /api/ayrshare/profile
 *  Creates an Ayrshare profile for the current user (idempotent — skips if already has one). */
router.post('/profile', async (req, res) => {
  if (!ayrshare.isConfigured()) {
    return res.status(503).json({ success: false, error: 'Ayrshare API key not configured. Add AYRSHARE_API_KEY to Railway env vars.' });
  }

  const user = await prisma.user.findUnique({ where: { id: (req as any).userId } });
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  if (user.ayrshareProfileKey) {
    return res.json({ success: true, data: { profileKey: user.ayrshareProfileKey, already: true } });
  }

  try {
    const profile = await ayrshare.createProfile(user.name, user.email);
    await prisma.user.update({ where: { id: user.id }, data: { ayrshareProfileKey: profile.profileKey } });
    return res.status(201).json({ success: true, data: { profileKey: profile.profileKey } });
  } catch (e: any) {
    return res.status(502).json({ success: false, error: e.message });
  }
});

/** POST /api/ayrshare/link
 *  Returns a hosted URL the user visits to connect their social accounts. */
router.post('/link', async (req, res) => {
  if (!ayrshare.isConfigured()) {
    return res.status(503).json({ success: false, error: 'Ayrshare API key not configured.' });
  }

  const user = await prisma.user.findUnique({ where: { id: (req as any).userId } });
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  let profileKey = user.ayrshareProfileKey;

  // Auto-create profile if the user doesn't have one yet
  if (!profileKey) {
    try {
      const profile = await ayrshare.createProfile(user.name, user.email);
      profileKey = profile.profileKey;
      await prisma.user.update({ where: { id: user.id }, data: { ayrshareProfileKey: profileKey } });
    } catch (e: any) {
      return res.status(502).json({ success: false, error: `Could not create Ayrshare profile: ${e.message}` });
    }
  }

  try {
    const { url } = await ayrshare.generateLinkUrl(profileKey);
    return res.json({ success: true, data: { url } });
  } catch (e: any) {
    return res.status(502).json({ success: false, error: e.message });
  }
});

/** GET /api/ayrshare/networks
 *  Returns the list of social accounts the user has connected via Ayrshare. */
router.get('/networks', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: (req as any).userId } });
  if (!user?.ayrshareProfileKey) {
    return res.json({ success: true, data: [] });
  }
  try {
    const profile = await ayrshare.getProfile(user.ayrshareProfileKey);
    return res.json({ success: true, data: profile.activeSocialAccounts ?? [] });
  } catch (e: any) {
    return res.status(502).json({ success: false, error: e.message });
  }
});

export default router;

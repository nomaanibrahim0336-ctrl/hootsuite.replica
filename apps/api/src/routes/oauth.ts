import { Router } from 'express';
import { prisma } from '../prisma';
import jwt from 'jsonwebtoken';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ─── Facebook / Instagram ─────────────────────────────────────────────────────

const FB_APP_ID = process.env.FACEBOOK_APP_ID;
const FB_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const FB_CALLBACK = `${API_BASE}/api/oauth/facebook/callback`;

// Scopes needed: publish to pages + read page insights + Instagram Basic Display
const FB_SCOPE = [
  'pages_show_list',
  'pages_manage_posts',
  'pages_read_engagement',
  'instagram_basic',
  'instagram_content_publish',
].join(',');

/** Kick off Facebook OAuth.
 *  Query params:
 *    returnTo — URL to redirect back to after success/failure (default: /settings)
 *    userId   — optional; stored in state so we can tie the token to a user later
 */
router.get('/facebook', (req, res) => {
  if (!FB_APP_ID || !FB_APP_SECRET) {
    const to = (req.query.returnTo as string) || `${FRONTEND_URL}/settings`;
    return res.redirect(`${to}?oauth_error=missing_config&network=facebook`);
  }

  // Sign a short-lived state token to prevent CSRF and carry returnTo
  const state = jwt.sign(
    { returnTo: (req.query.returnTo as string) || `${FRONTEND_URL}/settings`, network: 'facebook' },
    JWT_SECRET,
    { expiresIn: '10m' },
  );

  const params = new URLSearchParams({
    client_id: FB_APP_ID,
    redirect_uri: FB_CALLBACK,
    scope: FB_SCOPE,
    state,
    response_type: 'code',
  });

  res.redirect(`https://www.facebook.com/v19.0/dialog/oauth?${params}`);
});

router.get('/facebook/callback', async (req, res) => {
  const { code, state, error: fbError } = req.query as Record<string, string>;
  let returnTo = `${FRONTEND_URL}/settings`;

  try {
    // Validate state
    const payload = jwt.verify(state || '', JWT_SECRET) as any;
    returnTo = payload.returnTo || returnTo;
  } catch {
    return res.redirect(`${returnTo}?oauth_error=invalid_state&network=facebook`);
  }

  if (fbError || !code) {
    return res.redirect(`${returnTo}?oauth_error=${fbError || 'no_code'}&network=facebook`);
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
        new URLSearchParams({
          client_id: FB_APP_ID!,
          client_secret: FB_APP_SECRET!,
          redirect_uri: FB_CALLBACK,
          code,
        }),
    );
    const tokenData = await tokenRes.json() as any;
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error?.message || 'Token exchange failed');
    }

    const shortToken: string = tokenData.access_token;

    // Exchange short-lived token for long-lived (60 day) token
    const longRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
        new URLSearchParams({
          grant_type: 'fb_exchange_token',
          client_id: FB_APP_ID!,
          client_secret: FB_APP_SECRET!,
          fb_exchange_token: shortToken,
        }),
    );
    const longData = await longRes.json() as any;
    const longToken: string = longData.access_token || shortToken;
    const expiresIn: number = longData.expires_in || 5183944; // ~60 days

    // Get user's name + ID
    const meRes = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${longToken}`);
    const me = await meRes.json() as any;

    // Get pages the user manages (to find their primary page token)
    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?access_token=${longToken}`,
    );
    const pagesData = await pagesRes.json() as any;
    const firstPage = pagesData.data?.[0];

    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    // Upsert the facebook Network row
    const existing = await prisma.network.findFirst({ where: { type: 'facebook' } });
    if (existing) {
      await prisma.network.update({
        where: { id: existing.id },
        data: {
          connected: true,
          username: `@${me.name || 'facebook'}`,
          name: me.name || 'Facebook',
          accessToken: longToken,
          tokenExpiresAt,
          pageId: firstPage?.id ?? null,
          pageAccessToken: firstPage?.access_token ?? null,
          connectedAt: new Date(),
        },
      });
    } else {
      await prisma.network.create({
        data: {
          type: 'facebook',
          name: me.name || 'Facebook',
          username: `@${me.name || 'facebook'}`,
          followers: 0,
          connected: true,
          accessToken: longToken,
          tokenExpiresAt,
          pageId: firstPage?.id ?? null,
          pageAccessToken: firstPage?.access_token ?? null,
        },
      });
    }

    // Also upsert Instagram if a page with Instagram was found
    if (firstPage?.id) {
      try {
        const igRes = await fetch(
          `https://graph.facebook.com/v19.0/${firstPage.id}?fields=instagram_business_account&access_token=${firstPage.access_token}`,
        );
        const igData = await igRes.json() as any;
        const igId = igData.instagram_business_account?.id;
        if (igId) {
          const igInfoRes = await fetch(
            `https://graph.facebook.com/v19.0/${igId}?fields=name,username,followers_count&access_token=${firstPage.access_token}`,
          );
          const igInfo = await igInfoRes.json() as any;
          const existingIg = await prisma.network.findFirst({ where: { type: 'instagram' } });
          if (existingIg) {
            await prisma.network.update({
              where: { id: existingIg.id },
              data: {
                connected: true,
                username: `@${igInfo.username || 'instagram'}`,
                name: igInfo.name || 'Instagram',
                followers: igInfo.followers_count || 0,
                accessToken: firstPage.access_token,
                pageId: igId,
                connectedAt: new Date(),
              },
            });
          } else {
            await prisma.network.create({
              data: {
                type: 'instagram',
                name: igInfo.name || 'Instagram',
                username: `@${igInfo.username || 'instagram'}`,
                followers: igInfo.followers_count || 0,
                connected: true,
                accessToken: firstPage.access_token,
                pageId: igId,
              },
            });
          }
        }
      } catch {
        // Instagram not linked — not fatal
      }
    }

    res.redirect(`${returnTo}?oauth_success=true&network=facebook`);
  } catch (e: any) {
    const msg = encodeURIComponent(e?.message || 'unknown_error');
    res.redirect(`${returnTo}?oauth_error=${msg}&network=facebook`);
  }
});

// ─── Disconnect helper (shared) ───────────────────────────────────────────────

router.delete('/:network/disconnect', async (req, res) => {
  const { network } = req.params;
  const existing = await prisma.network.findFirst({ where: { type: network } });
  if (!existing) return res.status(404).json({ success: false, error: 'Not connected' });
  await prisma.network.update({
    where: { id: existing.id },
    data: { connected: false, accessToken: null, pageAccessToken: null, pageId: null, tokenExpiresAt: null },
  });
  res.json({ success: true });
});

export default router;

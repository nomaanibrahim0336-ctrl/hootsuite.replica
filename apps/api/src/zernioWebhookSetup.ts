// Registers (or updates) a Zernio webhook pointed at this server on startup,
// so real-time events (message.received) replace the old poll-only sync —
// this is what makes incoming DMs appear instantly instead of on the next
// 15s-gated background sync or manual refresh.
//
// The webhook secret is generated once and persisted in AppSetting (not an
// env var) so this works with zero manual Zernio-dashboard configuration —
// point API_BASE_URL at a real public HTTPS URL and it self-registers.

import crypto from 'crypto';
import { prisma } from './prisma';
import * as zernio from './lib/zernio';

const SECRET_SETTING_KEY = 'zernio.webhook.secret';
const WEBHOOK_NAME = 'SocialHub live inbox';
const EVENTS = ['message.received'];

async function getOrCreateSecret(): Promise<string> {
  const existing = await prisma.appSetting.findUnique({ where: { key: SECRET_SETTING_KEY } });
  if (existing) return existing.value;
  const secret = crypto.randomBytes(32).toString('hex');
  await prisma.appSetting.upsert({
    where: { key: SECRET_SETTING_KEY },
    create: { key: SECRET_SETTING_KEY, value: secret },
    update: { value: secret },
  });
  return secret;
}

export async function getZernioWebhookSecret(): Promise<string | undefined> {
  const row = await prisma.appSetting.findUnique({ where: { key: SECRET_SETTING_KEY } });
  return row?.value;
}

/** Idempotent — safe to call on every server boot. No-ops if Zernio isn't
 *  configured, or if API_BASE_URL is missing/localhost (Zernio can't reach
 *  a callback URL it can't resolve publicly). */
export async function ensureZernioWebhookRegistered(): Promise<void> {
  if (!zernio.isConfigured()) return;
  const base = process.env.API_BASE_URL;
  if (!base || /localhost|127\.0\.0\.1/.test(base)) {
    console.log('[zernio-webhook] API_BASE_URL not set to a public URL — skipping webhook registration (falling back to polling).');
    return;
  }
  const callbackUrl = `${base.replace(/\/$/, '')}/api/webhooks/zernio`;

  try {
    const secret = await getOrCreateSecret();
    const existing = (await zernio.listWebhooks()).find((w) => w.url === callbackUrl);
    if (existing) {
      const needsUpdate = !existing.isActive || EVENTS.some((e) => !existing.events.includes(e));
      if (needsUpdate) {
        await zernio.updateWebhook(existing.id, { events: EVENTS, isActive: true, secret });
        console.log('[zernio-webhook] updated existing webhook registration');
      }
      return;
    }
    await zernio.createWebhook({ name: WEBHOOK_NAME, url: callbackUrl, secret, events: EVENTS });
    console.log('[zernio-webhook] registered new webhook for real-time inbox delivery');
  } catch (e: any) {
    // Most commonly: Inbox addon not enabled (403), or the 10-webhooks-per-
    // account cap is already used by something else. The app keeps working
    // via the poll-based sync either way.
    console.error('[zernio-webhook] registration failed, falling back to polling:', e.message);
  }
}

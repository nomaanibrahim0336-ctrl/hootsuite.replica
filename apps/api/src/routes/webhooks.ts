// Public webhook receivers — no requireAuth, since these are called directly
// by third-party services (Zernio) rather than a logged-in browser. Every
// handler verifies its own signature before trusting the payload.

import { Router } from 'express';
import crypto from 'crypto';
import { getZernioWebhookSecret } from '../zernioWebhookSetup';
import { applyIncomingWebhookMessage } from '../zernioInboxSync';

const router = Router();

function verifyZernioSignature(rawBody: Buffer | undefined, signature: string | undefined, secret: string): boolean {
  if (!rawBody || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.post('/zernio', async (req, res) => {
  const secret = await getZernioWebhookSecret();
  if (!secret) {
    // No webhook has ever been registered by this server — nothing to verify against.
    return res.status(503).json({ success: false, error: 'Webhook not configured' });
  }

  const signature = req.header('x-zernio-signature');
  if (!verifyZernioSignature((req as any).rawBody, signature, secret)) {
    return res.status(401).json({ success: false, error: 'Invalid signature' });
  }

  const event = req.body ?? {};

  // Always ack quickly — Zernio disables a webhook after 10 consecutive
  // failures, and slow/failed responses count against that.
  res.json({ success: true });

  try {
    if (event.event === 'message.received' && event.message?.direction === 'incoming') {
      await applyIncomingWebhookMessage({
        conversationId: event.conversation?.id,
        platformMessageId: event.message.platformMessageId ?? event.message.id,
        accountId: event.account?.accountId ?? event.account?.id,
        platform: event.account?.platform ?? event.message.platform,
        text: event.message.text ?? '',
        senderName: event.message.sender?.name || event.conversation?.participantName || event.conversation?.participantUsername || '',
        senderId: event.message.sender?.id ?? event.conversation?.participantId ?? '',
        sentAt: event.message.sentAt ?? event.timestamp ?? new Date().toISOString(),
      });
    }
    // webhook.test and other subscribed-but-unhandled events are ack'd above and ignored here.
  } catch (e: any) {
    console.error('[webhooks/zernio] failed to apply event:', e.message);
  }
});

export default router;

// Pulls real DMs from Zernio's unified inbox API into our own Message /
// MessageReply tables, so the Inbox page reflects live conversations instead
// of only ever showing manually-seeded/test data.
//
// Requires the Zernio account to have the paid "Inbox addon" enabled — if it
// doesn't, listConversations() throws and syncZernioInbox() just no-ops (the
// rest of the app keeps working against whatever is already in the DB).

import { prisma, mapMessage } from './prisma';
import * as zernio from './lib/zernio';
import { publishInboxEvent } from './realtime';

// Only platforms the frontend's NETWORK_META knows how to render. Zernio's
// inbox also covers bluesky/reddit/telegram, which this app has no chip/label
// for — skip those rather than let an unknown network type crash the UI.
export const SUPPORTED_PLATFORMS = new Set(['facebook', 'instagram', 'twitter']);

/** One inbound message delivered by the `message.received` webhook — the
 *  real-time counterpart to syncOneConversation, applied to a single message
 *  instead of a full conversation history pull. Used by routes/webhooks.ts.
 *  Only handles incoming messages: outgoing ones are already written
 *  optimistically by POST /inbox/:id/reply the instant we send them, so
 *  handling `message.sent` here too would create a duplicate thread bubble. */
export async function applyIncomingWebhookMessage(input: {
  conversationId: string;
  platformMessageId: string;
  accountId: string;
  platform: string;
  text: string;
  senderName: string;
  senderId: string;
  sentAt: string;
}): Promise<void> {
  if (!SUPPORTED_PLATFORMS.has(input.platform)) return;

  const existing = await prisma.message.findUnique({ where: { externalId: input.conversationId } });

  const row = existing
    ? await prisma.message.update({
        where: { id: existing.id },
        data: {
          isRead: false,
          status: existing.status === 'resolved' ? 'unread' : existing.status,
          timestamp: new Date(input.sentAt),
          accountId: input.accountId,
        },
        include: { replies: true },
      })
    : await prisma.message.create({
        data: {
          externalId: input.conversationId,
          accountId: input.accountId,
          network: input.platform,
          senderName: input.senderName || 'Unknown',
          senderUser: input.senderId,
          content: input.text,
          type: 'dm',
          status: 'unread',
          sentiment: 'neutral',
          isRead: false,
          timestamp: new Date(input.sentAt),
        },
        include: { replies: true },
      });

  // If this wasn't the opening message, thread it as a reply (dedup by the
  // platform's message id so a webhook redelivery can't double it up).
  if (existing) {
    await prisma.messageReply.upsert({
      where: { externalId: input.platformMessageId },
      update: {},
      create: {
        externalId: input.platformMessageId,
        messageId: row.id,
        content: input.text,
        isFromUs: false,
        timestamp: new Date(input.sentAt),
      },
    });
  }

  const full = await prisma.message.findUnique({ where: { id: row.id }, include: { replies: true } });
  if (full) publishInboxEvent({ type: 'message', data: mapMessage(full) });
}

let lastSyncAt = 0;
const MIN_SYNC_INTERVAL_MS = 15_000;
let syncInFlight: Promise<void> | null = null;

async function syncOneConversation(conv: zernio.ZernioConversation): Promise<void> {
  let messages: zernio.ZernioInboxMessage[];
  try {
    messages = await zernio.listConversationMessages(conv.id, conv.accountId);
  } catch (e: any) {
    console.error(`[zernio-inbox] messages fetch failed for conversation ${conv.id}:`, e.message);
    return;
  }
  if (!messages.length) return;

  const existing = await prisma.message.findUnique({ where: { externalId: conv.id } });
  const isRead = (conv.unreadCount ?? 0) === 0;

  const row = existing
    ? await prisma.message.update({
        where: { id: existing.id },
        data: {
          isRead,
          status: existing.status === 'resolved' ? 'resolved' : isRead ? existing.status : 'unread',
          timestamp: new Date(conv.updatedTime),
          accountId: conv.accountId,
        },
      })
    : await prisma.message.create({
        data: {
          externalId: conv.id,
          accountId: conv.accountId,
          network: conv.platform,
          senderName: conv.participantName,
          senderUser: conv.participantId,
          content: messages[0].message,
          type: 'dm',
          status: 'unread', // freshly-imported conversations always start in our own triage queue
          sentiment: 'neutral',
          isRead,
          timestamp: new Date(conv.updatedTime),
        },
      });

  // Everything after the opening message becomes the visible thread —
  // direction tells us whether it renders as "them" or "us".
  for (const m of messages.slice(1)) {
    await prisma.messageReply.upsert({
      where: { externalId: m.id },
      update: {},
      create: {
        externalId: m.id,
        messageId: row.id,
        content: m.message,
        isFromUs: m.direction === 'outgoing',
        timestamp: new Date(m.createdAt),
      },
    });
  }
}

const SYNC_BATCH_SIZE = 5;

async function runSync(): Promise<void> {
  let conversations: zernio.ZernioConversation[];
  try {
    conversations = await zernio.listConversations();
  } catch (e: any) {
    // Most commonly: Inbox addon not enabled on this Zernio account (403).
    console.error('[zernio-inbox] listConversations failed:', e.message);
    return;
  }

  const targets = conversations.filter((c) => SUPPORTED_PLATFORMS.has(c.platform));
  // Bounded-concurrency batches — much faster than fully sequential without
  // firing dozens of simultaneous requests at Zernio's rate limits.
  for (let i = 0; i < targets.length; i += SYNC_BATCH_SIZE) {
    await Promise.all(targets.slice(i, i + SYNC_BATCH_SIZE).map((conv) => syncOneConversation(conv)));
  }
}

/** Best-effort, rate-limited sync — safe to call on every GET /api/inbox.
 *  Pass `force: true` (from an explicit user-triggered "Sync now" action) to
 *  bypass the passive rate-limit gate — a manual refresh should never be a
 *  silent no-op just because a passive page-load sync ran seconds earlier.
 *  Concurrent calls (force or not) still collapse onto a single in-flight run. */
export async function syncZernioInbox(opts: { force?: boolean } = {}): Promise<void> {
  if (!zernio.isConfigured()) return;
  if (!opts.force && Date.now() - lastSyncAt < MIN_SYNC_INTERVAL_MS) return;
  if (syncInFlight) return syncInFlight;

  lastSyncAt = Date.now();
  syncInFlight = runSync().finally(() => { syncInFlight = null; });
  return syncInFlight;
}

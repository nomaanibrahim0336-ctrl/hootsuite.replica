// Pulls real brand mentions and comment activity from Zernio into the Mention
// table, so the Listening feed reflects live conversation instead of the
// built-in sample corpus.
//
// Requires the Zernio account's paid "Inbox addon" (the mentions/comments
// endpoints 403 otherwise) — if that's not enabled, the sync no-ops and the
// Listening page keeps working against whatever is already in the DB.

import { prisma } from './prisma';
import * as zernio from './lib/zernio';
import { classifySentiment } from './sentiment';
import { toJson } from './prisma';

// Only platforms the frontend can render a chip/label for. Zernio also covers
// reddit/bluesky/threads/youtube, which this app has no NETWORK_META for.
const SUPPORTED_PLATFORMS = new Set(['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok']);

const AUTO_STREAM_NAME = 'Live mentions (Zernio)';
const MIN_SYNC_INTERVAL_MS = 15_000;
let lastSyncAt = 0;
let syncInFlight: Promise<void> | null = null;

/** Find or create the auto-managed stream that holds provider-synced mentions. */
async function ensureLiveStream(): Promise<string> {
  const existing = await prisma.stream.findFirst({ where: { name: AUTO_STREAM_NAME } });
  if (existing) return existing.id;
  const created = await prisma.stream.create({
    data: {
      name: AUTO_STREAM_NAME,
      keywords: toJson(['brand mentions', 'comments']),
      sources: toJson(['linkedin', 'facebook', 'instagram', 'twitter']),
      isActive: true,
      mentionCount: 0,
    },
  });
  return created.id;
}

async function upsertMention(row: {
  externalId: string;
  streamId: string;
  network: string;
  authorName: string;
  authorUser: string;
  content: string;
  likes: number;
  comments: number;
  timestamp: Date;
}): Promise<boolean> {
  const existing = await prisma.mention.findUnique({ where: { externalId: row.externalId } });
  if (existing) {
    await prisma.mention.update({
      where: { externalId: row.externalId },
      data: { likes: row.likes, comments: row.comments, sentiment: classifySentiment(row.content) },
    });
    return false; // not new
  }
  await prisma.mention.create({
    data: {
      externalId: row.externalId,
      streamId: row.streamId,
      network: row.network,
      authorName: row.authorName,
      authorUser: row.authorUser,
      content: row.content,
      sentiment: classifySentiment(row.content),
      likes: row.likes,
      shares: 0,
      comments: row.comments,
      timestamp: row.timestamp,
    },
  });
  return true; // new
}

async function runSync(): Promise<void> {
  let mentions: zernio.ZernioMention[] = [];
  let posts: zernio.ZernioCommentedPost[] = [];
  try {
    [mentions, posts] = await Promise.all([
      zernio.listMentions().catch((e) => { console.error('[zernio-listening] mentions failed:', e.message); return []; }),
      zernio.listCommentedPosts().catch((e) => { console.error('[zernio-listening] comments failed:', e.message); return []; }),
    ]);
  } catch (e: any) {
    console.error('[zernio-listening] sync failed:', e.message);
    return;
  }
  if (!mentions.length && !posts.length) return;

  const streamId = await ensureLiveStream();
  let added = 0;

  for (const m of mentions) {
    if (!SUPPORTED_PLATFORMS.has(m.platform)) continue;
    const isNew = await upsertMention({
      externalId: `mention:${m.id}`,
      streamId,
      network: m.platform,
      authorName: m.authorName,
      authorUser: m.authorName,
      content: m.content,
      likes: 0,
      comments: 0,
      timestamp: new Date(m.publishedAt),
    });
    if (isNew) added++;
  }

  for (const p of posts) {
    if (!SUPPORTED_PLATFORMS.has(p.platform)) continue;
    const isNew = await upsertMention({
      externalId: `comments:${p.id}`,
      streamId,
      network: p.platform,
      authorName: p.accountUsername || 'Your account',
      authorUser: p.accountUsername ? `@${p.accountUsername}` : '@you',
      content: p.content,
      likes: p.likeCount,
      comments: p.commentCount,
      timestamp: new Date(p.createdTime),
    });
    if (isNew) added++;
  }

  if (added > 0) {
    await prisma.stream.update({ where: { id: streamId }, data: { mentionCount: { increment: added } } });
  }
}

/** Best-effort, rate-limited sync — safe to call on every GET /listening/mentions.
 *  Pass `force: true` for an explicit user-triggered "Refresh" so a manual
 *  request is never silently skipped by the passive rate-limit gate. */
export async function syncZernioListening(opts: { force?: boolean } = {}): Promise<void> {
  if (!zernio.isConfigured()) return;
  if (!opts.force && Date.now() - lastSyncAt < MIN_SYNC_INTERVAL_MS) return;
  if (syncInFlight) return syncInFlight;
  lastSyncAt = Date.now();
  syncInFlight = runSync().finally(() => { syncInFlight = null; });
  return syncInFlight;
}

/** Test-only: reset the in-process rate-limit gate so the next call runs. */
export function __resetListeningSyncGate(): void {
  lastSyncAt = 0;
  syncInFlight = null;
}

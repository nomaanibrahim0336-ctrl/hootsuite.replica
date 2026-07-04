// Scheduling engine — auto-publishes posts when their scheduledAt time arrives.
//
// Dev/default: an in-process poller that scans the DB on an interval. It is
// fully runnable with no external services. For production, swap the body of
// `publishDuePosts` into a BullMQ worker backed by Redis (REDIS_URL) with
// delayed jobs + exponential backoff — the publish logic is identical.

import { prisma, mapPost, toJson } from './prisma';
import * as ayrshare from './lib/ayrshare';
import * as zernio from './lib/zernio';

const INTERVAL_MS = Number(process.env.SCHEDULER_INTERVAL_MS) || 15000;
const MAX_ATTEMPTS = 3;
const PAUSE_KEY = 'publishing_paused';

/** Crisis mode: when true the scheduler holds all scheduled posts (no publishing). */
export async function isPublishingPaused(): Promise<boolean> {
  const row = await prisma.appSetting.findUnique({ where: { key: PAUSE_KEY } });
  return row?.value === 'true';
}

export async function setPublishingPaused(paused: boolean): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: PAUSE_KEY },
    create: { key: PAUSE_KEY, value: String(paused) },
    update: { value: String(paused) },
  });
}

let timer: NodeJS.Timeout | null = null;
let running = false; // guards against overlapping runs (interval + manual trigger)

/** Deliver a post via the configured provider (Ayrshare > Zernio). If no
 *  provider is configured, simulate delivery so the scheduler still runs. */
async function deliver(post: { id: string; content: string; networks: string[]; authorId?: string | null }): Promise<void> {
  const PLATFORM_MAP: Record<string, string> = {
    facebook: 'facebook',
    instagram: 'instagram',
    twitter: 'twitter',
    linkedin: 'linkedin',
    tiktok: 'tiktok',
    youtube: 'youtube',
  };
  const platforms = post.networks.map((n) => PLATFORM_MAP[n] ?? n).filter(Boolean);
  if (!platforms.length) return;

  if (ayrshare.isConfigured()) {
    await ayrshare.publishPost(post.content, platforms);
    return;
  }
  if (zernio.isConfigured()) {
    await zernio.publish(post.content, platforms);
    return;
  }

  // No provider configured — simulate with ~5% failure rate
  if (Math.random() < 0.05) throw new Error('network timeout (simulated)');
}

/** Publish every scheduled post whose time has come. Returns count published. */
export async function publishDuePosts(nowMs = Date.now()): Promise<number> {
  // Prevent two concurrent runs from picking up (and double-publishing) the
  // same due posts before either has flipped their status.
  if (running) return 0;
  running = true;
  try {
    return await runDuePosts(nowMs);
  } finally {
    running = false;
  }
}

async function runDuePosts(nowMs: number): Promise<number> {
  // Crisis mode — hold everything until publishing is resumed.
  if (await isPublishingPaused()) return 0;

  const due = await prisma.post.findMany({
    where: { status: 'scheduled', scheduledAt: { lte: new Date(nowMs) } },
  });

  let published = 0;
  for (const row of due) {
    const post = mapPost(row);
    let ok = false;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !ok; attempt++) {
      try {
        await deliver({ id: post.id, content: post.content, networks: post.networks, authorId: row.authorId });
        ok = true;
      } catch {
        // Exponential backoff between attempts (skipped on the last try).
        if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, 50 * 2 ** attempt));
      }
    }

    await prisma.post.update({
      where: { id: post.id },
      data: ok
        ? {
            status: 'published',
            publishedAt: new Date(nowMs),
            engagements: toJson({ likes: 0, comments: 0, shares: 0, impressions: 0 }),
          }
        : { status: 'failed' },
    });
    if (ok) published++;
    console.log(`[scheduler] ${ok ? 'published' : 'FAILED'} post ${post.id}`);
  }
  return published;
}

export function startScheduler(): void {
  if (process.env.SCHEDULER_ENABLED === 'false') {
    console.log('[scheduler] disabled via SCHEDULER_ENABLED=false');
    return;
  }
  if (timer) return;
  console.log(`[scheduler] polling every ${INTERVAL_MS}ms`);
  timer = setInterval(() => {
    publishDuePosts().catch((e) => console.error('[scheduler] error', e));
  }, INTERVAL_MS);
  // Do not keep the event loop alive solely for the poller.
  timer.unref?.();
}

export function stopScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

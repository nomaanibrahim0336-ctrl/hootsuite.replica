// Scheduling engine — auto-publishes posts when their scheduledAt time arrives.
//
// Dev/default: an in-process poller that scans the DB on an interval. It is
// fully runnable with no external services. For production, swap the body of
// `publishDuePosts` into a BullMQ worker backed by Redis (REDIS_URL) with
// delayed jobs + exponential backoff — the publish logic is identical.

import { prisma, mapPost, toJson } from './prisma';

const INTERVAL_MS = Number(process.env.SCHEDULER_INTERVAL_MS) || 15000;
const MAX_ATTEMPTS = 3;

let timer: NodeJS.Timeout | null = null;

/** Simulate delivering a post to each social network. ~5% transient failure. */
async function deliver(post: { id: string; networks: string[] }): Promise<void> {
  if (Math.random() < 0.05) throw new Error('network timeout');
}

/** Publish every scheduled post whose time has come. Returns count published. */
export async function publishDuePosts(nowMs = Date.now()): Promise<number> {
  const due = await prisma.post.findMany({
    where: { status: 'scheduled', scheduledAt: { lte: new Date(nowMs) } },
  });

  let published = 0;
  for (const row of due) {
    const post = mapPost(row);
    let ok = false;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !ok; attempt++) {
      try {
        await deliver({ id: post.id, networks: post.networks });
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

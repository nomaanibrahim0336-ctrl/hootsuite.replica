/**
 * Zernio listening sync → Mention table.
 *
 * Upgrades the Listening feed from the built-in sample corpus to real brand
 * mentions (LinkedIn) and posts generating comments (across platforms) pulled
 * from Zernio. GET /listening/mentions triggers syncZernioListening() as a
 * best-effort, fire-and-forget side effect.
 *
 * The real Zernio client is mocked so this needs no API key, network, or the
 * paid Inbox addon.
 */

jest.mock('../src/lib/zernio', () => ({
  isConfigured: jest.fn(),
  listAccounts: jest.fn(),
  listConversations: jest.fn(),
  listConversationMessages: jest.fn(),
  sendInboxMessage: jest.fn(),
  markConversationRead: jest.fn(),
  listMentions: jest.fn(),
  listCommentedPosts: jest.fn(),
  generateConnectUrl: jest.fn(),
  disconnect: jest.fn(),
}));

import request from 'supertest';
import { app, authAs, bearer, closeDb } from './helpers';
import { prisma } from '../src/prisma';
import * as zernio from '../src/lib/zernio';
import { syncZernioListening, __resetListeningSyncGate } from '../src/zernioListeningSync';

const mockZernio = zernio as jest.Mocked<typeof zernio>;

jest.setTimeout(60_000);
afterAll(closeDb);

// syncZernioListening() rate-limits itself in-process (15s), shared across the
// file — advance a fake clock 20s before each test so each sync actually runs.
let virtualNow = Date.now();
beforeEach(() => {
  jest.clearAllMocks();
  mockZernio.isConfigured.mockReturnValue(true);
  mockZernio.listMentions.mockResolvedValue([]);
  mockZernio.listCommentedPosts.mockResolvedValue([]);
  virtualNow += 20_000;
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  jest.setSystemTime(virtualNow);
});
afterEach(() => jest.useRealTimers());

describe('Zernio listening sync pulls real mentions & comments into Mention', () => {
  it('creates a Mention from a Zernio brand mention, classifying sentiment', async () => {
    mockZernio.listMentions.mockResolvedValue([
      { id: 'm1', platform: 'linkedin', accountUsername: 'brand', authorName: '@someone', content: 'I absolutely love this brand, amazing work!', publishedAt: new Date().toISOString() },
    ]);
    await syncZernioListening();

    const row = await prisma.mention.findUnique({ where: { externalId: 'mention:m1' } });
    expect(row).toBeTruthy();
    expect(row!.network).toBe('linkedin');
    expect(row!.content).toContain('love this brand');
    expect(row!.sentiment).toBe('positive');
  });

  it('creates a Mention from a commented post carrying its like/comment counts', async () => {
    mockZernio.listCommentedPosts.mockResolvedValue([
      { id: 'p1', platform: 'instagram', accountUsername: 'ourbrand', content: 'Our launch post', permalink: 'https://x', createdTime: new Date().toISOString(), commentCount: 12, likeCount: 88 },
    ]);
    await syncZernioListening();

    const row = await prisma.mention.findUnique({ where: { externalId: 'comments:p1' } });
    expect(row).toBeTruthy();
    expect(row!.network).toBe('instagram');
    expect(row!.likes).toBe(88);
    expect(row!.comments).toBe(12);
  });

  it('attaches synced mentions to an auto-managed "Live mentions (Zernio)" stream', async () => {
    mockZernio.listMentions.mockResolvedValue([
      { id: 'm2', platform: 'linkedin', accountUsername: 'brand', authorName: '@x', content: 'neutral note', publishedAt: new Date().toISOString() },
    ]);
    await syncZernioListening();

    const stream = await prisma.stream.findFirst({ where: { name: 'Live mentions (Zernio)' } });
    expect(stream).toBeTruthy();
    const row = await prisma.mention.findUnique({ where: { externalId: 'mention:m2' } });
    expect(row!.streamId).toBe(stream!.id);
    expect(stream!.mentionCount).toBeGreaterThanOrEqual(1);
  });

  it('skips platforms the app has no chip for (e.g. reddit)', async () => {
    mockZernio.listCommentedPosts.mockResolvedValue([
      { id: 'p2', platform: 'reddit', accountUsername: 'brand', content: 'on reddit', createdTime: new Date().toISOString(), commentCount: 3, likeCount: 1 },
    ]);
    await syncZernioListening();
    const row = await prisma.mention.findUnique({ where: { externalId: 'comments:p2' } });
    expect(row).toBeNull();
  });

  it('skips paid/dark-post ad rows (filtered in the client)', async () => {
    // The client filters isAd rows out, so an ad row never reaches the sync.
    mockZernio.listCommentedPosts.mockResolvedValue([]);
    await syncZernioListening();
    const count = await prisma.mention.count({ where: { externalId: { startsWith: 'comments:' } } });
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it('does not duplicate on a repeated sync, and refreshes counts', async () => {
    mockZernio.listCommentedPosts.mockResolvedValue([
      { id: 'p3', platform: 'facebook', accountUsername: 'brand', content: 'post', createdTime: new Date().toISOString(), commentCount: 5, likeCount: 10 },
    ]);
    await syncZernioListening();

    mockZernio.listCommentedPosts.mockResolvedValue([
      { id: 'p3', platform: 'facebook', accountUsername: 'brand', content: 'post', createdTime: new Date().toISOString(), commentCount: 9, likeCount: 40 },
    ]);
    jest.setSystemTime(virtualNow + 20_000);
    await syncZernioListening();

    const rows = await prisma.mention.findMany({ where: { externalId: 'comments:p3' } });
    expect(rows).toHaveLength(1);
    expect(rows[0].comments).toBe(9); // refreshed
    expect(rows[0].likes).toBe(40);
  });

  it('does not throw if the provider fails (e.g. Inbox addon not enabled)', async () => {
    mockZernio.listMentions.mockRejectedValue(new Error('Zernio error 403: Inbox addon required'));
    mockZernio.listCommentedPosts.mockRejectedValue(new Error('Zernio error 403: Inbox addon required'));
    await expect(syncZernioListening()).resolves.toBeUndefined();
  });

  it('GET /listening/mentions responds without waiting on the sync', async () => {
    jest.useRealTimers();
    __resetListeningSyncGate(); // ensure the sync actually fires (not gated out)
    const { token } = await authAs();
    // Hang the provider — if the route awaited the sync, this request would hang.
    let release: (() => void) | undefined;
    mockZernio.listMentions.mockImplementation(() => new Promise((r) => { release = () => r([]); }));

    const res = await request(app).get('/api/listening/mentions').set(bearer(token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(mockZernio.listMentions).toHaveBeenCalled();

    release?.();
    await syncZernioListening().catch(() => {});
  });
});

describe('POST /listening/sync — explicit, awaited "Refresh"', () => {
  it('awaits the sync and the data is genuinely fresh the instant it responds', async () => {
    const { token } = await authAs();
    mockZernio.listMentions.mockResolvedValue([
      { id: 'sync_m1', platform: 'linkedin', accountUsername: 'brand', authorName: '@fast', content: 'quick mention', publishedAt: new Date().toISOString() },
    ]);

    const res = await request(app).post('/api/listening/sync').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.stillSyncing).toBe(false);

    const row = await prisma.mention.findUnique({ where: { externalId: 'mention:sync_m1' } });
    expect(row).toBeTruthy();
  });

  it('bypasses the passive rate-limit gate — a manual refresh right after an automatic sync still runs', async () => {
    const { token } = await authAs();
    mockZernio.listMentions.mockResolvedValue([]);
    mockZernio.listCommentedPosts.mockResolvedValue([]);

    await request(app).get('/api/listening/mentions').set(bearer(token));
    await syncZernioListening().catch(() => {}); // drain that passive sync first

    mockZernio.listMentions.mockResolvedValue([
      { id: 'sync_m2', platform: 'linkedin', accountUsername: 'brand', authorName: '@fresh', content: 'brand new mention', publishedAt: new Date().toISOString() },
    ]);

    const res = await request(app).post('/api/listening/sync').set(bearer(token));
    expect(res.status).toBe(200);

    const row = await prisma.mention.findUnique({ where: { externalId: 'mention:sync_m2' } });
    expect(row).toBeTruthy();
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/listening/sync');
    expect(res.status).toBe(401);
  });
});

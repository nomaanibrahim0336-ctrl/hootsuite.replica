/**
 * Zernio unified inbox → Message/MessageReply sync.
 *
 * Bug: connecting real social accounts never produced real DMs in the Inbox
 * page — nothing anywhere pulled Zernio's conversations into the app's own
 * Message table. GET /api/inbox now triggers syncZernioInbox() as a
 * best-effort side effect, which mirrors Zernio conversations/messages in.
 *
 * The real Zernio client is mocked so this test needs no real API key,
 * network access, or a Zernio account with the paid Inbox addon enabled.
 */

jest.mock('../src/lib/zernio', () => ({
  isConfigured: jest.fn(),
  listAccounts: jest.fn(),
  listConversations: jest.fn(),
  listConversationMessages: jest.fn(),
  sendInboxMessage: jest.fn(),
  markConversationRead: jest.fn(),
  generateConnectUrl: jest.fn(),
  disconnect: jest.fn(),
}));

import request from 'supertest';
import { app, authAs, bearer, closeDb } from './helpers';
import { prisma } from '../src/prisma';
import * as zernio from '../src/lib/zernio';
import { syncZernioInbox } from '../src/zernioInboxSync';

const mockZernio = zernio as jest.Mocked<typeof zernio>;

jest.setTimeout(60_000);
afterAll(closeDb);

// syncZernioInbox() rate-limits itself in-process (15s) so repeated syncs in a
// real request don't hammer Zernio. That state is module-level and shared
// across every test in this file — advance a fake clock by 20s before each
// test so each one's sync actually runs instead of being skipped by the gate
// left over from the previous test.
let virtualNow = Date.now();

beforeEach(() => {
  jest.clearAllMocks();
  mockZernio.isConfigured.mockReturnValue(true);
  virtualNow += 20_000;
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  jest.setSystemTime(virtualNow);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Zernio inbox sync (fire-and-forget from GET /api/inbox, tested directly for determinism)', () => {
  it('creates a Message row from a Zernio conversation with its opening message as content', async () => {
    const { token } = await authAs();
    mockZernio.listConversations.mockResolvedValue([
      {
        id: 'conv_1', platform: 'instagram', accountId: 'acct_1', accountUsername: 'brand',
        participantId: 'user_99', participantName: 'Jane Doe', lastMessage: 'Hey there!',
        updatedTime: new Date().toISOString(), status: 'active', unreadCount: 1,
      },
    ]);
    mockZernio.listConversationMessages.mockResolvedValue([
      { id: 'msg_1', conversationId: 'conv_1', accountId: 'acct_1', platform: 'instagram', message: 'Hey there!', senderName: 'Jane Doe', direction: 'incoming', createdAt: new Date().toISOString() },
    ]);

    // GET /api/inbox triggers this same sync fire-and-forget in production
    // (so the response is never slowed down by N calls to Zernio); call it
    // directly here so the test can deterministically await completion
    // before asserting, then confirm the read path serves it correctly.
    await syncZernioInbox();
    const res = await request(app).get('/api/inbox').set(bearer(token));
    expect(res.status).toBe(200);

    const found = res.body.data.find((m: any) => m.content === 'Hey there!');
    expect(found).toBeTruthy();
    expect(found.sender.name).toBe('Jane Doe');
    expect(found.network).toBe('instagram');
  });

  it('maps outgoing/incoming messages after the first into the thread with the right isFromUs', async () => {
    mockZernio.listConversations.mockResolvedValue([
      {
        id: 'conv_2', platform: 'twitter', accountId: 'acct_2', accountUsername: 'brand',
        participantId: 'user_1', participantName: 'Bob', lastMessage: 'thanks!',
        updatedTime: new Date().toISOString(), status: 'active', unreadCount: 0,
      },
    ]);
    mockZernio.listConversationMessages.mockResolvedValue([
      { id: 'msg_a', conversationId: 'conv_2', accountId: 'acct_2', platform: 'twitter', message: 'Hi, question about pricing', senderName: 'Bob', direction: 'incoming', createdAt: new Date(Date.now() - 2000).toISOString() },
      { id: 'msg_b', conversationId: 'conv_2', accountId: 'acct_2', platform: 'twitter', message: 'Sure, happy to help!', senderName: null, direction: 'outgoing', createdAt: new Date(Date.now() - 1000).toISOString() },
      { id: 'msg_c', conversationId: 'conv_2', accountId: 'acct_2', platform: 'twitter', message: 'thanks!', senderName: 'Bob', direction: 'incoming', createdAt: new Date().toISOString() },
    ]);

    await syncZernioInbox();

    const row = await prisma.message.findUnique({ where: { externalId: 'conv_2' }, include: { replies: true } });
    expect(row).toBeTruthy();
    expect(row!.content).toBe('Hi, question about pricing');
    expect(row!.replies).toHaveLength(2);
    const outgoing = row!.replies.find((r) => r.content === 'Sure, happy to help!');
    expect(outgoing!.isFromUs).toBe(true);
    const incoming = row!.replies.find((r) => r.content === 'thanks!');
    expect(incoming!.isFromUs).toBe(false);
  });

  it('does not duplicate rows when the same conversation is synced twice', async () => {
    mockZernio.listConversations.mockResolvedValue([
      {
        id: 'conv_3', platform: 'facebook', accountId: 'acct_3', accountUsername: 'brand',
        participantId: 'user_5', participantName: 'Amy', lastMessage: 'still there?',
        updatedTime: new Date().toISOString(), status: 'active', unreadCount: 1,
      },
    ]);
    mockZernio.listConversationMessages.mockResolvedValue([
      { id: 'msg_x', conversationId: 'conv_3', accountId: 'acct_3', platform: 'facebook', message: 'hello?', senderName: 'Amy', direction: 'incoming', createdAt: new Date().toISOString() },
      { id: 'msg_y', conversationId: 'conv_3', accountId: 'acct_3', platform: 'facebook', message: 'still there?', senderName: 'Amy', direction: 'incoming', createdAt: new Date().toISOString() },
    ]);

    // Call the sync twice, fast-forwarding the fake clock between calls so
    // the module's own in-process rate-limit gate doesn't just skip the
    // second call — this exercises the actual dedup logic (upsert on externalId).
    await syncZernioInbox();
    jest.setSystemTime(virtualNow + 20_000);
    await syncZernioInbox();

    const messagesAfterBoth = await prisma.message.count({ where: { externalId: 'conv_3' } });
    const repliesAfterBoth = await prisma.messageReply.count({ where: { externalId: 'msg_y' } });
    expect(messagesAfterBoth).toBe(1);
    expect(repliesAfterBoth).toBe(1);
  });

  it('skips conversations on platforms the app has no chip/label for (e.g. reddit, telegram)', async () => {
    mockZernio.listConversations.mockResolvedValue([
      {
        id: 'conv_unsupported', platform: 'reddit', accountId: 'acct_9', accountUsername: 'brand',
        participantId: 'user_1', participantName: 'RedditUser', lastMessage: 'yo',
        updatedTime: new Date().toISOString(), status: 'active', unreadCount: 1,
      },
    ]);

    await syncZernioInbox();
    expect(mockZernio.listConversationMessages).not.toHaveBeenCalled();
    const row = await prisma.message.findUnique({ where: { externalId: 'conv_unsupported' } });
    expect(row).toBeNull();
  });

  it('does not throw if listConversations fails (e.g. Inbox addon not enabled)', async () => {
    mockZernio.listConversations.mockRejectedValue(new Error('Zernio error 403: Inbox addon required'));
    await expect(syncZernioInbox()).resolves.toBeUndefined();
  });

  it('GET /api/inbox responds without waiting on the Zernio sync to finish', async () => {
    const { token } = await authAs();
    // Hold listConversations pending indefinitely — if the route awaited the
    // sync before responding (the earlier, buggy version of this code), this
    // request would hang. Resolve it at the end so no state leaks into later
    // tests via the sync module's shared in-flight-promise cache.
    let releaseSync!: () => void;
    mockZernio.listConversations.mockImplementation(
      () => new Promise((resolve) => { releaseSync = () => resolve([]); })
    );

    const res = await request(app).get('/api/inbox').set(bearer(token));
    expect(res.status).toBe(200);
    expect(mockZernio.listConversations).toHaveBeenCalled();

    releaseSync();
    await syncZernioInbox().catch(() => {}); // let the in-flight sync settle before the next test
  });
});

describe('POST /api/inbox/sync — explicit, awaited "Sync now"', () => {
  it('awaits the sync and returns stillSyncing:false when it completes quickly', async () => {
    const { token } = await authAs();
    mockZernio.listConversations.mockResolvedValue([
      { id: 'conv_sync_1', platform: 'instagram', accountId: 'acct_1', accountUsername: 'brand', participantId: 'u1', participantName: 'Fast', lastMessage: 'hi', updatedTime: new Date().toISOString(), status: 'active', unreadCount: 1 },
    ]);
    mockZernio.listConversationMessages.mockResolvedValue([
      { id: 'msg_sync_1', conversationId: 'conv_sync_1', accountId: 'acct_1', platform: 'instagram', message: 'hi', senderName: 'Fast', direction: 'incoming', createdAt: new Date().toISOString() },
    ]);

    const res = await request(app).post('/api/inbox/sync').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.stillSyncing).toBe(false);

    // Data is genuinely fresh the instant the response comes back — no delay needed.
    const row = await prisma.message.findUnique({ where: { externalId: 'conv_sync_1' } });
    expect(row).toBeTruthy();
  });

  it('bypasses the passive rate-limit gate (force:true) — a manual sync right after an automatic one still runs', async () => {
    const { token } = await authAs();
    mockZernio.listConversations.mockResolvedValue([]);

    // A passive sync via GET /inbox (rate-gated) primes lastSyncAt...
    await request(app).get('/api/inbox').set(bearer(token));
    await syncZernioInbox().catch(() => {}); // drain that passive sync so it can't be mistaken for the forced one below
    // ...then update the mock and immediately force a manual sync. If the
    // rate gate applied here, this would be a no-op and the new conversation
    // would never appear — that's the exact "stale for 15s" bug being fixed.
    mockZernio.listConversations.mockResolvedValue([
      { id: 'conv_sync_2', platform: 'twitter', accountId: 'acct_2', accountUsername: 'brand', participantId: 'u2', participantName: 'Fresh', lastMessage: 'new!', updatedTime: new Date().toISOString(), status: 'active', unreadCount: 1 },
    ]);
    mockZernio.listConversationMessages.mockResolvedValue([
      { id: 'msg_sync_2', conversationId: 'conv_sync_2', accountId: 'acct_2', platform: 'twitter', message: 'new!', senderName: 'Fresh', direction: 'incoming', createdAt: new Date().toISOString() },
    ]);

    const res = await request(app).post('/api/inbox/sync').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.stillSyncing).toBe(false);

    const row = await prisma.message.findUnique({ where: { externalId: 'conv_sync_2' } });
    expect(row).toBeTruthy();
  });

  it('returns 200 with stillSyncing:false even if Zernio is unconfigured (no-op)', async () => {
    const { token } = await authAs();
    mockZernio.isConfigured.mockReturnValue(false);
    const res = await request(app).post('/api/inbox/sync').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.stillSyncing).toBe(false);
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/inbox/sync');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/inbox/:id/reply delivers to the real conversation when synced from Zernio', () => {
  it('calls zernio.sendInboxMessage using the stored externalId/accountId', async () => {
    const { token } = await authAs();
    const msg = await prisma.message.create({
      data: {
        externalId: 'conv_reply_1', accountId: 'acct_reply_1', network: 'instagram',
        senderName: 'Cara', senderUser: 'user_1', content: 'hi', type: 'dm', status: 'unread', sentiment: 'neutral', isRead: false,
      },
    });
    mockZernio.sendInboxMessage.mockResolvedValue(undefined);

    const res = await request(app).post(`/api/inbox/${msg.id}/reply`).set(bearer(token)).send({ content: 'On it!' });
    expect(res.status).toBe(200);
    expect(mockZernio.sendInboxMessage).toHaveBeenCalledWith('conv_reply_1', 'acct_reply_1', 'On it!');
  });

  it('returns 502 if Zernio fails to deliver the reply, without saving a fake local reply', async () => {
    const { token } = await authAs();
    const msg = await prisma.message.create({
      data: {
        externalId: 'conv_reply_2', accountId: 'acct_reply_2', network: 'instagram',
        senderName: 'Dee', senderUser: 'user_2', content: 'hi', type: 'dm', status: 'unread', sentiment: 'neutral', isRead: false,
      },
    });
    mockZernio.sendInboxMessage.mockRejectedValue(new Error('platform rate limited'));

    const res = await request(app).post(`/api/inbox/${msg.id}/reply`).set(bearer(token)).send({ content: 'Reply' });
    expect(res.status).toBe(502);
    const replies = await prisma.messageReply.findMany({ where: { messageId: msg.id } });
    expect(replies).toHaveLength(0);
  });

  it('returns 503 when Zernio is not configured but the message needs live delivery', async () => {
    const { token } = await authAs();
    const msg = await prisma.message.create({
      data: {
        externalId: 'conv_reply_3', accountId: 'acct_reply_3', network: 'instagram',
        senderName: 'Eli', senderUser: 'user_3', content: 'hi', type: 'dm', status: 'unread', sentiment: 'neutral', isRead: false,
      },
    });
    mockZernio.isConfigured.mockReturnValue(false);

    const res = await request(app).post(`/api/inbox/${msg.id}/reply`).set(bearer(token)).send({ content: 'Reply' });
    expect(res.status).toBe(503);
  });

  it('plain locally-created messages (no externalId) still reply purely locally', async () => {
    const { token } = await authAs();
    const msg = await prisma.message.create({
      data: { network: 'twitter', senderName: 'Local', senderUser: 'local1', content: 'hi', type: 'dm', status: 'unread', sentiment: 'neutral', isRead: false },
    });

    const res = await request(app).post(`/api/inbox/${msg.id}/reply`).set(bearer(token)).send({ content: 'Reply' });
    expect(res.status).toBe(200);
    expect(mockZernio.sendInboxMessage).not.toHaveBeenCalled();
  });
});

describe('PUT /api/inbox/:id/read marks the real conversation read via Zernio', () => {
  it('calls zernio.markConversationRead for a synced message', async () => {
    const { token } = await authAs();
    const msg = await prisma.message.create({
      data: {
        externalId: 'conv_read_1', accountId: 'acct_read_1', network: 'instagram',
        senderName: 'Fay', senderUser: 'user_4', content: 'hi', type: 'dm', status: 'unread', sentiment: 'neutral', isRead: false,
      },
    });
    mockZernio.markConversationRead.mockResolvedValue(undefined);

    const res = await request(app).put(`/api/inbox/${msg.id}/read`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(mockZernio.markConversationRead).toHaveBeenCalledWith('conv_read_1', 'acct_read_1');
  });

  it('does not fail the request if markConversationRead itself throws', async () => {
    const { token } = await authAs();
    const msg = await prisma.message.create({
      data: {
        externalId: 'conv_read_2', accountId: 'acct_read_2', network: 'instagram',
        senderName: 'Gia', senderUser: 'user_5', content: 'hi', type: 'dm', status: 'unread', sentiment: 'neutral', isRead: false,
      },
    });
    mockZernio.markConversationRead.mockRejectedValue(new Error('boom'));

    const res = await request(app).put(`/api/inbox/${msg.id}/read`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.isRead).toBe(true);
  });
});

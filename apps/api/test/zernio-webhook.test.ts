/**
 * Real-time inbox delivery: Zernio webhook receiver + auto-registration.
 *
 * This is the fix for "huge wait" on incoming DMs — instead of only ever
 * discovering new messages on the next poll (rate-gated to 15s, or a manual
 * sync), Zernio pushes a signed `message.received` webhook the instant a DM
 * arrives, and this app applies it to the DB immediately and pushes it to any
 * open Inbox tab over the SSE stream.
 */

jest.mock('../src/lib/zernio', () => ({
  isConfigured: jest.fn(),
  listWebhooks: jest.fn(),
  createWebhook: jest.fn(),
  updateWebhook: jest.fn(),
}));

import crypto from 'crypto';
import request from 'supertest';
import { app, closeDb } from './helpers';
import { prisma } from '../src/prisma';
import * as zernio from '../src/lib/zernio';
import { ensureZernioWebhookRegistered, getZernioWebhookSecret } from '../src/zernioWebhookSetup';
import { subscribeInboxEvents, publishInboxEvent } from '../src/realtime';

const mockZernio = zernio as jest.Mocked<typeof zernio>;

jest.setTimeout(30_000);
afterAll(closeDb);

beforeEach(async () => {
  jest.clearAllMocks();
  mockZernio.isConfigured.mockReturnValue(true);
  await prisma.appSetting.deleteMany({ where: { key: 'zernio.webhook.secret' } });
  await prisma.message.deleteMany({});
  process.env.API_BASE_URL = 'https://api.example.com';
});

function sign(secret: string, body: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

describe('ensureZernioWebhookRegistered', () => {
  it('creates a new webhook when none exists, generating and persisting a secret', async () => {
    mockZernio.listWebhooks.mockResolvedValue([]);
    mockZernio.createWebhook.mockResolvedValue({ id: 'wh1', name: 'x', url: 'https://api.example.com/api/webhooks/zernio', events: ['message.received'], isActive: true });

    await ensureZernioWebhookRegistered();

    expect(mockZernio.createWebhook).toHaveBeenCalledTimes(1);
    const call = mockZernio.createWebhook.mock.calls[0][0];
    expect(call.url).toBe('https://api.example.com/api/webhooks/zernio');
    expect(call.events).toContain('message.received');
    expect(call.secret).toHaveLength(64); // 32 random bytes, hex

    const secret = await getZernioWebhookSecret();
    expect(secret).toBe(call.secret);
  });

  it('is idempotent — an already-correct existing webhook is left alone', async () => {
    mockZernio.listWebhooks.mockResolvedValue([
      { id: 'wh1', name: 'x', url: 'https://api.example.com/api/webhooks/zernio', events: ['message.received'], isActive: true },
    ]);
    await ensureZernioWebhookRegistered();
    expect(mockZernio.createWebhook).not.toHaveBeenCalled();
    expect(mockZernio.updateWebhook).not.toHaveBeenCalled();
  });

  it('updates an existing-but-stale webhook (inactive or missing the event)', async () => {
    mockZernio.listWebhooks.mockResolvedValue([
      { id: 'wh1', name: 'x', url: 'https://api.example.com/api/webhooks/zernio', events: [], isActive: false },
    ]);
    await ensureZernioWebhookRegistered();
    expect(mockZernio.updateWebhook).toHaveBeenCalledWith('wh1', expect.objectContaining({ isActive: true, events: ['message.received'] }));
  });

  it('skips registration when API_BASE_URL is missing or points at localhost', async () => {
    process.env.API_BASE_URL = 'http://localhost:3001';
    await ensureZernioWebhookRegistered();
    expect(mockZernio.listWebhooks).not.toHaveBeenCalled();
  });

  it('skips registration when Zernio is not configured', async () => {
    mockZernio.isConfigured.mockReturnValue(false);
    await ensureZernioWebhookRegistered();
    expect(mockZernio.listWebhooks).not.toHaveBeenCalled();
  });

  it('does not throw if Zernio rejects registration (e.g. Inbox addon required)', async () => {
    mockZernio.listWebhooks.mockRejectedValue(new Error('Zernio error 403: Inbox addon required'));
    await expect(ensureZernioWebhookRegistered()).resolves.toBeUndefined();
  });
});

describe('POST /api/webhooks/zernio — signature verification', () => {
  it('rejects a request with no secret registered yet', async () => {
    const res = await request(app).post('/api/webhooks/zernio').send({ event: 'message.received' });
    expect(res.status).toBe(503);
  });

  it('rejects an invalid signature', async () => {
    mockZernio.listWebhooks.mockResolvedValue([]);
    mockZernio.createWebhook.mockResolvedValue({ id: 'wh1', name: 'x', url: 'x', events: [], isActive: true });
    await ensureZernioWebhookRegistered();

    const res = await request(app)
      .post('/api/webhooks/zernio')
      .set('x-zernio-signature', 'not-the-real-signature')
      .send({ event: 'message.received' });
    expect(res.status).toBe(401);
  });

  it('accepts a validly signed payload', async () => {
    mockZernio.listWebhooks.mockResolvedValue([]);
    mockZernio.createWebhook.mockResolvedValue({ id: 'wh1', name: 'x', url: 'x', events: [], isActive: true });
    await ensureZernioWebhookRegistered();
    const secret = (await getZernioWebhookSecret())!;

    const payload = { event: 'webhook.test' };
    const body = JSON.stringify(payload);
    const res = await request(app)
      .post('/api/webhooks/zernio')
      .set('content-type', 'application/json')
      .set('x-zernio-signature', sign(secret, body))
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('POST /api/webhooks/zernio — message.received applies instantly', () => {
  let secret: string;

  beforeEach(async () => {
    mockZernio.listWebhooks.mockResolvedValue([]);
    mockZernio.createWebhook.mockResolvedValue({ id: 'wh1', name: 'x', url: 'x', events: [], isActive: true });
    await ensureZernioWebhookRegistered();
    secret = (await getZernioWebhookSecret())!;
  });

  function post(payload: any) {
    const body = JSON.stringify(payload);
    return request(app)
      .post('/api/webhooks/zernio')
      .set('content-type', 'application/json')
      .set('x-zernio-signature', sign(secret, body))
      .send(body);
  }

  it('creates a new Message row for a first-time conversation', async () => {
    const res = await post({
      id: 'evt1',
      event: 'message.received',
      message: {
        id: 'm1', conversationId: 'conv_wh_1', platform: 'instagram', platformMessageId: 'pm1',
        direction: 'incoming', text: 'Hey, is this in stock?', attachments: [],
        sender: { id: 'u1', name: 'Jane' }, sentAt: new Date().toISOString(), isRead: false,
      },
      conversation: { id: 'conv_wh_1', platformConversationId: 'pc1', participantId: 'u1', participantName: 'Jane', status: 'active' },
      account: { id: 'acct1', accountId: 'acct1', platform: 'instagram', username: 'brand' },
      timestamp: new Date().toISOString(),
    });
    expect(res.status).toBe(200);

    // Applied asynchronously after the response — poll briefly.
    await new Promise((r) => setTimeout(r, 100));
    const row = await prisma.message.findUnique({ where: { externalId: 'conv_wh_1' } });
    expect(row).toBeTruthy();
    expect(row!.content).toBe('Hey, is this in stock?');
    expect(row!.senderName).toBe('Jane');
    expect(row!.isRead).toBe(false);
  });

  it('threads a follow-up message into an existing conversation as a reply', async () => {
    await prisma.message.create({
      data: {
        externalId: 'conv_wh_2', accountId: 'acct2', network: 'instagram',
        senderName: 'Bob', senderUser: 'u2', content: 'first message', type: 'dm',
        status: 'resolved', sentiment: 'neutral', isRead: true,
      },
    });

    const res = await post({
      id: 'evt2', event: 'message.received',
      message: { id: 'm2', conversationId: 'conv_wh_2', platform: 'instagram', platformMessageId: 'pm2', direction: 'incoming', text: 'still there?', attachments: [], sender: { id: 'u2', name: 'Bob' }, sentAt: new Date().toISOString(), isRead: false },
      conversation: { id: 'conv_wh_2', platformConversationId: 'pc2', participantId: 'u2', participantName: 'Bob', status: 'active' },
      account: { id: 'acct2', accountId: 'acct2', platform: 'instagram', username: 'brand' },
      timestamp: new Date().toISOString(),
    });
    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 100));

    const row = await prisma.message.findUnique({ where: { externalId: 'conv_wh_2' }, include: { replies: true } });
    expect(row!.status).toBe('unread'); // a resolved thread reopens on a new incoming message
    expect(row!.isRead).toBe(false);
    const reply = row!.replies.find((r) => r.content === 'still there?');
    expect(reply).toBeTruthy();
    expect(reply!.isFromUs).toBe(false);
  });

  it('ignores outgoing messages (already written optimistically by the reply route)', async () => {
    const res = await post({
      id: 'evt3', event: 'message.received',
      message: { id: 'm3', conversationId: 'conv_wh_3', platform: 'instagram', platformMessageId: 'pm3', direction: 'outgoing', text: 'our reply', attachments: [], sender: { id: 'business' }, sentAt: new Date().toISOString(), isRead: true },
      conversation: { id: 'conv_wh_3', platformConversationId: 'pc3', status: 'active' },
      account: { id: 'acct3', accountId: 'acct3', platform: 'instagram', username: 'brand' },
      timestamp: new Date().toISOString(),
    });
    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 100));
    const row = await prisma.message.findUnique({ where: { externalId: 'conv_wh_3' } });
    expect(row).toBeNull();
  });

  it('skips platforms the app has no chip for', async () => {
    const res = await post({
      id: 'evt4', event: 'message.received',
      message: { id: 'm4', conversationId: 'conv_wh_4', platform: 'telegram', platformMessageId: 'pm4', direction: 'incoming', text: 'hi', attachments: [], sender: { id: 'u4' }, sentAt: new Date().toISOString(), isRead: false },
      conversation: { id: 'conv_wh_4', platformConversationId: 'pc4', status: 'active' },
      account: { id: 'acct4', accountId: 'acct4', platform: 'telegram', username: 'brand' },
      timestamp: new Date().toISOString(),
    });
    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 100));
    const row = await prisma.message.findUnique({ where: { externalId: 'conv_wh_4' } });
    expect(row).toBeNull();
  });

  it('publishes an inbox event for a live-connected client the instant the message is applied', async () => {
    const events: any[] = [];
    const unsubscribe = subscribeInboxEvents((e) => events.push(e));

    await post({
      id: 'evt5', event: 'message.received',
      message: { id: 'm5', conversationId: 'conv_wh_5', platform: 'facebook', platformMessageId: 'pm5', direction: 'incoming', text: 'urgent!', attachments: [], sender: { id: 'u5', name: 'Cara' }, sentAt: new Date().toISOString(), isRead: false },
      conversation: { id: 'conv_wh_5', platformConversationId: 'pc5', participantName: 'Cara', status: 'active' },
      account: { id: 'acct5', accountId: 'acct5', platform: 'facebook', username: 'brand' },
      timestamp: new Date().toISOString(),
    });
    await new Promise((r) => setTimeout(r, 150));

    unsubscribe();
    const messageEvents = events.filter((e) => e.type === 'message');
    expect(messageEvents.length).toBeGreaterThanOrEqual(1);
    expect(messageEvents[0].data.content).toBe('urgent!');
  });
});

describe('realtime pub-sub (unit)', () => {
  it('delivers a published event to a subscriber and stops after unsubscribe', () => {
    const received: any[] = [];
    const unsubscribe = subscribeInboxEvents((e) => received.push(e));

    publishInboxEvent({ type: 'message', data: { id: 'x' } });
    expect(received).toHaveLength(1);

    unsubscribe();
    publishInboxEvent({ type: 'message', data: { id: 'y' } });
    expect(received).toHaveLength(1); // no further delivery after unsubscribe
  });

  it('delivers to multiple concurrent subscribers (multiple open tabs)', () => {
    const a: any[] = [];
    const b: any[] = [];
    const unsubA = subscribeInboxEvents((e) => a.push(e));
    const unsubB = subscribeInboxEvents((e) => b.push(e));

    publishInboxEvent({ type: 'message', data: { id: 'z' } });
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);

    unsubA();
    unsubB();
  });
});

/**
 * AI feature connectivity — end-to-end.
 *
 * Unlike llm.test.ts (which mocks global.fetch), this stands up a REAL local
 * HTTP server that speaks the OpenAI-compatible chat-completions protocol,
 * points the app's `custom` provider at it via a stored credential (the same
 * mechanism the Settings "Connect" button uses), makes it the active provider,
 * and then drives every AI endpoint through supertest.
 *
 * The point is to prove the whole connectivity path works when a provider is
 * genuinely reachable: request → provider resolution → real outbound HTTP →
 * response parsing → endpoint output — asserting `fallback: false` everywhere
 * (i.e. the offline mock was NOT used). If any wire in that chain is broken,
 * these tests fail where the mocked-fetch unit tests would still pass.
 */

import http from 'http';
import type { AddressInfo } from 'net';
import request from 'supertest';
import { app, authAs, bearer, closeDb } from './helpers';
import { prisma } from '../src/prisma';

let server: http.Server;
let baseUrl: string;
let received: any[] = [];

/** A minimal but realistic OpenAI-compatible LLM. It inspects the system
 *  prompt to return content shaped for whichever AI feature is calling, so
 *  every endpoint's parser gets something valid to work with. */
function replyFor(system: string, user: string): string {
  const s = system.toLowerCase();
  // Match on each endpoint's distinctive system-prompt phrasing. Order and
  // specificity matter: the campaign prompt literally says "no hashtags
  // block", so a naive `includes('hashtag')` would wrongly catch it.
  if (s.includes('output only hashtags')) return '#marketing #growth #socialmedia #branding #contentcreator';
  if (s.includes('classify sentiment')) {
    if (/love|great|amazing|awesome|excellent/i.test(user)) return 'positive';
    if (/hate|terrible|awful|bad|worst/i.test(user)) return 'negative';
    return 'neutral';
  }
  if (s.includes('post ideas')) // ideas
    return '1. Behind-the-scenes tour\n2. Customer success story\n3. Quick tip Tuesday\n4. Myth-busting thread\n5. Ask-me-anything';
  if (s.includes('senior social media strategist')) // campaign
    return '1. 🚀 Launch day is here!\n2. 💡 A tip you can use today\n3. 🤔 What do you think?\n4. 📊 The numbers speak\n5. ✨ Behind the scenes';
  if (s.includes('adapt one social post')) // repurpose
    return 'twitter: Short and punchy 🔥\nlinkedin: A thoughtful, professional take on this for your network.\ninstagram: ✨ Punchy and visual ✨ 💬';
  if (s.includes('brand support agent')) // reply
    return 'Thanks so much for reaching out! We are on it and will follow up shortly. 🙌';
  // caption / default
  return '📊 Here is a genuinely-generated caption from the live provider. Save this! 🚀';
}

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url?.endsWith('/chat/completions')) {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        let parsed: any = {};
        try { parsed = JSON.parse(body); } catch { /* ignore */ }
        received.push({ auth: req.headers['authorization'], body: parsed });
        const messages: any[] = parsed.messages ?? [];
        const system = messages.find((m) => m.role === 'system')?.content ?? '';
        const user = messages.find((m) => m.role === 'user')?.content ?? '';
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { content: replyFor(system, user) } }] }));
      });
      return;
    }
    res.writeHead(404).end();
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;
  baseUrl = `http://127.0.0.1:${port}/v1`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await closeDb();
});

beforeEach(() => { received = []; });

async function connectCustomProviderAndActivate(token: string) {
  // Same path the Settings "Connect" button uses.
  const connect = await request(app).put('/api/ai/providers/custom/key').set(bearer(token))
    .send({ apiKey: 'test-connectivity-key', baseUrl });
  expect(connect.status).toBe(200);
  const activate = await request(app).put('/api/ai/config').set(bearer(token))
    .send({ provider: 'custom', model: 'connectivity-model' });
  expect(activate.status).toBe(200);
  expect(activate.body.data.active).toBe('custom');
  expect(activate.body.data.usingMock).toBe(false);
}

describe('AI connectivity: every feature works against a live provider', () => {
  let token: string;

  beforeAll(async () => {
    token = (await authAs('owner')).token;
  });

  beforeEach(async () => {
    // Reset any prior active-provider setting and reconnect fresh each test.
    await prisma.appSetting.deleteMany({ where: { key: { in: ['llm.provider', 'llm.model'] } } });
    await prisma.llmCredential.deleteMany({});
    await connectCustomProviderAndActivate(token);
  });

  it('status reports the live provider as active and not using mock', async () => {
    const res = await request(app).get('/api/ai/status').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.active).toBe('custom');
    expect(res.body.data.usingMock).toBe(false);
    const custom = res.body.data.providers.find((p: any) => p.id === 'custom');
    expect(custom.configured).toBe(true);
  });

  it('caption comes from the live provider (fallback:false) and forwards the API key', async () => {
    const res = await request(app).post('/api/ai/caption').set(bearer(token))
      .send({ prompt: 'our new AI feature', tone: 'bold' });
    expect(res.status).toBe(200);
    expect(res.body.data.provider).toBe('custom');
    expect(res.body.data.fallback).toBe(false);
    expect(res.body.data.caption).toContain('genuinely-generated');
    // The outbound request actually carried our stored key as a Bearer token.
    expect(received[0].auth).toBe('Bearer test-connectivity-key');
  });

  it('hashtags are parsed from the live provider response', async () => {
    const res = await request(app).post('/api/ai/hashtags').set(bearer(token))
      .send({ topic: 'ai marketing', count: 5 });
    expect(res.status).toBe(200);
    expect(res.body.data.fallback).toBe(false);
    expect(res.body.data.hashtags).toEqual(
      expect.arrayContaining(['#marketing', '#growth', '#socialmedia'])
    );
  });

  it('ideas are parsed from a numbered list returned by the live provider', async () => {
    const res = await request(app).post('/api/ai/ideas').set(bearer(token))
      .send({ industry: 'fintech', count: 5 });
    expect(res.status).toBe(200);
    expect(res.body.data.fallback).toBe(false);
    expect(res.body.data.ideas.length).toBe(5);
    // Numbering prefix stripped by the route parser.
    expect(res.body.data.ideas[0]).toBe('Behind-the-scenes tour');
  });

  it('sentiment classification uses the live provider', async () => {
    const pos = await request(app).post('/api/ai/sentiment').set(bearer(token))
      .send({ text: 'I absolutely love this product, amazing!' });
    expect(pos.status).toBe(200);
    expect(pos.body.data.fallback).toBe(false);
    expect(pos.body.data.sentiment).toBe('positive');

    const neg = await request(app).post('/api/ai/sentiment').set(bearer(token))
      .send({ text: 'This is terrible and I hate it' });
    expect(neg.body.data.sentiment).toBe('negative');
  });

  it('campaign generates N posts from the live provider', async () => {
    const res = await request(app).post('/api/ai/campaign').set(bearer(token))
      .send({ brief: 'summer launch', count: 5, tone: 'excited', networks: ['twitter'] });
    expect(res.status).toBe(200);
    expect(res.body.data.fallback).toBe(false);
    expect(res.body.data.posts.length).toBe(5);
    expect(res.body.data.posts[0].content).toContain('Launch day');
    expect(res.body.data.posts[0].networks).toEqual(['twitter']);
  });

  it('repurpose maps live-provider output to per-network variants', async () => {
    const res = await request(app).post('/api/ai/repurpose').set(bearer(token))
      .send({ content: 'Our big announcement', networks: ['twitter', 'linkedin', 'instagram'] });
    expect(res.status).toBe(200);
    expect(res.body.data.fallback).toBe(false);
    expect(res.body.data.variants.twitter).toContain('punchy');
    expect(res.body.data.variants.linkedin).toContain('professional');
    expect(res.body.data.variants.instagram).toBeTruthy();
  });

  it('reply drafts a support message from the live provider', async () => {
    const res = await request(app).post('/api/ai/reply').set(bearer(token))
      .send({ message: 'Where is my order?', sentiment: 'neutral', tone: 'friendly' });
    expect(res.status).toBe(200);
    expect(res.body.data.fallback).toBe(false);
    expect(res.body.data.reply).toContain('reaching out');
  });

  it('gracefully falls back to mock if the live provider goes down mid-session', async () => {
    // Point the provider at a dead port so the outbound call fails.
    await request(app).put('/api/ai/providers/custom/key').set(bearer(token))
      .send({ apiKey: 'test-connectivity-key', baseUrl: 'http://127.0.0.1:1/v1' });
    const res = await request(app).post('/api/ai/caption').set(bearer(token))
      .send({ prompt: 'anything' });
    expect(res.status).toBe(200);
    // Feature still responds — just from the offline fallback.
    expect(res.body.data.fallback).toBe(true);
    expect(res.body.data.caption).toBeTruthy();
  });
});

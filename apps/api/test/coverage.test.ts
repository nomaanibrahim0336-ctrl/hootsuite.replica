/**
 * Full coverage test suite — covers every route, validation rule, RBAC
 * check, and edge case that exists in the API but wasn't covered by load.test.ts.
 *
 * Organized by domain. Runs after load.test.ts via --runInBand.
 */

import request from 'supertest';
import { app, authAs, bearer, seedMessage, seedStream, seedReport, seedAdvocacy, closeDb } from './helpers';

jest.setTimeout(120_000);

afterAll(closeDb);

// ─────────────────────────────────────────────────────────────────────────────
// AUTH — forgot password / reset password / token edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('Auth: forgot-password & reset-password flow', () => {
  it('forgot-password with valid email returns resetToken', async () => {
    const email = `forgot_${Date.now()}@test.com`;
    await request(app).post('/api/auth/register').send({ email, password: 'Pass1234', name: 'Forgot' });
    const res = await request(app).post('/api/auth/forgot-password').send({ email });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.resetToken).toBeTruthy();
  });

  it('forgot-password with unknown email still returns 200 (anti-enumeration)', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@nowhere.test' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('forgot-password with invalid email format returns 400', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('reset-password with valid token updates password and allows new login', async () => {
    const email = `reset_${Date.now()}@test.com`;
    await request(app).post('/api/auth/register').send({ email, password: 'OldPass1', name: 'Reset' });
    const fpRes = await request(app).post('/api/auth/forgot-password').send({ email });
    const { resetToken } = fpRes.body.data;

    const resetRes = await request(app).post('/api/auth/reset-password').send({ token: resetToken, password: 'NewPass9' });
    expect(resetRes.status).toBe(200);

    const loginRes = await request(app).post('/api/auth/login').send({ email, password: 'NewPass9' });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.accessToken).toBeTruthy();
  });

  it('reset-password with invalid token returns 400', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({ token: 'totally.invalid.token', password: 'NewPass9' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('reset-password with password < 6 chars returns 400', async () => {
    const email = `reset2_${Date.now()}@test.com`;
    await request(app).post('/api/auth/register').send({ email, password: 'OldPass1', name: 'Reset2' });
    const fpRes = await request(app).post('/api/auth/forgot-password').send({ email });
    const { resetToken } = fpRes.body.data;
    const res = await request(app).post('/api/auth/reset-password').send({ token: resetToken, password: 'abc' });
    expect(res.status).toBe(400);
  });

  it('logout always returns 200', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
  });

  it('/me with no token returns 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('/me with malformed token returns 401', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(401);
  });

  it('refresh with invalid refresh token returns 401', async () => {
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'garbage' });
    expect(res.status).toBe(401);
  });

  it('valid refresh token returns new access + refresh tokens', async () => {
    const { refreshToken } = await authAs();
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POSTS — validation, calendar, approval, schedule edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('Posts: validation edge cases', () => {
  let token: string;
  beforeAll(async () => { token = (await authAs()).token; });

  it('create post with content > 5000 chars returns 400', async () => {
    const res = await request(app).post('/api/posts').set(bearer(token))
      .send({ content: 'x'.repeat(5001) });
    expect(res.status).toBe(400);
  });

  it('create post with empty content returns 400', async () => {
    const res = await request(app).post('/api/posts').set(bearer(token))
      .send({ content: '' });
    expect(res.status).toBe(400);
  });

  it('create post with missing content returns 400', async () => {
    const res = await request(app).post('/api/posts').set(bearer(token))
      .send({ networks: ['twitter'] });
    expect(res.status).toBe(400);
  });

  it('create post with exactly 5000 chars succeeds', async () => {
    const res = await request(app).post('/api/posts').set(bearer(token))
      .send({ content: 'a'.repeat(5000) });
    expect(res.status).toBe(201);
  });

  it('update post returns 404 for another user\'s post', async () => {
    const other = await authAs();
    const post = await request(app).post('/api/posts').set(bearer(other.token))
      .send({ content: 'Other user post' });
    const id = post.body.data.id;
    const res = await request(app).put(`/api/posts/${id}`).set(bearer(token)).send({ content: 'Hacked' });
    expect(res.status).toBe(404);
  });

  it('schedule post with explicit scheduledAt stores correct date', async () => {
    const post = await request(app).post('/api/posts').set(bearer(token))
      .send({ content: 'Schedule me', networks: ['twitter'] });
    const id = post.body.data.id;
    const futureDate = new Date(Date.now() + 7200000).toISOString();
    const res = await request(app).post(`/api/posts/${id}/schedule`).set(bearer(token))
      .send({ scheduledAt: futureDate });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('scheduled');
    expect(new Date(res.body.data.scheduledAt).getTime()).toBeCloseTo(new Date(futureDate).getTime(), -3);
  });

  it('schedule post without scheduledAt defaults to ~+1 hour', async () => {
    const post = await request(app).post('/api/posts').set(bearer(token))
      .send({ content: 'Schedule default', networks: ['twitter'] });
    const id = post.body.data.id;
    const before = Date.now();
    const res = await request(app).post(`/api/posts/${id}/schedule`).set(bearer(token)).send({});
    expect(res.status).toBe(200);
    const scheduled = new Date(res.body.data.scheduledAt).getTime();
    expect(scheduled).toBeGreaterThanOrEqual(before + 3500000); // ~1 hour
  });

  it('publish post sets publishedAt and engagements shape', async () => {
    const post = await request(app).post('/api/posts').set(bearer(token))
      .send({ content: 'Publish me', networks: ['twitter'] });
    const id = post.body.data.id;
    const res = await request(app).post(`/api/posts/${id}/publish`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('published');
    expect(res.body.data.publishedAt).toBeTruthy();
    expect(res.body.data.engagements).toMatchObject({ likes: 0, comments: 0, shares: 0, impressions: 0 });
  });

  it('publish another user\'s post returns 404', async () => {
    const other = await authAs();
    const post = await request(app).post('/api/posts').set(bearer(other.token))
      .send({ content: 'Not yours', networks: ['twitter'] });
    const id = post.body.data.id;
    const res = await request(app).post(`/api/posts/${id}/publish`).set(bearer(token));
    expect(res.status).toBe(404);
  });
});

describe('Posts: calendar endpoint', () => {
  it('calendar returns only own posts with dates', async () => {
    const { token: t1 } = await authAs();
    const { token: t2 } = await authAs();

    const futureDate = new Date(Date.now() + 3600000).toISOString();
    const p1 = await request(app).post('/api/posts').set(bearer(t1))
      .send({ content: 'Cal post user1', networks: ['twitter'], scheduledAt: futureDate });
    const p2 = await request(app).post('/api/posts').set(bearer(t2))
      .send({ content: 'Cal post user2', networks: ['twitter'], scheduledAt: futureDate });

    const res = await request(app).get('/api/posts/calendar').set(bearer(t1));
    expect(res.status).toBe(200);
    const ids = res.body.data.map((p: any) => p.id);
    expect(ids).toContain(p1.body.data.id);
    expect(ids).not.toContain(p2.body.data.id);
  });

  it('calendar entries have id, content, networks, status, date fields', async () => {
    const { token } = await authAs();
    const futureDate = new Date(Date.now() + 3600000).toISOString();
    await request(app).post('/api/posts').set(bearer(token))
      .send({ content: 'Cal fields test', networks: ['linkedin'], scheduledAt: futureDate });
    const res = await request(app).get('/api/posts/calendar').set(bearer(token));
    const entry = res.body.data[0];
    expect(entry).toHaveProperty('id');
    expect(entry).toHaveProperty('content');
    expect(entry).toHaveProperty('networks');
    expect(entry).toHaveProperty('status');
    expect(entry).toHaveProperty('date');
  });
});

describe('Posts: bulk create', () => {
  let token: string;
  beforeAll(async () => { token = (await authAs()).token; });

  it('bulk create with empty posts array returns 201 with empty data', async () => {
    const res = await request(app).post('/api/posts/bulk').set(bearer(token)).send({ posts: [] });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('bulk create with 10 posts all succeed', async () => {
    const posts = Array.from({ length: 10 }, (_, i) => ({
      content: `Bulk post ${i}`,
      networks: ['twitter'],
      status: 'draft',
    }));
    const res = await request(app).post('/api/posts/bulk').set(bearer(token)).send({ posts });
    expect(res.status).toBe(201);
    expect(res.body.data.length).toBe(10);
    expect(res.body.total).toBe(10);
  });

  it('bulk create with missing posts field treats as empty', async () => {
    const res = await request(app).post('/api/posts/bulk').set(bearer(token)).send({});
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual([]);
  });
});

describe('Posts: approval workflow', () => {
  it('submit post for approval sets approvalStatus to pending', async () => {
    const { token } = await authAs();
    const post = await request(app).post('/api/posts').set(bearer(token))
      .send({ content: 'Submit me' });
    const id = post.body.data.id;
    const res = await request(app).post(`/api/posts/${id}/submit`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.approvalStatus).toBe('pending');
  });

  it('approve post sets approvalStatus to approved (owner has permission)', async () => {
    const { token } = await authAs('owner');
    const post = await request(app).post('/api/posts').set(bearer(token))
      .send({ content: 'Approve me' });
    const id = post.body.data.id;
    const res = await request(app).post(`/api/posts/${id}/approve`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.approvalStatus).toBe('approved');
  });

  it('reject post sets approvalStatus to rejected', async () => {
    const { token } = await authAs('owner');
    const post = await request(app).post('/api/posts').set(bearer(token))
      .send({ content: 'Reject me' });
    const id = post.body.data.id;
    const res = await request(app).post(`/api/posts/${id}/reject`).set(bearer(token))
      .send({ reason: 'Off-brand' });
    expect(res.status).toBe(200);
    expect(res.body.data.approvalStatus).toBe('rejected');
  });

  it('viewer cannot approve posts (403)', async () => {
    const owner = await authAs('owner');
    const viewer = await authAs('viewer');
    const post = await request(app).post('/api/posts').set(bearer(owner.token))
      .send({ content: 'Viewer cant approve' });
    const id = post.body.data.id;
    const res = await request(app).post(`/api/posts/${id}/approve`).set(bearer(viewer.token));
    expect(res.status).toBe(403);
  });

  it('editor cannot approve posts (403)', async () => {
    const owner = await authAs('owner');
    const editor = await authAs('editor');
    const post = await request(app).post('/api/posts').set(bearer(owner.token))
      .send({ content: 'Editor cant approve' });
    const id = post.body.data.id;
    const res = await request(app).post(`/api/posts/${id}/approve`).set(bearer(editor.token));
    expect(res.status).toBe(403);
  });

  it('editor cannot reject posts (403)', async () => {
    const owner = await authAs('owner');
    const editor = await authAs('editor');
    const post = await request(app).post('/api/posts').set(bearer(owner.token))
      .send({ content: 'Editor cant reject' });
    const id = post.body.data.id;
    const res = await request(app).post(`/api/posts/${id}/reject`).set(bearer(editor.token));
    expect(res.status).toBe(403);
  });

  it('submit another user\'s post returns 404', async () => {
    const owner = await authAs();
    const other = await authAs();
    const post = await request(app).post('/api/posts').set(bearer(owner.token))
      .send({ content: 'Not yours to submit' });
    const id = post.body.data.id;
    const res = await request(app).post(`/api/posts/${id}/submit`).set(bearer(other.token));
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// NETWORKS
// ─────────────────────────────────────────────────────────────────────────────

describe('Networks: CRUD', () => {
  let token: string;
  beforeAll(async () => { token = (await authAs()).token; });

  it('list networks returns array', async () => {
    const res = await request(app).get('/api/networks').set(bearer(token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('connect new network creates it (201)', async () => {
    const type = `testnet_${Date.now()}`;
    const res = await request(app).post('/api/networks').set(bearer(token))
      .send({ type, name: 'Test Net', username: '@testnet' });
    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe(type);
    expect(res.body.data.connected).toBe(true);
  });

  it('connect existing network type upserts (200)', async () => {
    const type = `upsertnet_${Date.now()}`;
    await request(app).post('/api/networks').set(bearer(token)).send({ type });
    const res = await request(app).post('/api/networks').set(bearer(token))
      .send({ type, name: 'Updated Net', username: '@updated' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Net');
  });

  it('connect without type returns 400', async () => {
    const res = await request(app).post('/api/networks').set(bearer(token)).send({});
    expect(res.status).toBe(400);
  });

  it('disconnect network sets connected to false', async () => {
    const type = `disc_${Date.now()}`;
    const created = await request(app).post('/api/networks').set(bearer(token)).send({ type });
    const id = created.body.data.id;
    const res = await request(app).delete(`/api/networks/${id}`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.connected).toBe(false);
  });

  it('disconnect non-existent network returns 404', async () => {
    const res = await request(app).delete('/api/networks/00000000-0000-0000-0000-000000000099').set(bearer(token));
    expect(res.status).toBe(404);
  });

  it('get network status by id', async () => {
    const type = `status_${Date.now()}`;
    const created = await request(app).post('/api/networks').set(bearer(token)).send({ type });
    const id = created.body.data.id;
    const res = await request(app).get(`/api/networks/${id}/status`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('connected');
  });

  it('get status of non-existent network returns 404', async () => {
    const res = await request(app).get('/api/networks/00000000-0000-0000-0000-000000000099/status').set(bearer(token));
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// INBOX
// ─────────────────────────────────────────────────────────────────────────────

describe('Inbox: CRUD and filtering', () => {
  let token: string;
  beforeAll(async () => { token = (await authAs()).token; });

  it('list inbox messages returns array with total', async () => {
    await seedMessage();
    const res = await request(app).get('/api/inbox').set(bearer(token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.total).toBe('number');
  });

  it('filter inbox by status=resolved', async () => {
    const res = await request(app).get('/api/inbox?status=resolved').set(bearer(token));
    expect(res.status).toBe(200);
    res.body.data.forEach((m: any) => expect(m.status).toBe('resolved'));
  });

  it('filter inbox by network=twitter', async () => {
    await seedMessage(); // twitter by default
    const res = await request(app).get('/api/inbox?network=twitter').set(bearer(token));
    expect(res.status).toBe(200);
    res.body.data.forEach((m: any) => expect(m.network).toBe('twitter'));
  });

  it('mark message as read returns isRead: true', async () => {
    const msg = await seedMessage();
    const res = await request(app).put(`/api/inbox/${msg.id}/read`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.isRead).toBe(true);
  });

  it('mark read on non-existent message returns 404', async () => {
    const res = await request(app).put('/api/inbox/00000000-0000-0000-0000-000000000099/read').set(bearer(token));
    expect(res.status).toBe(404);
  });

  it('assign message sets assignedTo and status=assigned', async () => {
    const msg = await seedMessage();
    const res = await request(app).put(`/api/inbox/${msg.id}/assign`).set(bearer(token))
      .send({ assignedTo: 'Alice' });
    expect(res.status).toBe(200);
    expect(res.body.data.assignedTo).toBe('Alice');
    expect(res.body.data.status).toBe('assigned');
  });

  it('assign non-existent message returns 404', async () => {
    const res = await request(app).put('/api/inbox/00000000-0000-0000-0000-000000000099/assign').set(bearer(token))
      .send({ assignedTo: 'Bob' });
    expect(res.status).toBe(404);
  });

  it('reply to message sets status=resolved and stores reply', async () => {
    const msg = await seedMessage();
    const res = await request(app).post(`/api/inbox/${msg.id}/reply`).set(bearer(token))
      .send({ content: 'Thanks for your message!' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('resolved');
    expect(res.body.data.thread.length).toBeGreaterThanOrEqual(1);
  });

  it('reply without content returns 400', async () => {
    const msg = await seedMessage();
    const res = await request(app).post(`/api/inbox/${msg.id}/reply`).set(bearer(token)).send({});
    expect(res.status).toBe(400);
  });

  it('reply to non-existent message returns 404', async () => {
    const res = await request(app).post('/api/inbox/00000000-0000-0000-0000-000000000099/reply').set(bearer(token))
      .send({ content: 'Hi' });
    expect(res.status).toBe(404);
  });
});

describe('Inbox: saved replies', () => {
  let token: string;
  beforeAll(async () => { token = (await authAs()).token; });

  it('list saved replies returns array', async () => {
    const res = await request(app).get('/api/inbox/saved-replies').set(bearer(token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('create saved reply returns 201 with data', async () => {
    const res = await request(app).post('/api/inbox/saved-replies').set(bearer(token))
      .send({ title: 'Thanks!', content: 'Thank you for your message.' });
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Thanks!');
  });

  it('create saved reply without title returns 400', async () => {
    const res = await request(app).post('/api/inbox/saved-replies').set(bearer(token))
      .send({ content: 'No title here' });
    expect(res.status).toBe(400);
  });

  it('create saved reply without content returns 400', async () => {
    const res = await request(app).post('/api/inbox/saved-replies').set(bearer(token))
      .send({ title: 'No content' });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LISTENING
// ─────────────────────────────────────────────────────────────────────────────

describe('Listening: streams and mentions', () => {
  let token: string;
  beforeAll(async () => { token = (await authAs()).token; });

  it('list streams returns array', async () => {
    const res = await request(app).get('/api/listening/streams').set(bearer(token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('create stream with name returns 201', async () => {
    const res = await request(app).post('/api/listening/streams').set(bearer(token))
      .send({ name: `Stream ${Date.now()}`, keywords: ['brand', 'product'], sources: ['twitter'] });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBeTruthy();
    expect(res.body.data.isActive).toBe(true);
  });

  it('create stream without name returns 400', async () => {
    const res = await request(app).post('/api/listening/streams').set(bearer(token)).send({});
    expect(res.status).toBe(400);
  });

  it('ingest mentions into a stream', async () => {
    const stream = await seedStream();
    const res = await request(app).post(`/api/listening/streams/${stream.id}/ingest`)
      .set(bearer(token)).send({ count: 5 });
    expect(res.status).toBe(201);
    expect(res.body.data.length).toBe(5);
    expect(res.body.total).toBe(5);
  });

  it('ingest caps at 20 mentions', async () => {
    const stream = await seedStream();
    const res = await request(app).post(`/api/listening/streams/${stream.id}/ingest`)
      .set(bearer(token)).send({ count: 100 });
    expect(res.status).toBe(201);
    expect(res.body.data.length).toBe(20);
  });

  it('ingest updates mentionCount on stream', async () => {
    const stream = await seedStream();
    await request(app).post(`/api/listening/streams/${stream.id}/ingest`)
      .set(bearer(token)).send({ count: 3 });
    const { prisma } = await import('../src/prisma');
    const updated = await prisma.stream.findUnique({ where: { id: stream.id } });
    expect(updated!.mentionCount).toBe(3);
  });

  it('ingest on non-existent stream returns 404', async () => {
    const res = await request(app).post('/api/listening/streams/00000000-0000-0000-0000-000000000099/ingest')
      .set(bearer(token)).send({ count: 3 });
    expect(res.status).toBe(404);
  });

  it('list mentions returns array with total', async () => {
    const res = await request(app).get('/api/listening/mentions').set(bearer(token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('filter mentions by streamId', async () => {
    const stream = await seedStream();
    await request(app).post(`/api/listening/streams/${stream.id}/ingest`)
      .set(bearer(token)).send({ count: 2 });
    const res = await request(app).get(`/api/listening/mentions?streamId=${stream.id}`).set(bearer(token));
    expect(res.status).toBe(200);
    res.body.data.forEach((m: any) => expect(m.streamId).toBe(stream.id));
  });

  it('filter mentions by sentiment=positive', async () => {
    const res = await request(app).get('/api/listening/mentions?sentiment=positive').set(bearer(token));
    expect(res.status).toBe(200);
    res.body.data.forEach((m: any) => expect(m.sentiment).toBe('positive'));
  });

  it('sentiment summary returns positive/negative/neutral percentages', async () => {
    const res = await request(app).get('/api/listening/sentiment').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.summary).toHaveProperty('positive');
    expect(res.body.data.summary).toHaveProperty('negative');
    expect(res.body.data.summary).toHaveProperty('neutral');
    expect(res.body.data.trend).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS — reports & export
// ─────────────────────────────────────────────────────────────────────────────

describe('Analytics: metrics', () => {
  let token: string;
  beforeAll(async () => { token = (await authAs()).token; });

  it('GET /analytics/metrics returns metrics array and networkBreakdown', async () => {
    const res = await request(app).get('/api/analytics/metrics').set(bearer(token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.metrics)).toBe(true);
    expect(Array.isArray(res.body.data.networkBreakdown)).toBe(true);
    expect(res.body.data.trend).toBeTruthy();
  });

  it('metrics after publishing a post reflect engagements', async () => {
    const post = await request(app).post('/api/posts').set(bearer(token))
      .send({ content: 'Analytics post', networks: ['twitter'] });
    await request(app).post(`/api/posts/${post.body.data.id}/publish`).set(bearer(token));
    const res = await request(app).get('/api/analytics/metrics').set(bearer(token));
    expect(res.status).toBe(200);
    // impressions and engagements may be 0 (no real delivery), but shape must be correct
    const imp = res.body.data.metrics.find((m: any) => m.label === 'Impressions');
    expect(imp).toBeTruthy();
  });
});

describe('Analytics: reports CRUD', () => {
  let token: string;
  beforeAll(async () => { token = (await authAs()).token; });

  it('list reports returns array', async () => {
    const res = await request(app).get('/api/analytics/reports').set(bearer(token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('create report returns 201', async () => {
    const res = await request(app).post('/api/analytics/reports').set(bearer(token))
      .send({ name: `Report ${Date.now()}`, type: 'Engagement', networks: ['twitter'] });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBeTruthy();
  });

  it('create report without name returns 400', async () => {
    const res = await request(app).post('/api/analytics/reports').set(bearer(token)).send({});
    expect(res.status).toBe(400);
  });

  it('get report by id returns data', async () => {
    const report = await seedReport();
    const res = await request(app).get(`/api/analytics/reports/${report.id}`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(report.id);
  });

  it('get non-existent report returns 404', async () => {
    const res = await request(app).get('/api/analytics/reports/00000000-0000-0000-0000-000000000099').set(bearer(token));
    expect(res.status).toBe(404);
  });

  it('update report name', async () => {
    const report = await seedReport();
    const res = await request(app).put(`/api/analytics/reports/${report.id}`).set(bearer(token))
      .send({ name: 'Updated Name' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Name');
  });

  it('update non-existent report returns 404', async () => {
    const res = await request(app).put('/api/analytics/reports/00000000-0000-0000-0000-000000000099').set(bearer(token))
      .send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  it('delete report returns 200 with deleted data', async () => {
    const report = await seedReport();
    const res = await request(app).delete(`/api/analytics/reports/${report.id}`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(report.id);
  });

  it('delete non-existent report returns 404', async () => {
    const res = await request(app).delete('/api/analytics/reports/00000000-0000-0000-0000-000000000099').set(bearer(token));
    expect(res.status).toBe(404);
  });

  it('export report as CSV returns text/csv content-type', async () => {
    const report = await seedReport();
    const res = await request(app).post(`/api/analytics/reports/${report.id}/export?format=csv`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
  });

  it('export report as PDF returns application/pdf content-type', async () => {
    const report = await seedReport();
    const res = await request(app).post(`/api/analytics/reports/${report.id}/export?format=pdf`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
  });

  it('export report as JSON (default) returns JSON body', async () => {
    const report = await seedReport();
    const res = await request(app).post(`/api/analytics/reports/${report.id}/export?format=json`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeTruthy();
  });

  it('export non-existent report returns 404', async () => {
    const res = await request(app).post('/api/analytics/reports/00000000-0000-0000-0000-000000000099/export')
      .set(bearer(token));
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEAMS
// ─────────────────────────────────────────────────────────────────────────────

describe('Teams: CRUD', () => {
  let ownerToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    const owner = await authAs('owner');
    const viewer = await authAs('viewer');
    ownerToken = owner.token;
    viewerToken = viewer.token;
  });

  it('GET /teams returns array', async () => {
    const res = await request(app).get('/api/teams').set(bearer(ownerToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /teams/members also returns array', async () => {
    const res = await request(app).get('/api/teams/members').set(bearer(ownerToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('invite member (owner) returns 201', async () => {
    const res = await request(app).post('/api/teams/members').set(bearer(ownerToken))
      .send({ name: 'Alice', email: `alice_${Date.now()}@team.test`, role: 'editor' });
    expect(res.status).toBe(201);
    expect(res.body.data.email).toContain('@team.test');
  });

  it('invite member without name returns 400', async () => {
    const res = await request(app).post('/api/teams/members').set(bearer(ownerToken))
      .send({ email: `noname_${Date.now()}@team.test` });
    expect(res.status).toBe(400);
  });

  it('invite member without email returns 400', async () => {
    const res = await request(app).post('/api/teams/members').set(bearer(ownerToken))
      .send({ name: 'NoEmail' });
    expect(res.status).toBe(400);
  });

  it('viewer cannot invite member (403)', async () => {
    const res = await request(app).post('/api/teams/members').set(bearer(viewerToken))
      .send({ name: 'Bob', email: `bob_${Date.now()}@team.test` });
    expect(res.status).toBe(403);
  });

  it('update member role', async () => {
    const created = await request(app).post('/api/teams/members').set(bearer(ownerToken))
      .send({ name: 'Update Me', email: `upd_${Date.now()}@team.test`, role: 'viewer' });
    const id = created.body.data.id;
    const res = await request(app).put(`/api/teams/members/${id}`).set(bearer(ownerToken))
      .send({ role: 'editor' });
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('editor');
  });

  it('update non-existent member returns 404', async () => {
    const res = await request(app).put('/api/teams/members/00000000-0000-0000-0000-000000000099').set(bearer(ownerToken))
      .send({ role: 'editor' });
    expect(res.status).toBe(404);
  });

  it('viewer cannot update member (403)', async () => {
    const created = await request(app).post('/api/teams/members').set(bearer(ownerToken))
      .send({ name: 'Target', email: `target_${Date.now()}@team.test` });
    const id = created.body.data.id;
    const res = await request(app).put(`/api/teams/members/${id}`).set(bearer(viewerToken))
      .send({ role: 'admin' });
    expect(res.status).toBe(403);
  });

  it('remove member returns 200 with deleted data', async () => {
    const created = await request(app).post('/api/teams/members').set(bearer(ownerToken))
      .send({ name: 'Delete Me', email: `del_${Date.now()}@team.test` });
    const id = created.body.data.id;
    const res = await request(app).delete(`/api/teams/members/${id}`).set(bearer(ownerToken));
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(id);
  });

  it('remove non-existent member returns 404', async () => {
    const res = await request(app).delete('/api/teams/members/00000000-0000-0000-0000-000000000099').set(bearer(ownerToken));
    expect(res.status).toBe(404);
  });

  it('viewer cannot remove member (403)', async () => {
    const created = await request(app).post('/api/teams/members').set(bearer(ownerToken))
      .send({ name: 'Dont Delete', email: `nodelete_${Date.now()}@team.test` });
    const id = created.body.data.id;
    const res = await request(app).delete(`/api/teams/members/${id}`).set(bearer(viewerToken));
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADVOCACY
// ─────────────────────────────────────────────────────────────────────────────

describe('Advocacy: content and shares', () => {
  let ownerToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    const owner = await authAs('owner');
    const viewer = await authAs('viewer');
    ownerToken = owner.token;
    viewerToken = viewer.token;
  });

  it('list advocacy content returns array', async () => {
    const res = await request(app).get('/api/advocacy/content').set(bearer(ownerToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('create content (owner) returns 201', async () => {
    const res = await request(app).post('/api/advocacy/content').set(bearer(ownerToken))
      .send({ title: 'Share This!', body: 'Great content to share.', category: 'Product' });
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Share This!');
  });

  it('create content without title returns 400', async () => {
    const res = await request(app).post('/api/advocacy/content').set(bearer(ownerToken))
      .send({ body: 'No title' });
    expect(res.status).toBe(400);
  });

  it('create content without body returns 400', async () => {
    const res = await request(app).post('/api/advocacy/content').set(bearer(ownerToken))
      .send({ title: 'No body' });
    expect(res.status).toBe(400);
  });

  it('viewer cannot create content (403)', async () => {
    const res = await request(app).post('/api/advocacy/content').set(bearer(viewerToken))
      .send({ title: 'Viewer Content', body: 'Nope' });
    expect(res.status).toBe(403);
  });

  it('share content records a share with reach', async () => {
    const content = await seedAdvocacy();
    const res = await request(app).post(`/api/advocacy/content/${content.id}/share`).set(bearer(ownerToken))
      .send({ employeeName: 'Bob', employeeEmail: 'bob@corp.test' });
    expect(res.status).toBe(201);
    expect(res.body.data.reach).toBeGreaterThan(0);
    expect(res.body.data.employeeName).toBe('Bob');
  });

  it('share non-existent content returns 404', async () => {
    const res = await request(app).post('/api/advocacy/content/00000000-0000-0000-0000-000000000099/share')
      .set(bearer(ownerToken)).send({});
    expect(res.status).toBe(404);
  });

  it('advocacy analytics returns totalShares, totalReach, leaderboard', async () => {
    const res = await request(app).get('/api/advocacy/analytics').set(bearer(ownerToken));
    expect(res.status).toBe(200);
    expect(typeof res.body.data.totalShares).toBe('number');
    expect(typeof res.body.data.totalReach).toBe('number');
    expect(Array.isArray(res.body.data.leaderboard)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOG
// ─────────────────────────────────────────────────────────────────────────────

describe('Audit log', () => {
  let ownerToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    const owner = await authAs('owner');
    const viewer = await authAs('viewer');
    ownerToken = owner.token;
    viewerToken = viewer.token;
  });

  it('owner can view audit log', async () => {
    const res = await request(app).get('/api/audit').set(bearer(ownerToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('viewer cannot view audit log (403)', async () => {
    const res = await request(app).get('/api/audit').set(bearer(viewerToken));
    expect(res.status).toBe(403);
  });

  it('audit log respects limit query param', async () => {
    const res = await request(app).get('/api/audit?limit=5').set(bearer(ownerToken));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
  });

  it('audit log caps at 500 even if limit=1000', async () => {
    const res = await request(app).get('/api/audit?limit=1000').set(bearer(ownerToken));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(500);
  });

  it('actions like post.submit create audit entries', async () => {
    const { token } = await authAs('owner');
    const post = await request(app).post('/api/posts').set(bearer(token))
      .send({ content: 'Audit trail test' });
    await request(app).post(`/api/posts/${post.body.data.id}/submit`).set(bearer(token));

    const res = await request(app).get('/api/audit').set(bearer(ownerToken));
    const actions = res.body.data.map((e: any) => e.action);
    expect(actions).toContain('post.submit');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AI ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

describe('AI: all endpoints with mock provider', () => {
  let token: string;
  let ownerToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    const u = await authAs('owner');
    const v = await authAs('viewer');
    token = u.token;
    ownerToken = u.token;
    viewerToken = v.token;
  });

  it('GET /ai/status returns active provider and providers list', async () => {
    const res = await request(app).get('/api/ai/status').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('active');
    expect(Array.isArray(res.body.data.providers)).toBe(true);
  });

  it('GET /ai/providers returns array of providers', async () => {
    const res = await request(app).get('/api/ai/providers').set(bearer(token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /ai/caption returns caption string', async () => {
    const res = await request(app).post('/api/ai/caption').set(bearer(token))
      .send({ prompt: 'our new product', tone: 'professional', length: 150 });
    expect(res.status).toBe(200);
    expect(typeof res.body.data.caption).toBe('string');
    expect(res.body.data.caption.length).toBeGreaterThan(0);
  });

  it('POST /ai/hashtags returns array of hashtags', async () => {
    const res = await request(app).post('/api/ai/hashtags').set(bearer(token))
      .send({ topic: 'marketing', count: 6 });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.hashtags)).toBe(true);
    expect(res.body.data.hashtags.length).toBeGreaterThan(0);
    res.body.data.hashtags.forEach((h: string) => expect(h).toMatch(/^#/));
  });

  it('POST /ai/ideas returns array of ideas', async () => {
    const res = await request(app).post('/api/ai/ideas').set(bearer(token))
      .send({ industry: 'fintech', count: 4 });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.ideas)).toBe(true);
    expect(res.body.data.ideas.length).toBeGreaterThan(0);
  });

  it('POST /ai/sentiment classifies text', async () => {
    const res = await request(app).post('/api/ai/sentiment').set(bearer(token))
      .send({ text: 'I love this product so much!' });
    expect(res.status).toBe(200);
    expect(['positive', 'negative', 'neutral']).toContain(res.body.data.sentiment);
  });

  it('POST /ai/campaign returns N posts array', async () => {
    const res = await request(app).post('/api/ai/campaign').set(bearer(token))
      .send({ brief: 'our launch event', count: 4, tone: 'excited', networks: ['twitter'] });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.posts)).toBe(true);
    expect(res.body.data.posts.length).toBeGreaterThan(0);
  });

  it('POST /ai/campaign caps count at 12', async () => {
    const res = await request(app).post('/api/ai/campaign').set(bearer(token))
      .send({ brief: 'test', count: 99 });
    expect(res.status).toBe(200);
    expect(res.body.data.posts.length).toBeLessThanOrEqual(12);
  });

  it('POST /ai/repurpose returns variants per network', async () => {
    const res = await request(app).post('/api/ai/repurpose').set(bearer(token))
      .send({ content: 'Exciting news from our team!', networks: ['twitter', 'linkedin', 'instagram'] });
    expect(res.status).toBe(200);
    expect(res.body.data.variants).toHaveProperty('twitter');
    expect(res.body.data.variants).toHaveProperty('linkedin');
    expect(res.body.data.variants).toHaveProperty('instagram');
  });

  it('POST /ai/reply returns a reply string', async () => {
    const res = await request(app).post('/api/ai/reply').set(bearer(token))
      .send({ message: 'Your service is terrible!', sentiment: 'negative', tone: 'empathetic' });
    expect(res.status).toBe(200);
    expect(typeof res.body.data.reply).toBe('string');
    expect(res.body.data.reply.length).toBeGreaterThan(0);
  });

  it('PUT /ai/config without permission returns 403 (viewer)', async () => {
    const res = await request(app).put('/api/ai/config').set(bearer(viewerToken))
      .send({ provider: 'mock' });
    expect(res.status).toBe(403);
  });

  it('PUT /ai/config without provider field returns 400', async () => {
    const res = await request(app).put('/api/ai/config').set(bearer(ownerToken)).send({});
    expect(res.status).toBe(400);
  });

  it('PUT /ai/config with valid provider (owner) returns 200', async () => {
    const res = await request(app).put('/api/ai/config').set(bearer(ownerToken))
      .send({ provider: 'mock' });
    expect(res.status).toBe(200);
    expect(res.body.data.active).toBe('mock');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OAUTH ROUTES
// ─────────────────────────────────────────────────────────────────────────────

describe('OAuth: Facebook flows', () => {
  it('GET /oauth/facebook without FB_APP_ID redirects with oauth_error=missing_config', async () => {
    // In test env, FB_APP_ID is not set — should redirect
    const res = await request(app).get('/api/oauth/facebook?returnTo=http://localhost:3000/settings');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('oauth_error=missing_config');
  });

  it('GET /oauth/facebook/callback with invalid state redirects with oauth_error', async () => {
    const res = await request(app).get('/api/oauth/facebook/callback?state=invalidstate&code=abc');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('oauth_error');
  });

  it('GET /oauth/facebook/callback with fbError param redirects with error', async () => {
    // Sign a valid state token to get past state validation
    const jwt = await import('jsonwebtoken');
    const state = jwt.default.sign(
      { returnTo: 'http://localhost:3000/settings', network: 'facebook' },
      process.env.JWT_SECRET || 'dev-secret-change-me',
      { expiresIn: '10m' }
    );
    const res = await request(app)
      .get(`/api/oauth/facebook/callback?state=${state}&error=access_denied`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('oauth_error=access_denied');
  });
});

describe('OAuth: disconnect', () => {
  let token: string;
  beforeAll(async () => { token = (await authAs()).token; });

  it('disconnect non-connected network returns 404', async () => {
    const res = await request(app).delete('/api/oauth/nonexistentnet123/disconnect');
    expect(res.status).toBe(404);
  });

  it('disconnect connected network sets connected: false', async () => {
    // First connect a network
    const type = `oauthnet_${Date.now()}`;
    await request(app).post('/api/networks').set(bearer(token)).send({ type });
    const { prisma } = await import('../src/prisma');
    const n = await prisma.network.findFirst({ where: { type } });
    // Then disconnect via OAuth route
    const res = await request(app).delete(`/api/oauth/${type}/disconnect`);
    expect(res.status).toBe(200);
    const updated = await prisma.network.findUnique({ where: { id: n!.id } });
    expect(updated!.connected).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ZERNIO & AYRSHARE ROUTES (no API key configured in test)
// ─────────────────────────────────────────────────────────────────────────────

describe('Zernio: routes when not configured', () => {
  let token: string;
  beforeAll(async () => { token = (await authAs()).token; });

  it('GET /zernio/status returns configured: false when no API key', async () => {
    const res = await request(app).get('/api/zernio/status').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.configured).toBe(false);
    expect(Array.isArray(res.body.data.accounts)).toBe(true);
  });

  it('POST /zernio/connect without platform returns 400', async () => {
    // Even when configured, missing platform = 400; when not configured, 503 comes first
    const res = await request(app).post('/api/zernio/connect').set(bearer(token)).send({});
    expect([400, 503]).toContain(res.status);
  });

  it('POST /zernio/connect when not configured returns 503', async () => {
    const res = await request(app).post('/api/zernio/connect').set(bearer(token))
      .send({ platform: 'twitter', returnTo: 'http://localhost:3000' });
    expect(res.status).toBe(503);
  });

  it('DELETE /zernio/accounts/:platform when not configured returns 503', async () => {
    const res = await request(app).delete('/api/zernio/accounts/twitter').set(bearer(token));
    expect(res.status).toBe(503);
  });
});

describe('Ayrshare: routes when not configured', () => {
  let token: string;
  beforeAll(async () => { token = (await authAs()).token; });

  it('GET /ayrshare/status returns configured: false', async () => {
    const res = await request(app).get('/api/ayrshare/status').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.configured).toBe(false);
  });

  it('GET /ayrshare/networks returns empty array', async () => {
    const res = await request(app).get('/api/ayrshare/networks').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATE MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────

describe('Validator middleware: all rule types', () => {
  it('required string missing → 400', async () => {
    const res = await request(app).post('/api/auth/register').send({ password: 'Pass1234', name: 'Test' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  it('string below minLength → 400', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ email: `v_${Date.now()}@test.com`, password: 'ab', name: 'Test' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/password/i);
  });

  it('string above maxLength → 400 (name > 120)', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ email: `v2_${Date.now()}@test.com`, password: 'ValidPass1', name: 'x'.repeat(121) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/i);
  });

  it('string fails pattern → 400 (email without @)', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ email: 'notanemail', password: 'ValidPass1', name: 'Test' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  it('valid payload passes through → not 400', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ email: `valid_${Date.now()}@test.com`, password: 'ValidPass1', name: 'Valid User' });
    expect(res.status).toBe(201);
  });

  it('post content over maxLength (5000) → 400', async () => {
    const { token } = await authAs();
    const res = await request(app).post('/api/posts').set(bearer(token))
      .send({ content: 'x'.repeat(5001) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/content/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

describe('Health endpoints', () => {
  it('GET /health returns success: true', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(typeof res.body.data.uptime).toBe('number');
  });

  it('GET /health/db returns success: true and user count', async () => {
    const res = await request(app).get('/health/db');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(typeof res.body.data.users).toBe('number');
    expect(typeof res.body.data.latencyMs).toBe('number');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULER — run-scheduler + publishing-status
// ─────────────────────────────────────────────────────────────────────────────

describe('Scheduler: publishing status endpoints', () => {
  let token: string;
  beforeAll(async () => { token = (await authAs()).token; });

  it('GET /posts/publishing-status returns paused boolean', async () => {
    const res = await request(app).get('/api/posts/publishing-status').set(bearer(token));
    expect(res.status).toBe(200);
    expect(typeof res.body.data.paused).toBe('boolean');
  });

  it('pause then resume publishing changes state correctly', async () => {
    await request(app).post('/api/posts/pause-publishing').set(bearer(token));
    const paused = await request(app).get('/api/posts/publishing-status').set(bearer(token));
    expect(paused.body.data.paused).toBe(true);

    await request(app).post('/api/posts/resume-publishing').set(bearer(token));
    const resumed = await request(app).get('/api/posts/publishing-status').set(bearer(token));
    expect(resumed.body.data.paused).toBe(false);
  });

  it('run-scheduler returns published count (0 if nothing due)', async () => {
    const res = await request(app).post('/api/posts/run-scheduler').set(bearer(token));
    expect(res.status).toBe(200);
    expect(typeof res.body.data.published).toBe('number');
    expect(res.body.data.published).toBeGreaterThanOrEqual(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POSTS — filter by status
// ─────────────────────────────────────────────────────────────────────────────

describe('Posts: filter by status', () => {
  let token: string;
  beforeAll(async () => { token = (await authAs()).token; });

  it('filter posts by status=draft returns only drafts', async () => {
    await request(app).post('/api/posts').set(bearer(token))
      .send({ content: 'Draft post', status: 'draft' });
    const res = await request(app).get('/api/posts?status=draft').set(bearer(token));
    expect(res.status).toBe(200);
    res.body.data.forEach((p: any) => expect(p.status).toBe('draft'));
  });

  it('filter posts by status=published returns only published', async () => {
    const p = await request(app).post('/api/posts').set(bearer(token))
      .send({ content: 'Soon published', status: 'draft' });
    await request(app).post(`/api/posts/${p.body.data.id}/publish`).set(bearer(token));
    const res = await request(app).get('/api/posts?status=published').set(bearer(token));
    expect(res.status).toBe(200);
    res.body.data.forEach((p: any) => expect(p.status).toBe('published'));
  });

  it('posts list has total field', async () => {
    const res = await request(app).get('/api/posts').set(bearer(token));
    expect(typeof res.body.total).toBe('number');
    expect(res.body.total).toBe(res.body.data.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UNKNOWN ROUTE
// ─────────────────────────────────────────────────────────────────────────────

describe('Unknown routes', () => {
  it('unknown route returns 404 with success: false', async () => {
    const res = await request(app).get('/api/this-does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTH — profile update (PUT /auth/me)
// ─────────────────────────────────────────────────────────────────────────────

describe('Auth: update profile (PUT /auth/me)', () => {
  it('updates name and email and returns the updated user', async () => {
    const { token } = await authAs();
    const newEmail = `updated_${Date.now()}@test.com`;
    const res = await request(app).put('/api/auth/me').set(bearer(token))
      .send({ name: 'Updated Name', email: newEmail });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Name');
    expect(res.body.data.email).toBe(newEmail);
  });

  it('updates only name when email is omitted', async () => {
    const { token, email } = await authAs();
    const res = await request(app).put('/api/auth/me').set(bearer(token)).send({ name: 'Only Name' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Only Name');
    expect(res.body.data.email).toBe(email);
  });

  it('rejects email already in use by another user (409)', async () => {
    const other = await authAs();
    const { token } = await authAs();
    const res = await request(app).put('/api/auth/me').set(bearer(token)).send({ email: other.email });
    expect(res.status).toBe(409);
  });

  it('allows keeping your own current email unchanged', async () => {
    const { token, email } = await authAs();
    const res = await request(app).put('/api/auth/me').set(bearer(token)).send({ name: 'Same Email', email });
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(email);
  });

  it('rejects invalid email format (400)', async () => {
    const { token } = await authAs();
    const res = await request(app).put('/api/auth/me').set(bearer(token)).send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('requires authentication (401 without token)', async () => {
    const res = await request(app).put('/api/auth/me').send({ name: 'Nope' });
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// INBOX — resolve & internal notes
// ─────────────────────────────────────────────────────────────────────────────

describe('Inbox: resolve and internal notes', () => {
  let token: string;
  beforeAll(async () => { token = (await authAs()).token; });

  it('resolve sets status to resolved', async () => {
    const msg = await seedMessage();
    const res = await request(app).put(`/api/inbox/${msg.id}/resolve`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('resolved');
  });

  it('resolve on non-existent message returns 404', async () => {
    const res = await request(app).put('/api/inbox/00000000-0000-0000-0000-000000000099/resolve').set(bearer(token));
    expect(res.status).toBe(404);
  });

  it('save note persists notes field', async () => {
    const msg = await seedMessage();
    const res = await request(app).put(`/api/inbox/${msg.id}/note`).set(bearer(token))
      .send({ note: 'Call back tomorrow' });
    expect(res.status).toBe(200);
    expect(res.body.data.notes).toBe('Call back tomorrow');
  });

  it('note defaults to empty string when notes field is unset', async () => {
    const msg = await seedMessage();
    const res = await request(app).get('/api/inbox').set(bearer(token));
    const found = res.body.data.find((m: any) => m.id === msg.id);
    expect(found.notes).toBe('');
  });

  it('save note on non-existent message returns 404', async () => {
    const res = await request(app).put('/api/inbox/00000000-0000-0000-0000-000000000099/note').set(bearer(token))
      .send({ note: 'x' });
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS — createReport (used by the report-template "use template" buttons)
// ─────────────────────────────────────────────────────────────────────────────

describe('Analytics: createReport used by report templates', () => {
  it('creates a report from a template id and it appears in the reports list', async () => {
    const { token } = await authAs();
    const res = await request(app).post('/api/analytics/reports').set(bearer(token))
      .send({ name: 'Performance report', type: 't-perf' });
    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('t-perf');

    const list = await request(app).get('/api/analytics/reports').set(bearer(token));
    expect(list.body.data.some((r: any) => r.id === res.body.data.id)).toBe(true);
  });
});

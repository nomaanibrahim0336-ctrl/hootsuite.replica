import request from 'supertest';
import { app, authAs, bearer, seedStream, seedMessage, seedReport, seedAdvocacy, closeDb } from './helpers';

let token: string;
beforeAll(async () => { token = (await authAs()).token; });
afterAll(closeDb);

describe('Inbox', () => {
  it('lists messages, replies, and lists saved replies', async () => {
    const m = await seedMessage();
    const list = await request(app).get('/api/inbox').set(bearer(token));
    expect(list.status).toBe(200);
    const reply = await request(app).post(`/api/inbox/${m.id}/reply`).set(bearer(token)).send({ content: 'thanks!' });
    expect(reply.body.data.status).toBe('resolved');
    expect(reply.body.data.thread.length).toBe(1);
    const saved = await request(app).get('/api/inbox/saved-replies').set(bearer(token));
    expect(saved.status).toBe(200);
  });
});

describe('Listening', () => {
  it('ingests mentions, classifies sentiment, and aggregates', async () => {
    const s = await seedStream();
    const ingest = await request(app).post(`/api/listening/streams/${s.id}/ingest`).set(bearer(token)).send({ count: 4 });
    expect(ingest.status).toBe(201);
    expect(ingest.body.total).toBe(4);
    for (const m of ingest.body.data) expect(['positive', 'negative', 'neutral']).toContain(m.sentiment);
    const sentiment = await request(app).get('/api/listening/sentiment').set(bearer(token));
    expect(sentiment.body.data.summary).toHaveProperty('positive');
  });
});

describe('Analytics', () => {
  it('computes metrics and exports CSV + PDF', async () => {
    const metrics = await request(app).get('/api/analytics/metrics').set(bearer(token));
    expect(metrics.body.data.metrics.length).toBe(4);

    const r = await seedReport();
    const csv = await request(app).post(`/api/analytics/reports/${r.id}/export?format=csv`).set(bearer(token));
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('Report,');

    const pdf = await request(app).post(`/api/analytics/reports/${r.id}/export?format=pdf`).set(bearer(token));
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
  });
});

describe('AI', () => {
  it('reports provider status with mock active (no keys)', async () => {
    const res = await request(app).get('/api/ai/status').set(bearer(token));
    expect(res.body.data.active).toBe('mock');
    expect(res.body.data.usingMock).toBe(true);
    expect(res.body.data.providers.map((p: any) => p.id)).toEqual(
      expect.arrayContaining(['claude', 'openai', 'gemini', 'deepseek', 'custom', 'mock'])
    );
  });

  it('generates a caption, hashtags and ideas', async () => {
    const cap = await request(app).post('/api/ai/caption').set(bearer(token)).send({ prompt: 'a coffee shop', tone: 'playful' });
    expect(cap.body.data.caption.length).toBeGreaterThan(0);
    const tags = await request(app).post('/api/ai/hashtags').set(bearer(token)).send({ topic: 'coffee', count: 5 });
    expect(tags.body.data.hashtags.length).toBeGreaterThan(0);
    expect(tags.body.data.hashtags[0]).toMatch(/^#/);
    const ideas = await request(app).post('/api/ai/ideas').set(bearer(token)).send({ industry: 'fitness', count: 3 });
    expect(ideas.body.data.ideas.length).toBe(3);
  });
});

describe('Advocacy', () => {
  it('shares content and reports leaderboard analytics', async () => {
    const c = await seedAdvocacy();
    await request(app).post(`/api/advocacy/content/${c.id}/share`).set(bearer(token)).send({ employeeName: 'Sam', employeeEmail: 'sam@test.com' });
    const analytics = await request(app).get('/api/advocacy/analytics').set(bearer(token));
    expect(analytics.body.data.totalShares).toBeGreaterThanOrEqual(1);
    expect(analytics.body.data.leaderboard.length).toBeGreaterThanOrEqual(1);
  });
});

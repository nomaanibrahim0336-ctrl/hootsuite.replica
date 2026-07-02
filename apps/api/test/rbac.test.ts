import request from 'supertest';
import { app, authAs, bearer, closeDb } from './helpers';

afterAll(closeDb);

describe('RBAC + hardening', () => {
  it('blocks a viewer from team management, audit and AI config (403)', async () => {
    const { token } = await authAs('viewer');
    const invite = await request(app).post('/api/teams/members').set(bearer(token)).send({ name: 'X', email: 'x@test.com' });
    expect(invite.status).toBe(403);
    const audit = await request(app).get('/api/audit').set(bearer(token));
    expect(audit.status).toBe(403);
    const cfg = await request(app).put('/api/ai/config').set(bearer(token)).send({ provider: 'claude' });
    expect(cfg.status).toBe(403);
  });

  it('allows a viewer to read analytics (200)', async () => {
    const { token } = await authAs('viewer');
    const res = await request(app).get('/api/analytics/metrics').set(bearer(token));
    expect(res.status).toBe(200);
  });

  it('lets an owner manage the team and see the audit trail', async () => {
    const { token } = await authAs('owner');
    const invite = await request(app).post('/api/teams/members').set(bearer(token)).send({ name: 'New', email: `new${Date.now()}@test.com`, role: 'editor' });
    expect(invite.status).toBe(201);
    const audit = await request(app).get('/api/audit').set(bearer(token));
    expect(audit.status).toBe(200);
  });

  it('returns 404 for unknown routes', async () => {
    const { token } = await authAs();
    const res = await request(app).get('/api/nope').set(bearer(token));
    expect(res.status).toBe(404);
  });

  it('returns 400 for malformed JSON', async () => {
    const { token } = await authAs();
    const res = await request(app).post('/api/posts').set(bearer(token)).set('Content-Type', 'application/json').send('{ bad json ');
    expect(res.status).toBe(400);
  });
});

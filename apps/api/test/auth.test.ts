import request from 'supertest';
import { app, authAs, bearer, closeDb } from './helpers';

afterAll(closeDb);

describe('Auth', () => {
  it('health check works', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
  });

  it('registers a new user and returns tokens', async () => {
    const email = `reg${Date.now()}@test.com`;
    const res = await request(app).post('/api/auth/register').send({ email, password: 'secret123', name: 'Reg' });
    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.email).toBe(email);
  });

  it('rejects invalid email and short password', async () => {
    const bad1 = await request(app).post('/api/auth/register').send({ email: 'not-an-email', password: 'secret123', name: 'X' });
    expect(bad1.status).toBe(400);
    const bad2 = await request(app).post('/api/auth/register').send({ email: 'ok@test.com', password: '123', name: 'X' });
    expect(bad2.status).toBe(400);
  });

  it('rejects a malformed login without crashing (400, not a hang/500)', async () => {
    const empty = await request(app).post('/api/auth/login').send({});
    expect(empty.status).toBe(400);
    const badEmail = await request(app).post('/api/auth/login').send({ email: 'nope', password: 'x' });
    expect(badEmail.status).toBe(400);
  });

  it('blocks protected routes without a token (401)', async () => {
    const res = await request(app).get('/api/posts');
    expect(res.status).toBe(401);
  });

  it('allows protected routes with a valid token', async () => {
    const { token } = await authAs();
    const res = await request(app).get('/api/posts').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects a garbage token (401)', async () => {
    const res = await request(app).get('/api/posts').set({ Authorization: 'Bearer garbage' });
    expect(res.status).toBe(401);
  });
});

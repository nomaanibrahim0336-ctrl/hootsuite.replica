import request from 'supertest';
import { app, authAs, bearer, closeDb } from './helpers';

afterAll(closeDb);

describe('Auth', () => {
  it('health check works', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
  });

  it('deep DB health check round-trips to the database', async () => {
    const res = await request(app).get('/health/db');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
    expect(typeof res.body.data.users).toBe('number');
    expect(typeof res.body.data.latencyMs).toBe('number');
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

  it('refreshes an access token', async () => {
    const { refreshToken } = await authAs();
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it('rejects an invalid refresh token', async () => {
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'garbage' });
    expect(res.status).toBe(401);
  });

  it('completes the forgot-password / reset-password flow and the new password works', async () => {
    const email = `reset${Date.now()}@test.com`;
    await request(app).post('/api/auth/register').send({ email, password: 'oldpass1', name: 'Reset Me' });

    const forgot = await request(app).post('/api/auth/forgot-password').send({ email });
    expect(forgot.status).toBe(200);
    expect(forgot.body.data.resetToken).toBeTruthy();

    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: forgot.body.data.resetToken, password: 'newpass1' });
    expect(reset.status).toBe(200);

    const badLogin = await request(app).post('/api/auth/login').send({ email, password: 'oldpass1' });
    expect(badLogin.status).toBe(401);

    const goodLogin = await request(app).post('/api/auth/login').send({ email, password: 'newpass1' });
    expect(goodLogin.status).toBe(200);
    expect(goodLogin.body.data.accessToken).toBeTruthy();
  });

  it('does not leak whether an email exists on forgot-password', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody-here@test.com' });
    expect(res.status).toBe(200);
    expect(res.body.data.resetToken).toBeUndefined();
  });

  it('rejects an invalid or expired reset token', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({ token: 'garbage', password: 'whatever1' });
    expect(res.status).toBe(400);
  });
});

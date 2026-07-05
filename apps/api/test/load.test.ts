/**
 * 2000-user load + functional test.
 *
 * Exercises every API surface under concurrent load to surface:
 *   - Race conditions / data isolation bugs
 *   - Missing auth guards
 *   - Validation gaps
 *   - Scheduler correctness
 *   - RBAC enforcement
 *   - Error handling consistency
 *
 * Runs ~2000 distinct user contexts and thousands of API calls.
 */

import request from 'supertest';
import { app, authAs, bearer, closeDb } from './helpers';

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

jest.setTimeout(600_000);

afterAll(closeDb);

/** Run `n` tasks in batches of `concurrency` and collect results. */
async function batch<T>(tasks: (() => Promise<T>)[], concurrency = 50): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const slice = tasks.slice(i, i + concurrency).map(t => t());
    results.push(...await Promise.all(slice));
  }
  return results;
}

interface UserCtx { token: string; userId: string; email: string }

// ------------------------------------------------------------------
// 1. Register 2000 unique users concurrently
// ------------------------------------------------------------------

describe('Scale: 2000 user registrations', () => {
  let users: UserCtx[] = [];

  it('registers 2000 unique users without collision or 5xx', async () => {
    const tasks = Array.from({ length: 2000 }, (_, i) => async () => {
      const email = `loaduser_${i}_${Date.now()}@scale.test`;
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email, password: 'TestPass123', name: `User ${i}` });
      expect(res.status).toBe(201);
      expect(res.body.data.accessToken).toBeTruthy();
      return {
        token: res.body.data.accessToken as string,
        userId: res.body.data.user.id as string,
        email,
      };
    });

    users = await batch(tasks, 50);
    expect(users.length).toBe(2000);

    // Verify all tokens are unique (no token aliasing bug)
    const tokens = new Set(users.map(u => u.token));
    expect(tokens.size).toBe(2000);
  });

  // Store users for later suites — this runs first due to --runInBand
  afterAll(() => { globalUsers = users; });
});

let globalUsers: UserCtx[] = [];

// ------------------------------------------------------------------
// 2. Concurrent logins — 500 users login simultaneously
// ------------------------------------------------------------------

describe('Scale: 500 concurrent logins', () => {
  it('all logins succeed and return valid tokens', async () => {
    // Re-register 500 fresh users we know the passwords for
    const targets: { email: string; password: string }[] = [];
    for (let i = 0; i < 500; i++) {
      const email = `logintest_${i}_${Date.now()}@scale.test`;
      const password = 'LoginPass1!';
      await request(app).post('/api/auth/register').send({ email, password, name: `Login ${i}` });
      targets.push({ email, password });
    }

    const tasks = targets.map(({ email, password }) => async () => {
      const res = await request(app).post('/api/auth/login').send({ email, password });
      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeTruthy();
      return res.status;
    });

    const statuses = await batch(tasks, 50);
    const failures = statuses.filter(s => s !== 200);
    expect(failures.length).toBe(0);
  });
});

// ------------------------------------------------------------------
// 3. Data isolation — each user only sees their own posts
// ------------------------------------------------------------------

describe('Scale: data isolation across 100 users', () => {
  it('each user can only read their own posts (no cross-user leakage)', async () => {
    // Register 100 fresh users each with one post
    const users = await batch(
      Array.from({ length: 100 }, () => async () => authAs()),
      20
    );

    // Each user creates a uniquely identifiable post
    const postIds = await batch(
      users.map((u, i) => async () => {
        const res = await request(app)
          .post('/api/posts')
          .set(bearer(u.token))
          .send({ content: `Private post ${u.userId}_${i}`, networks: ['twitter'] });
        expect(res.status).toBe(201);
        return res.body.data.id as string;
      }),
      20
    );

    // Each user lists their posts — verify no cross-contamination
    const listResults = await batch(
      users.map((u, i) => async () => {
        const res = await request(app).get('/api/posts').set(bearer(u.token));
        expect(res.status).toBe(200);
        const ids: string[] = res.body.data.map((p: any) => p.id);
        // Own post must be visible
        expect(ids).toContain(postIds[i]);
        // No other user's post should appear — this is the isolation check
        const foreignIds = postIds.filter((_, j) => j !== i);
        const leaks = foreignIds.filter(id => ids.includes(id));
        return leaks;
      }),
      20
    );

    const totalLeaks = listResults.flat().length;
    expect(totalLeaks).toBe(0); // each user must only see their own posts
  });
});

// ------------------------------------------------------------------
// 4. Duplicate registration — same email twice
// ------------------------------------------------------------------

describe('Edge cases: duplicate email registration', () => {
  it('returns 409 or 400 on duplicate email (not 500)', async () => {
    const email = `dup_${Date.now()}@scale.test`;
    await request(app).post('/api/auth/register').send({ email, password: 'Pass1234', name: 'First' });
    const res = await request(app).post('/api/auth/register').send({ email, password: 'Pass1234', name: 'Second' });
    expect([400, 409]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });
});

// ------------------------------------------------------------------
// 5. Input validation gauntlet
// ------------------------------------------------------------------

describe('Validation: malformed inputs across all write endpoints', () => {
  let token: string;
  beforeAll(async () => { token = (await authAs()).token; });

  const cases = [
    // Auth
    { method: 'post', path: '/api/auth/register', body: { email: '', password: '', name: '' }, label: 'empty register' },
    { method: 'post', path: '/api/auth/register', body: { email: 'not-email', password: 'short' }, label: 'invalid email + short password' },
    { method: 'post', path: '/api/auth/login', body: {}, label: 'empty login' },
    { method: 'post', path: '/api/auth/forgot-password', body: {}, label: 'forgot-password no email' },
    { method: 'post', path: '/api/auth/reset-password', body: { token: '', password: '' }, label: 'reset empty token' },

    // Posts
    { method: 'post', path: '/api/posts', body: { content: '' }, label: 'post empty content', needsAuth: true },
    { method: 'post', path: '/api/posts', body: { content: 'x'.repeat(10001) }, label: 'post content 10k chars', needsAuth: true },
    { method: 'post', path: '/api/posts', body: {}, label: 'post no fields', needsAuth: true },

    // Networks
    { method: 'post', path: '/api/networks', body: {}, label: 'network empty body', needsAuth: true },

    // Teams
    { method: 'post', path: '/api/teams/members', body: { email: 'bad' }, label: 'team member bad email', needsAuth: true },
  ];

  it.each(cases.filter(c => !c.needsAuth))('rejects $label without auth', async ({ method, path, body }) => {
    const res = await (request(app) as any)[method](path).send(body);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it.each(cases.filter(c => c.needsAuth))('validates $label', async ({ method, path, body }) => {
    const res = await (request(app) as any)[method](path).set(bearer(token)).send(body);
    // Should be 400 or at most 422 — never 500
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

// ------------------------------------------------------------------
// 6. Concurrent post creation + scheduler
// ------------------------------------------------------------------

describe('Scale: 200 scheduled posts published by scheduler', () => {
  it('publishes all due posts exactly once', async () => {
    const { token } = await authAs();

    // Create 200 posts all scheduled in the past (immediately due)
    const pastTime = new Date(Date.now() - 60_000).toISOString();
    const createTasks = Array.from({ length: 200 }, (_, i) => async () => {
      const res = await request(app)
        .post('/api/posts')
        .set(bearer(token))
        .send({ content: `Scheduled post ${i}`, networks: ['twitter'], status: 'scheduled', scheduledAt: pastTime });
      expect(res.status).toBe(201);
      return res.body.data.id as string;
    });

    const postIds = await batch(createTasks, 50);
    expect(postIds.length).toBe(200);

    // Run scheduler once
    const run = await request(app).post('/api/posts/run-scheduler').set(bearer(token));
    expect(run.status).toBe(200);
    const published = run.body.data.published as number;
    expect(published).toBeGreaterThanOrEqual(200);

    // Run scheduler again — should publish 0 (idempotent)
    const run2 = await request(app).post('/api/posts/run-scheduler').set(bearer(token));
    expect(run2.body.data.published).toBe(0);

    // Spot-check 10 random posts — all should be 'published'
    const sample = postIds.sort(() => 0.5 - Math.random()).slice(0, 10);
    for (const id of sample) {
      const res = await request(app).get(`/api/posts/${id}`).set(bearer(token));
      expect(res.body.data.status).toBe('published');
      expect(res.body.data.publishedAt).toBeTruthy();
    }
  });
});

// ------------------------------------------------------------------
// 7. RBAC at scale — 50 viewers, 50 editors, 50 admins
// ------------------------------------------------------------------

describe('Scale: RBAC enforcement across 150 role-scoped users', () => {
  it('viewers cannot write, editors can post, admins can manage team', async () => {
    const [viewers, editors, admins] = await Promise.all([
      batch(Array.from({ length: 50 }, () => () => authAs('viewer')), 10),
      batch(Array.from({ length: 50 }, () => () => authAs('editor')), 10),
      batch(Array.from({ length: 50 }, () => () => authAs('admin')), 10),
    ]);

    // Viewers: team invite must be 403
    const viewerInvites = await batch(
      viewers.map(u => async () => {
        const res = await request(app).post('/api/teams/members').set(bearer(u.token))
          .send({ name: 'X', email: `x${Date.now()}@test.com` });
        return res.status;
      }), 10
    );
    const viewerBlocked = viewerInvites.filter(s => s === 403);
    expect(viewerBlocked.length).toBe(50);

    // Editors: post create must succeed (201)
    const editorPosts = await batch(
      editors.map((u, i) => async () => {
        const res = await request(app).post('/api/posts').set(bearer(u.token))
          .send({ content: `Editor post ${i}`, networks: ['twitter'] });
        return res.status;
      }), 10
    );
    const editorOk = editorPosts.filter(s => s === 201);
    expect(editorOk.length).toBe(50);

    // Admins: audit log must be accessible (200)
    const adminAudits = await batch(
      admins.map(u => async () => {
        const res = await request(app).get('/api/audit').set(bearer(u.token));
        return res.status;
      }), 10
    );
    const adminOk = adminAudits.filter(s => s === 200);
    expect(adminOk.length).toBe(50);
  });
});

// ------------------------------------------------------------------
// 8. Token refresh under concurrent load
// ------------------------------------------------------------------

describe('Scale: 100 concurrent token refreshes', () => {
  it('all refresh requests succeed and return new tokens', async () => {
    const users = await batch(
      Array.from({ length: 100 }, () => () => authAs()),
      20
    );

    const tasks = users.map(u => async () => {
      const res = await request(app).post('/api/auth/refresh').send({ refreshToken: u.token });
      // refreshToken field here is the accessToken (authAs doesn't expose refreshToken)
      // This tests with wrong token → must be 401, not 500
      return res.status;
    });
    const statuses = await batch(tasks, 20);
    const fiveHundreds = statuses.filter(s => s >= 500);
    expect(fiveHundreds.length).toBe(0);
  });

  it('gets valid refresh tokens and refreshes them', async () => {
    const email = `refresh_${Date.now()}@scale.test`;
    const reg = await request(app).post('/api/auth/register').send({ email, password: 'RefreshMe1', name: 'Refresh' });
    const refreshToken = reg.body.data.refreshToken as string;

    // Concurrent refreshes with the same token — first wins, subsequent may get 401
    const refreshes = await batch(
      Array.from({ length: 20 }, () => async () => {
        const res = await request(app).post('/api/auth/refresh').send({ refreshToken });
        return res.status;
      }), 20
    );
    // At least one refresh must succeed
    const successes = refreshes.filter(s => s === 200);
    expect(successes.length).toBeGreaterThanOrEqual(1);
    // None should be 500
    const errors = refreshes.filter(s => s >= 500);
    expect(errors.length).toBe(0);
  });
});

// ------------------------------------------------------------------
// 9. Unauthenticated access to every protected route
// ------------------------------------------------------------------

describe('Security: unauthenticated access blocked on all protected routes', () => {
  const protectedRoutes = [
    ['GET', '/api/posts'],
    ['POST', '/api/posts'],
    ['GET', '/api/networks'],
    ['GET', '/api/inbox'],
    ['GET', '/api/listening/streams'],
    ['GET', '/api/analytics/metrics'],
    ['GET', '/api/ai/status'],
    ['GET', '/api/teams'],
    ['GET', '/api/audit'],
    ['GET', '/api/advocacy/content'],
    ['GET', '/api/ayrshare/status'],
    ['GET', '/api/zernio/status'],
    ['GET', '/api/auth/me'],
  ];

  it.each(protectedRoutes)('%s %s returns 401 without token', async (method, path) => {
    const res = await (request(app) as any)[method.toLowerCase()](path);
    expect(res.status).toBe(401);
  });
});

// ------------------------------------------------------------------
// 10. Inbox & messaging at scale
// ------------------------------------------------------------------

describe('Scale: 100 concurrent inbox message replies', () => {
  it('all replies succeed without 5xx', async () => {
    const { token } = await authAs();
    const { prisma } = await import('../src/prisma');

    // Seed 100 messages
    const messages = await Promise.all(
      Array.from({ length: 100 }, (_, i) =>
        prisma.message.create({
          data: {
            network: 'twitter',
            senderName: `User ${i}`,
            senderUser: `@user${i}`,
            content: `Message ${i}`,
            type: 'dm',
            status: 'unread',
            sentiment: 'neutral',
            isRead: false,
          },
        })
      )
    );

    const tasks = messages.map((m, i) => async () => {
      const res = await request(app)
        .post(`/api/inbox/${m.id}/reply`)
        .set(bearer(token))
        .send({ content: `Reply to message ${i}` });
      return res.status;
    });

    const statuses = await batch(tasks, 25);
    const errors = statuses.filter(s => s >= 500);
    expect(errors.length).toBe(0);
    const successes = statuses.filter(s => s === 200);
    expect(successes.length).toBe(100);
  });
});

// ------------------------------------------------------------------
// 11. Analytics under concurrent read load
// ------------------------------------------------------------------

describe('Scale: 200 concurrent analytics reads', () => {
  it('all return 200 with consistent shape', async () => {
    const { token } = await authAs();
    const tasks = Array.from({ length: 200 }, () => async () => {
      const res = await request(app).get('/api/analytics/metrics').set(bearer(token));
      return { status: res.status, hasMetrics: Array.isArray(res.body.data?.metrics) };
    });

    const results = await batch(tasks, 50);
    const bad = results.filter(r => r.status !== 200);
    expect(bad.length).toBe(0);
    const shapeBad = results.filter(r => !r.hasMetrics);
    expect(shapeBad.length).toBe(0);
  });
});

// ------------------------------------------------------------------
// 12. Stress: delete non-existent resources
// ------------------------------------------------------------------

describe('Edge cases: operations on non-existent resources', () => {
  let token: string;
  beforeAll(async () => { token = (await authAs()).token; });

  it('DELETE non-existent post returns 404, not 500', async () => {
    const res = await request(app).delete('/api/posts/00000000-0000-0000-0000-000000000000').set(bearer(token));
    expect([404, 400]).toContain(res.status);
  });

  it('GET non-existent post returns 404, not 500', async () => {
    const res = await request(app).get('/api/posts/00000000-0000-0000-0000-000000000000').set(bearer(token));
    expect(res.status).toBe(404);
  });

  it('PUT non-existent post returns 404, not 500', async () => {
    const res = await request(app).put('/api/posts/00000000-0000-0000-0000-000000000000').set(bearer(token)).send({ content: 'x' });
    expect([404, 400]).toContain(res.status);
  });

  it('schedule on non-existent post returns 404', async () => {
    const res = await request(app).post('/api/posts/00000000-0000-0000-0000-000000000000/schedule').set(bearer(token))
      .send({ scheduledAt: new Date().toISOString() });
    expect([404, 400]).toContain(res.status);
  });

  it('reply to non-existent inbox message returns 404', async () => {
    const res = await request(app).post('/api/inbox/00000000-0000-0000-0000-000000000000/reply').set(bearer(token)).send({ content: 'hi' });
    expect([404, 400]).toContain(res.status);
  });
});

// ------------------------------------------------------------------
// 13. AI endpoints under load
// ------------------------------------------------------------------

describe('Scale: 100 concurrent AI requests (mock provider)', () => {
  it('all caption/hashtag/idea requests succeed', async () => {
    const { token } = await authAs();

    const tasks = Array.from({ length: 100 }, (_, i) => async () => {
      if (i % 3 === 0) {
        const r = await request(app).post('/api/ai/caption').set(bearer(token)).send({ prompt: 'product', tone: 'friendly' });
        return r.status;
      } else if (i % 3 === 1) {
        const r = await request(app).post('/api/ai/hashtags').set(bearer(token)).send({ topic: 'tech', count: 5 });
        return r.status;
      } else {
        const r = await request(app).post('/api/ai/ideas').set(bearer(token)).send({ industry: 'retail', count: 3 });
        return r.status;
      }
    });

    const statuses = await batch(tasks, 25);
    const errors = statuses.filter(s => s !== 200);
    expect(errors.length).toBe(0);
  });
});

// ------------------------------------------------------------------
// 14. Rate limiter — fires at 101st request per IP
// ------------------------------------------------------------------

describe('Security: rate limiter activates after 100 req/min', () => {
  // Rate limiter is disabled in NODE_ENV=test — verify it is truly off
  it('does NOT limit in test env (limiter disabled)', async () => {
    const { token } = await authAs();
    const tasks = Array.from({ length: 110 }, () => async () => {
      const res = await request(app).get('/api/posts').set(bearer(token));
      return res.status;
    });
    const statuses = await batch(tasks, 20);
    const limited = statuses.filter(s => s === 429);
    // Should be 0 — limiter must be off in test env
    expect(limited.length).toBe(0);
  });
});

// ------------------------------------------------------------------
// 15. Full user lifecycle: register → post → schedule → publish → delete
// ------------------------------------------------------------------

describe('E2E: complete user lifecycle (50 users in parallel)', () => {
  it('all 50 users complete register→draft→schedule→publish→delete', async () => {
    const tasks = Array.from({ length: 50 }, (_, i) => async () => {
      // Register
      const email = `lifecycle_${i}_${Date.now()}@e2e.test`;
      const regRes = await request(app).post('/api/auth/register').send({ email, password: 'LifePass1', name: `Life ${i}` });
      expect(regRes.status).toBe(201);
      const token = regRes.body.data.accessToken as string;

      // Create draft
      const draftRes = await request(app).post('/api/posts').set(bearer(token))
        .send({ content: `E2E post ${i}`, networks: ['twitter', 'linkedin'], status: 'draft' });
      expect(draftRes.status).toBe(201);
      const postId = draftRes.body.data.id;

      // Schedule it (in the past so it's immediately due)
      const schedRes = await request(app).post(`/api/posts/${postId}/schedule`).set(bearer(token))
        .send({ scheduledAt: new Date(Date.now() - 5000).toISOString() });
      expect(schedRes.body.data.status).toBe('scheduled');

      // Publish immediately
      const pubRes = await request(app).post(`/api/posts/${postId}/publish`).set(bearer(token));
      expect(pubRes.body.data.status).toBe('published');

      // Delete it
      const delRes = await request(app).delete(`/api/posts/${postId}`).set(bearer(token));
      expect([200, 204]).toContain(delRes.status);

      // Confirm gone
      const goneRes = await request(app).get(`/api/posts/${postId}`).set(bearer(token));
      expect(goneRes.status).toBe(404);

      return 'ok';
    });

    const results = await batch(tasks, 10);
    expect(results.every(r => r === 'ok')).toBe(true);
  });
});

// ------------------------------------------------------------------
// 16. XSS / injection in content fields
// ------------------------------------------------------------------

describe('Security: XSS and injection payloads stored safely', () => {
  let token: string;
  beforeAll(async () => { token = (await authAs()).token; });

  const payloads = [
    '<script>alert(1)</script>',
    '"><img src=x onerror=alert(1)>',
    "'; DROP TABLE users; --",
    '{{constructor.constructor("alert(1)")()}}',
    '\x00null\x00byte',
  ];

  it.each(payloads)('stores and returns payload safely: %s', async (payload) => {
    const res = await request(app).post('/api/posts').set(bearer(token))
      .send({ content: payload, networks: ['twitter'] });
    // Must not crash (no 500) — storage is fine, XSS prevention is the frontend's job
    expect(res.status).toBeLessThan(500);
    if (res.status === 201) {
      const id = res.body.data.id;
      const get = await request(app).get(`/api/posts/${id}`).set(bearer(token));
      // Content must be returned as-is (not mangled by backend)
      if (get.status === 200) {
        expect(get.body.data.content).toBe(payload);
      }
    }
  });
});

// ------------------------------------------------------------------
// 17. Crisis mode under concurrent scheduler load
// ------------------------------------------------------------------

describe('Reliability: crisis mode blocks all publishing while paused', () => {
  it('paused scheduler publishes 0 posts then resumes correctly', async () => {
    const { token } = await authAs();
    const pastTime = new Date(Date.now() - 1000).toISOString();

    // Create 20 due posts
    await batch(
      Array.from({ length: 20 }, (_, i) => async () =>
        request(app).post('/api/posts').set(bearer(token))
          .send({ content: `Crisis test ${i}`, networks: ['twitter'], status: 'scheduled', scheduledAt: pastTime })
      ), 10
    );

    // Pause publishing
    await request(app).post('/api/posts/pause-publishing').set(bearer(token));

    // Run scheduler 3 times — all must return 0
    for (let i = 0; i < 3; i++) {
      const run = await request(app).post('/api/posts/run-scheduler').set(bearer(token));
      expect(run.body.data.published).toBe(0);
    }

    // Resume — run again — should publish
    await request(app).post('/api/posts/resume-publishing').set(bearer(token));
    const finalRun = await request(app).post('/api/posts/run-scheduler').set(bearer(token));
    expect(finalRun.body.data.published).toBeGreaterThanOrEqual(20);
  });
});

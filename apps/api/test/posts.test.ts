import request from 'supertest';
import { app, authAs, bearer, closeDb } from './helpers';

let token: string;
beforeAll(async () => { token = (await authAs()).token; });
afterAll(closeDb);

describe('Posts', () => {
  it('creates, reads and deletes a post', async () => {
    const create = await request(app).post('/api/posts').set(bearer(token))
      .send({ content: 'Hello world', networks: ['twitter', 'linkedin'], status: 'draft' });
    expect(create.status).toBe(201);
    const id = create.body.data.id;
    expect(create.body.data.networks).toEqual(['twitter', 'linkedin']);

    const get = await request(app).get(`/api/posts/${id}`).set(bearer(token));
    expect(get.status).toBe(200);

    const del = await request(app).delete(`/api/posts/${id}`).set(bearer(token));
    expect(del.status).toBe(200);

    const gone = await request(app).get(`/api/posts/${id}`).set(bearer(token));
    expect(gone.status).toBe(404);
  });

  it('rejects a post with empty content (400)', async () => {
    const res = await request(app).post('/api/posts').set(bearer(token)).send({ content: '' });
    expect(res.status).toBe(400);
  });

  it('schedules then publishes a post', async () => {
    const create = await request(app).post('/api/posts').set(bearer(token)).send({ content: 'Schedule me', networks: ['twitter'] });
    const id = create.body.data.id;
    const sched = await request(app).post(`/api/posts/${id}/schedule`).set(bearer(token)).send({ scheduledAt: '2020-01-01T00:00:00Z' });
    expect(sched.body.data.status).toBe('scheduled');
    const pub = await request(app).post(`/api/posts/${id}/publish`).set(bearer(token));
    expect(pub.body.data.status).toBe('published');
    expect(pub.body.data.publishedAt).toBeTruthy();
  });

  it('runs the scheduler and publishes due posts', async () => {
    await request(app).post('/api/posts').set(bearer(token)).send({ content: 'Due', networks: ['twitter'], status: 'scheduled', scheduledAt: '2020-01-01T00:00:00Z' });
    const run = await request(app).post('/api/posts/run-scheduler').set(bearer(token));
    expect(run.status).toBe(200);
    expect(run.body.data.published).toBeGreaterThanOrEqual(1);
  });

  it('supports the approval workflow', async () => {
    const create = await request(app).post('/api/posts').set(bearer(token)).send({ content: 'Approve me', networks: ['linkedin'] });
    const id = create.body.data.id;
    const submit = await request(app).post(`/api/posts/${id}/submit`).set(bearer(token));
    expect(submit.body.data.approvalStatus).toBe('pending');
    const approve = await request(app).post(`/api/posts/${id}/approve`).set(bearer(token));
    expect(approve.body.data.approvalStatus).toBe('approved');
  });
});

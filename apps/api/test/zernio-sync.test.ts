/**
 * Zernio → Network table sync.
 *
 * Bug: connecting a platform through Zernio only ever updated Zernio's own
 * remote account list — nothing in the app's own `Network` table (which is
 * what Dashboard/Composer/Publisher/Analytics actually read from) ever
 * reflected it. `GET /api/zernio/status` now mirrors Zernio's account state
 * into `Network` as a side effect, and disconnect marks it disconnected.
 *
 * The real Zernio client (`src/lib/zernio.ts`) is mocked here so the test
 * doesn't need a real ZERNIO_API_KEY or network access — only the sync
 * logic in `src/routes/zernio.ts` is under test.
 */

jest.mock('../src/lib/zernio', () => ({
  isConfigured: jest.fn(),
  listAccounts: jest.fn(),
  generateConnectUrl: jest.fn(),
  disconnect: jest.fn(),
}));

import request from 'supertest';
import { app, authAs, bearer, closeDb } from './helpers';
import { prisma } from '../src/prisma';
import * as zernio from '../src/lib/zernio';

const mockZernio = zernio as jest.Mocked<typeof zernio>;

jest.setTimeout(60_000);
afterAll(closeDb);

beforeEach(() => {
  jest.clearAllMocks();
  mockZernio.isConfigured.mockReturnValue(true);
});

describe('Zernio status syncs connected accounts into the Network table', () => {
  it('creates a Network row for a platform Zernio reports as connected', async () => {
    const { token } = await authAs();
    mockZernio.listAccounts.mockResolvedValue([
      { id: 'abc123def456abc123def456', platform: 'twitter', handle: 'myhandle', connected: true, followers: 1200 },
    ]);

    const res = await request(app).get('/api/zernio/status').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.accounts).toHaveLength(1);

    const network = await prisma.network.findFirst({ where: { type: 'twitter' } });
    expect(network).toBeTruthy();
    expect(network!.connected).toBe(true);
    expect(network!.username).toBe('@myhandle');
    expect(network!.followers).toBe(1200);
  });

  it('is visible from GET /api/networks after a Zernio status sync (the actual dashboard bug)', async () => {
    const { token } = await authAs();
    mockZernio.listAccounts.mockResolvedValue([
      { id: 'abc123def456abc123def457', platform: 'linkedin', handle: 'companypage', connected: true, followers: 500 },
    ]);

    await request(app).get('/api/zernio/status').set(bearer(token));

    // This is exactly what Dashboard/Composer/Publisher/Analytics call.
    const networksRes = await request(app).get('/api/networks').set(bearer(token));
    expect(networksRes.status).toBe(200);
    const linkedin = networksRes.body.data.find((n: any) => n.type === 'linkedin');
    expect(linkedin).toBeTruthy();
    expect(linkedin.connected).toBe(true);
  });

  it('updates an existing Network row rather than duplicating it on repeated syncs', async () => {
    const { token } = await authAs();
    mockZernio.listAccounts.mockResolvedValue([
      { id: 'abc123def456abc123def458', platform: 'instagram', handle: 'first_handle', connected: true, followers: 100 },
    ]);
    await request(app).get('/api/zernio/status').set(bearer(token));

    mockZernio.listAccounts.mockResolvedValue([
      { id: 'abc123def456abc123def458', platform: 'instagram', handle: 'updated_handle', connected: true, followers: 999 },
    ]);
    await request(app).get('/api/zernio/status').set(bearer(token));

    const rows = await prisma.network.findMany({ where: { type: 'instagram' } });
    expect(rows).toHaveLength(1);
    expect(rows[0].username).toBe('@updated_handle');
    expect(rows[0].followers).toBe(999);
  });

  it('disconnecting a platform via Zernio marks the mirrored Network row disconnected', async () => {
    const { token } = await authAs();
    mockZernio.listAccounts.mockResolvedValue([
      { id: 'abc123def456abc123def459', platform: 'tiktok', handle: 'brandtok', connected: true, followers: 50 },
    ]);
    await request(app).get('/api/zernio/status').set(bearer(token));

    mockZernio.disconnect.mockResolvedValue(undefined);
    const disconnectRes = await request(app).delete('/api/zernio/accounts/tiktok').set(bearer(token));
    expect(disconnectRes.status).toBe(200);

    const network = await prisma.network.findFirst({ where: { type: 'tiktok' } });
    expect(network!.connected).toBe(false);
  });

  it('does not crash the status endpoint if the Network sync itself fails', async () => {
    const { token } = await authAs();
    mockZernio.listAccounts.mockResolvedValue([
      { id: 'abc123def456abc123def460', platform: 'youtube', handle: 'brandtube', connected: true, followers: 10 },
    ]);
    const spy = jest.spyOn(prisma.network, 'findFirst').mockRejectedValueOnce(new Error('DB hiccup'));

    const res = await request(app).get('/api/zernio/status').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.accounts).toHaveLength(1);

    spy.mockRestore();
  });
});

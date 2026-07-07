/**
 * Unit tests for the frontend API client (src/lib/api.ts):
 *  - token / refresh-token / session storage helpers
 *  - auto-refresh-on-401 request wrapper, including deduplication of
 *    concurrent refresh calls
 *  - diagnostics probes
 *
 * All network calls are mocked via global.fetch — no real backend needed.
 */

function freshApiModule() {
  jest.resetModules();
  return require('../src/lib/api');
}

function mockJsonResponse(status: number, body: any): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  localStorage.clear();
  jest.resetModules();
});

describe('Token / session storage helpers', () => {
  it('setToken/getToken/clearToken round-trip through localStorage', () => {
    const { setToken, getToken, clearToken } = freshApiModule();
    expect(getToken()).toBeNull();
    setToken('abc123');
    expect(getToken()).toBe('abc123');
    clearToken();
    expect(getToken()).toBeNull();
  });

  it('setRefreshToken/getRefreshToken/clearRefreshToken round-trip', () => {
    const { setRefreshToken, getRefreshToken, clearRefreshToken } = freshApiModule();
    expect(getRefreshToken()).toBeNull();
    setRefreshToken('refresh-xyz');
    expect(getRefreshToken()).toBe('refresh-xyz');
    clearRefreshToken();
    expect(getRefreshToken()).toBeNull();
  });

  it('startSession/hasSession/endSession round-trip and endSession also clears tokens', () => {
    const { startSession, hasSession, endSession, setToken, getToken, setRefreshToken, getRefreshToken } = freshApiModule();
    expect(hasSession()).toBe(false);
    startSession();
    expect(hasSession()).toBe(true);

    setToken('t1');
    setRefreshToken('r1');
    endSession();
    expect(hasSession()).toBe(false);
    expect(getToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });
});

describe('diagnostics probes', () => {
  it('diagnostics.api() reports ok:true with latency on 200', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockJsonResponse(200, { success: true, data: { status: 'ok' } }));
    const { diagnostics } = freshApiModule();
    const result = await diagnostics.api();
    expect(result.ok).toBe(true);
    expect(typeof result.latencyMs).toBe('number');
  });

  it('diagnostics.database() reports ok:false with error text on non-2xx', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockJsonResponse(503, { success: false, error: 'DB down' }));
    const { diagnostics } = freshApiModule();
    const result = await diagnostics.database();
    expect(result.ok).toBe(false);
    expect(result.error).toBe('DB down');
  });

  it('diagnostics probe reports ok:false with network-error message on thrown fetch', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('fetch failed'));
    const { diagnostics } = freshApiModule();
    const result = await diagnostics.api();
    expect(result.ok).toBe(false);
    expect(result.error).toBe('fetch failed');
  });

  it('diagnostics.auth() reports "not signed in" when no token is stored', async () => {
    const { diagnostics } = freshApiModule();
    const result = await diagnostics.auth();
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not signed in/i);
  });

  it('diagnostics.auth() probes /api/posts with Authorization header when token exists', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockJsonResponse(200, { success: true, data: [] }));
    const { diagnostics, setToken } = freshApiModule();
    setToken('my-token');
    const result = await diagnostics.auth();
    expect(result.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/posts'),
      expect.objectContaining({ headers: { Authorization: 'Bearer my-token' } })
    );
  });
});

describe('request() core behavior', () => {
  it('attaches Authorization header when a token is stored', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockJsonResponse(200, { success: true, data: [{ id: 1 }] }));
    const { api, setToken } = freshApiModule();
    setToken('secret-token');
    await api.getPosts();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/posts'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer secret-token' }),
      })
    );
  });

  it('omits Authorization header when no token is stored', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockJsonResponse(200, { success: true, data: [] }));
    const { api } = freshApiModule();
    await api.getPosts();
    const headers = (global.fetch as jest.Mock).mock.calls[0][1].headers;
    expect(headers.Authorization).toBeUndefined();
  });

  it('resolves with response data on success', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockJsonResponse(200, { success: true, data: { ok: 1 } }));
    const { api } = freshApiModule();
    const data = await api.getMe();
    expect(data).toEqual({ ok: 1 });
  });

  it('throws with server error message on success:false', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockJsonResponse(400, { success: false, error: 'Bad input' }));
    const { api } = freshApiModule();
    await expect(api.getMe()).rejects.toThrow('Bad input');
  });

  it('throws a generic message when the server gives no error field', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockJsonResponse(500, { success: false }));
    const { api } = freshApiModule();
    await expect(api.getMe()).rejects.toThrow(/Request failed \(500\)/);
  });
});

describe('request() auto-refresh-on-401 logic', () => {
  it('on 401, refreshes token then retries the original request once', async () => {
    const { api, setToken, setRefreshToken } = freshApiModule();
    setToken('expired-token');
    setRefreshToken('valid-refresh');

    let call = 0;
    global.fetch = jest.fn().mockImplementation((url: string) => {
      call++;
      if (call === 1) {
        // First call: original request fails with 401
        return Promise.resolve(mockJsonResponse(401, { success: false, error: 'Token expired' }));
      }
      if (url.includes('/auth/refresh')) {
        // Second call: refresh succeeds
        return Promise.resolve(
          mockJsonResponse(200, { success: true, data: { accessToken: 'new-token', refreshToken: 'new-refresh' } })
        );
      }
      // Third call: retried original request succeeds
      return Promise.resolve(mockJsonResponse(200, { success: true, data: [{ id: 'post1' }] }));
    });

    const data = await api.getPosts();
    expect(data).toEqual([{ id: 'post1' }]);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('on 401 with no refresh token available, clears tokens and throws', async () => {
    const { api, setToken } = freshApiModule();
    setToken('expired-token');
    // No refresh token set

    global.fetch = jest.fn().mockResolvedValue(mockJsonResponse(401, { success: false, error: 'Unauthorized' }));

    await expect(api.getPosts()).rejects.toThrow('Unauthorized');
    const { getToken, getRefreshToken } = freshApiModule();
    // Note: freshApiModule() resets modules but localStorage persists across the reset
    expect(getToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it('on 401 where the refresh call itself fails, clears tokens and surfaces original error', async () => {
    const { api, setToken, setRefreshToken } = freshApiModule();
    setToken('expired-token');
    setRefreshToken('bad-refresh');

    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/refresh')) {
        return Promise.resolve(mockJsonResponse(401, { success: false, error: 'Invalid refresh token' }));
      }
      return Promise.resolve(mockJsonResponse(401, { success: false, error: 'Unauthorized' }));
    });

    await expect(api.getPosts()).rejects.toThrow('Unauthorized');
  });

  it('does not attempt refresh for /auth/* endpoints even on 401', async () => {
    const { api, setToken, setRefreshToken } = freshApiModule();
    setToken('expired-token');
    setRefreshToken('valid-refresh');

    global.fetch = jest.fn().mockResolvedValue(mockJsonResponse(401, { success: false, error: 'Invalid credentials' }));

    await expect(api.login('a@b.com', 'wrong')).rejects.toThrow('Invalid credentials');
    // Only the single login call — no refresh attempt
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent 401s into a single /auth/refresh call', async () => {
    const { api, setToken, setRefreshToken } = freshApiModule();
    setToken('expired-token');
    setRefreshToken('valid-refresh');

    let refreshCalls = 0;
    global.fetch = jest.fn().mockImplementation((url: string, opts: any) => {
      if (url.includes('/auth/refresh')) {
        refreshCalls++;
        return Promise.resolve(
          mockJsonResponse(200, { success: true, data: { accessToken: 'new-token', refreshToken: 'new-refresh' } })
        );
      }
      // Any non-refresh call: fail with 401 on the very first attempt (no auth header yet
      // matches "new-token"), succeed once retried with the refreshed token.
      const authHeader = opts?.headers?.Authorization;
      if (authHeader === 'Bearer new-token') {
        return Promise.resolve(mockJsonResponse(200, { success: true, data: [] }));
      }
      return Promise.resolve(mockJsonResponse(401, { success: false, error: 'Token expired' }));
    });

    // Fire two concurrent requests that will both hit 401 initially
    const [r1, r2] = await Promise.all([api.getPosts(), api.getNetworks()]);
    expect(r1).toEqual([]);
    expect(r2).toEqual([]);
    expect(refreshCalls).toBe(1); // deduplication worked
  });
});

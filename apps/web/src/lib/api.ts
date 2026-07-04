// Typed client for the SocialHub REST API (Phase 2).
// Pages currently render from local mock data for offline/demo reliability;
// import these helpers to talk to the live API at NEXT_PUBLIC_API_URL.

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const TOKEN_KEY = 'socialhub_token';
const REFRESH_TOKEN_KEY = 'socialhub_refresh_token';
const SESSION_KEY = 'socialhub_session';

export function setToken(token: string) {
  if (typeof window !== 'undefined') localStorage.setItem(TOKEN_KEY, token);
}
export function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
}
export function clearToken() {
  if (typeof window !== 'undefined') localStorage.removeItem(TOKEN_KEY);
}

export function setRefreshToken(token: string) {
  if (typeof window !== 'undefined') localStorage.setItem(REFRESH_TOKEN_KEY, token);
}
export function getRefreshToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem(REFRESH_TOKEN_KEY) : null;
}
export function clearRefreshToken() {
  if (typeof window !== 'undefined') localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// Session marker — set on login/register (even in offline demo mode so the
// auth guard lets the user in). Independent of the JWT, which only exists
// when the live API is reachable.
export function startSession() {
  if (typeof window !== 'undefined') localStorage.setItem(SESSION_KEY, '1');
}
export function hasSession(): boolean {
  return typeof window !== 'undefined' && localStorage.getItem(SESSION_KEY) === '1';
}
export function endSession() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export interface AiProvider {
  id: string;
  label: string;
  models: string[];
  configured: boolean;
  envKey?: string;
}

export const API_BASE = BASE;

export type DiagResult = {
  ok: boolean;
  latencyMs: number;
  detail?: string;
  error?: string;
};

/** Raw connectivity probe used by the Settings diagnostics panel. Bypasses the
 *  authed `request()` wrapper so it reports the true transport-level result
 *  (network error, CORS, non-2xx) instead of falling into token-refresh logic. */
async function probe(path: string, opts: RequestInit = {}): Promise<DiagResult> {
  const started = Date.now();
  try {
    const res = await fetch(`${BASE}${path}`, opts);
    const latencyMs = Date.now() - started;
    let body: any = null;
    try { body = await res.json(); } catch { /* non-JSON response */ }
    if (!res.ok) {
      return { ok: false, latencyMs, error: body?.error || `HTTP ${res.status}` };
    }
    return { ok: true, latencyMs, detail: body?.data ? JSON.stringify(body.data) : undefined };
  } catch (e: any) {
    return { ok: false, latencyMs: Date.now() - started, error: e?.message || 'Network error (unreachable / CORS)' };
  }
}

export const diagnostics = {
  api: () => probe('/health'),
  database: () => probe('/health/db'),
  auth: async (): Promise<DiagResult> => {
    const token = getToken();
    if (!token) return { ok: false, latencyMs: 0, error: 'Not signed in (no token stored)' };
    return probe('/api/posts', { headers: { Authorization: `Bearer ${token}` } });
  },
};

interface ApiResult<T> {
  success: boolean;
  data: T;
  error?: string;
  total?: number;
}

let refreshInFlight: Promise<boolean> | null = null;

// Exchanges the stored refresh token for a new access token. Deduplicated so
// concurrent 401s (e.g. the dashboard's Promise.all of several endpoints)
// only trigger one /auth/refresh call instead of a stampede.
async function refreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return false;
      try {
        const res = await fetch(`${BASE}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        const body = (await res.json()) as ApiResult<{ accessToken: string; refreshToken: string }>;
        if (!res.ok || !body.success) return false;
        setToken(body.data.accessToken);
        setRefreshToken(body.data.refreshToken);
        return true;
      } catch {
        return false;
      }
    })().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

async function request<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (res.status === 401 && !isRetry && !path.startsWith('/auth/')) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return request<T>(path, options, true);
    clearToken();
    clearRefreshToken();
  }
  const body = (await res.json()) as ApiResult<T>;
  if (!res.ok || !body.success) throw new Error(body.error || `Request failed (${res.status})`);
  return body.data;
}

export const api = {
  // Auth
  register: (email: string, password: string, name: string) =>
    request<{ user: any; accessToken: string; refreshToken: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),
  login: (email: string, password: string) =>
    request<{ user: any; accessToken: string; refreshToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  forgotPassword: (email: string) =>
    request<{ resetToken?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, password: string) =>
    request<{ success: true }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),

  // Networks
  getNetworks: () => request<any[]>('/networks'),
  connectNetwork: (payload: any) => request('/networks', { method: 'POST', body: JSON.stringify(payload) }),
  disconnectNetwork: (id: string) => request(`/networks/${id}`, { method: 'DELETE' }),

  // Posts
  getPosts: (status?: string) => request<any[]>(`/posts${status ? `?status=${status}` : ''}`),
  createPost: (payload: any) => request('/posts', { method: 'POST', body: JSON.stringify(payload) }),
  updatePost: (id: string, payload: any) => request(`/posts/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deletePost: (id: string) => request(`/posts/${id}`, { method: 'DELETE' }),
  schedulePost: (id: string, scheduledAt: string) =>
    request(`/posts/${id}/schedule`, { method: 'POST', body: JSON.stringify({ scheduledAt }) }),
  publishPost: (id: string) => request(`/posts/${id}/publish`, { method: 'POST' }),
  approvePost: (id: string) => request(`/posts/${id}/approve`, { method: 'POST' }),
  rejectPost: (id: string) => request(`/posts/${id}/reject`, { method: 'POST' }),
  getCalendar: () => request<any[]>('/posts/calendar'),
  getPublishingStatus: () => request<{ paused: boolean }>('/posts/publishing-status'),
  pausePublishing: () => request<{ paused: boolean }>('/posts/pause-publishing', { method: 'POST' }),
  resumePublishing: () => request<{ paused: boolean }>('/posts/resume-publishing', { method: 'POST' }),

  // Inbox
  getInbox: (status?: string) => request<any[]>(`/inbox${status ? `?status=${status}` : ''}`),
  markMessageRead: (id: string) => request(`/inbox/${id}/read`, { method: 'PUT' }),
  replyMessage: (id: string, content: string) =>
    request(`/inbox/${id}/reply`, { method: 'POST', body: JSON.stringify({ content }) }),
  assignMessage: (id: string, assignedTo: string) =>
    request(`/inbox/${id}/assign`, { method: 'PUT', body: JSON.stringify({ assignedTo }) }),
  getSavedReplies: () => request<any[]>('/inbox/saved-replies'),

  // Listening
  getStreams: () => request<any[]>('/listening/streams'),
  createStream: (payload: any) => request('/listening/streams', { method: 'POST', body: JSON.stringify(payload) }),
  getMentions: (streamId?: string) => request<any[]>(`/listening/mentions${streamId ? `?streamId=${streamId}` : ''}`),
  getSentiment: () => request<any>('/listening/sentiment'),

  // Analytics
  getMetrics: () => request<any>('/analytics/metrics'),
  getReports: () => request<any[]>('/analytics/reports'),
  exportReport: (id: string, format: string) =>
    request(`/analytics/reports/${id}/export`, { method: 'POST', body: JSON.stringify({ format }) }),

  // AI
  aiCaption: (prompt: string, tone: string) =>
    request<{ caption: string; provider: string; fallback: boolean }>('/ai/caption', { method: 'POST', body: JSON.stringify({ prompt, tone }) }),
  aiHashtags: (topic: string, count = 8) =>
    request<{ hashtags: string[] }>('/ai/hashtags', { method: 'POST', body: JSON.stringify({ topic, count }) }),
  aiIdeas: (industry: string, count = 5) =>
    request<{ ideas: string[] }>('/ai/ideas', { method: 'POST', body: JSON.stringify({ industry, count }) }),
  aiSentiment: (text: string) =>
    request<{ sentiment: string }>('/ai/sentiment', { method: 'POST', body: JSON.stringify({ text }) }),
  aiCampaign: (brief: string, count: number, tone: string, networks: string[]) =>
    request<{ posts: { content: string; networks: string[] }[]; provider: string; fallback: boolean }>('/ai/campaign', {
      method: 'POST',
      body: JSON.stringify({ brief, count, tone, networks }),
    }),
  aiRepurpose: (content: string, networks: string[]) =>
    request<{ variants: Record<string, string>; provider: string; fallback: boolean }>('/ai/repurpose', {
      method: 'POST',
      body: JSON.stringify({ content, networks }),
    }),
  aiReply: (message: string, sentiment: string, tone = 'friendly') =>
    request<{ reply: string; provider: string; fallback: boolean }>('/ai/reply', {
      method: 'POST',
      body: JSON.stringify({ message, sentiment, tone }),
    }),

  // AI provider config
  aiStatus: () =>
    request<{ active: string; model: string; usingMock: boolean; providers: AiProvider[] }>('/ai/status'),
  aiSetConfig: (provider: string, model?: string) =>
    request<{ active: string; model: string; usingMock: boolean; providers: AiProvider[] }>('/ai/config', {
      method: 'PUT',
      body: JSON.stringify({ provider, model }),
    }),

  // Teams
  getTeam: () => request<any[]>('/teams'),
  inviteMember: (payload: any) => request('/teams/members', { method: 'POST', body: JSON.stringify(payload) }),

  // Audit
  getAudit: () => request<any[]>('/audit'),

  // Advocacy (Amplify)
  getAdvocacyContent: () => request<any[]>('/advocacy/content'),
  getAdvocacyAnalytics: () => request<{ totalShares: number; totalReach: number; leaderboard: any[] }>('/advocacy/analytics'),
  shareAdvocacyContent: (id: string, payload: any) =>
    request(`/advocacy/content/${id}/share`, { method: 'POST', body: JSON.stringify(payload) }),
};

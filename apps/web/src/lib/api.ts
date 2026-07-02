// Typed client for the SocialHub REST API (Phase 2).
// Pages currently render from local mock data for offline/demo reliability;
// import these helpers to talk to the live API at NEXT_PUBLIC_API_URL.

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const TOKEN_KEY = 'socialhub_token';

export function setToken(token: string) {
  if (typeof window !== 'undefined') localStorage.setItem(TOKEN_KEY, token);
}
export function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
}
export function clearToken() {
  if (typeof window !== 'undefined') localStorage.removeItem(TOKEN_KEY);
}

interface ApiResult<T> {
  success: boolean;
  data: T;
  error?: string;
  total?: number;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
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
  getCalendar: () => request<any[]>('/posts/calendar'),

  // Inbox
  getInbox: (status?: string) => request<any[]>(`/inbox${status ? `?status=${status}` : ''}`),
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
    request<{ caption: string }>('/ai/caption', { method: 'POST', body: JSON.stringify({ prompt, tone }) }),
  aiHashtags: (topic: string, count = 8) =>
    request<{ hashtags: string[] }>('/ai/hashtags', { method: 'POST', body: JSON.stringify({ topic, count }) }),
  aiIdeas: (industry: string, count = 5) =>
    request<{ ideas: string[] }>('/ai/ideas', { method: 'POST', body: JSON.stringify({ industry, count }) }),

  // Teams
  getTeam: () => request<any[]>('/teams'),
  inviteMember: (payload: any) => request('/teams/members', { method: 'POST', body: JSON.stringify(payload) }),
};

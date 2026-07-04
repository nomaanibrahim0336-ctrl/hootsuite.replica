// Ayrshare API client
// Docs: https://docs.ayrshare.com
// All calls require the API key (AYRSHARE_API_KEY) in the Authorization header.
// Per-user calls also require the Profile-Key header (the user's profileKey).

// Ayrshare Solo/free plan — single profile mode.
// The Business Plan supports per-user profiles via createProfile(). The Solo
// plan uses the API key directly: connect accounts once in app.ayrshare.com,
// then all publish calls use the same key with no Profile-Key header.

const BASE = 'https://app.ayrshare.com/api';
const API_KEY = process.env.AYRSHARE_API_KEY || '';

export function isConfigured(): boolean {
  return !!API_KEY;
}

async function call<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${API_KEY}`,
  };
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const body = await res.json() as any;
  if (!res.ok) {
    throw new Error(body?.message || body?.error || `Ayrshare error ${res.status}`);
  }
  return body as T;
}

export interface AyrshareUser {
  activeSocialAccounts: string[];
  displayName?: string;
  email?: string;
}

export interface AyrsharePostResult {
  status: string;
  postIds: Record<string, string>;
  errors?: Record<string, string>;
}

/** Get the current account's connected social accounts. */
export async function getUser(): Promise<AyrshareUser> {
  return call<AyrshareUser>('/user');
}

/** Publish a post to one or more networks immediately. */
export async function publishPost(
  text: string,
  platforms: string[],
  mediaUrls?: string[],
): Promise<AyrsharePostResult> {
  return call<AyrsharePostResult>('/post', {
    method: 'POST',
    body: JSON.stringify({
      post: text,
      platforms,
      ...(mediaUrls?.length ? { mediaUrls } : {}),
    }),
  });
}

/** Schedule a post at a specific UTC time. */
export async function schedulePost(
  text: string,
  platforms: string[],
  scheduleDate: Date,
  mediaUrls?: string[],
): Promise<AyrsharePostResult> {
  return call<AyrsharePostResult>('/post', {
    method: 'POST',
    body: JSON.stringify({
      post: text,
      platforms,
      scheduleDate: scheduleDate.toISOString(),
      ...(mediaUrls?.length ? { mediaUrls } : {}),
    }),
  });
}

// Ayrshare API client
// Docs: https://docs.ayrshare.com
// All calls require the API key (AYRSHARE_API_KEY) in the Authorization header.
// Per-user calls also require the Profile-Key header (the user's profileKey).

const BASE = 'https://app.ayrshare.com/api';
const API_KEY = process.env.AYRSHARE_API_KEY || '';

export function isConfigured(): boolean {
  return !!API_KEY;
}

async function call<T>(
  path: string,
  options: RequestInit = {},
  profileKey?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${API_KEY}`,
  };
  if (profileKey) headers['Profile-Key'] = profileKey;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const body = await res.json() as any;
  if (!res.ok) {
    throw new Error(body?.message || body?.error || `Ayrshare error ${res.status}`);
  }
  return body as T;
}

export interface AyrshareProfile {
  profileKey: string;
  title: string;
  activeSocialAccounts: string[];
}

export interface AyrsharePostResult {
  status: string;
  postIds: Record<string, string>;
  errors?: Record<string, string>;
}

/** Create a new user profile in Ayrshare (call once per user at onboarding). */
export async function createProfile(title: string, email?: string): Promise<AyrshareProfile> {
  return call<AyrshareProfile>('/profiles/profile', {
    method: 'POST',
    body: JSON.stringify({ title, ...(email ? { email } : {}) }),
  });
}

/** Generate a hosted Social Account Link URL the user clicks to connect their networks. */
export async function generateLinkUrl(profileKey: string): Promise<{ url: string }> {
  return call<{ url: string }>('/profiles/generateJWT', {
    method: 'POST',
    body: JSON.stringify({ profileKey, domain: process.env.FRONTEND_URL || 'http://localhost:3000' }),
  });
}

/** Get the user's profile including which social accounts are connected. */
export async function getProfile(profileKey: string): Promise<AyrshareProfile> {
  return call<AyrshareProfile>('/profiles/profile', {}, profileKey);
}

/** Publish a post to one or more networks immediately. */
export async function publishPost(
  profileKey: string,
  text: string,
  platforms: string[],
  mediaUrls?: string[],
): Promise<AyrsharePostResult> {
  return call<AyrsharePostResult>(
    '/post',
    {
      method: 'POST',
      body: JSON.stringify({
        post: text,
        platforms,
        ...(mediaUrls?.length ? { mediaUrls } : {}),
      }),
    },
    profileKey,
  );
}

/** Schedule a post at a specific UTC time. */
export async function schedulePost(
  profileKey: string,
  text: string,
  platforms: string[],
  scheduleDate: Date,
  mediaUrls?: string[],
): Promise<AyrsharePostResult> {
  return call<AyrsharePostResult>(
    '/post',
    {
      method: 'POST',
      body: JSON.stringify({
        post: text,
        platforms,
        scheduleDate: scheduleDate.toISOString(),
        ...(mediaUrls?.length ? { mediaUrls } : {}),
      }),
    },
    profileKey,
  );
}

/** Delete a previously scheduled post. */
export async function deletePost(profileKey: string, id: string, platforms: string[]): Promise<void> {
  await call(
    '/post',
    { method: 'DELETE', body: JSON.stringify({ id, platforms }) },
    profileKey,
  );
}

/** Get analytics for a post. */
export async function getPostAnalytics(profileKey: string, id: string): Promise<any> {
  return call(`/analytics/post?id=${id}`, {}, profileKey);
}

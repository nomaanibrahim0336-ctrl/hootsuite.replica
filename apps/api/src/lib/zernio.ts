// Zernio API client — direct social platform connections.
//
// Zernio is used as a third integration option alongside Ayrshare and
// direct OAuth. Configure via env vars:
//   ZERNIO_API_KEY — bearer token from your Zernio dashboard (required)
//   ZERNIO_API_URL — base URL, defaults to https://api.zernio.com/v1
//
// If ZERNIO_API_KEY is unset, isConfigured() returns false and all
// endpoints report the provider as unavailable — the app still functions
// through Ayrshare / direct OAuth.

const DEFAULT_BASE = 'https://api.zernio.com/v1';
const BASE = process.env.ZERNIO_API_URL || DEFAULT_BASE;
const API_KEY = process.env.ZERNIO_API_KEY || '';

export function isConfigured(): boolean {
  return !!API_KEY;
}

async function call<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
      ...(options.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({})) as any;
  if (!res.ok) {
    throw new Error(body?.message || body?.error || `Zernio error ${res.status}`);
  }
  return body as T;
}

export interface ZernioAccount {
  platform: string;
  handle: string;
  connected: boolean;
  followers?: number;
  connectedAt?: string;
}

export interface ZernioStatus {
  configured: boolean;
  accounts: ZernioAccount[];
}

export interface ZernioPostResult {
  id: string;
  platform: string;
  url?: string;
  status: 'published' | 'scheduled' | 'failed';
  error?: string;
}

/** List all connected social accounts for the account represented by the API key. */
export async function listAccounts(): Promise<ZernioAccount[]> {
  const data = await call<{ accounts?: ZernioAccount[] }>('/accounts');
  return data.accounts ?? [];
}

/** Generate a hosted URL where the end user connects their social account.
 *  returnTo is where Zernio should redirect the user after they finish. */
export async function generateConnectUrl(platform: string, returnTo: string): Promise<{ url: string }> {
  return call<{ url: string }>('/connect/url', {
    method: 'POST',
    body: JSON.stringify({ platform, returnTo }),
  });
}

/** Publish a post to one or more platforms immediately. */
export async function publish(text: string, platforms: string[], mediaUrls?: string[]): Promise<ZernioPostResult[]> {
  const data = await call<{ results: ZernioPostResult[] }>('/publish', {
    method: 'POST',
    body: JSON.stringify({ text, platforms, mediaUrls: mediaUrls ?? [] }),
  });
  return data.results;
}

/** Schedule a post at a specific UTC time. */
export async function schedule(text: string, platforms: string[], when: Date, mediaUrls?: string[]): Promise<ZernioPostResult[]> {
  const data = await call<{ results: ZernioPostResult[] }>('/schedule', {
    method: 'POST',
    body: JSON.stringify({ text, platforms, scheduledAt: when.toISOString(), mediaUrls: mediaUrls ?? [] }),
  });
  return data.results;
}

/** Disconnect a platform. */
export async function disconnect(platform: string): Promise<void> {
  await call(`/accounts/${platform}`, { method: 'DELETE' });
}

// Zernio API client — direct social platform connections.
//
// Configure via env vars:
//   ZERNIO_API_KEY — bearer token from your Zernio dashboard (required)
//   ZERNIO_API_URL — base URL override (defaults to https://zernio.com/api/v1)
//
// API ref: https://zernio.com/api/v1  Auth: Bearer API key
// Key concepts: profile (container) → accounts (connected social accounts)

const DEFAULT_BASE = 'https://zernio.com/api/v1';
const BASE = (process.env.ZERNIO_API_URL || DEFAULT_BASE).replace(/\/$/, '');
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
  id: string;        // Zernio _id — used for disconnect / posting
  platform: string;
  handle: string;
  connected: boolean;
  followers?: number;
}

export interface ZernioPostResult {
  id: string;
  platform: string;
  url?: string;
  status: 'published' | 'scheduled' | 'failed';
  error?: string;
}

/** Fetch the first (default) profile ID — required by the connect flow. */
async function getDefaultProfileId(): Promise<string> {
  const data = await call<{ profiles: { _id: string; isDefault?: boolean }[] }>('/profiles');
  const profiles = data.profiles ?? [];
  if (!profiles.length) {
    throw new Error('No Zernio profiles found. Create a profile at zernio.com/dashboard first.');
  }
  return (profiles.find(p => p.isDefault) ?? profiles[0])._id;
}

/** List all connected social accounts for this API key. */
export async function listAccounts(): Promise<ZernioAccount[]> {
  const data = await call<{ accounts: any[] }>('/accounts');
  return (data.accounts ?? []).map((a: any) => ({
    id: a._id,
    platform: a.platform,
    handle: a.username || a.displayName || a.platform,
    connected: a.isActive !== false,
    followers: a.followersCount,
  }));
}

/** Get the OAuth authUrl to redirect the user to for connecting a platform.
 *  After OAuth completes, Zernio redirects to returnTo with ?connected=platform. */
export async function generateConnectUrl(platform: string, returnTo: string): Promise<{ url: string }> {
  const profileId = await getDefaultProfileId();
  const qs = new URLSearchParams({ profileId, ...(returnTo ? { redirect_url: returnTo } : {}) });
  const data = await call<{ authUrl: string }>(`/connect/${encodeURIComponent(platform)}?${qs}`);
  return { url: data.authUrl };
}

/** Publish a post immediately to the given platform names.
 *  Looks up the matching connected accountIds internally. */
export async function publish(text: string, platformNames: string[]): Promise<ZernioPostResult[]> {
  const accounts = await listAccounts();
  const targets = platformNames
    .map(p => accounts.find(a => a.platform === p))
    .filter(Boolean)
    .map(a => ({ platform: a!.platform, accountId: a!.id }));

  if (!targets.length) {
    throw new Error(`No connected Zernio accounts for: ${platformNames.join(', ')}`);
  }

  const data = await call<{ post: any }>('/posts', {
    method: 'POST',
    body: JSON.stringify({ content: text, platforms: targets, publishNow: true }),
  });

  const post = data.post ?? {};
  return ((post.platforms as any[]) ?? targets).map((t: any) => ({
    id: post._id ?? '',
    platform: t.platform,
    url: t.platformPostUrl,
    status: (t.status === 'failed' ? 'failed' : 'published') as 'published' | 'failed',
  }));
}

// ─── Unified inbox (Messages) — requires the Inbox addon on the Zernio account ──

export interface ZernioConversation {
  id: string;
  platform: string;
  accountId: string;
  accountUsername: string;
  participantId: string;
  participantName: string;
  lastMessage: string;
  updatedTime: string;
  status: 'active' | 'archived';
  unreadCount: number;
}

export interface ZernioInboxMessage {
  id: string;
  conversationId: string;
  accountId: string;
  platform: string;
  message: string;
  senderName: string | null;
  direction: 'incoming' | 'outgoing';
  createdAt: string;
}

/** List DM conversations across all connected accounts. Throws (with a
 *  message mentioning the Inbox addon) if that addon isn't enabled. */
export async function listConversations(): Promise<ZernioConversation[]> {
  const data = await call<{ data: any[] }>('/inbox/conversations?limit=100');
  return (data.data ?? []).map((c: any) => ({
    id: c.id,
    platform: c.platform,
    accountId: c.accountId,
    accountUsername: c.accountUsername,
    participantId: c.participantId,
    participantName: c.participantName || c.accountUsername || 'Unknown',
    lastMessage: c.lastMessage ?? '',
    updatedTime: c.updatedTime,
    status: c.status ?? 'active',
    unreadCount: c.unreadCount ?? 0,
  }));
}

/** List messages in one conversation, oldest first. */
export async function listConversationMessages(conversationId: string, accountId: string): Promise<ZernioInboxMessage[]> {
  const qs = new URLSearchParams({ accountId, limit: '50', sortOrder: 'asc' });
  const data = await call<{ messages: any[] }>(`/inbox/conversations/${encodeURIComponent(conversationId)}/messages?${qs}`);
  return (data.messages ?? []).map((m: any) => ({
    id: m.id,
    conversationId: m.conversationId,
    accountId: m.accountId,
    platform: m.platform,
    message: m.message ?? '',
    senderName: m.senderName ?? null,
    direction: m.direction,
    createdAt: m.createdAt,
  }));
}

/** Send a reply into a real conversation on the connected platform. */
export async function sendInboxMessage(conversationId: string, accountId: string, message: string): Promise<void> {
  await call(`/inbox/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ accountId, message }),
  });
}

/** Mark all unread messages in a conversation as read (also sends WhatsApp read receipts where supported). */
export async function markConversationRead(conversationId: string, accountId: string): Promise<void> {
  await call(`/inbox/conversations/${encodeURIComponent(conversationId)}/read`, {
    method: 'POST',
    body: JSON.stringify({ accountId }),
  });
}

// ─── Webhooks — real-time push instead of polling (up to 10 per account) ───────

export interface ZernioWebhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
}

export async function listWebhooks(): Promise<ZernioWebhook[]> {
  const data = await call<{ webhooks: any[] }>('/webhooks/settings');
  return (data.webhooks ?? []).map((w: any) => ({
    id: w._id, name: w.name, url: w.url, events: w.events ?? [], isActive: w.isActive !== false,
  }));
}

export async function createWebhook(input: { name: string; url: string; secret: string; events: string[] }): Promise<ZernioWebhook> {
  const data = await call<{ webhook: any }>('/webhooks/settings', {
    method: 'POST',
    body: JSON.stringify({ name: input.name, url: input.url, secret: input.secret, events: input.events, isActive: true }),
  });
  const w = data.webhook;
  return { id: w._id, name: w.name, url: w.url, events: w.events ?? [], isActive: w.isActive !== false };
}

export async function updateWebhook(id: string, input: { url?: string; secret?: string; events?: string[]; isActive?: boolean }): Promise<void> {
  await call('/webhooks/settings', { method: 'PUT', body: JSON.stringify({ _id: id, ...input }) });
}

// ─── Listening — brand mentions & posts generating comments (Inbox addon) ──────

export interface ZernioMention {
  id: string;
  platform: string;
  accountUsername: string;
  authorName: string;
  content: string;
  permalink?: string;
  publishedAt: string;
}

export interface ZernioCommentedPost {
  id: string;
  platform: string;
  accountUsername: string;
  content: string;
  permalink?: string;
  createdTime: string;
  commentCount: number;
  likeCount: number;
}

/** Brand mentions of your connected org accounts (currently LinkedIn). */
export async function listMentions(): Promise<ZernioMention[]> {
  const data = await call<{ data: any[] }>('/inbox/mentions?limit=50');
  return (data.data ?? []).map((m: any) => ({
    id: m.id,
    platform: m.platform,
    accountUsername: m.accountUsername ?? '',
    authorName: friendlyAuthor(m.authorUrn),
    content: m.content ?? '',
    permalink: m.permalink ?? undefined,
    publishedAt: m.publishedAt ?? m.createdAt ?? new Date().toISOString(),
  }));
}

/** Your posts that are generating comments across connected accounts. */
export async function listCommentedPosts(): Promise<ZernioCommentedPost[]> {
  const data = await call<{ data: any[] }>('/inbox/comments?limit=50&sortBy=comments&sortOrder=desc');
  return (data.data ?? [])
    .filter((p: any) => !p.isAd) // skip paid/dark-post rows — organic conversation only
    .map((p: any) => ({
      id: p.id,
      platform: p.platform,
      accountUsername: p.accountUsername ?? '',
      content: p.content ?? '',
      permalink: p.permalink ?? undefined,
      createdTime: p.createdTime ?? new Date().toISOString(),
      commentCount: p.commentCount ?? 0,
      likeCount: p.likeCount ?? 0,
    }));
}

/** LinkedIn mentions only carry an author URN; derive a readable handle. */
function friendlyAuthor(urn?: string | null): string {
  if (!urn) return 'LinkedIn member';
  const tail = String(urn).split(':').pop() ?? '';
  return tail ? `@${tail.slice(0, 16)}` : 'LinkedIn member';
}

/** Disconnect a social account.
 *  Accepts either a Zernio accountId (24-char hex) or a platform name (slower — requires a listAccounts lookup). */
export async function disconnect(accountIdOrPlatform: string): Promise<void> {
  // If it looks like a Zernio ObjectId, use it directly; otherwise resolve via platform name.
  if (/^[0-9a-f]{24}$/i.test(accountIdOrPlatform)) {
    await call(`/accounts/${accountIdOrPlatform}`, { method: 'DELETE' });
    return;
  }
  const accounts = await listAccounts();
  const account = accounts.find(a => a.platform === accountIdOrPlatform);
  if (!account) throw new Error(`No connected Zernio account for platform: ${accountIdOrPlatform}`);
  await call(`/accounts/${account.id}`, { method: 'DELETE' });
}

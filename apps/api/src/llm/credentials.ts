// Resolves an LLM provider's effective API key: an environment variable
// always wins when present (so ops can pin production credentials without
// touching the DB); otherwise falls back to a key entered through the app's
// Settings UI and stored in LlmCredential.
//
// A short in-memory cache avoids a DB round-trip on every isConfigured()
// check — these run several times per request (getProvidersMeta iterates
// every provider) and the value rarely changes.

import { prisma } from '../prisma';

const CACHE_TTL_MS = 10_000;
const cache = new Map<string, { value: { apiKey: string; baseUrl?: string } | null; expiresAt: number }>();

export function invalidateCredentialCache(provider?: string): void {
  if (provider) cache.delete(provider);
  else cache.clear();
}

async function getStoredCredential(provider: string): Promise<{ apiKey: string; baseUrl?: string } | null> {
  const cached = cache.get(provider);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const row = await prisma.llmCredential.findUnique({ where: { provider } });
  const value = row ? { apiKey: row.apiKey, baseUrl: row.baseUrl ?? undefined } : null;
  cache.set(provider, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

/** Effective API key: env var first, then a DB-stored key. */
export async function resolveApiKey(provider: string, envVar: string | undefined): Promise<string | undefined> {
  if (envVar) return envVar;
  const stored = await getStoredCredential(provider);
  return stored?.apiKey;
}

/** Effective base URL (custom provider only): env var first, then DB-stored. */
export async function resolveBaseUrl(provider: string, envVar: string | undefined): Promise<string | undefined> {
  if (envVar) return envVar;
  const stored = await getStoredCredential(provider);
  return stored?.baseUrl;
}

export async function isProviderConfigured(provider: string, envConfigured: boolean): Promise<boolean> {
  if (envConfigured) return true;
  return !!(await getStoredCredential(provider));
}

/** Whether this provider has a key stored via the UI specifically (as opposed
 *  to only being configured via env var) — used to show a "Disconnect"
 *  option only when there's actually something in the DB to remove. */
export async function hasStoredCredential(provider: string): Promise<boolean> {
  return !!(await getStoredCredential(provider));
}

export async function setStoredCredential(provider: string, apiKey: string, baseUrl?: string): Promise<void> {
  await prisma.llmCredential.upsert({
    where: { provider },
    update: { apiKey, baseUrl },
    create: { provider, apiKey, baseUrl },
  });
  invalidateCredentialCache(provider);
}

export async function deleteStoredCredential(provider: string): Promise<void> {
  await prisma.llmCredential.deleteMany({ where: { provider } });
  invalidateCredentialCache(provider);
}

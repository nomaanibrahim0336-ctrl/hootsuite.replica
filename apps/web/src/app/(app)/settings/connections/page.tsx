'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, PageHeader, Button, Badge, NetworkChip } from '@/components/ui';
import { toast } from '@/components/Toast';
import { NETWORK_META, cn } from '@/lib/utils';
import type { NetworkType } from '@/lib/types';
import { diagnostics, API_BASE, type DiagResult } from '@/lib/api';
import { Database, Server, Sparkles, Plug, CheckCircle2, XCircle, ExternalLink, ShieldCheck, Cloud, Loader2, PlayCircle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kvrhkseifkwshnqfvldu.supabase.co';
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_WUc9VZOC_b4x8IGHjCqdPg_cDS-yDpp';
const SUPABASE_REF = 'kvrhkseifkwshnqfvldu';

type Health = 'checking' | 'online' | 'offline';

function StatusDot({ state }: { state: Health }) {
  const map = { checking: 'bg-amber-400', online: 'bg-positive', offline: 'bg-slate-300' };
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${map[state]} ${state === 'checking' ? 'animate-pulse' : ''}`} />;
}

const socials: NetworkType[] = ['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok'];

type TestKey = 'api' | 'database' | 'auth' | 'supabase';
type TestState = { status: 'idle' | 'running' | 'pass' | 'fail'; result?: DiagResult };

const TEST_META: Record<TestKey, { label: string; desc: string; icon: any }> = {
  api: { label: 'Backend API (Railway)', desc: 'GET /health on the Express service', icon: Server },
  database: { label: 'Database (Supabase via API)', desc: 'API round-trips a real query to Postgres', icon: Database },
  auth: { label: 'Authentication', desc: 'Your stored token against a protected route', icon: ShieldCheck },
  supabase: { label: 'Supabase REST (direct)', desc: 'Browser → Supabase anon endpoint', icon: Cloud },
};

/** Turn a raw error string into a plain-English likely cause + suggested fix,
 *  per test type, so a failure is actionable instead of just a status code. */
function explainFailure(key: TestKey, error: string | undefined): { cause: string; fix: string } {
  const e = (error || '').toLowerCase();

  const networkDown = e.includes('failed to fetch') || e.includes('network error') || e.includes('unreachable') || e.includes('load failed');

  if (key === 'api') {
    if (networkDown) return { cause: 'The Railway service is unreachable from your browser.', fix: 'Check Railway → Deployments: is the service Active/Online, or crashed/sleeping? Also confirm NEXT_PUBLIC_API_URL points at the right URL.' };
    if (e.includes('http 5')) return { cause: 'The API responded but crashed handling the request.', fix: 'Check Railway → Deploy Logs for a stack trace at this exact time.' };
    return { cause: 'Unexpected response from the health check.', fix: 'Open the API target URL + /health directly in a browser tab to see the raw response.' };
  }

  if (key === 'database') {
    if (e.includes('http 404') || e.includes('not found')) return { cause: "The deployed API doesn't have this endpoint yet — Railway is running an older build.", fix: 'Push a commit that touches apps/api/ (or use Railway\'s "Deploy latest commit"), then confirm the new deployment references your latest commit SHA, not a stale one.' };
    if (e.includes('http 401') || e.includes('http 403')) return { cause: 'The request was blocked before it reached the database check.', fix: 'This endpoint is meant to be public — if you see this, check CORS_ORIGINS and the auth middleware ordering in apps/api/src/app.ts.' };
    if (e.includes('prepared statement') || e.includes('pgbouncer')) return { cause: 'Prisma is hitting a connection-pooler prepared-statement conflict.', fix: 'Add ?pgbouncer=true&connection_limit=1 to the end of DATABASE_URL in Railway.' };
    if (networkDown) return { cause: 'The API itself is unreachable, so it never got to test the database.', fix: 'Fix the "Backend API" test above first — this one will follow.' };
    if (e.includes('http 5') || e.includes('database query failed')) return { cause: 'The API reached the database layer but the query failed.', fix: 'Check DATABASE_URL is correct and the database is not paused/deleted in Supabase.' };
    return { cause: 'The database round-trip failed for an uncommon reason.', fix: 'Check Railway → Deploy Logs around this timestamp for the real Postgres/Prisma error.' };
  }

  if (key === 'auth') {
    if (e.includes('no token stored')) return { cause: "You're not signed in — there's no token in this browser.", fix: 'Log in from /login, then re-run this test.' };
    if (e.includes('invalid or expired') || e.includes('http 401')) return { cause: 'Your stored token is invalid or expired and refresh also failed.', fix: 'Log out fully, clear local storage for this site, and log back in.' };
    if (networkDown) return { cause: 'Could not reach the API to check the token.', fix: 'Fix the "Backend API" test above first.' };
    return { cause: 'The protected route rejected the request for an uncommon reason.', fix: 'Check Railway → Deploy Logs at this timestamp.' };
  }

  // supabase (direct)
  if (networkDown) return { cause: 'The browser could not reach Supabase at all.', fix: 'Check NEXT_PUBLIC_SUPABASE_URL is correct and the Supabase project is not paused.' };
  return { cause: 'An unexpected response from Supabase REST.', fix: 'Confirm NEXT_PUBLIC_SUPABASE_ANON_KEY matches the project shown in your Supabase dashboard.' };
}

function DiagnosticsPanel() {
  const [tests, setTests] = useState<Record<TestKey, TestState>>({
    api: { status: 'idle' }, database: { status: 'idle' }, auth: { status: 'idle' }, supabase: { status: 'idle' },
  });
  const [runningAll, setRunningAll] = useState(false);

  const supabaseProbe = async (): Promise<DiagResult> => {
    const started = Date.now();
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/`, { headers: { apikey: SUPABASE_ANON } });
      const latencyMs = Date.now() - started;
      // Any HTTP response (including 401/404) means Supabase is reachable. A 401
      // is the *expected* result — RLS deny-all correctly blocks anon browser
      // access, so we treat it as a pass with an explanatory note.
      if (res.status === 401 || res.status === 404) {
        return { ok: true, latencyMs, detail: `Reachable · anon access blocked by RLS (HTTP ${res.status}, expected)` };
      }
      return { ok: res.ok, latencyMs, error: res.ok ? undefined : `HTTP ${res.status}` };
    } catch (e: any) {
      return { ok: false, latencyMs: Date.now() - started, error: e?.message || 'Network error (unreachable)' };
    }
  };

  const runners: Record<TestKey, () => Promise<DiagResult>> = {
    api: diagnostics.api,
    database: diagnostics.database,
    auth: diagnostics.auth,
    supabase: supabaseProbe,
  };

  const runOne = async (key: TestKey) => {
    setTests((t) => ({ ...t, [key]: { status: 'running' } }));
    const result = await runners[key]();
    setTests((t) => ({ ...t, [key]: { status: result.ok ? 'pass' : 'fail', result } }));
    return result;
  };

  const runAll = async () => {
    setRunningAll(true);
    for (const key of Object.keys(TEST_META) as TestKey[]) await runOne(key);
    setRunningAll(false);
  };

  return (
    <Card>
      <CardHeader
        title="Connectivity diagnostics"
        subtitle="Test each layer of the stack and see the exact error when something fails."
        action={
          <Button size="sm" onClick={runAll} disabled={runningAll}>
            {runningAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            Run all tests
          </Button>
        }
      />
      <div className="mb-3 px-5 pt-3 text-xs text-slate-400">
        API target: <code className="rounded bg-slate-100 px-1 py-0.5">{API_BASE}</code>
      </div>
      <div className="divide-y divide-slate-100">
        {(Object.keys(TEST_META) as TestKey[]).map((key) => {
          const meta = TEST_META[key];
          const t = tests[key];
          const Icon = meta.icon;
          return (
            <div key={key} className="flex items-start gap-4 px-5 py-4">
              <span className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                t.status === 'pass' ? 'bg-emerald-100 text-emerald-700' : t.status === 'fail' ? 'bg-red-100 text-negative' : 'bg-slate-100 text-slate-500'
              )}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-800">{meta.label}</p>
                <p className="text-xs text-slate-400">{meta.desc}</p>
                {t.status === 'fail' && t.result?.error && (
                  <>
                    <p className="mt-1.5 break-words rounded-md bg-red-50 px-2 py-1 font-mono text-xs text-negative">{t.result.error}</p>
                    {(() => {
                      const { cause, fix } = explainFailure(key, t.result?.error);
                      return (
                        <div className="mt-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
                          <p><span className="font-semibold">Likely cause:</span> {cause}</p>
                          <p className="mt-0.5"><span className="font-semibold">Try:</span> {fix}</p>
                        </div>
                      );
                    })()}
                  </>
                )}
                {t.status === 'pass' && t.result?.detail && (
                  <p className="mt-1.5 break-words rounded-md bg-emerald-50 px-2 py-1 font-mono text-[11px] text-emerald-700">{t.result.detail}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {t.result && <span className="text-xs text-slate-400">{t.result.latencyMs}ms</span>}
                {t.status === 'pass' && <Badge color="green"><CheckCircle2 className="mr-1 inline h-3 w-3" /> Pass</Badge>}
                {t.status === 'fail' && <Badge color="red"><XCircle className="mr-1 inline h-3 w-3" /> Fail</Badge>}
                {t.status === 'running' && <Loader2 className="h-4 w-4 animate-spin text-accent-deep" />}
                <Button variant="secondary" size="sm" onClick={() => runOne(key)} disabled={t.status === 'running'}>Test</Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function ConnectionsPage() {
  const [apiHealth, setApiHealth] = useState<Health>('checking');
  const [supaHealth, setSupaHealth] = useState<Health>('checking');
  const [connected, setConnected] = useState<Record<string, boolean>>({
    facebook: true, instagram: true, twitter: true, linkedin: true, tiktok: false,
  });

  useEffect(() => {
    const ping = async (url: string, opts: RequestInit, set: (h: Health) => void) => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 4000);
        const res = await fetch(url, { ...opts, signal: ctrl.signal });
        clearTimeout(t);
        set(res.ok || res.status === 200 ? 'online' : 'offline');
      } catch {
        set('offline');
      }
    };
    ping(`${API_URL}/health`, {}, setApiHealth);
    ping(`${SUPABASE_URL}/rest/v1/`, { headers: { apikey: SUPABASE_ANON } }, setSupaHealth);
  }, []);

  const toggleSocial = (n: NetworkType) => {
    setConnected((c) => {
      const next = !c[n];
      toast[next ? 'success' : 'info'](`${NETWORK_META[n].label} ${next ? 'connected' : 'disconnected'}`);
      return { ...c, [n]: next };
    });
  };

  const label: Record<Health, string> = { checking: 'Checking…', online: 'Connected', offline: 'Offline' };

  return (
    <div>
      <PageHeader
        title="Connections"
        subtitle="Manage the database, backend API, social networks and AI providers."
        action={<Link href="/settings" className="text-sm font-medium text-accent-deep hover:underline">← Back to Settings</Link>}
      />

      <div className="space-y-6">
        <DiagnosticsPanel />

        {/* Database — Supabase */}
        <Card>
          <CardHeader title="Database" subtitle="Postgres persistence layer" action={<Database className="h-5 w-5 text-accent-deep" />} />
          <div className="space-y-3 p-5">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40">
                  <Database className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-medium text-slate-800">Supabase — <code className="text-xs">{SUPABASE_REF}</code></p>
                  <p className="text-xs text-slate-400">{SUPABASE_URL} · region ap-northeast-1 · Postgres 17</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusDot state={supaHealth} />
                <Badge color={supaHealth === 'online' ? 'green' : 'slate'}>{label[supaHealth]}</Badge>
              </div>
            </div>
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              The API defaults to local SQLite. To use Supabase, set <code>DATABASE_URL</code> in
              <code> apps/api/.env</code> to the project&apos;s connection string, then run
              <code> npm run db:push:supabase &amp;&amp; npm run db:seed</code>. Schema:
              <code> prisma/schema.postgres.prisma</code>. Prefer plain SQL? Paste-ready,
              verified migrations live in <code>supabase/migrations/</code> — run them
              directly in the Supabase SQL Editor (see <code>supabase/README.md</code>).
            </p>
          </div>
        </Card>

        {/* Backend API */}
        <Card>
          <CardHeader title="Backend API" subtitle="SocialHub REST service" action={<Server className="h-5 w-5 text-accent-deep" />} />
          <div className="flex items-center justify-between p-5">
            <div>
              <p className="font-medium text-slate-800">REST API</p>
              <p className="text-xs text-slate-400">{API_URL}</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusDot state={apiHealth} />
              <Badge color={apiHealth === 'online' ? 'green' : 'amber'}>{label[apiHealth]}</Badge>
            </div>
          </div>
        </Card>

        {/* Social networks */}
        <Card>
          <CardHeader title="Social networks" subtitle="Connect accounts via OAuth to publish and monitor" action={<Plug className="h-5 w-5 text-accent-deep" />} />
          <div className="divide-y divide-slate-100">
            {socials.map((n) => (
              <div key={n} className="flex items-center gap-4 px-5 py-4">
                <NetworkChip type={n} size={38} />
                <div className="flex-1">
                  <p className="font-medium text-slate-800">{NETWORK_META[n].label}</p>
                  <p className="text-xs text-slate-400">{connected[n] ? 'OAuth token active' : 'Not connected'}</p>
                </div>
                {connected[n] ? (
                  <>
                    <span className="flex items-center gap-1 text-xs font-medium text-positive"><CheckCircle2 className="h-4 w-4" /> connected</span>
                    <Button variant="secondary" size="sm" onClick={() => toggleSocial(n)}>Disconnect</Button>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-1 text-xs text-slate-400"><XCircle className="h-4 w-4" /> not connected</span>
                    <Button size="sm" onClick={() => toggleSocial(n)}>Connect</Button>
                  </>
                )}
              </div>
            ))}
          </div>
          <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            🔒 Production OAuth requires each network&apos;s app credentials (client ID/secret) configured server-side in <code>apps/api/.env</code>.
          </p>
        </Card>

        {/* AI providers */}
        <Card>
          <CardHeader title="AI providers" subtitle="LLM used for captions, hashtags, ideas and sentiment" action={<Sparkles className="h-5 w-5 text-accent-deep" />} />
          <div className="flex items-center justify-between p-5">
            <p className="text-sm text-slate-600">Manage Claude / OpenAI / Gemini / DeepSeek / Custom providers and the active model.</p>
            <Link href="/settings">
              <Button variant="secondary" size="sm">Open AI settings <ExternalLink className="h-4 w-4" /></Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

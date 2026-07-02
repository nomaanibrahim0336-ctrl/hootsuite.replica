'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, PageHeader, Button, Badge, NetworkChip } from '@/components/ui';
import { toast } from '@/components/Toast';
import { NETWORK_META } from '@/lib/utils';
import type { NetworkType } from '@/lib/types';
import { Database, Server, Sparkles, Plug, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';

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
              <code> prisma/schema.postgres.prisma</code>.
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

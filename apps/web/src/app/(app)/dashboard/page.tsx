'use client';

import { useEffect, useState } from 'react';
import { ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Clock, Activity, Gauge, Sparkles, Inbox } from 'lucide-react';
import { Card, CardHeader, PageHeader, NetworkChip, Badge, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { toast } from '@/components/Toast';
import { formatNumber, cn, NETWORK_META } from '@/lib/utils';
import type { AnalyticsMetric, AnalyticsPoint, Post, Network } from '@/lib/types';
import { format } from 'date-fns';

const RANGES = ['7 days', '30 days', '90 days'] as const;

export default function DashboardPage() {
  const [range, setRange] = useState<(typeof RANGES)[number]>('30 days');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardMetrics, setDashboardMetrics] = useState<AnalyticsMetric[]>([]);
  const [analyticsTrend, setAnalyticsTrend] = useState<AnalyticsPoint[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [networks, setNetworks] = useState<Network[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [metricsRes, postsRes, networksRes] = await Promise.all([
          api.getMetrics(),
          api.getPosts(),
          api.getNetworks(),
        ]);
        if (cancelled) return;
        setDashboardMetrics(metricsRes?.metrics ?? []);
        setAnalyticsTrend(metricsRes?.trend ?? []);
        setPosts(postsRes ?? []);
        setNetworks(networksRes ?? []);
        setError(null);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || 'Could not reach the live API');
        toast.error('Live API unreachable — try again in a moment.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const upcoming = posts.filter((p) => p.status === 'scheduled').slice(0, 5);
  const recent = posts.filter((p) => p.status === 'published').slice(0, 3);
  const days = range === '7 days' ? 7 : range === '90 days' ? 90 : 30;
  const trend = analyticsTrend.slice(-days);

  // Derive best-times from post engagement (only when we have real data)
  const bestTimes = derivBestTimes(posts);
  const health = deriveBrandHealth(dashboardMetrics);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Your social performance at a glance."
        action={
          <div className="flex rounded-lg border border-slate-200 p-0.5">
            {RANGES.map((r) => (
              <button key={r} onClick={() => setRange(r)} className={cn('rounded-md px-3 py-1 text-sm font-medium', range === r ? 'bg-accent-light text-accent-deep' : 'text-slate-500')}>{r}</button>
            ))}
          </div>
        }
      />

      {error && !loading && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span className="font-semibold">Live data unavailable:</span> {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-3 h-8 w-20" />
                <Skeleton className="mt-3 h-4 w-28" />
              </Card>
            ))
          : dashboardMetrics.length === 0 ? (
              <Card className="col-span-full p-8 text-center">
                <p className="text-sm text-slate-500">No metrics yet. Connect an account and publish your first post to see numbers here.</p>
              </Card>
            ) : dashboardMetrics.map((m) => (
              <Card key={m.label} className="p-5">
                <p className="text-sm text-slate-500">{m.label}</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{formatNumber(m.value)}</p>
                <div className={cn('mt-2 inline-flex items-center gap-1 text-sm font-medium', m.changeType === 'increase' ? 'text-positive' : 'text-negative')}>
                  {m.changeType === 'increase' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  {m.change}% <span className="font-normal text-slate-400">vs last period</span>
                </div>
              </Card>
            ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Engagement over time" subtitle={`Last ${range}`} />
          <div className="h-72 p-4">
            {trend.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">No engagement data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="eng" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FFB81C" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#FFB81C" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} interval={Math.floor(days / 6)} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
                  <Tooltip />
                  <Area type="monotone" dataKey="engagements" stroke="#FFB81C" strokeWidth={2} fill="url(#eng)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Connected accounts" />
          <div className="divide-y divide-slate-100">
            {networks.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">No networks connected. <a href="/settings" className="text-accent underline">Add one →</a></div>
            ) : networks.map((n) => (
              <div key={n.id} className="flex items-center gap-3 px-5 py-3">
                <NetworkChip type={n.type} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{NETWORK_META[n.type].label}</p>
                  <p className="text-xs text-slate-400">{n.username}</p>
                </div>
                {n.connected ? <span className="text-sm font-semibold text-slate-700">{formatNumber(n.followers)}</span> : <Badge color="amber">Not connected</Badge>}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Brand health · Best times · Activity — only when real data exists */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-2"><Gauge className="h-5 w-5 text-accent-deep" /><h3 className="font-semibold text-slate-800">Brand health</h3></div>
          {health ? (
            <>
              <div className="mt-4 flex items-end gap-3">
                <p className="text-5xl font-bold text-slate-900">{health.score}</p>
                <span className={cn('mb-2 inline-flex items-center gap-1 text-sm font-medium', health.delta >= 0 ? 'text-positive' : 'text-negative')}>
                  {health.delta >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />} {Math.abs(health.delta)}%
                </span>
              </div>
              <div className="mt-4 flex h-2.5 overflow-hidden rounded-full">
                <span className="bg-positive" style={{ width: `${health.positive}%` }} />
                <span className="bg-neutral" style={{ width: `${health.neutral}%` }} />
                <span className="bg-negative" style={{ width: `${health.negative}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-xs text-slate-400">
                <span>{health.positive}% positive</span><span>{health.negative}% negative</span>
              </div>
            </>
          ) : (
            <p className="mt-8 text-center text-sm text-slate-400">Not enough data yet.</p>
          )}
        </Card>

        <Card>
          <CardHeader title="Best time to post" subtitle="Based on your posts" action={<Sparkles className="h-5 w-5 text-accent-deep" />} />
          <div className="space-y-2 p-4">
            {bestTimes.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Publish posts to see recommendations.</p>
            ) : bestTimes.map((b) => (
              <div key={b.day} className="flex items-center gap-3">
                <span className="w-8 text-sm font-medium text-slate-600">{b.day}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <span className="block h-full rounded-full bg-gradient-to-r from-accent to-[#FF7A3D]" style={{ width: `${b.score}%` }} />
                </div>
                <span className="w-14 text-right text-xs text-slate-500">{b.hour}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent activity" subtitle="Latest published posts" action={<Activity className="h-5 w-5 text-accent-deep" />} />
          <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
            {recent.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-slate-400">
                <Inbox className="h-8 w-8 text-slate-300" />
                No activity yet.
              </div>
            ) : recent.map((p) => (
              <div key={p.id} className="flex gap-3 px-5 py-3">
                <div className="flex -space-x-1.5 pt-0.5">{p.networks.map((net) => <NetworkChip key={net} type={net} size={22} />)}</div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm text-slate-700">{p.content}</p>
                  <p className="mt-0.5 text-xs text-slate-400">Published {p.publishedAt && format(new Date(p.publishedAt), 'MMM d, h:mm a')}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Upcoming + top posts */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Upcoming posts" subtitle={`${upcoming.length} scheduled`} />
          <div className="divide-y divide-slate-100">
            {upcoming.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">No scheduled posts.</div>
            ) : upcoming.map((p) => (
              <div key={p.id} className="flex gap-3 px-5 py-3">
                <div className="flex -space-x-1.5 pt-0.5">{p.networks.map((net) => <NetworkChip key={net} type={net} size={24} />)}</div>
                <div className="flex-1">
                  <p className="line-clamp-2 text-sm text-slate-700">{p.content}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-400"><Clock className="h-3 w-3" />{p.scheduledAt && format(new Date(p.scheduledAt), 'MMM d, h:mm a')}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent top posts" subtitle="By engagement" />
          <div className="divide-y divide-slate-100">
            {recent.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">No published posts yet.</div>
            ) : recent.map((p) => (
              <div key={p.id} className="px-5 py-3">
                <div className="flex items-center gap-2">
                  {p.networks.map((net) => <NetworkChip key={net} type={net} size={22} />)}
                  <Badge color="green">Published</Badge>
                </div>
                <p className="mt-2 line-clamp-1 text-sm text-slate-700">{p.content}</p>
                {p.engagements && (
                  <div className="mt-2 flex gap-4 text-xs text-slate-500">
                    <span>❤️ {formatNumber(p.engagements.likes)}</span>
                    <span>💬 {formatNumber(p.engagements.comments)}</span>
                    <span>🔁 {formatNumber(p.engagements.shares)}</span>
                    <span>👁 {formatNumber(p.engagements.impressions)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/** Compute per-weekday engagement scores from published posts. */
function derivBestTimes(posts: Post[]): { day: string; score: number; hour: string }[] {
  const published = posts.filter((p) => p.status === 'published' && p.publishedAt && p.engagements);
  if (published.length < 3) return [];
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const buckets: Record<number, { total: number; hours: number[] }> = {};
  for (const p of published) {
    const d = new Date(p.publishedAt!);
    const dow = d.getDay();
    const eng = (p.engagements!.likes + p.engagements!.comments + p.engagements!.shares) || 0;
    if (!buckets[dow]) buckets[dow] = { total: 0, hours: [] };
    buckets[dow].total += eng;
    buckets[dow].hours.push(d.getHours());
  }
  const max = Math.max(...Object.values(buckets).map((b) => b.total), 1);
  return Object.entries(buckets)
    .map(([dow, b]) => {
      const avgHour = Math.round(b.hours.reduce((s, h) => s + h, 0) / b.hours.length);
      const h12 = avgHour % 12 || 12;
      const ampm = avgHour < 12 ? 'AM' : 'PM';
      return { day: DAYS[+dow], score: Math.round((b.total / max) * 100), hour: `${h12}:00 ${ampm}` };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/** Derive a simple brand-health snapshot from engagement metrics. */
function deriveBrandHealth(metrics: AnalyticsMetric[]): { score: number; delta: number; positive: number; neutral: number; negative: number } | null {
  if (metrics.length === 0) return null;
  const engagement = metrics.find((m) => /engag/i.test(m.label));
  const followers = metrics.find((m) => /follow/i.test(m.label));
  const base = engagement ?? followers ?? metrics[0];
  const delta = base.changeType === 'increase' ? base.change : -base.change;
  // Placeholder split until real sentiment data lands
  const score = Math.max(0, Math.min(100, 60 + Math.round(delta)));
  return { score, delta, positive: score, neutral: Math.max(0, Math.round((100 - score) * 0.6)), negative: Math.max(0, 100 - score - Math.round((100 - score) * 0.6)) };
}

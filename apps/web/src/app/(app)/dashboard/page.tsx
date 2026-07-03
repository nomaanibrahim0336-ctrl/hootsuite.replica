'use client';

import { useEffect, useState } from 'react';
import { ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Clock, Activity, Gauge, Sparkles } from 'lucide-react';
import { Card, CardHeader, PageHeader, NetworkChip, Badge, Avatar } from '@/components/ui';
import { dashboardMetrics as mockMetrics, analyticsTrend as mockTrend, posts as mockPosts, networks as mockNetworks, activityStream, brandHealth, bestTimes } from '@/lib/mock';
import { api } from '@/lib/api';
import { toast } from '@/components/Toast';
import { formatNumber, cn, NETWORK_META, SENTIMENT_META } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';

const RANGES = ['7 days', '30 days', '90 days'] as const;
const kindLabel: Record<string, string> = { message: 'New message', mention: 'Mention', published: 'Published', approval: 'Approval' };

export default function DashboardPage() {
  const [range, setRange] = useState<(typeof RANGES)[number]>('30 days');
  const [loading, setLoading] = useState(true);
  const [dashboardMetrics, setDashboardMetrics] = useState(mockMetrics);
  const [analyticsTrend, setAnalyticsTrend] = useState(mockTrend);
  const [posts, setPosts] = useState(mockPosts);
  const [networks, setNetworks] = useState(mockNetworks);

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
        if (metricsRes?.metrics?.length) setDashboardMetrics(metricsRes.metrics);
        if (metricsRes?.trend?.length) setAnalyticsTrend(metricsRes.trend);
        if (postsRes?.length) setPosts(postsRes);
        if (networksRes?.length) setNetworks(networksRes);
      } catch {
        // Live API unreachable — keep mock data so the dashboard still renders.
        toast.info('Showing demo data — live API unreachable.');
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

      <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4', loading && 'opacity-60')}>
        {dashboardMetrics.map((m) => (
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
          </div>
        </Card>

        <Card>
          <CardHeader title="Connected accounts" />
          <div className="divide-y divide-slate-100">
            {networks.map((n) => (
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

      {/* Brand health · Best times · Activity */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-2"><Gauge className="h-5 w-5 text-accent-deep" /><h3 className="font-semibold text-slate-800">Brand health</h3></div>
          <div className="mt-4 flex items-end gap-3">
            <p className="text-5xl font-bold text-slate-900">{brandHealth.score}</p>
            <span className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-positive"><ArrowUpRight className="h-4 w-4" /> {brandHealth.delta}%</span>
          </div>
          <div className="mt-4 flex h-2.5 overflow-hidden rounded-full">
            <span className="bg-positive" style={{ width: `${brandHealth.positive}%` }} />
            <span className="bg-neutral" style={{ width: `${brandHealth.neutral}%` }} />
            <span className="bg-negative" style={{ width: `${brandHealth.negative}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-slate-400">
            <span>{brandHealth.positive}% positive</span><span>{brandHealth.negative}% negative</span>
          </div>
        </Card>

        <Card>
          <CardHeader title="Best time to post" subtitle="AI recommendation" action={<Sparkles className="h-5 w-5 text-accent-deep" />} />
          <div className="space-y-2 p-4">
            {bestTimes.map((b) => (
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
          <CardHeader title="Recent activity" subtitle="Messages, mentions & actions" action={<Activity className="h-5 w-5 text-accent-deep" />} />
          <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
            {activityStream.map((a) => (
              <div key={a.id} className="flex gap-3 px-5 py-3">
                <div className="relative shrink-0">
                  <Avatar name={a.actor} size={32} />
                  <span className="absolute -bottom-1 -right-1"><NetworkChip type={a.network} size={15} /></span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs">
                    <span className="font-semibold text-slate-700">{a.actor}</span>
                    <span className="text-slate-400"> · {kindLabel[a.kind]}</span>
                  </p>
                  <p className="line-clamp-1 text-sm text-slate-600">{a.text}</p>
                </div>
                {a.sentiment && <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: SENTIMENT_META[a.sentiment].color }} />}
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
            {upcoming.map((p) => (
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
            {recent.map((p) => (
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

'use client';

import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';
import { ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';
import { Card, CardHeader, PageHeader, NetworkChip, Badge } from '@/components/ui';
import { dashboardMetrics, analyticsTrend, posts, networks } from '@/lib/mock';
import { formatNumber, cn, NETWORK_META } from '@/lib/utils';
import { format } from 'date-fns';

export default function DashboardPage() {
  const upcoming = posts.filter((p) => p.status === 'scheduled').slice(0, 5);
  const recent = posts.filter((p) => p.status === 'published').slice(0, 3);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Your social performance at a glance." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dashboardMetrics.map((m) => (
          <Card key={m.label} className="p-5">
            <p className="text-sm text-slate-500">{m.label}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{formatNumber(m.value)}</p>
            <div className={cn('mt-2 inline-flex items-center gap-1 text-sm font-medium', m.changeType === 'increase' ? 'text-emerald-600' : 'text-red-500')}>
              {m.changeType === 'increase' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              {m.change}% <span className="font-normal text-slate-400">vs last month</span>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Engagement over time" subtitle="Last 30 days" />
          <div className="h-72 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analyticsTrend}>
                <defs>
                  <linearGradient id="eng" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6c63ff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6c63ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} interval={5} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
                <Tooltip />
                <Area type="monotone" dataKey="engagements" stroke="#6c63ff" strokeWidth={2} fill="url(#eng)" />
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
                {n.connected ? (
                  <span className="text-sm font-semibold text-slate-700">{formatNumber(n.followers)}</span>
                ) : (
                  <Badge color="amber">Not connected</Badge>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Upcoming posts" subtitle={`${upcoming.length} scheduled`} />
          <div className="divide-y divide-slate-100">
            {upcoming.map((p) => (
              <div key={p.id} className="flex gap-3 px-5 py-3">
                <div className="flex -space-x-1.5 pt-0.5">
                  {p.networks.map((net) => (
                    <NetworkChip key={net} type={net} size={24} />
                  ))}
                </div>
                <div className="flex-1">
                  <p className="line-clamp-2 text-sm text-slate-700">{p.content}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                    <Clock className="h-3 w-3" />
                    {p.scheduledAt && format(new Date(p.scheduledAt), "MMM d, h:mm a")}
                  </p>
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
                  {p.networks.map((net) => (
                    <NetworkChip key={net} type={net} size={22} />
                  ))}
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

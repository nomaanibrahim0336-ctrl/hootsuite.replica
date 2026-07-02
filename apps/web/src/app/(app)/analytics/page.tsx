'use client';

import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { ArrowUpRight, ArrowDownRight, FileText, Download } from 'lucide-react';
import { Card, CardHeader, PageHeader, Button, Badge, NetworkChip } from '@/components/ui';
import { analyticsMetrics, analyticsTrend, networkBreakdown, reports, reportTemplates } from '@/lib/mock';
import { formatNumber, cn, NETWORK_META } from '@/lib/utils';
import { format } from 'date-fns';

export default function AnalyticsPage() {
  return (
    <div>
      <PageHeader
        title="Analytics & Reporting"
        subtitle="Measure performance and prove ROI across every network."
        action={<Button variant="secondary"><Download className="h-4 w-4" /> Export</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {analyticsMetrics.map((m) => (
          <Card key={m.label} className="p-5">
            <p className="text-sm text-slate-500">{m.label}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{formatNumber(m.value)}</p>
            <div className={cn('mt-2 inline-flex items-center gap-1 text-sm font-medium', m.changeType === 'increase' ? 'text-emerald-600' : 'text-red-500')}>
              {m.changeType === 'increase' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              {Math.abs(m.change)}%
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Performance trends" subtitle="Impressions, engagements & clicks · 30 days" />
          <div className="h-80 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analyticsTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} interval={5} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="impressions" stroke="#6c63ff" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="engagements" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="clicks" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Engagement by network" />
          <div className="h-80 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={networkBreakdown} dataKey="value" nameKey="network" cx="50%" cy="45%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {networkBreakdown.map((n) => (
                    <Cell key={n.network} fill={NETWORK_META[n.network].color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number, n: string) => [`${v}%`, NETWORK_META[n as keyof typeof NETWORK_META]?.label ?? n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-3">
              {networkBreakdown.map((n) => (
                <div key={n.network} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: NETWORK_META[n.network].color }} />
                  {NETWORK_META[n.network].label} {n.value}%
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Saved reports" />
          <div className="divide-y divide-slate-100">
            {reports.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-light">
                  <FileText className="h-4 w-4 text-accent" />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{r.name}</p>
                  <p className="text-xs text-slate-400">{r.type} · {format(new Date(r.createdAt), 'MMM d, yyyy')}</p>
                </div>
                <div className="flex -space-x-1.5">
                  {r.networks.map((n) => <NetworkChip key={n} type={n} size={20} />)}
                </div>
                <Button variant="ghost" size="sm"><Download className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Report templates" subtitle="Start from a pre-built template" />
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
            {reportTemplates.map((t) => (
              <button key={t.id} className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-accent hover:shadow-sm">
                <p className="text-sm font-semibold text-slate-800">{t.name}</p>
                <p className="mt-1 text-xs text-slate-500">{t.desc}</p>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

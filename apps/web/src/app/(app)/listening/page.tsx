'use client';

import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardHeader, PageHeader, Button, Badge, NetworkChip, Avatar } from '@/components/ui';
import { streams as seedStreams, mentions, sentimentTrend } from '@/lib/mock';
import { cn, formatNumber, SENTIMENT_META, NETWORK_META } from '@/lib/utils';
import type { Stream, NetworkType } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { Plus, Radio, Heart, Repeat2, MessageCircle } from 'lucide-react';

export default function ListeningPage() {
  const [streams, setStreams] = useState<Stream[]>(seedStreams);
  const [active, setActive] = useState(seedStreams[0].id);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [keywords, setKeywords] = useState('');

  const feed = mentions;
  const total = feed.length;
  const pos = feed.filter((m) => m.sentiment === 'positive').length;
  const neg = feed.filter((m) => m.sentiment === 'negative').length;

  const addStream = () => {
    if (!name.trim()) return;
    const s: Stream = {
      id: 's' + Date.now(),
      name,
      keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
      sources: ['twitter', 'instagram'] as NetworkType[],
      isActive: true,
      mentionCount: 0,
      createdAt: new Date().toISOString(),
    };
    setStreams([s, ...streams]);
    setName('');
    setKeywords('');
    setCreating(false);
  };

  return (
    <div>
      <PageHeader
        title="Social Listening"
        subtitle="Track keywords, monitor brand mentions and analyze sentiment."
        action={
          <Button onClick={() => setCreating((c) => !c)}>
            <Plus className="h-4 w-4" /> New Stream
          </Button>
        }
      />

      {creating && (
        <Card className="mb-6 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Stream name (e.g. Brand Mentions)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent" />
            <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="Keywords, comma separated" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent" />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setCreating(false)}>Cancel</Button>
            <Button size="sm" onClick={addStream}>Create stream</Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-slate-500">Total mentions</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{formatNumber(total * 34)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Positive sentiment</p>
          <p className="mt-1 text-3xl font-bold text-emerald-600">{Math.round((pos / total) * 100)}%</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Negative sentiment</p>
          <p className="mt-1 text-3xl font-bold text-red-500">{Math.round((neg / total) * 100)}%</p>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Streams */}
        <Card>
          <CardHeader title="Streams" />
          <div className="divide-y divide-slate-100">
            {streams.map((s) => (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={cn('flex w-full items-start gap-3 px-5 py-3 text-left', active === s.id ? 'bg-accent-light/50' : 'hover:bg-slate-50')}
              >
                <Radio className={cn('mt-0.5 h-4 w-4', s.isActive ? 'text-accent-deep' : 'text-slate-300')} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-800">{s.name}</p>
                    {s.isActive ? <Badge color="green">Live</Badge> : <Badge>Paused</Badge>}
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">{s.keywords.join(', ')}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">{formatNumber(s.mentionCount)} mentions</p>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Sentiment chart */}
        <Card className="lg:col-span-2">
          <CardHeader title="Sentiment over time" subtitle="Last 14 days" />
          <div className="h-72 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sentimentTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} interval={2} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="positive" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="neutral" stackId="a" fill="#94a3b8" />
                <Bar dataKey="negative" stackId="a" fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Mentions feed */}
      <Card className="mt-6">
        <CardHeader title="Mentions feed" subtitle="Latest conversations about your brand" />
        <div className="divide-y divide-slate-100">
          {feed.map((m) => {
            const sm = SENTIMENT_META[m.sentiment];
            return (
              <div key={m.id} className="flex gap-3 px-5 py-4">
                <div className="relative">
                  <Avatar name={m.author.name} size={40} />
                  <span className="absolute -bottom-1 -right-1">
                    <NetworkChip type={m.network} size={18} />
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800">{m.author.name}</p>
                    <p className="text-xs text-slate-400">{m.author.username} · {NETWORK_META[m.network].label}</p>
                    <span className="ml-auto text-xs text-slate-400">{formatDistanceToNow(new Date(m.timestamp), { addSuffix: true })}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{m.content}</p>
                  <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {m.engagements.likes}</span>
                    <span className="flex items-center gap-1"><Repeat2 className="h-3.5 w-3.5" /> {m.engagements.shares}</span>
                    <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> {m.engagements.comments}</span>
                    <span className="ml-auto rounded-full px-2 py-0.5 font-medium" style={{ backgroundColor: sm.bg, color: sm.color }}>
                      {sm.label}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

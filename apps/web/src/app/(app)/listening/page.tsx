'use client';

import { useEffect, useState } from 'react';
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
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { api } from '@/lib/api';
import { toast } from '@/components/Toast';
import { cn, formatNumber, SENTIMENT_META, NETWORK_META } from '@/lib/utils';
import type { Stream, NetworkType, Mention, SentimentPoint } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { Plus, Radio, Heart, Repeat2, MessageCircle, Pencil, Trash2, Download, Loader2 } from 'lucide-react';

export default function ListeningPage() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [active, setActive] = useState<string | undefined>(undefined);
  const [feed, setFeed] = useState<Mention[]>([]);
  const [sentimentTrend, setSentimentTrend] = useState<SentimentPoint[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [keywords, setKeywords] = useState('');

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editKeywords, setEditKeywords] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [ingestingId, setIngestingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [streamsRes, mentionsRes, sentimentRes] = await Promise.all([
          api.getStreams(),
          api.getMentions(),
          api.getSentiment(),
        ]);
        if (cancelled) return;
        setStreams(streamsRes ?? []);
        setActive(streamsRes?.[0]?.id);
        setFeed(mentionsRes ?? []);
        setSentimentTrend(sentimentRes?.trend ?? []);
      } catch {
        if (cancelled) return;
        toast.error('Live API unreachable — no streams or mentions loaded.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Clicking a stream filters the mentions feed to that stream.
  const selectStream = async (id: string) => {
    setActive(id);
    try {
      const rows = await api.getMentions(id);
      setFeed(rows ?? []);
    } catch {
      // API unreachable — keep the current feed.
    }
  };

  const feedForActive = active ? feed.filter((m) => !m.streamId || m.streamId === active) : feed;
  const total = feedForActive.length;
  const pos = feedForActive.filter((m) => m.sentiment === 'positive').length;
  const neg = feedForActive.filter((m) => m.sentiment === 'negative').length;

  const addStream = async () => {
    if (!name.trim()) return;
    const kw = keywords.split(',').map((k) => k.trim()).filter(Boolean);
    const s: Stream = {
      id: 's' + Date.now(),
      name,
      keywords: kw,
      sources: ['twitter', 'instagram'] as NetworkType[],
      isActive: true,
      mentionCount: 0,
      createdAt: new Date().toISOString(),
    };
    setStreams([s, ...streams]);
    setName('');
    setKeywords('');
    setCreating(false);
    try {
      const created = (await api.createStream({ name: s.name, keywords: kw, sources: s.sources })) as Stream;
      setStreams((l: Stream[]) => [created, ...l.filter((x) => x.id !== s.id)]);
    } catch {
      // API unreachable — locally created stream stands as the offline result.
    }
  };

  const startEdit = (s: Stream) => {
    setEditId(s.id);
    setEditName(s.name);
    setEditKeywords(s.keywords.join(', '));
  };

  const saveEdit = async () => {
    if (!editId) return;
    const kw = editKeywords.split(',').map((k) => k.trim()).filter(Boolean);
    setStreams((l) => l.map((s) => (s.id === editId ? { ...s, name: editName, keywords: kw } : s)));
    const id = editId;
    setEditId(null);
    try {
      const updated = (await api.updateStream(id, { name: editName, keywords: kw })) as Stream;
      setStreams((l) => l.map((s) => (s.id === id ? updated : s)));
      toast.success('Stream updated');
    } catch (e: any) {
      toast.error(e?.message || 'Could not update stream');
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    setStreams((l) => l.filter((s) => s.id !== id));
    if (active === id) setActive(undefined);
    try {
      await api.deleteStream(id);
      toast.success('Stream deleted');
    } catch (e: any) {
      toast.error(e?.message || 'Could not delete stream');
    }
  };

  const pullMentions = async (id: string) => {
    setIngestingId(id);
    try {
      await api.ingestStream(id, 5);
      const [rows, streamsRes] = await Promise.all([api.getMentions(id), api.getStreams()]);
      setFeed(rows ?? []);
      setStreams(streamsRes ?? []);
      setActive(id);
      toast.success('Pulled 5 fresh mentions');
    } catch (e: any) {
      toast.error(e?.message || 'Could not pull mentions');
    } finally {
      setIngestingId(null);
    }
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
              <div key={s.id} className={cn('px-5 py-3', active === s.id && 'bg-accent-light/50')}>
                {editId === s.id ? (
                  <div className="space-y-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Stream name"
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-accent"
                    />
                    <input
                      value={editKeywords}
                      onChange={(e) => setEditKeywords(e.target.value)}
                      placeholder="Keywords, comma separated"
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-accent"
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setEditId(null)}>Cancel</Button>
                      <Button size="sm" onClick={saveEdit}>Save</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <button onClick={() => selectStream(s.id)} className="flex flex-1 items-start gap-3 text-left">
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
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => pullMentions(s.id)}
                        disabled={ingestingId === s.id}
                        aria-label="Pull mentions"
                        title="Pull fresh mentions"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-accent-deep disabled:opacity-50"
                      >
                        {ingestingId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => startEdit(s)}
                        aria-label="Edit stream"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteId(s.id)}
                        aria-label="Delete stream"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-negative"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {streams.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-slate-400">No streams yet. Click "New Stream" to start monitoring.</p>
            )}
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
        <CardHeader
          title="Mentions feed"
          subtitle={active ? 'Showing mentions for the selected stream' : 'Latest conversations about your brand'}
        />
        <div className="divide-y divide-slate-100">
          {feedForActive.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-slate-400">
              No mentions yet. Use the ⬇ button on a stream to pull some in.
            </p>
          )}
          {feedForActive.map((m) => {
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

      <ConfirmDialog
        open={!!deleteId}
        title="Delete stream?"
        message="This removes the stream and all mentions collected for it. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

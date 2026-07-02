'use client';

import { useState } from 'react';
import { Card, CardHeader, PageHeader, Button, Badge, NetworkChip } from '@/components/ui';
import { posts as seedPosts, networks } from '@/lib/mock';
import { NETWORK_META, NETWORK_LIMITS, cn } from '@/lib/utils';
import type { NetworkType, Post, PostStatus } from '@/lib/types';
import { Sparkles, Calendar, Send, Trash2, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';

const statusColor: Record<PostStatus, string> = {
  draft: 'slate',
  scheduled: 'blue',
  published: 'green',
  failed: 'red',
};

export default function PublisherPage() {
  const [list, setList] = useState<Post[]>(seedPosts);
  const [content, setContent] = useState('');
  const [selected, setSelected] = useState<NetworkType[]>(['twitter']);
  const [when, setWhen] = useState('');
  const [filter, setFilter] = useState<'all' | PostStatus>('all');

  const connected = networks.filter((n) => n.connected);
  const minLimit = Math.min(...(selected.length ? selected.map((n) => NETWORK_LIMITS[n]) : [280]));
  const over = content.length > minLimit;

  const toggle = (n: NetworkType) =>
    setSelected((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]));

  const create = (status: PostStatus) => {
    if (!content.trim() || selected.length === 0) return;
    const post: Post = {
      id: 'p' + Date.now(),
      content,
      networks: selected,
      status,
      scheduledAt: status === 'scheduled' && when ? new Date(when).toISOString() : undefined,
      publishedAt: status === 'published' ? new Date().toISOString() : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setList([post, ...list]);
    setContent('');
    setWhen('');
  };

  const aiCaption = () => {
    const ideas = [
      '🚀 Ready to level up your social game? Here is how top brands stay ahead. ',
      '✨ New week, new content. What is your team shipping today? ',
      '💡 Pro tip: consistency beats perfection. Schedule ahead and stay sane. ',
    ];
    setContent((c) => c + ideas[Math.floor(Math.random() * ideas.length)]);
  };

  const remove = (id: string) => setList((l) => l.filter((p) => p.id !== id));

  const filtered = filter === 'all' ? list : list.filter((p) => p.status === filter);

  return (
    <div>
      <PageHeader title="Publisher" subtitle="Compose, schedule and publish across all your networks." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Composer */}
        <Card className="lg:col-span-3">
          <CardHeader title="Create a post" />
          <div className="space-y-4 p-5">
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Publish to</p>
              <div className="flex flex-wrap gap-2">
                {connected.map((n) => {
                  const active = selected.includes(n.type);
                  return (
                    <button
                      key={n.id}
                      onClick={() => toggle(n.type)}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition',
                        active ? 'border-accent bg-accent-light text-accent-deep' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      <NetworkChip type={n.type} size={20} />
                      {NETWORK_META[n.type].label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                placeholder="What do you want to share?"
                className="w-full resize-none rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-accent"
              />
              <div className="mt-2 flex items-center justify-between">
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={aiCaption}>
                    <Sparkles className="h-4 w-4 text-accent-deep" /> AI Caption
                  </Button>
                  <Button variant="secondary" size="sm">
                    <ImageIcon className="h-4 w-4" /> Media
                  </Button>
                </div>
                <span className={cn('text-sm', over ? 'text-red-500' : 'text-slate-400')}>
                  {content.length} / {minLimit}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => create('draft')}>
                  Save draft
                </Button>
                <Button variant="secondary" onClick={() => create('scheduled')} disabled={!when || over}>
                  <Calendar className="h-4 w-4" /> Schedule
                </Button>
                <Button onClick={() => create('published')} disabled={over}>
                  <Send className="h-4 w-4" /> Publish now
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Preview */}
        <Card className="lg:col-span-2">
          <CardHeader title="Preview" />
          <div className="p-5">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <span className="h-9 w-9 rounded-full bg-accent-light" />
                <div>
                  <p className="text-sm font-semibold text-slate-800">SocialHub</p>
                  <p className="text-xs text-slate-400">Just now</p>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                {content || 'Your post preview will appear here…'}
              </p>
              <div className="mt-3 flex gap-2">
                {selected.map((n) => (
                  <NetworkChip key={n} type={n} size={22} />
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Scheduled list */}
      <Card className="mt-6">
        <CardHeader
          title="Your posts"
          action={
            <div className="flex gap-1">
              {(['all', 'scheduled', 'published', 'draft', 'failed'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'rounded-md px-3 py-1 text-sm font-medium capitalize',
                    filter === f ? 'bg-accent-light text-accent-deep' : 'text-slate-500 hover:bg-slate-100'
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          }
        />
        <div className="divide-y divide-slate-100">
          {filtered.map((p) => (
            <div key={p.id} className="flex items-start gap-4 px-5 py-4">
              <div className="flex -space-x-1.5 pt-0.5">
                {p.networks.map((n) => (
                  <NetworkChip key={n} type={n} size={24} />
                ))}
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-700">{p.content}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {p.status === 'scheduled' && p.scheduledAt && `Scheduled for ${format(new Date(p.scheduledAt), 'MMM d, h:mm a')}`}
                  {p.status === 'published' && p.publishedAt && `Published ${format(new Date(p.publishedAt), 'MMM d, h:mm a')}`}
                  {p.status === 'draft' && 'Draft'}
                  {p.status === 'failed' && 'Failed to publish'}
                </p>
              </div>
              <Badge color={statusColor[p.status]}>{p.status}</Badge>
              <button onClick={() => remove(p.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {filtered.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-400">No posts in this category.</p>}
        </div>
      </Card>
    </div>
  );
}

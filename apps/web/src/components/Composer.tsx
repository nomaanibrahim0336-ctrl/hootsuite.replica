'use client';

import { useRef, useState } from 'react';
import { useUiStore } from '@/lib/ui-store';
import { networks } from '@/lib/mock';
import { NETWORK_META, NETWORK_LIMITS, cn, initials } from '@/lib/utils';
import type { NetworkType } from '@/lib/types';
import { Button, NetworkChip } from './ui';
import { toast } from './Toast';
import { api } from '@/lib/api';
import { X, Sparkles, Hash, Lightbulb, Image as ImageIcon, Calendar, Send, Heart, MessageCircle, Repeat2, Trash2 } from 'lucide-react';

const TONES = ['professional', 'casual', 'playful', 'bold'] as const;
const MAX_MEDIA = 4;
const MAX_MEDIA_BYTES = 8 * 1024 * 1024; // 8MB per file

function aiCaption(topic: string, tone: string) {
  const openers: Record<string, string> = {
    professional: '📊 Insights that matter:',
    casual: '👋 Hey friends!',
    playful: '✨ Plot twist:',
    bold: '🔥 Stop scrolling.',
  };
  return `${openers[tone] ?? openers.professional} Here is why ${topic || 'this'} is a game-changer. Save this and share it with your team. 🚀`;
}
function aiHashtags(topic: string) {
  const base = (topic || 'social media').toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ').filter(Boolean);
  const extras = ['marketing', 'growth', 'trending', 'contentcreator', 'strategy', 'branding'];
  return Array.from(new Set([...base, ...extras].map((w) => `#${w}`))).slice(0, 8);
}
const IDEAS = (industry: string) => [
  `Behind-the-scenes look at a day in ${industry || 'your team'}`,
  `5 myths about ${industry || 'your product'} — busted`,
  `A customer success story worth sharing`,
  `Quick tip Tuesday: level up your workflow`,
  `Ask your audience: their biggest challenge?`,
];

export function Composer() {
  const { composerOpen, closeComposer } = useUiStore();
  const [content, setContent] = useState('');
  const [selected, setSelected] = useState<NetworkType[]>(['twitter']);
  const [when, setWhen] = useState('');
  const [tone, setTone] = useState<(typeof TONES)[number]>('professional');
  const [previewNet, setPreviewNet] = useState<NetworkType>('twitter');
  const [ideas, setIdeas] = useState<string[]>([]);
  const [media, setMedia] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const connected = networks.filter((n) => n.connected);
  const minLimit = selected.length ? Math.min(...selected.map((n) => NETWORK_LIMITS[n])) : 280;
  const over = content.length > minLimit;

  const toggle = (n: NetworkType) => {
    setSelected((s) => {
      const next = s.includes(n) ? s.filter((x) => x !== n) : [...s, n];
      if (!next.includes(previewNet) && next.length) setPreviewNet(next[0]);
      return next;
    });
  };

  const reset = () => { setContent(''); setWhen(''); setIdeas([]); setMedia([]); };

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // allow re-selecting the same file later
    if (!files.length) return;

    const room = MAX_MEDIA - media.length;
    if (room <= 0) {
      toast.error(`You can attach up to ${MAX_MEDIA} images`);
      return;
    }

    files.slice(0, room).forEach((file) => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} isn't an image`);
        return;
      }
      if (file.size > MAX_MEDIA_BYTES) {
        toast.error(`${file.name} is over the 8MB limit`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => setMedia((m) => [...m, reader.result as string]);
      reader.onerror = () => toast.error(`Couldn't read ${file.name}`);
      reader.readAsDataURL(file);
    });

    if (files.length > room) toast.error(`Only the first ${room} image(s) were added (max ${MAX_MEDIA})`);
  };

  const removeMedia = (idx: number) => setMedia((m) => m.filter((_, i) => i !== idx));

  const submit = async (kind: 'draft' | 'schedule' | 'publish') => {
    if (kind !== 'draft' && (!content.trim() || selected.length === 0)) {
      toast.error('Add content and pick at least one network');
      return;
    }
    if (over) return toast.error('Content exceeds the character limit');
    if (kind === 'schedule' && !when) return toast.error('Pick a date & time to schedule');
    const labels = { draft: 'Draft saved', schedule: 'Post scheduled 🎉', publish: 'Published across networks ✓' };
    toast.success(labels[kind]);
    const status = kind === 'schedule' ? 'scheduled' : kind === 'publish' ? 'published' : 'draft';
    api.createPost({
      content,
      networks: selected,
      status,
      scheduledAt: kind === 'schedule' ? new Date(when).toISOString() : undefined,
      media,
    }).catch(() => {
      // Live API unreachable — the toast above already confirmed the (local-only) action.
    });
    reset();
    closeComposer();
  };

  if (!composerOpen) return null;

  const previewMeta = NETWORK_META[previewNet];
  const previewText = previewNet === 'twitter' && content.length > 280 ? content.slice(0, 277) + '…' : content;

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/40" onClick={closeComposer}>
      <div
        className="flex h-full w-full max-w-2xl flex-col bg-canvas shadow-2xl"
        style={{ animation: 'slidein 200ms ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`@keyframes slidein{from{transform:translateX(24px);opacity:.6}to{transform:translateX(0);opacity:1}}`}</style>

        <div className="flex items-center justify-between border-b border-slate-200 bg-surface px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">Create a post</h2>
          <button onClick={closeComposer} aria-label="Close composer" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Networks */}
          <p className="mb-2 text-sm font-medium text-slate-700">Publish to</p>
          <div className="mb-4 flex flex-wrap gap-2">
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

          {/* Editor */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            placeholder="What do you want to share?"
            className="w-full resize-none rounded-lg border border-slate-200 bg-surface p-3 text-sm outline-none focus:border-accent"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as any)}
                className="rounded-lg border border-slate-200 bg-surface px-2 py-1.5 text-xs capitalize outline-none focus:border-accent"
              >
                {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <Button variant="secondary" size="sm" onClick={() => setContent((c) => (c ? c + '\n\n' : '') + aiCaption('your update', tone))}>
                <Sparkles className="h-4 w-4 text-accent-deep" /> AI Caption
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setContent((c) => c.trimEnd() + '\n\n' + aiHashtags(content).join(' '))}>
                <Hash className="h-4 w-4 text-accent-deep" /> Hashtags
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setIdeas(IDEAS(content))}>
                <Lightbulb className="h-4 w-4 text-accent-deep" /> Ideas
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleMediaSelect}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={media.length >= MAX_MEDIA}
              >
                <ImageIcon className="h-4 w-4" /> Media{media.length > 0 ? ` (${media.length})` : ''}
              </Button>
            </div>
            <span className={cn('text-sm', over ? 'text-negative' : 'text-slate-400')}>{content.length} / {minLimit}</span>
          </div>

          {media.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {media.map((src, i) => (
                <div key={i} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Attachment ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    onClick={() => removeMedia(i)}
                    aria-label={`Remove attachment ${i + 1}`}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {ideas.length > 0 && (
            <div className="mt-3 rounded-lg border border-slate-200 bg-surface p-3">
              <p className="mb-1.5 text-xs font-semibold text-slate-500">Content ideas — click to use</p>
              <div className="flex flex-col gap-1">
                {ideas.map((i) => (
                  <button key={i} onClick={() => setContent(i)} className="rounded px-2 py-1 text-left text-sm text-slate-700 hover:bg-accent-light">
                    {i}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Per-network preview */}
          {selected.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 flex items-center gap-2">
                <p className="text-sm font-medium text-slate-700">Preview</p>
                <div className="flex gap-1">
                  {selected.map((n) => (
                    <button
                      key={n}
                      onClick={() => setPreviewNet(n)}
                      className={cn('rounded-md p-1', previewNet === n ? 'ring-2 ring-accent' : 'opacity-60 hover:opacity-100')}
                    >
                      <NetworkChip type={n} size={22} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-surface p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: previewMeta.color }}>
                    {initials('Social Hub')}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">SocialHub <span className="font-normal text-slate-400">· {previewMeta.label}</span></p>
                    <p className="text-xs text-slate-400">Just now</p>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{previewText || 'Your post preview appears here…'}</p>
                {media.length > 0 ? (
                  <div className={cn('mt-3 grid gap-1', media.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
                    {media.map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={src} alt={`Attachment ${i + 1}`} className="h-40 w-full rounded-lg object-cover" />
                    ))}
                  </div>
                ) : previewNet === 'instagram' && (
                  <div className="mt-3 flex h-40 items-center justify-center rounded-lg bg-gradient-to-br from-accent-light to-accent/10 text-xs text-slate-400">
                    image / carousel
                  </div>
                )}
                <div className="mt-3 flex gap-5 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><Heart className="h-4 w-4" /> Like</span>
                  <span className="flex items-center gap-1"><MessageCircle className="h-4 w-4" /> Comment</span>
                  <span className="flex items-center gap-1"><Repeat2 className="h-4 w-4" /> Share</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex flex-col gap-3 border-t border-slate-200 bg-surface px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="rounded-lg border border-slate-200 bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => submit('draft')}>Save draft</Button>
            <Button variant="secondary" onClick={() => submit('schedule')} disabled={!when || over}>
              <Calendar className="h-4 w-4" /> Schedule
            </Button>
            <Button onClick={() => submit('publish')} disabled={over}>
              <Send className="h-4 w-4" /> Publish
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Card, CardHeader, PageHeader, Button, Badge, NetworkChip } from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';
import { toast } from '@/components/Toast';
import { api } from '@/lib/api';
import { cn, NETWORK_META } from '@/lib/utils';
import type { NetworkType } from '@/lib/types';
import { Sparkles, Wand2, Send, Copy, Loader2 } from 'lucide-react';

const TONES = ['professional', 'casual', 'playful', 'bold'] as const;
const NETWORKS: NetworkType[] = ['twitter', 'linkedin', 'instagram', 'facebook', 'tiktok'];

type GenPost = { content: string; networks: string[] };

export default function AiStudioPage() {
  const [brief, setBrief] = useState('');
  const [tone, setTone] = useState<(typeof TONES)[number]>('professional');
  const [count, setCount] = useState(5);
  const [nets, setNets] = useState<NetworkType[]>(['twitter', 'linkedin']);
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState<GenPost[]>([]);
  const [provider, setProvider] = useState<string>('');
  const [usedMock, setUsedMock] = useState(false);

  const toggleNet = (n: NetworkType) =>
    setNets((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]));

  const generate = async () => {
    if (!brief.trim()) return toast.error('Describe your campaign first');
    if (nets.length === 0) return toast.error('Pick at least one network');
    setLoading(true);
    setPosts([]);
    try {
      const res = await api.aiCampaign(brief, count, tone, nets);
      setPosts(res.posts);
      setProvider(res.provider);
      setUsedMock(res.fallback);
      toast.success(`Generated ${res.posts.length} posts`);
    } catch {
      toast.error('Generation failed — is the API reachable?');
    } finally {
      setLoading(false);
    }
  };

  const scheduleOne = async (p: GenPost) => {
    try {
      await api.createPost({ content: p.content, networks: p.networks, status: 'draft' });
      toast.success('Saved to drafts ✓');
    } catch {
      toast.error('Could not save — API unreachable');
    }
  };

  const scheduleAll = async () => {
    try {
      await Promise.allSettled(posts.map((p) => api.createPost({ content: p.content, networks: p.networks, status: 'draft' })));
      toast.success(`${posts.length} posts saved to drafts ✓`);
    } catch {
      toast.error('Some posts could not be saved');
    }
  };

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text);
    toast.info('Copied to clipboard');
  };

  return (
    <div>
      <PageHeader
        title="AI Studio"
        subtitle="Turn one brief into a whole campaign — ready to review, edit and schedule."
        action={<Badge color="purple"><Sparkles className="mr-1 inline h-3 w-3" /> AI-powered</Badge>}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Brief panel */}
        <Card className="h-fit lg:col-span-1">
          <CardHeader title="Campaign brief" subtitle="What should this campaign be about?" />
          <div className="space-y-4 p-5">
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={4}
              placeholder="e.g. Launch of our new AI caption generator — highlight time saved and ease of use."
              className="w-full resize-none rounded-lg border border-slate-200 bg-surface p-3 text-sm outline-none focus:border-accent"
            />

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">Tone</label>
              <div className="flex flex-wrap gap-1.5">
                {TONES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium capitalize',
                      tone === t ? 'border-accent bg-accent-light text-accent-deep' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">How many posts</label>
              <input
                type="range"
                min={1}
                max={12}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full accent-accent"
              />
              <p className="text-xs text-slate-400">{count} posts</p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">Publish to</label>
              <div className="flex flex-wrap gap-1.5">
                {NETWORKS.map((n) => (
                  <button
                    key={n}
                    onClick={() => toggleNet(n)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium',
                      nets.includes(n) ? 'border-accent bg-accent-light text-accent-deep' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    <NetworkChip type={n} size={16} /> {NETWORK_META[n].label}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={generate} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {loading ? 'Generating…' : 'Generate campaign'}
            </Button>
          </div>
        </Card>

        {/* Results panel */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Generated posts"
              subtitle={posts.length ? `${posts.length} posts${usedMock ? ' · offline generator' : provider ? ` · via ${provider}` : ''}` : 'Your campaign will appear here'}
              action={posts.length > 0 ? <Button size="sm" onClick={scheduleAll}><Send className="h-4 w-4" /> Save all to drafts</Button> : undefined}
            />
            {loading && (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-accent-deep" />
                <p className="text-sm">Writing your campaign…</p>
              </div>
            )}
            {!loading && posts.length === 0 && (
              <EmptyState icon={Sparkles} title="No campaign yet" message="Write a brief on the left and hit Generate to get a batch of ready-to-schedule posts." />
            )}
            {!loading && posts.length > 0 && (
              <div className="divide-y divide-slate-100">
                {posts.map((p, i) => (
                  <div key={i} className="flex items-start gap-4 px-5 py-4">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-light text-xs font-bold text-accent-deep">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-wrap text-sm text-slate-700">{p.content}</p>
                      <div className="mt-2 flex -space-x-1.5">
                        {p.networks.map((n) => <NetworkChip key={n} type={n as NetworkType} size={18} />)}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => copy(p.content)} aria-label="Copy" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                        <Copy className="h-4 w-4" />
                      </button>
                      <Button variant="secondary" size="sm" onClick={() => scheduleOne(p)}>Save</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

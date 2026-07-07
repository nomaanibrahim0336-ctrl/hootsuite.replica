'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, PageHeader, Button, Badge, Avatar } from '@/components/ui';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { api } from '@/lib/api';
import type { AdvocacyContent, AdvocacyLeader } from '@/lib/types';
import { formatNumber, cn } from '@/lib/utils';
import { toast } from '@/components/Toast';
import { Megaphone, Share2, Trophy, Users, TrendingUp, Medal, Plus, Pencil, Trash2 } from 'lucide-react';

type Draft = { title: string; body: string; category: string };
const EMPTY_DRAFT: Draft = { title: '', body: '', category: 'General' };

export default function AmplifyPage() {
  const [shared, setShared] = useState<Record<string, boolean>>({});
  const [advocacyContent, setAdvocacyContent] = useState<AdvocacyContent[]>([]);
  const [advocacyLeaderboard, setAdvocacyLeaderboard] = useState<AdvocacyLeader[]>([]);
  const [advocacyStats, setAdvocacyStats] = useState({ totalShares: 0, totalReach: 0, activeAdvocates: 0 });

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [contentRes, analyticsRes] = await Promise.all([api.getAdvocacyContent(), api.getAdvocacyAnalytics()]);
        if (cancelled) return;
        setAdvocacyContent(contentRes ?? []);
        setAdvocacyLeaderboard(analyticsRes?.leaderboard ?? []);
        setAdvocacyStats({
          totalShares: analyticsRes?.totalShares ?? 0,
          totalReach: analyticsRes?.totalReach ?? 0,
          activeAdvocates: analyticsRes?.leaderboard?.length ?? 0,
        });
      } catch {
        if (cancelled) return;
        toast.error('Live API unreachable — advocacy hub is empty.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const share = (id: string, title: string) => {
    setShared((s) => ({ ...s, [id]: true }));
    toast.success(`Shared "${title}" to your networks 🎉`);
    api.shareAdvocacyContent(id, {}).catch(() => {
      // API unreachable — local share state stands as the offline result.
    });
  };

  const startCreate = () => { setCreating(true); setEditingId(null); setDraft(EMPTY_DRAFT); };
  const startEdit = (c: AdvocacyContent) => {
    setEditingId(c.id); setCreating(false);
    setDraft({ title: c.title, body: c.body, category: c.category });
  };
  const cancelForm = () => { setCreating(false); setEditingId(null); setDraft(EMPTY_DRAFT); };

  const submitForm = async () => {
    if (!draft.title.trim() || !draft.body.trim()) return toast.error('Title and body are required');
    setBusy(true);
    try {
      if (editingId) {
        const updated = await api.updateAdvocacyContent(editingId, draft);
        setAdvocacyContent((list) => list.map((c) => (c.id === editingId ? { ...c, ...updated } : c)));
        toast.success('Content updated');
      } else {
        const created = await api.createAdvocacyContent(draft);
        setAdvocacyContent((list) => [{ ...created, shareCount: 0 }, ...list]);
        toast.success('Content added');
      }
      cancelForm();
    } catch (e: any) {
      toast.error(e?.message || 'Could not save — you may not have permission (admin only).');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    try {
      await api.deleteAdvocacyContent(id);
      setAdvocacyContent((list) => list.filter((c) => c.id !== id));
      toast.success('Content deleted');
    } catch (e: any) {
      toast.error(e?.message || 'Could not delete — you may not have permission (admin only).');
    }
  };

  const medal = ['#FFB81C', '#B0B8C4', '#CD7F32'];

  return (
    <div>
      <PageHeader
        title="Amplify"
        subtitle="Share pre-approved brand content and climb the leaderboard."
        action={<Button onClick={startCreate}><Plus className="h-4 w-4" /> New content</Button>}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Total shares', value: advocacyStats.totalShares, icon: Share2 },
          { label: 'Total reach', value: advocacyStats.totalReach, icon: TrendingUp },
          { label: 'Active advocates', value: advocacyStats.activeAdvocates, icon: Users },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="flex items-center gap-4 p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-accent-light to-accent/20">
              <Icon className="h-5 w-5 text-accent-deep" />
            </span>
            <div>
              <p className="text-sm text-slate-500">{label}</p>
              <p className="text-2xl font-bold text-slate-900">{formatNumber(value)}</p>
            </div>
          </Card>
        ))}
      </div>

      {(creating || editingId) && (
        <Card className="mt-6 p-5">
          <p className="mb-3 text-sm font-semibold text-slate-700">{editingId ? 'Edit content' : 'New content'}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Title"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <input
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              placeholder="Category (e.g. Product)"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <textarea
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            rows={3}
            placeholder="Post body employees can share…"
            className="mt-3 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={cancelForm}>Cancel</Button>
            <Button size="sm" onClick={submitForm} disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Add content'}</Button>
          </div>
        </Card>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Content hub */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="Content hub" subtitle="Brand-approved posts ready to share" />
            <div className="divide-y divide-slate-100">
              {advocacyContent.map((c) => (
                <div key={c.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-800">{c.title}</p>
                      <Badge>{c.category}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">{c.body}</p>
                    <p className="mt-1 text-xs text-slate-400">{c.shareCount + (shared[c.id] ? 1 : 0)} shares</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={shared[c.id] ? 'secondary' : 'primary'}
                      size="sm"
                      onClick={() => share(c.id, c.title)}
                      disabled={shared[c.id]}
                    >
                      <Share2 className="h-4 w-4" /> {shared[c.id] ? 'Shared' : 'Share'}
                    </Button>
                    <button
                      onClick={() => startEdit(c)}
                      aria-label="Edit content"
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteId(c.id)}
                      aria-label="Delete content"
                      className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-negative"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              {advocacyContent.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-slate-400">No content yet. Click "New content" to add the first post.</p>
              )}
            </div>
          </Card>
        </div>

        {/* Leaderboard */}
        <Card className="h-fit">
          <CardHeader title="Leaderboard" subtitle="Top advocates by reach" action={<Trophy className="h-5 w-5 text-accent-deep" />} />
          <div className="divide-y divide-slate-100">
            {advocacyLeaderboard.map((l, i) => (
              <div key={l.name} className="flex items-center gap-3 px-5 py-3">
                <span
                  className={cn('flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold', i < 3 ? 'text-white' : 'bg-slate-100 text-slate-500')}
                  style={i < 3 ? { background: medal[i] } : undefined}
                >
                  {i < 3 ? <Medal className="h-4 w-4" /> : i + 1}
                </span>
                <Avatar name={l.name} size={32} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{l.name}</p>
                  <p className="text-xs text-slate-400">{l.shares} shares</p>
                </div>
                <span className="text-sm font-semibold text-slate-700">{formatNumber(l.reach)}</span>
              </div>
            ))}
            {advocacyLeaderboard.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-slate-400">No shares yet.</p>
            )}
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete content?"
        message="This removes the post from the content hub for everyone. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

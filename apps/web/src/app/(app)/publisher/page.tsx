'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, PageHeader, Button, Badge, NetworkChip } from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toast } from '@/components/Toast';
import { posts as seedPosts } from '@/lib/mock';
import { api } from '@/lib/api';
import { useUiStore } from '@/lib/ui-store';
import { cn } from '@/lib/utils';
import type { Post, PostStatus } from '@/lib/types';
import { Plus, Trash2, CheckCircle2, XCircle, Clock, Send, FileText, Inbox as InboxIcon } from 'lucide-react';
import { format } from 'date-fns';

const statusColor: Record<PostStatus, string> = {
  draft: 'slate',
  scheduled: 'blue',
  published: 'green',
  failed: 'red',
};
const approvalColor: Record<string, string> = { pending: 'amber', approved: 'green', rejected: 'red', none: 'slate' };

export default function PublisherPage() {
  const openComposer = useUiStore((s) => s.openComposer);
  const [list, setList] = useState<Post[]>(seedPosts);
  const [filter, setFilter] = useState<'all' | PostStatus>('all');
  const [toDelete, setToDelete] = useState<Post | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getPosts();
        if (!cancelled && res?.length) setList(res);
      } catch {
        // Live API unreachable — keep mock data so the page still renders.
        toast.info('Showing demo data — live API unreachable.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const pending = list.filter((p) => p.approvalStatus === 'pending');
  const filtered = filter === 'all' ? list : list.filter((p) => p.status === filter);

  const setApproval = async (id: string, approvalStatus: Post['approvalStatus']) => {
    setList((l) => l.map((p) => (p.id === id ? { ...p, approvalStatus } : p)));
    toast.success(approvalStatus === 'approved' ? 'Post approved ✓' : 'Post rejected');
    try {
      await (approvalStatus === 'approved' ? api.approvePost(id) : api.rejectPost(id));
    } catch {
      // API unreachable — local state change stands as the offline result.
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const id = toDelete.id;
    setList((l) => l.filter((p) => p.id !== id));
    toast.success('Post deleted');
    setToDelete(null);
    try {
      await api.deletePost(id);
    } catch {
      // API unreachable — local removal stands as the offline result.
    }
  };

  return (
    <div>
      <PageHeader
        title="Publisher"
        subtitle="Compose, schedule and manage content across all your networks."
        action={<Button onClick={openComposer}><Plus className="h-4 w-4" /> New Post</Button>}
      />

      {/* Approvals queue */}
      {pending.length > 0 && (
        <Card className="mb-6 border-amber-200">
          <CardHeader title="Pending approvals" subtitle={`${pending.length} post${pending.length > 1 ? 's' : ''} awaiting review`} />
          <div className="divide-y divide-slate-100">
            {pending.map((p) => (
              <div key={p.id} className="flex items-start gap-4 px-5 py-4">
                <div className="flex -space-x-1.5 pt-0.5">
                  {p.networks.map((n) => <NetworkChip key={n} type={n} size={24} />)}
                </div>
                <p className="flex-1 text-sm text-slate-700">{p.content}</p>
                <Button variant="secondary" size="sm" onClick={() => setApproval(p.id, 'rejected')}>
                  <XCircle className="h-4 w-4 text-negative" /> Reject
                </Button>
                <Button size="sm" onClick={() => setApproval(p.id, 'approved')}>
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Posts list */}
      <Card>
        <CardHeader
          title="Your posts"
          action={
            <div className="flex flex-wrap gap-1">
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
                {p.networks.map((n) => <NetworkChip key={n} type={n} size={24} />)}
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-700">{p.content}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                  <Clock className="h-3 w-3" />
                  {p.status === 'scheduled' && p.scheduledAt && `Scheduled for ${format(new Date(p.scheduledAt), 'MMM d, h:mm a')}`}
                  {p.status === 'published' && p.publishedAt && `Published ${format(new Date(p.publishedAt), 'MMM d, h:mm a')}`}
                  {p.status === 'draft' && 'Draft'}
                  {p.status === 'failed' && 'Failed to publish — reconnect account'}
                </p>
              </div>
              {p.approvalStatus && p.approvalStatus !== 'none' && (
                <Badge color={approvalColor[p.approvalStatus]}>{p.approvalStatus}</Badge>
              )}
              <Badge color={statusColor[p.status]}>{p.status}</Badge>
              <button
                onClick={() => setToDelete(p)}
                aria-label="Delete post"
                className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-negative"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <EmptyState
              icon={filter === 'all' ? FileText : InboxIcon}
              title="No posts here yet"
              message={filter === 'all' ? 'Create your first post to get started.' : `You have no ${filter} posts.`}
              action={<Button onClick={openComposer}><Send className="h-4 w-4" /> Compose a post</Button>}
            />
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete this post?"
        message="This action cannot be undone. The post will be permanently removed."
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

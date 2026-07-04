'use client';

import { useEffect, useState } from 'react';
import { Card, PageHeader, Badge, NetworkChip, Avatar, Button } from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';
import { toast } from '@/components/Toast';
import { messages as seed, savedReplies as seedSavedReplies } from '@/lib/mock';
import { api } from '@/lib/api';
import { cn, SENTIMENT_META, NETWORK_META } from '@/lib/utils';
import type { Message, MessageStatus } from '@/lib/types';
import { formatDistanceToNow, format } from 'date-fns';
import { Send, UserPlus, CheckCircle2, Inbox as InboxIcon, StickyNote, Tag, Clock } from 'lucide-react';

const filters: (MessageStatus | 'all')[] = ['all', 'unread', 'assigned', 'resolved'];

export default function InboxPage() {
  const [list, setList] = useState<Message[]>([]);
  const [savedReplies, setSavedReplies] = useState<typeof seedSavedReplies>([]);
  const [filter, setFilter] = useState<(typeof filters)[number]>('all');
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const [reply, setReply] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [messagesRes, repliesRes] = await Promise.all([api.getInbox(), api.getSavedReplies()]);
        if (cancelled) return;
        setList(messagesRes ?? []);
        setActiveId(messagesRes?.[0]?.id);
        setSavedReplies(repliesRes ?? []);
      } catch {
        if (cancelled) return;
        // Live API unreachable — fall back to demo data so the inbox still renders.
        setList(seed);
        setActiveId(seed[0]?.id);
        setSavedReplies(seedSavedReplies);
        toast.info('Showing demo data — live API unreachable.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = filter === 'all' ? list : list.filter((m) => m.status === filter);
  const active = list.find((m) => m.id === activeId) ?? filtered[0];

  const update = (id: string, patch: Partial<Message>) =>
    setList((l) => l.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const select = (m: Message) => {
    setActiveId(m.id);
    if (!m.isRead) {
      update(m.id, { isRead: true });
      api.markMessageRead(m.id).catch(() => {
        // API unreachable — local read state stands as the offline result.
      });
    }
  };

  const sendReply = () => {
    if (!reply.trim() || !active) return;
    const content = reply;
    update(active.id, {
      status: 'resolved',
      thread: [...active.thread, { id: 'r' + Date.now(), content, isFromUs: true, timestamp: new Date().toISOString() }],
    });
    setReply('');
    toast.success('Reply sent');
    api.replyMessage(active.id, content).catch(() => {
      // API unreachable — local reply stands as the offline result.
    });
  };

  return (
    <div>
      <PageHeader title="Unified Inbox" subtitle="All your messages, comments and mentions in one place." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-4">
        {/* Column 1: conversation list */}
        <Card className="xl:col-span-1">
          <div className="flex gap-1 border-b border-slate-100 p-2">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn('flex-1 rounded-md px-2 py-1.5 text-sm font-medium capitalize', filter === f ? 'bg-accent-light text-accent-deep' : 'text-slate-500 hover:bg-slate-100')}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="max-h-[34rem] divide-y divide-slate-100 overflow-y-auto">
            {filtered.map((m) => (
              <button
                key={m.id}
                onClick={() => select(m)}
                className={cn('flex w-full gap-3 px-4 py-3 text-left transition', active?.id === m.id ? 'bg-accent-light/50' : 'hover:bg-slate-50')}
              >
                <div className="relative">
                  <Avatar name={m.sender.name} size={38} />
                  <span className="absolute -bottom-1 -right-1"><NetworkChip type={m.network} size={18} /></span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className={cn('truncate text-sm', m.isRead ? 'font-medium text-slate-700' : 'font-bold text-slate-900')}>{m.sender.name}</p>
                    <span className="ml-2 shrink-0 text-[11px] text-slate-400">{formatDistanceToNow(new Date(m.timestamp))}</span>
                  </div>
                  <p className="truncate text-sm text-slate-500">{m.content}</p>
                </div>
                {!m.isRead && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" />}
              </button>
            ))}
            {filtered.length === 0 && <EmptyState icon={InboxIcon} title="Inbox zero!" message="No messages in this view." />}
          </div>
        </Card>

        {/* Column 2: conversation thread */}
        <Card className="flex flex-col lg:col-span-1 xl:col-span-2">
          {active ? (
            <>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-3">
                  <Avatar name={active.sender.name} />
                  <div>
                    <p className="font-semibold text-slate-800">{active.sender.name}</p>
                    <p className="text-xs text-slate-400">{active.sender.username} · {active.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={active.sentiment === 'positive' ? 'green' : active.sentiment === 'negative' ? 'red' : 'slate'}>{SENTIMENT_META[active.sentiment].label}</Badge>
                  <Badge color={active.status === 'resolved' ? 'green' : active.status === 'assigned' ? 'blue' : 'amber'}>{active.status}</Badge>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-5">
                <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-2.5 text-sm text-slate-700">{active.content}</div>
                {active.thread.map((r) => (
                  <div key={r.id} className={cn('max-w-[80%] rounded-2xl px-4 py-2.5 text-sm', r.isFromUs ? 'ml-auto rounded-tr-sm bg-accent text-accent-ink' : 'rounded-tl-sm bg-slate-100 text-slate-700')}>{r.content}</div>
                ))}
              </div>

              <div className="border-t border-slate-100 px-5 py-2">
                <div className="flex flex-wrap gap-2">
                  {savedReplies.map((sr) => (
                    <button key={sr.id} onClick={() => setReply(sr.content)} className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:border-accent hover:text-accent-deep">{sr.title}</button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 border-t border-slate-100 p-3">
                <Button variant="ghost" size="sm" onClick={() => { update(active.id, { status: 'assigned', assignedTo: 'Sarah Lee' }); toast.info('Assigned to Sarah Lee'); api.assignMessage(active.id, 'Sarah Lee').catch(() => {}); }}>
                  <UserPlus className="h-4 w-4" /> <span className="hidden sm:inline">Assign</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { update(active.id, { status: 'resolved' }); toast.success('Marked resolved'); }}>
                  <CheckCircle2 className="h-4 w-4" /> <span className="hidden sm:inline">Resolve</span>
                </Button>
                <input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendReply()} placeholder="Type a reply…" className="flex-1 rounded-lg border border-slate-200 bg-surface px-3 py-2 text-sm outline-none focus:border-accent" />
                <Button onClick={sendReply}><Send className="h-4 w-4" /></Button>
              </div>
            </>
          ) : (
            <EmptyState icon={InboxIcon} title="Select a message" message="Choose a conversation to view the thread." />
          )}
        </Card>

        {/* Column 3: customer profile */}
        {active && (
          <Card className="h-fit lg:col-span-2 xl:col-span-1">
            <div className="flex flex-col items-center border-b border-slate-100 px-5 py-6 text-center">
              <Avatar name={active.sender.name} size={64} />
              <p className="mt-3 font-semibold text-slate-800">{active.sender.name}</p>
              <p className="text-xs text-slate-400">{active.sender.username}</p>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                <NetworkChip type={active.network} size={16} /> {NETWORK_META[active.network].label}
              </div>
            </div>
            <div className="space-y-3 px-5 py-4 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Customer since</span><span className="font-medium text-slate-700">Mar 2025</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Conversations</span><span className="font-medium text-slate-700">{active.thread.length + 3}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Sentiment</span><span className="font-medium" style={{ color: SENTIMENT_META[active.sentiment].color }}>{SENTIMENT_META[active.sentiment].label}</span></div>
              <div className="flex items-center gap-2 text-xs text-slate-400"><Clock className="h-3.5 w-3.5" /> Last seen {formatDistanceToNow(new Date(active.timestamp), { addSuffix: true })}</div>
            </div>
            <div className="border-t border-slate-100 px-5 py-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Tag className="h-3.5 w-3.5" /> Tags</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge color="purple">VIP</Badge>
                <Badge>Returning</Badge>
                <Badge color="blue">{active.type}</Badge>
              </div>
            </div>
            <div className="border-t border-slate-100 px-5 py-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><StickyNote className="h-3.5 w-3.5" /> Internal note</p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => note && toast.info('Note saved')}
                rows={3}
                placeholder="Add a private note (team only)…"
                className="w-full resize-none rounded-lg border border-slate-200 bg-surface p-2 text-sm outline-none focus:border-accent"
              />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

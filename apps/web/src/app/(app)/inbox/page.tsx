'use client';

import { useState } from 'react';
import { Card, CardHeader, PageHeader, Badge, NetworkChip, Avatar, Button } from '@/components/ui';
import { messages as seed, savedReplies } from '@/lib/mock';
import { cn, SENTIMENT_META } from '@/lib/utils';
import type { Message, MessageStatus } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { Send, UserPlus, CheckCircle2 } from 'lucide-react';

const filters: (MessageStatus | 'all')[] = ['all', 'unread', 'assigned', 'resolved'];

export default function InboxPage() {
  const [list, setList] = useState<Message[]>(seed);
  const [filter, setFilter] = useState<(typeof filters)[number]>('all');
  const [activeId, setActiveId] = useState(seed[0].id);
  const [reply, setReply] = useState('');

  const filtered = filter === 'all' ? list : list.filter((m) => m.status === filter);
  const active = list.find((m) => m.id === activeId) ?? filtered[0];

  const update = (id: string, patch: Partial<Message>) =>
    setList((l) => l.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const select = (m: Message) => {
    setActiveId(m.id);
    if (!m.isRead) update(m.id, { isRead: true, status: m.status === 'unread' ? 'assigned' : m.status });
  };

  const sendReply = () => {
    if (!reply.trim() || !active) return;
    update(active.id, {
      status: 'resolved',
      thread: [...active.thread, { id: 'r' + Date.now(), content: reply, isFromUs: true, timestamp: new Date().toISOString() }],
    });
    setReply('');
  };

  return (
    <div>
      <PageHeader title="Unified Inbox" subtitle="All your messages, comments and mentions in one place." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* List */}
        <Card className="lg:col-span-1">
          <div className="flex gap-1 border-b border-slate-100 p-2">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'flex-1 rounded-md px-2 py-1.5 text-sm font-medium capitalize',
                  filter === f ? 'bg-accent-light text-accent' : 'text-slate-500 hover:bg-slate-100'
                )}
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
                className={cn(
                  'flex w-full gap-3 px-4 py-3 text-left transition',
                  active?.id === m.id ? 'bg-accent-light/50' : 'hover:bg-slate-50'
                )}
              >
                <div className="relative">
                  <Avatar name={m.sender.name} size={38} />
                  <span className="absolute -bottom-1 -right-1">
                    <NetworkChip type={m.network} size={18} />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className={cn('truncate text-sm', m.isRead ? 'font-medium text-slate-700' : 'font-bold text-slate-900')}>
                      {m.sender.name}
                    </p>
                    <span className="ml-2 shrink-0 text-[11px] text-slate-400">
                      {formatDistanceToNow(new Date(m.timestamp), { addSuffix: false })}
                    </span>
                  </div>
                  <p className="truncate text-sm text-slate-500">{m.content}</p>
                </div>
                {!m.isRead && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" />}
              </button>
            ))}
          </div>
        </Card>

        {/* Detail */}
        <Card className="lg:col-span-2 flex flex-col">
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
                  <Badge color={active.sentiment === 'positive' ? 'green' : active.sentiment === 'negative' ? 'red' : 'slate'}>
                    {SENTIMENT_META[active.sentiment].label}
                  </Badge>
                  <Badge color={active.status === 'resolved' ? 'green' : active.status === 'assigned' ? 'blue' : 'amber'}>
                    {active.status}
                  </Badge>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-5">
                <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-2.5 text-sm text-slate-700">
                  {active.content}
                </div>
                {active.thread.map((r) => (
                  <div
                    key={r.id}
                    className={cn(
                      'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm',
                      r.isFromUs ? 'ml-auto rounded-tr-sm bg-accent text-white' : 'rounded-tl-sm bg-slate-100 text-slate-700'
                    )}
                  >
                    {r.content}
                  </div>
                ))}
              </div>

              {/* Saved replies */}
              <div className="border-t border-slate-100 px-5 py-2">
                <div className="flex flex-wrap gap-2">
                  {savedReplies.map((sr) => (
                    <button
                      key={sr.id}
                      onClick={() => setReply(sr.content)}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:border-accent hover:text-accent"
                    >
                      {sr.title}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 border-t border-slate-100 p-3">
                <Button variant="ghost" size="sm" onClick={() => update(active.id, { status: 'assigned', assignedTo: 'Sarah Lee' })}>
                  <UserPlus className="h-4 w-4" /> Assign
                </Button>
                <Button variant="ghost" size="sm" onClick={() => update(active.id, { status: 'resolved' })}>
                  <CheckCircle2 className="h-4 w-4" /> Resolve
                </Button>
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendReply()}
                  placeholder="Type a reply…"
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
                />
                <Button onClick={sendReply}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <p className="p-10 text-center text-sm text-slate-400">Select a message.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  format, isSameMonth, isSameDay, addMonths, subMonths, addWeeks, subWeeks, setHours,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Card, PageHeader, Button, NetworkChip } from '@/components/ui';
import { posts as seedPosts } from '@/lib/mock';
import { api } from '@/lib/api';
import { useUiStore } from '@/lib/ui-store';
import { toast } from '@/components/Toast';
import { cn } from '@/lib/utils';
import type { Post } from '@/lib/types';

export default function CalendarPage() {
  const openComposer = useUiStore((s) => s.openComposer);
  const [cursor, setCursor] = useState(new Date());
  const [view, setView] = useState<'month' | 'week'>('month');
  const [list, setList] = useState<Post[]>(seedPosts);
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getPosts();
        if (!cancelled && res?.length) setList(res);
      } catch {
        // Live API unreachable — keep mock data so the planner still renders.
        toast.info('Showing demo data — live API unreachable.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const scheduled = list.filter((p) => p.scheduledAt || p.publishedAt);

  const days =
    view === 'month'
      ? eachDayOfInterval({ start: startOfWeek(startOfMonth(cursor)), end: endOfWeek(endOfMonth(cursor)) })
      : eachDayOfInterval({ start: startOfWeek(cursor), end: endOfWeek(cursor) });

  const postsFor = (d: Date) =>
    scheduled.filter((p) => {
      const dt = p.scheduledAt || p.publishedAt;
      return dt && isSameDay(new Date(dt), d);
    });

  const move = (day: Date) => {
    if (!dragId) return;
    const id = dragId;
    let nextIso = '';
    setList((l) =>
      l.map((p) => {
        if (p.id !== id) return p;
        const prev = p.scheduledAt ? new Date(p.scheduledAt) : setHours(day, 10);
        const next = setHours(day, prev.getHours());
        nextIso = next.toISOString();
        return { ...p, scheduledAt: nextIso, status: p.status === 'published' ? p.status : 'scheduled' };
      })
    );
    toast.success(`Rescheduled to ${format(day, 'MMM d')}`);
    setDragId(null);
    if (nextIso) {
      api.schedulePost(id, nextIso).catch(() => {
        // API unreachable — local reschedule stands as the offline result.
      });
    }
  };

  const step = (dir: 1 | -1) =>
    setCursor((c) => (view === 'month' ? (dir === 1 ? addMonths(c, 1) : subMonths(c, 1)) : dir === 1 ? addWeeks(c, 1) : subWeeks(c, 1)));

  return (
    <div>
      <PageHeader
        title="Planner"
        subtitle="Drag posts to reschedule. Plan your week or month at a glance."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 p-0.5">
              {(['month', 'week'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn('rounded-md px-3 py-1 text-sm font-medium capitalize', view === v ? 'bg-accent-light text-accent-deep' : 'text-slate-500')}
                >
                  {v}
                </button>
              ))}
            </div>
            <Button variant="secondary" size="sm" onClick={() => step(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="min-w-[9rem] text-center font-semibold text-slate-800">{format(cursor, view === 'month' ? 'MMMM yyyy' : "'Week of' MMM d")}</span>
            <Button variant="secondary" size="sm" onClick={() => step(1)}><ChevronRight className="h-4 w-4" /></Button>
            <Button variant="secondary" size="sm" onClick={() => setCursor(new Date())}>Today</Button>
            <Button size="sm" onClick={openComposer}><Plus className="h-4 w-4" /> New</Button>
          </div>
        }
      />

      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 text-center text-xs font-semibold uppercase text-slate-500">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayPosts = postsFor(day);
            const inMonth = view === 'week' || isSameMonth(day, cursor);
            const today = isSameDay(day, new Date());
            return (
              <div
                key={day.toISOString()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => move(day)}
                className={cn(
                  'border-b border-r border-slate-100 p-1.5 transition-colors',
                  view === 'month' ? 'min-h-[7rem]' : 'min-h-[16rem]',
                  !inMonth && 'bg-slate-50/60',
                  dragId && 'hover:bg-accent-light/40'
                )}
              >
                <div className="mb-1 flex justify-end">
                  <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs', today ? 'bg-accent font-semibold text-accent-ink' : inMonth ? 'text-slate-600' : 'text-slate-300')}>
                    {format(day, 'd')}
                  </span>
                </div>
                <div className="space-y-1">
                  {dayPosts.slice(0, view === 'month' ? 3 : 8).map((p) => (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={() => setDragId(p.id)}
                      onDragEnd={() => setDragId(null)}
                      className={cn(
                        'flex cursor-grab items-center gap-1 rounded-md px-1.5 py-1 text-[11px] active:cursor-grabbing',
                        p.status === 'published' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-accent-light text-accent-deep',
                        dragId === p.id && 'opacity-40'
                      )}
                      title={p.content}
                    >
                      {p.networks[0] && <NetworkChip type={p.networks[0]} size={14} />}
                      <span className="truncate">{p.content}</span>
                    </div>
                  ))}
                  {dayPosts.length > (view === 'month' ? 3 : 8) && (
                    <p className="px-1 text-[10px] text-slate-400">+{dayPosts.length - (view === 'month' ? 3 : 8)} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

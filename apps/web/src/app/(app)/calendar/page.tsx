'use client';

import { useState } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, PageHeader, Button, NetworkChip } from '@/components/ui';
import { posts } from '@/lib/mock';
import { cn } from '@/lib/utils';

export default function CalendarPage() {
  const [cursor, setCursor] = useState(new Date());

  const scheduled = posts.filter((p) => p.scheduledAt || p.publishedAt);
  const monthStart = startOfMonth(cursor);
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart),
    end: endOfWeek(endOfMonth(cursor)),
  });

  const postsFor = (d: Date) =>
    scheduled.filter((p) => {
      const dt = p.scheduledAt || p.publishedAt;
      return dt && isSameDay(new Date(dt), d);
    });

  return (
    <div>
      <PageHeader
        title="Content Calendar"
        subtitle="Plan and visualize your publishing schedule."
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setCursor(subMonths(cursor, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[9rem] text-center font-semibold text-slate-800">
              {format(cursor, 'MMMM yyyy')}
            </span>
            <Button variant="secondary" size="sm" onClick={() => setCursor(addMonths(cursor, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setCursor(new Date())}>
              Today
            </Button>
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
            const inMonth = isSameMonth(day, cursor);
            const today = isSameDay(day, new Date());
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'min-h-[7rem] border-b border-r border-slate-100 p-1.5',
                  !inMonth && 'bg-slate-50/60'
                )}
              >
                <div className="mb-1 flex justify-end">
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs',
                      today ? 'bg-accent font-semibold text-accent-ink' : inMonth ? 'text-slate-600' : 'text-slate-300'
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                </div>
                <div className="space-y-1">
                  {dayPosts.slice(0, 3).map((p) => (
                    <div
                      key={p.id}
                      className={cn(
                        'flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px]',
                        p.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-accent-light text-accent-deep'
                      )}
                      title={p.content}
                    >
                      {p.networks[0] && <NetworkChip type={p.networks[0]} size={14} />}
                      <span className="truncate">{p.content}</span>
                    </div>
                  ))}
                  {dayPosts.length > 3 && (
                    <p className="px-1 text-[10px] text-slate-400">+{dayPosts.length - 3} more</p>
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

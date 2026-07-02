'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUiStore } from '@/lib/ui-store';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Send, CalendarDays, Inbox, Radio, BarChart2, Settings,
  Megaphone, Search, Moon, Plus,
} from 'lucide-react';

export function CommandPalette() {
  const router = useRouter();
  const { paletteOpen, setPalette, openComposer, toggleTheme } = useUiStore();
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);

  const commands = [
    { label: 'Go to Dashboard', icon: LayoutDashboard, run: () => router.push('/dashboard') },
    { label: 'Go to Publisher', icon: Send, run: () => router.push('/publisher') },
    { label: 'Go to Planner', icon: CalendarDays, run: () => router.push('/calendar') },
    { label: 'Go to Inbox', icon: Inbox, run: () => router.push('/inbox') },
    { label: 'Go to Listening', icon: Radio, run: () => router.push('/listening') },
    { label: 'Go to Analytics', icon: BarChart2, run: () => router.push('/analytics') },
    { label: 'Go to Amplify', icon: Megaphone, run: () => router.push('/amplify') },
    { label: 'Go to Settings', icon: Settings, run: () => router.push('/settings') },
    { label: 'Create a new post', icon: Plus, run: () => openComposer() },
    { label: 'Toggle dark mode', icon: Moon, run: () => toggleTheme() },
  ];

  const filtered = commands.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));

  // Global ⌘K / Ctrl-K listener.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette(!useUiStore.getState().paletteOpen);
      }
      if (e.key === 'Escape') setPalette(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPalette]);

  useEffect(() => { setI(0); }, [q]);
  if (!paletteOpen) return null;

  const exec = (idx: number) => {
    const c = filtered[idx];
    if (!c) return;
    c.run();
    setPalette(false);
    setQ('');
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center bg-black/40 pt-28" onClick={() => setPalette(false)}>
      <div
        className="w-full max-w-lg animate-pop-in overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-slate-100 px-4">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') setI((v) => Math.min(v + 1, filtered.length - 1));
              if (e.key === 'ArrowUp') setI((v) => Math.max(v - 1, 0));
              if (e.key === 'Enter') exec(i);
            }}
            placeholder="Type a command or search…"
            className="w-full bg-transparent py-3.5 text-sm outline-none"
          />
          <kbd className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-400">ESC</kbd>
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {filtered.map((c, idx) => {
            const Icon = c.icon;
            return (
              <button
                key={c.label}
                onMouseEnter={() => setI(idx)}
                onClick={() => exec(idx)}
                className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm', i === idx ? 'bg-accent-light text-accent-deep' : 'text-slate-700')}
              >
                <Icon className="h-4 w-4" /> {c.label}
              </button>
            );
          })}
          {filtered.length === 0 && <p className="px-3 py-6 text-center text-sm text-slate-400">No matching commands.</p>}
        </div>
      </div>
    </div>
  );
}

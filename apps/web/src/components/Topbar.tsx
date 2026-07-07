'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Bell, Plus, Sun, Moon, Menu, PauseCircle, PlayCircle } from 'lucide-react';
import { Avatar } from './ui';
import { currentUser } from '@/lib/mock';
import { useUiStore } from '@/lib/ui-store';
import { api } from '@/lib/api';
import { toast } from './Toast';
import { cn } from '@/lib/utils';

interface NotificationItem {
  id: string;
  action: string;
  entity: string;
  createdAt: string;
}

function describeAction(action: string, entity: string): string {
  const map: Record<string, string> = {
    'post.submit': 'A post was submitted for approval',
    'post.approve': 'A post was approved',
    'post.reject': 'A post was rejected',
    'team.invite': 'A new team member was invited',
    'team.update': 'A team member was updated',
    'team.remove': 'A team member was removed',
    'advocacy.create': 'New advocacy content was published',
    'advocacy.share': 'Advocacy content was shared',
    pause: 'Publishing was paused',
    resume: 'Publishing was resumed',
  };
  return map[action] || `${action.replace(/\./g, ' ')} · ${entity}`;
}

export function Topbar() {
  const router = useRouter();
  const { theme, toggleTheme, openComposer, setPalette, setMobileNav } = useUiStore();
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifError, setNotifError] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getPublishingStatus()
      .then((s) => setPaused(s.paused))
      .catch(() => {
        // API unreachable — assume publishing is active.
      });
  }, []);

  useEffect(() => {
    setLastSeen(typeof window !== 'undefined' ? localStorage.getItem('socialhub_notifs_seen') : null);
    api.getAudit()
      .then((rows) => setNotifications(rows.slice(0, 10).map((e: any) => ({ id: e.id, action: e.action, entity: e.entity, createdAt: e.createdAt }))))
      .catch(() => setNotifError(true));
  }, []);

  useEffect(() => {
    if (!notifOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [notifOpen]);

  const unreadCount = lastSeen ? notifications.filter((n) => n.createdAt > lastSeen).length : notifications.length;

  const toggleNotifications = () => {
    setNotifOpen((v) => !v);
    if (!notifOpen) {
      const now = new Date().toISOString();
      setLastSeen(now);
      if (typeof window !== 'undefined') localStorage.setItem('socialhub_notifs_seen', now);
    }
  };

  const togglePause = async () => {
    setBusy(true);
    const next = !paused;
    try {
      const res = next ? await api.pausePublishing() : await api.resumePublishing();
      setPaused(res.paused);
      toast[next ? 'info' : 'success'](
        next ? '⏸ Publishing paused — all scheduled posts are on hold.' : '▶ Publishing resumed.'
      );
    } catch {
      toast.error('Could not change publishing state — API unreachable');
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-surface/80 px-4 backdrop-blur sm:px-6">
      <div className="flex flex-1 items-center gap-2">
        <button
          onClick={() => setMobileNav(true)}
          aria-label="Open navigation"
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <button
          onClick={() => setPalette(true)}
          className="flex w-full max-w-md items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-2 pl-3 pr-2 text-sm text-slate-400 hover:bg-slate-100"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Search or jump to…</span>
          <kbd className="ml-auto hidden rounded border border-slate-200 bg-surface px-1.5 py-0.5 text-[10px] sm:inline">⌘K</kbd>
        </button>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {paused && (
          <span className="hidden items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-negative sm:inline-flex">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-negative" /> Publishing paused
          </span>
        )}
        <button
          onClick={togglePause}
          disabled={busy}
          title={paused ? 'Resume publishing' : 'Pause all scheduled publishing (crisis mode)'}
          aria-label={paused ? 'Resume publishing' : 'Pause publishing'}
          className={cn(
            'rounded-lg p-2 transition-colors hover:bg-slate-100 disabled:opacity-50',
            paused ? 'text-negative' : 'text-slate-500'
          )}
        >
          {paused ? <PlayCircle className="h-5 w-5" /> : <PauseCircle className="h-5 w-5" />}
        </button>
        <button
          onClick={openComposer}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-ink transition-transform hover:bg-accent-hover active:scale-95 sm:px-4"
        >
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New Post</span>
        </button>
        <button
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
        <div className="relative" ref={notifRef}>
          <button
            onClick={toggleNotifications}
            aria-label="Notifications"
            aria-expanded={notifOpen}
            className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 animate-pulse rounded-full bg-negative" />
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-full z-30 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-surface shadow-2xl">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-semibold text-slate-800">Notifications</p>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifError && (
                  <p className="px-4 py-6 text-center text-sm text-slate-400">
                    Sign in with an owner or admin account to view notifications.
                  </p>
                )}
                {!notifError && notifications.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-slate-400">You're all caught up.</p>
                )}
                {!notifError && notifications.map((n) => (
                  <div key={n.id} className="border-b border-slate-50 px-4 py-3 last:border-0 hover:bg-slate-50">
                    <p className="text-sm text-slate-700">{describeAction(n.action, n.entity)}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{new Date(n.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
              {!notifError && (
                <button
                  onClick={() => { setNotifOpen(false); router.push('/settings'); }}
                  className="w-full border-t border-slate-100 px-4 py-2.5 text-center text-xs font-medium text-accent-deep hover:bg-slate-50"
                >
                  View full audit trail
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Avatar name={currentUser.name} size={34} />
          <div className="hidden text-sm lg:block">
            <p className="font-medium leading-tight text-slate-800">{currentUser.name}</p>
            <p className="text-xs capitalize text-slate-400">{currentUser.role}</p>
          </div>
        </div>
      </div>
    </header>
  );
}

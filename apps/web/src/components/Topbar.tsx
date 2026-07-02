'use client';

import { Search, Bell, Plus, Sun, Moon, Menu } from 'lucide-react';
import { Avatar } from './ui';
import { currentUser } from '@/lib/mock';
import { useUiStore } from '@/lib/ui-store';

export function Topbar() {
  const { theme, toggleTheme, openComposer, setPalette, setMobileNav } = useUiStore();

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
        <button aria-label="Notifications" className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 animate-pulse rounded-full bg-negative" />
        </button>
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

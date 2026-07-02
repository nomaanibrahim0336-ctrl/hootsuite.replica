'use client';

import { Search, Bell, Plus } from 'lucide-react';
import Link from 'next/link';
import { Avatar } from './ui';
import { currentUser } from '@/lib/mock';

export function Topbar() {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-6 backdrop-blur">
      <div className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          placeholder="Search posts, messages, mentions…"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-accent focus:bg-white"
        />
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/publisher"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          <Plus className="h-4 w-4" /> New Post
        </Link>
        <button className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent" />
        </button>
        <div className="flex items-center gap-2">
          <Avatar name={currentUser.name} size={34} />
          <div className="hidden text-sm sm:block">
            <p className="font-medium leading-tight text-slate-800">{currentUser.name}</p>
            <p className="text-xs capitalize text-slate-400">{currentUser.role}</p>
          </div>
        </div>
      </div>
    </header>
  );
}

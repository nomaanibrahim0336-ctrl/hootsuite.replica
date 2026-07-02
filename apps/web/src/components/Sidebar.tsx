'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Send,
  Calendar,
  Inbox,
  Radio,
  BarChart2,
  Settings,
  Zap,
} from 'lucide-react';

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/publisher', label: 'Publisher', icon: Send },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/listening', label: 'Listening', icon: Radio },
  { href: '/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-sidebar text-slate-300">
      <div className="flex items-center gap-2 px-6 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
          <Zap className="h-5 w-5 text-white" />
        </span>
        <span className="text-lg font-bold text-white">SocialHub</span>
      </div>

      <nav className="mt-2 flex-1 space-y-1 px-3">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active ? 'bg-accent text-white' : 'text-slate-300 hover:bg-sidebarHover hover:text-white'
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <div className="rounded-lg bg-sidebarHover p-3 text-xs text-slate-400">
          <p className="font-semibold text-white">Pro plan</p>
          <p className="mt-1">5 of 5 social accounts connected.</p>
        </div>
      </div>
    </aside>
  );
}

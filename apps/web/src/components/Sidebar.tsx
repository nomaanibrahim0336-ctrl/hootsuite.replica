'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/lib/ui-store';
import { currentUser } from '@/lib/mock';
import { initials } from '@/lib/utils';
import {
  LayoutDashboard,
  Send,
  CalendarDays,
  Inbox,
  Radio,
  BarChart2,
  Settings,
  Zap,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/publisher', label: 'Publisher', icon: Send },
  { href: '/calendar', label: 'Planner', icon: CalendarDays },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/listening', label: 'Listening', icon: Radio },
  { href: '/analytics', label: 'Analytics', icon: BarChart2 },
];

// Drawer palette is fixed (deep grey) regardless of light/dark theme.
const ITEM = 'text-[#B0B8C4] hover:bg-[#3A3D47] hover:text-white';
const ITEM_ACTIVE = 'bg-[#3A3D47] text-white';

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useUiStore();

  const linkCls = (active: boolean) =>
    cn(
      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
      active ? ITEM_ACTIVE : ITEM,
      sidebarCollapsed && 'justify-center px-0'
    );

  return (
    <aside
      aria-label="Main navigation"
      className={cn(
        'fixed inset-y-0 left-0 z-30 flex flex-col bg-sidebar transition-[width] duration-200',
        sidebarCollapsed ? 'w-[72px]' : 'w-60'
      )}
    >
      {/* Top: logo */}
      <div className={cn('flex items-center gap-2 px-4 py-5', sidebarCollapsed && 'justify-center px-0')}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent">
          <Zap className="h-5 w-5 text-accent-ink" />
        </span>
        {!sidebarCollapsed && <span className="text-lg font-bold text-white">SocialHub</span>}
      </div>

      {/* Middle: core modules */}
      <nav className="mt-1 flex-1 space-y-1 px-3">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link key={href} href={href} className={linkCls(active)} title={label} aria-label={label}>
              <Icon className="h-5 w-5 shrink-0" />
              {!sidebarCollapsed && label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: help, settings, profile, collapse */}
      <div className="space-y-1 border-t border-white/10 px-3 py-3">
        <a href="#" className={linkCls(false)} title="Help" aria-label="Help">
          <HelpCircle className="h-5 w-5 shrink-0" />
          {!sidebarCollapsed && 'Help'}
        </a>
        <Link
          href="/settings"
          className={linkCls(pathname.startsWith('/settings'))}
          title="Settings"
          aria-label="Settings"
        >
          <Settings className="h-5 w-5 shrink-0" />
          {!sidebarCollapsed && 'Settings'}
        </Link>

        <div className={cn('flex items-center gap-2 rounded-lg px-3 py-2', sidebarCollapsed && 'justify-center px-0')}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3A3D47] text-xs font-semibold text-white">
            {initials(currentUser.name)}
          </span>
          {!sidebarCollapsed && (
            <span className="truncate text-xs text-[#B0B8C4]">{currentUser.name}</span>
          )}
        </div>

        <button
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          className={cn('w-full', linkCls(false))}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-5 w-5 shrink-0" />
          ) : (
            <>
              <PanelLeftClose className="h-5 w-5 shrink-0" /> Collapse
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

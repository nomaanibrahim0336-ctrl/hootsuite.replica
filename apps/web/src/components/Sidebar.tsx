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

/**
 * Gradient-bordered tab: a 1px gradient shell around the link keeps layout
 * stable — transparent when idle, faint on hover, saffron→sunset when active.
 */
function NavTab({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  onClick,
  as = 'link',
}: {
  href?: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  collapsed: boolean;
  onClick?: () => void;
  as?: 'link' | 'button';
}) {
  const shell = cn(
    'block rounded-[11px] p-px transition-all duration-200',
    active
      ? 'bg-gradient-to-r from-[#FFB81C] via-[#FF9A3D] to-[#FF4C46] shadow-[0_0_14px_rgba(255,184,28,0.25)]'
      : 'bg-white/[0.06] hover:bg-gradient-to-r hover:from-[#FFB81C]/45 hover:via-white/10 hover:to-white/10'
  );
  const inner = cn(
    'flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors',
    active
      ? 'bg-gradient-to-r from-[#3A3D47] to-[#31343E] text-white'
      : 'bg-[#2B2D35] text-[#B0B8C4] hover:bg-[#33363F] hover:text-white',
    collapsed && 'justify-center px-0'
  );
  const content = (
    <>
      <Icon className={cn('h-5 w-5 shrink-0', active && 'text-accent')} />
      {!collapsed && label}
    </>
  );
  if (as === 'button') {
    return (
      <div className={shell}>
        <button onClick={onClick} aria-label={label} title={label} className={cn('w-full', inner)}>
          {content}
        </button>
      </div>
    );
  }
  return (
    <div className={shell}>
      <Link href={href!} aria-label={label} title={label} className={inner}>
        {content}
      </Link>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useUiStore();

  return (
    <aside
      aria-label="Main navigation"
      className={cn(
        'fixed inset-y-0 left-0 z-30 flex flex-col transition-[width] duration-200',
        'bg-gradient-to-b from-[#2F323C] via-[#2B2D35] to-[#20222A]',
        sidebarCollapsed ? 'w-[72px]' : 'w-60'
      )}
    >
      {/* Gradient edge line on the drawer's right border */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-[#FFB81C]/50 via-white/10 to-[#FF4C46]/30"
      />

      {/* Top: logo on a saffron→sunset gradient tile with a soft glow */}
      <div className={cn('flex items-center gap-2 px-4 py-5', sidebarCollapsed && 'justify-center px-0')}>
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#FFB81C] to-[#FF7A3D] shadow-[0_0_18px_rgba(255,184,28,0.35)]">
          <Zap className="h-5 w-5 text-accent-ink" />
        </span>
        {!sidebarCollapsed && (
          <span className="bg-gradient-to-r from-white to-[#B0B8C4] bg-clip-text text-lg font-bold text-transparent">
            SocialHub
          </span>
        )}
      </div>

      {/* Middle: core modules */}
      <nav className="mt-1 flex-1 space-y-1.5 px-3">
        {nav.map(({ href, label, icon }) => (
          <NavTab
            key={href}
            href={href}
            label={label}
            icon={icon}
            active={pathname === href || pathname.startsWith(href + '/')}
            collapsed={sidebarCollapsed}
          />
        ))}
      </nav>

      {/* Bottom: help, settings, profile, collapse — above a gradient divider */}
      <div className="relative space-y-1.5 px-3 py-3">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-px left-3 right-3 h-px bg-gradient-to-r from-transparent via-[#FFB81C]/40 to-transparent"
        />
        <NavTab href="#" label="Help" icon={HelpCircle} active={false} collapsed={sidebarCollapsed} />
        <NavTab
          href="/settings"
          label="Settings"
          icon={Settings}
          active={pathname.startsWith('/settings')}
          collapsed={sidebarCollapsed}
        />

        <div className={cn('flex items-center gap-2 rounded-lg px-3 py-2', sidebarCollapsed && 'justify-center px-0')}>
          <span className="rounded-full bg-gradient-to-br from-[#FFB81C] to-[#FF4C46] p-px">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2B2D35] text-xs font-semibold text-white">
              {initials(currentUser.name)}
            </span>
          </span>
          {!sidebarCollapsed && <span className="truncate text-xs text-[#B0B8C4]">{currentUser.name}</span>}
        </div>

        <NavTab
          as="button"
          onClick={toggleSidebar}
          label={sidebarCollapsed ? 'Expand navigation' : 'Collapse'}
          icon={sidebarCollapsed ? PanelLeftOpen : PanelLeftClose}
          active={false}
          collapsed={sidebarCollapsed}
        />
      </div>
    </aside>
  );
}

'use client';

import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useUiStore } from '@/lib/ui-store';
import { cn } from '@/lib/utils';

export function Shell({ children }: { children: React.ReactNode }) {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className={cn('transition-[padding] duration-200', collapsed ? 'pl-[72px]' : 'pl-60')}>
        <Topbar />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}

'use client';

import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { Composer } from './Composer';
import { CommandPalette } from './CommandPalette';
import { Toaster } from './Toast';
import { AuthGuard } from './AuthGuard';
import { useUiStore } from '@/lib/ui-store';
import { cn } from '@/lib/utils';

export function Shell({ children }: { children: React.ReactNode }) {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileNav = useUiStore((s) => s.setMobileNav);

  return (
    <AuthGuard>
    <div className="min-h-screen">
      {/* Mobile overlay behind the drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setMobileNav(false)} />
      )}
      <Sidebar />
      <div className={cn('transition-[padding] duration-200', collapsed ? 'md:pl-[72px]' : 'md:pl-60')}>
        <Topbar />
        <main className="p-4 sm:p-6">{children}</main>
      </div>

      {/* Global overlays */}
      <Composer />
      <CommandPalette />
      <Toaster />
    </div>
    </AuthGuard>
  );
}

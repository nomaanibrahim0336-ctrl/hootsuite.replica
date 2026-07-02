'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { hasSession } from '@/lib/api';

/**
 * Client-side route guard for the authenticated app shell. Redirects to /login
 * when there's no active session. Renders nothing until the check completes to
 * avoid a flash of protected content.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hasSession()) {
      router.replace('/login');
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-accent" />
      </div>
    );
  }
  return <>{children}</>;
}

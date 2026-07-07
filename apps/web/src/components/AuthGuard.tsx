'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, hasSession, getToken, endSession } from '@/lib/api';

/**
 * Client-side route guard for the authenticated app shell. Redirects to
 * /login when there's no session or the stored access token doesn't
 * actually authenticate against the live API (expired, revoked, or never
 * issued). Renders nothing until the check completes to avoid a flash of
 * protected content.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hasSession() || !getToken()) {
        router.replace('/login');
        return;
      }
      try {
        // api.getMe() carries the access token and auto-refreshes on a 401
        // via the request() wrapper — this call fails only if both the
        // access and refresh tokens are invalid/expired.
        await api.getMe();
        if (!cancelled) setReady(true);
      } catch {
        if (cancelled) return;
        endSession();
        router.replace('/login');
      }
    })();
    return () => { cancelled = true; };
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

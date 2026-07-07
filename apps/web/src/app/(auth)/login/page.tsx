'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Zap, AlertCircle } from 'lucide-react';
import { api, setToken, setRefreshToken, startSession } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.login(email, password);
      setToken(res.accessToken);
      setRefreshToken(res.refreshToken);
      startSession();
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Could not sign in — the live API may be unreachable.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
            <Zap className="h-5 w-5 text-accent-ink" />
          </span>
          <span className="text-xl font-bold text-slate-900">SocialHub</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
        <p className="mt-1 text-slate-500">Sign in to manage your social presence.</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-accent"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <Link href="/forgot-password" className="text-xs font-medium text-accent-deep hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-accent"
            />
          </div>
          <button type="submit" disabled={loading} className="w-full rounded-lg bg-accent py-2.5 font-semibold text-accent-ink hover:bg-accent-hover disabled:opacity-60">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-medium text-accent-deep hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

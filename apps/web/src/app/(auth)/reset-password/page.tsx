'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Zap } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/components/Toast';

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return toast.error('Missing or invalid reset link');
    setLoading(true);
    try {
      await api.resetPassword(token, password);
      toast.success('Password updated — sign in with your new password.');
      router.push('/login');
    } catch (err: any) {
      toast.error(err?.message || 'Reset link is invalid or expired');
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
        <h1 className="text-2xl font-bold text-slate-900">Choose a new password</h1>
        <p className="mt-1 text-slate-500">This reset link expires 15 minutes after it was requested.</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">New password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-accent"
            />
          </div>
          <button type="submit" disabled={loading} className="w-full rounded-lg bg-accent py-2.5 font-semibold text-accent-ink hover:bg-accent-hover disabled:opacity-60">
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/login" className="font-medium text-accent-deep hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

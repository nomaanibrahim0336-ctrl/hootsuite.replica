'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Zap } from 'lucide-react';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.forgotPassword(email);
      setSent(true);
      // No email provider is configured, so the reset link is handed off directly
      // instead of being emailed — swap for a real email send once one is wired up.
      if (res.resetToken) {
        setTimeout(() => router.push(`/reset-password?token=${res.resetToken}`), 1200);
      }
    } catch {
      setSent(true);
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
        <h1 className="text-2xl font-bold text-slate-900">Reset your password</h1>
        <p className="mt-1 text-slate-500">Enter your account email and we&apos;ll get you a reset link.</p>

        {sent ? (
          <p className="mt-6 rounded-lg bg-accent-light px-4 py-3 text-sm text-accent-deep">
            If an account exists for that email, you&apos;ll be taken to the reset screen shortly.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-accent"
              />
            </div>
            <button type="submit" disabled={loading} className="w-full rounded-lg bg-accent py-2.5 font-semibold text-accent-ink hover:bg-accent-hover disabled:opacity-60">
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/login" className="font-medium text-accent-deep hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

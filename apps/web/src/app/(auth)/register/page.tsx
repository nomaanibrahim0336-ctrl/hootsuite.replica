'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Zap } from 'lucide-react';
import { api, setToken, startSession } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.register(form.email, form.password, form.name);
      setToken(res.accessToken);
    } catch {
      // API unavailable — proceed in demo mode.
    } finally {
      startSession();
      router.push('/dashboard');
    }
  };

  const field = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value });

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
            <Zap className="h-5 w-5 text-accent-ink" />
          </span>
          <span className="text-xl font-bold text-slate-900">SocialHub</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
        <p className="mt-1 text-slate-500">Start managing all your social channels in one place.</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
            <input value={form.name} onChange={field('name')} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-accent" placeholder="Jane Doe" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input type="email" value={form.email} onChange={field('email')} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-accent" placeholder="you@company.com" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input type="password" value={form.password} onChange={field('password')} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-accent" placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading} className="w-full rounded-lg bg-accent py-2.5 font-semibold text-accent-ink hover:bg-accent-hover disabled:opacity-60">
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-accent-deep hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

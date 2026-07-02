import { cn, NETWORK_META, initials } from '@/lib/utils';
import type { NetworkType } from '@/lib/types';

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
      <div>
        <h3 className="font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
};

export function Button({ variant = 'primary', size = 'md', className, children, ...props }: BtnProps) {
  const variants = {
    primary: 'bg-accent text-white hover:bg-accent-hover',
    secondary: 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
    danger: 'bg-negative text-white hover:bg-red-600',
  };
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2 text-sm' };
  return (
    <button
      className={cn('inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50', variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function Badge({ children, color = 'slate' }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-600',
    green: 'bg-emerald-100 text-emerald-700',
    blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-accent-light text-accent',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', colors[color] ?? colors.slate)}>
      {children}
    </span>
  );
}

export function NetworkChip({ type, size = 28 }: { type: NetworkType; size?: number }) {
  const meta = NETWORK_META[type];
  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-[11px] font-bold text-white"
      style={{ width: size, height: size, backgroundColor: meta.color }}
      title={meta.label}
    >
      {meta.short}
    </span>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-accent-light font-semibold text-accent"
      style={{ width: size, height: size, fontSize: size / 2.6 }}
    >
      {initials(name)}
    </span>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

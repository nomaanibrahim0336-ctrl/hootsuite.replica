'use client';

import type { LucideIcon } from 'lucide-react';

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-light to-accent/20">
        <Icon className="h-7 w-7 text-accent-deep" />
      </span>
      <h3 className="font-semibold text-slate-800">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-slate-500">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

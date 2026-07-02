'use client';

import { create } from 'zustand';
import { CheckCircle2, XCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastKind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, kind?: ToastKind) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

export const useToast = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, kind = 'success') => {
    const id = ++seq;
    set({ toasts: [...get().toasts, { id, message, kind }] });
    setTimeout(() => get().dismiss(id), 3200);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

/** Convenience helper usable from any client component/event handler. */
export const toast = {
  success: (m: string) => useToast.getState().push(m, 'success'),
  error: (m: string) => useToast.getState().push(m, 'error'),
  info: (m: string) => useToast.getState().push(m, 'info'),
};

const ICON = { success: CheckCircle2, error: XCircle, info: Info };
const COLOR = {
  success: 'text-positive',
  error: 'text-negative',
  info: 'text-accent-deep',
};

export function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICON[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            onClick={() => dismiss(t.id)}
            className="pointer-events-auto flex animate-pop-in items-center gap-2.5 rounded-xl border border-slate-200 bg-surface px-4 py-3 text-sm text-slate-800 shadow-lg"
          >
            <Icon className={cn('h-5 w-5 shrink-0', COLOR[t.kind])} />
            {t.message}
          </div>
        );
      })}
    </div>
  );
}

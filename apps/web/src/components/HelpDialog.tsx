'use client';

import { X, Keyboard } from 'lucide-react';

const SHORTCUTS = [
  { keys: '⌘K / Ctrl+K', label: 'Open search & command palette' },
  { keys: 'Esc', label: 'Close the current dialog' },
];

export function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm animate-pop-in rounded-2xl border border-slate-200 bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-bold text-slate-900">Help & shortcuts</h3>
          <button onClick={onClose} aria-label="Close help" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <Keyboard className="h-3.5 w-3.5" /> Keyboard shortcuts
          </p>
          <div className="space-y-1.5">
            {SHORTCUTS.map((s) => (
              <div key={s.keys} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="text-slate-600">{s.label}</span>
                <kbd className="rounded border border-slate-200 bg-surface px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{s.keys}</kbd>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          For questions about your workspace, reach out to your team's SocialHub admin.
        </p>
      </div>
    </div>
  );
}

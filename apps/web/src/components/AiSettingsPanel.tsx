'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, Button, Badge } from './ui';
import { api, type AiProvider } from '@/lib/api';
import { Sparkles, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

// Static fallback shown when the API is offline (keys live in env, never here).
const FALLBACK: AiProvider[] = [
  { id: 'claude', label: 'Claude (Anthropic)', models: ['claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5-20251001'], configured: false, envKey: 'ANTHROPIC_API_KEY' },
  { id: 'openai', label: 'OpenAI (GPT)', models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'], configured: false, envKey: 'OPENAI_API_KEY' },
  { id: 'gemini', label: 'Gemini (Google)', models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'], configured: false, envKey: 'GEMINI_API_KEY' },
  { id: 'deepseek', label: 'DeepSeek', models: ['deepseek-chat', 'deepseek-reasoner'], configured: false, envKey: 'DEEPSEEK_API_KEY' },
  { id: 'custom', label: 'Custom (OpenAI-compatible)', models: ['custom-model'], configured: false, envKey: 'CUSTOM_LLM_BASE_URL + CUSTOM_LLM_API_KEY' },
  { id: 'mock', label: 'Built-in (offline)', models: ['mock-1'], configured: true },
];

export function AiSettingsPanel() {
  const [providers, setProviders] = useState<AiProvider[]>(FALLBACK);
  const [active, setActive] = useState('mock');
  const [model, setModel] = useState('mock-1');
  const [online, setOnline] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api
      .aiStatus()
      .then((s) => {
        setProviders(s.providers);
        setActive(s.active);
        setModel(s.model);
        setOnline(true);
      })
      .catch(() => setOnline(false));
  }, []);

  const current = providers.find((p) => p.id === active) ?? providers[0];

  const save = async () => {
    setSaving(true);
    setMsg('');
    try {
      const s = await api.aiSetConfig(active, model);
      setActive(s.active);
      setModel(s.model);
      setMsg(s.usingMock && active !== 'mock' ? `Saved. ${active} has no key yet — using offline mode until a key is added.` : 'Saved.');
    } catch (e) {
      setMsg('Could not save — is the API running?');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="AI & Automation"
        subtitle="Choose the LLM provider that powers captions, hashtags, ideas and sentiment."
        action={<Sparkles className="h-5 w-5 text-accent-deep" />}
      />
      <div className="p-5">
        {!online && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            <AlertTriangle className="h-4 w-4" /> API offline — showing defaults. Start the API to manage providers.
          </div>
        )}

        <p className="mb-2 text-sm font-medium text-slate-700">Providers</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {providers.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setActive(p.id);
                setModel(p.models[0]);
              }}
              className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition ${
                active === p.id ? 'border-accent bg-accent-light' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div>
                <p className="text-sm font-medium text-slate-800">{p.label}</p>
                {p.envKey && <p className="text-[11px] text-slate-400">{p.envKey}</p>}
              </div>
              {p.configured ? (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" /> configured
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <XCircle className="h-4 w-4" /> no key
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
            >
              {(current?.models ?? []).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save AI settings'}</Button>
        </div>

        {msg && <p className="mt-3 text-sm text-slate-500">{msg}</p>}

        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          🔒 API keys are configured via environment variables on the server
          (<code>apps/api/.env</code>) and are never entered or stored in the browser.
          A provider becomes selectable the moment its key is present.
        </p>
      </div>
    </Card>
  );
}

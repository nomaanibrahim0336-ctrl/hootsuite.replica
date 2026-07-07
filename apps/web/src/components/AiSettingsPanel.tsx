'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, Button, Badge } from './ui';
import { api, type AiProvider } from '@/lib/api';
import { toast } from './Toast';
import { Sparkles, CheckCircle2, XCircle, AlertTriangle, Plug, Unplug, Loader2 } from 'lucide-react';

// Static fallback shown when the API is offline (keys live in env, never here).
const FALLBACK: AiProvider[] = [
  { id: 'claude', label: 'Claude (Anthropic)', models: ['claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5-20251001'], configured: false, envKey: 'ANTHROPIC_API_KEY' },
  { id: 'openai', label: 'OpenAI (GPT)', models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'], configured: false, envKey: 'OPENAI_API_KEY' },
  { id: 'gemini', label: 'Gemini (Google)', models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'], configured: false, envKey: 'GEMINI_API_KEY' },
  { id: 'deepseek', label: 'DeepSeek', models: ['deepseek-chat', 'deepseek-reasoner'], configured: false, envKey: 'DEEPSEEK_API_KEY' },
  { id: 'custom', label: 'Custom (OpenAI-compatible)', models: ['custom-model'], configured: false, envKey: 'CUSTOM_LLM_BASE_URL + CUSTOM_LLM_API_KEY' },
  { id: 'mock', label: 'Built-in (offline)', models: ['mock-1'], configured: true },
];

const CONNECTABLE = new Set(['claude', 'openai', 'gemini', 'deepseek', 'custom']);

export function AiSettingsPanel() {
  const [providers, setProviders] = useState<AiProvider[]>(FALLBACK);
  const [active, setActive] = useState('mock');
  const [model, setModel] = useState('mock-1');
  const [online, setOnline] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [baseUrlInput, setBaseUrlInput] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () =>
    api
      .aiStatus()
      .then((s) => {
        setProviders(s.providers);
        setActive(s.active);
        setModel(s.model);
        setOnline(true);
      })
      .catch(() => setOnline(false));

  useEffect(() => { load(); }, []);

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

  const openConnect = (id: string) => {
    setConnectingId(id);
    setKeyInput('');
    setBaseUrlInput('');
  };

  const submitConnect = async (id: string) => {
    if (!keyInput.trim()) return toast.error('Enter an API key');
    if (id === 'custom' && !baseUrlInput.trim()) return toast.error('Enter a base URL for the custom provider');
    setBusyId(id);
    try {
      const updated = await api.aiConnectProvider(id, keyInput.trim(), id === 'custom' ? baseUrlInput.trim() : undefined);
      setProviders(updated);
      setConnectingId(null);
      toast.success(`${providers.find((p) => p.id === id)?.label ?? id} connected`);
    } catch (e: any) {
      toast.error(e?.message || 'Could not connect — is the API running?');
    } finally {
      setBusyId(null);
    }
  };

  const disconnect = async (id: string) => {
    setBusyId(id);
    try {
      const updated = await api.aiDisconnectProvider(id);
      setProviders(updated);
      if (active === id) { setActive('mock'); setModel('mock-1'); }
      toast.info(`${providers.find((p) => p.id === id)?.label ?? id} disconnected`);
    } catch (e: any) {
      toast.error(e?.message || 'Could not disconnect — is the API running?');
    } finally {
      setBusyId(null);
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
          {providers.map((p) => {
            const connectable = CONNECTABLE.has(p.id);
            const isConnecting = connectingId === p.id;
            const isBusy = busyId === p.id;
            return (
              <div
                key={p.id}
                className={`rounded-lg border transition ${active === p.id ? 'border-accent bg-accent-light' : 'border-slate-200'}`}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => { setActive(p.id); setModel(p.models[0]); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { setActive(p.id); setModel(p.models[0]); } }}
                  className="flex cursor-pointer items-center justify-between px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{p.label}</p>
                    {p.envKey && <p className="text-[11px] text-slate-400">{p.envKey}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {p.configured ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                        <CheckCircle2 className="h-4 w-4" /> configured
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <XCircle className="h-4 w-4" /> no key
                      </span>
                    )}
                    {connectable && p.envConfigured && (
                      <span className="text-[11px] text-slate-400">(env)</span>
                    )}
                    {connectable && !p.envConfigured && p.hasStoredKey && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={isBusy}
                        onClick={(e) => { e.stopPropagation(); disconnect(p.id); }}
                      >
                        {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
                        Disconnect
                      </Button>
                    )}
                    {connectable && !p.envConfigured && !p.hasStoredKey && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); openConnect(p.id); }}
                      >
                        <Plug className="h-3.5 w-3.5" /> Connect
                      </Button>
                    )}
                  </div>
                </div>

                {isConnecting && (
                  <div
                    className="space-y-2 border-t border-slate-200 px-3 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="password"
                      autoFocus
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      placeholder={`${p.label} API key`}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                    {p.id === 'custom' && (
                      <input
                        type="text"
                        value={baseUrlInput}
                        onChange={(e) => setBaseUrlInput(e.target.value)}
                        placeholder="Base URL (e.g. https://api.example.com/v1)"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
                      />
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" disabled={isBusy} onClick={() => submitConnect(p.id)}>
                        {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save key
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => setConnectingId(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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
          🔒 Connect a provider by pasting its API key above — it's sent straight to the
          server and stored there, never in the browser. Alternatively, an environment
          variable set on the server (e.g. <code>GEMINI_API_KEY</code>) always takes
          priority over a key entered here.
        </p>
      </div>
    </Card>
  );
}

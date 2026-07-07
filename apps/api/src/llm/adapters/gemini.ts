import { LLMProvider, CompleteOptions } from '../types';
import { resolveApiKey, isProviderConfigured } from '../credentials';

const DEFAULT_MODEL = 'gemini-1.5-flash';

export const geminiProvider: LLMProvider = {
  id: 'gemini',
  label: 'Gemini (Google)',
  models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  isConfigured: () => isProviderConfigured('gemini', !!process.env.GEMINI_API_KEY),
  async complete(prompt: string, opts: CompleteOptions = {}): Promise<string> {
    const key = await resolveApiKey('gemini', process.env.GEMINI_API_KEY);
    if (!key) throw new Error('GEMINI_API_KEY not set');
    const model = process.env.LLM_MODEL || DEFAULT_MODEL;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: opts.temperature ?? 0.7,
          maxOutputTokens: opts.maxTokens ?? 512,
        },
      }),
    });
    if (!res.ok) throw new Error(`Gemini API ${res.status}: ${await res.text()}`);
    const data: any = await res.json();
    return (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
  },
};

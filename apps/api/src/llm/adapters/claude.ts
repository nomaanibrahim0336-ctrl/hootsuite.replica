import { LLMProvider, CompleteOptions } from '../types';

const DEFAULT_MODEL = 'claude-opus-4-8';

export const claudeProvider: LLMProvider = {
  id: 'claude',
  label: 'Claude (Anthropic)',
  models: ['claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5-20251001'],
  isConfigured: () => !!process.env.ANTHROPIC_API_KEY,
  async complete(prompt: string, opts: CompleteOptions = {}): Promise<string> {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY not set');
    const model = process.env.LLM_MODEL || DEFAULT_MODEL;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 512,
        temperature: opts.temperature ?? 0.7,
        ...(opts.system ? { system: opts.system } : {}),
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
    const data: any = await res.json();
    return (data.content?.[0]?.text ?? '').trim();
  },
};

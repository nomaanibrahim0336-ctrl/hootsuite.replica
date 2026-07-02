import { LLMProvider, CompleteOptions } from '../types';

// Shared OpenAI-compatible chat-completions caller (reused by OpenAI, DeepSeek, Custom).
export async function openAICompatibleComplete(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  opts: CompleteOptions = {}
): Promise<string> {
  const messages = [
    ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
    { role: 'user', content: prompt },
  ];
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 512,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI-compatible API ${res.status}: ${await res.text()}`);
  const data: any = await res.json();
  return (data.choices?.[0]?.message?.content ?? '').trim();
}

const DEFAULT_MODEL = 'gpt-4o-mini';

export const openaiProvider: LLMProvider = {
  id: 'openai',
  label: 'OpenAI (GPT)',
  models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
  isConfigured: () => !!process.env.OPENAI_API_KEY,
  async complete(prompt, opts) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY not set');
    const model = process.env.LLM_MODEL || DEFAULT_MODEL;
    return openAICompatibleComplete('https://api.openai.com/v1', key, model, prompt, opts);
  },
};

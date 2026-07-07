import { LLMProvider } from '../types';
import { openAICompatibleComplete } from './openai';
import { resolveApiKey, isProviderConfigured } from '../credentials';

const DEFAULT_MODEL = 'deepseek-chat';

export const deepseekProvider: LLMProvider = {
  id: 'deepseek',
  label: 'DeepSeek',
  models: ['deepseek-chat', 'deepseek-reasoner'],
  isConfigured: () => isProviderConfigured('deepseek', !!process.env.DEEPSEEK_API_KEY),
  async complete(prompt, opts) {
    const key = await resolveApiKey('deepseek', process.env.DEEPSEEK_API_KEY);
    if (!key) throw new Error('DEEPSEEK_API_KEY not set');
    const model = process.env.LLM_MODEL || DEFAULT_MODEL;
    return openAICompatibleComplete('https://api.deepseek.com/v1', key, model, prompt, opts);
  },
};

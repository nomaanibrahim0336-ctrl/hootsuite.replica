import { LLMProvider } from '../types';
import { openAICompatibleComplete } from './openai';

// Any OpenAI-compatible endpoint. Configure via:
//   CUSTOM_LLM_BASE_URL, CUSTOM_LLM_API_KEY, CUSTOM_LLM_MODEL
export const customProvider: LLMProvider = {
  id: 'custom',
  label: 'Custom (OpenAI-compatible)',
  models: [process.env.CUSTOM_LLM_MODEL || 'custom-model'],
  isConfigured: () => !!(process.env.CUSTOM_LLM_BASE_URL && process.env.CUSTOM_LLM_API_KEY),
  async complete(prompt, opts) {
    const baseUrl = process.env.CUSTOM_LLM_BASE_URL;
    const key = process.env.CUSTOM_LLM_API_KEY;
    if (!baseUrl || !key) throw new Error('CUSTOM_LLM_BASE_URL / CUSTOM_LLM_API_KEY not set');
    const model = process.env.LLM_MODEL || process.env.CUSTOM_LLM_MODEL || 'custom-model';
    return openAICompatibleComplete(baseUrl, key, model, prompt, opts);
  },
};

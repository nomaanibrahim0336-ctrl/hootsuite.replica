import { LLMProvider } from '../types';

// Deterministic offline provider. Always "configured" so the app works with no keys.
export const mockProvider: LLMProvider = {
  id: 'mock',
  label: 'Built-in (offline)',
  models: ['mock-1'],
  isConfigured: () => true,
  async complete(prompt: string): Promise<string> {
    return `【mock】${prompt.slice(0, 240)}`;
  },
};

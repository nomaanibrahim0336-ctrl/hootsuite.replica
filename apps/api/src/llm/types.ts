// Common contract every LLM provider adapter implements.

export type ProviderId = 'claude' | 'openai' | 'gemini' | 'deepseek' | 'custom' | 'mock';

export interface CompleteOptions {
  system?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMProvider {
  id: ProviderId;
  /** Human label for UIs. */
  label: string;
  /** Selectable models for this provider. */
  models: string[];
  /** True when the provider has the credentials it needs (env keys). */
  isConfigured(): boolean;
  /** Run a single text completion. Adapters throw on transport/API errors. */
  complete(prompt: string, opts?: CompleteOptions): Promise<string>;
}

export interface ProviderMeta {
  id: ProviderId;
  label: string;
  models: string[];
  configured: boolean;
  /** Which env var supplies the key (for docs / UI hints). */
  envKey?: string;
}

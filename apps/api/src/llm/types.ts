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
  /** True when the provider has the credentials it needs (env var or a
   *  key entered through the app's Settings UI). */
  isConfigured(): Promise<boolean>;
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
  /** True when an env var configures this provider — a stored key (if any)
   *  is masked/unused, and there's nothing for "Disconnect" to remove. */
  envConfigured?: boolean;
  /** True when a key was entered through the app's Settings UI and is
   *  stored in the DB — enables a "Disconnect" action for this provider. */
  hasStoredKey?: boolean;
}

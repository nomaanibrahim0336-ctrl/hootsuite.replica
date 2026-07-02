import { prisma } from '../prisma';
import { LLMProvider, ProviderId, ProviderMeta, CompleteOptions } from './types';
import { mockProvider } from './adapters/mock';
import { claudeProvider } from './adapters/claude';
import { openaiProvider } from './adapters/openai';
import { geminiProvider } from './adapters/gemini';
import { deepseekProvider } from './adapters/deepseek';
import { customProvider } from './adapters/custom';

export * from './types';

const ENV_KEYS: Partial<Record<ProviderId, string>> = {
  claude: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  custom: 'CUSTOM_LLM_BASE_URL + CUSTOM_LLM_API_KEY',
};

const REGISTRY: Record<ProviderId, LLMProvider> = {
  claude: claudeProvider,
  openai: openaiProvider,
  gemini: geminiProvider,
  deepseek: deepseekProvider,
  custom: customProvider,
  mock: mockProvider,
};

const SETTING_PROVIDER = 'llm.provider';
const SETTING_MODEL = 'llm.model';

async function getSetting(key: string): Promise<string | undefined> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value;
}
async function setSetting(key: string, value: string): Promise<void> {
  await prisma.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

/** The provider chosen in settings, or the first configured one, else env LLM_PROVIDER, else mock. */
export async function resolveActiveProviderId(): Promise<ProviderId> {
  const configured = (await getSetting(SETTING_PROVIDER)) as ProviderId | undefined;
  if (configured && REGISTRY[configured]?.isConfigured()) return configured;
  const envChoice = process.env.LLM_PROVIDER as ProviderId | undefined;
  if (envChoice && REGISTRY[envChoice]?.isConfigured()) return envChoice;
  const firstReal = (Object.keys(REGISTRY) as ProviderId[]).find(
    (id) => id !== 'mock' && REGISTRY[id].isConfigured()
  );
  return firstReal ?? 'mock';
}

export async function getActiveProvider(): Promise<LLMProvider> {
  return REGISTRY[await resolveActiveProviderId()];
}

/** Run a completion through the active provider; fall back to mock on any failure. */
export async function complete(prompt: string, opts?: CompleteOptions): Promise<{ text: string; provider: ProviderId; fallback: boolean }> {
  const provider = await getActiveProvider();
  try {
    const text = await provider.complete(prompt, opts);
    return { text, provider: provider.id, fallback: false };
  } catch (e) {
    console.error(`[llm] ${provider.id} failed, falling back to mock:`, (e as Error).message);
    const text = await mockProvider.complete(prompt, opts);
    return { text, provider: 'mock', fallback: true };
  }
}

export async function getProvidersMeta(): Promise<ProviderMeta[]> {
  return (Object.keys(REGISTRY) as ProviderId[]).map((id) => ({
    id,
    label: REGISTRY[id].label,
    models: REGISTRY[id].models,
    configured: REGISTRY[id].isConfigured(),
    envKey: ENV_KEYS[id],
  }));
}

export async function getStatus() {
  const activeId = await resolveActiveProviderId();
  return {
    active: activeId,
    model: (await getSetting(SETTING_MODEL)) || process.env.LLM_MODEL || REGISTRY[activeId].models[0],
    usingMock: activeId === 'mock',
    providers: await getProvidersMeta(),
  };
}

export async function setActiveConfig(providerId: ProviderId, model?: string): Promise<void> {
  if (!REGISTRY[providerId]) throw new Error(`Unknown provider: ${providerId}`);
  await setSetting(SETTING_PROVIDER, providerId);
  if (model) await setSetting(SETTING_MODEL, model);
}

/**
 * LLM provider routing & fallback logic — unit-tested with mocked global.fetch
 * so no real API keys or network calls are needed.
 */

import { prisma } from '../src/prisma';

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = global.fetch;

function resetEnv() {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.CUSTOM_LLM_BASE_URL;
  delete process.env.CUSTOM_LLM_API_KEY;
  delete process.env.LLM_PROVIDER;
  delete process.env.LLM_MODEL;
}

async function clearSettings() {
  await prisma.appSetting.deleteMany({ where: { key: { in: ['llm.provider', 'llm.model'] } } });
  await prisma.llmCredential.deleteMany({});
}

afterAll(async () => {
  global.fetch = ORIGINAL_FETCH;
  process.env = ORIGINAL_ENV;
  await prisma.$disconnect();
});

beforeEach(async () => {
  resetEnv();
  await clearSettings();
  jest.resetModules();
});

describe('LLM: provider resolution', () => {
  it('resolves to mock when no provider is configured', async () => {
    const { resolveActiveProviderId } = await import('../src/llm');
    expect(await resolveActiveProviderId()).toBe('mock');
  });

  it('resolves to claude when ANTHROPIC_API_KEY is set', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-key';
    const { resolveActiveProviderId } = await import('../src/llm');
    expect(await resolveActiveProviderId()).toBe('claude');
  });

  it('resolves to openai when OPENAI_API_KEY is set (and no claude key)', async () => {
    process.env.OPENAI_API_KEY = 'sk-test-key';
    const { resolveActiveProviderId } = await import('../src/llm');
    expect(await resolveActiveProviderId()).toBe('openai');
  });

  it('respects LLM_PROVIDER env override when that provider is configured', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-a';
    process.env.OPENAI_API_KEY = 'sk-b';
    process.env.LLM_PROVIDER = 'openai';
    const { resolveActiveProviderId } = await import('../src/llm');
    expect(await resolveActiveProviderId()).toBe('openai');
  });

  it('falls back to mock if LLM_PROVIDER names an unconfigured provider', async () => {
    process.env.LLM_PROVIDER = 'gemini'; // no GEMINI_API_KEY set
    const { resolveActiveProviderId } = await import('../src/llm');
    expect(await resolveActiveProviderId()).toBe('mock');
  });

  it('setActiveConfig persists provider choice and resolveActiveProviderId honors it', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-a';
    process.env.OPENAI_API_KEY = 'sk-b';
    const { setActiveConfig, resolveActiveProviderId } = await import('../src/llm');
    await setActiveConfig('openai', 'gpt-4o');
    expect(await resolveActiveProviderId()).toBe('openai');
  });

  it('setActiveConfig with unknown provider throws', async () => {
    const { setActiveConfig } = await import('../src/llm');
    await expect(setActiveConfig('nope' as any)).rejects.toThrow(/Unknown provider/);
  });

  it('a saved provider setting is ignored if that provider becomes unconfigured', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-a';
    const { setActiveConfig, resolveActiveProviderId } = await import('../src/llm');
    await setActiveConfig('claude');
    delete process.env.ANTHROPIC_API_KEY;
    jest.resetModules();
    const fresh = await import('../src/llm');
    expect(await fresh.resolveActiveProviderId()).toBe('mock');
  });
});

describe('LLM: getProvidersMeta', () => {
  it('lists all 6 providers with configured flags', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-a';
    const { getProvidersMeta } = await import('../src/llm');
    const meta = await getProvidersMeta();
    expect(meta.length).toBe(6);
    const claude = meta.find((m) => m.id === 'claude');
    expect(claude?.configured).toBe(true);
    const openai = meta.find((m) => m.id === 'openai');
    expect(openai?.configured).toBe(false);
    const mock = meta.find((m) => m.id === 'mock');
    expect(mock?.configured).toBe(true); // mock is always configured
  });
});

describe('LLM: getStatus', () => {
  it('reports usingMock: true when nothing is configured', async () => {
    const { getStatus } = await import('../src/llm');
    const status = await getStatus();
    expect(status.active).toBe('mock');
    expect(status.usingMock).toBe(true);
    expect(status.model).toBe('mock-1');
  });

  it('reports usingMock: false and correct model when a real provider is active', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-a';
    const { getStatus } = await import('../src/llm');
    const status = await getStatus();
    expect(status.active).toBe('claude');
    expect(status.usingMock).toBe(false);
  });
});

describe('LLM: complete() success path with mocked fetch', () => {
  it('calls the Claude API shape and returns trimmed text on success', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-a';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ text: '  Hello from Claude  ' }] }),
    }) as any;

    const { complete } = await import('../src/llm');
    const result = await complete('Say hi');
    expect(result.provider).toBe('claude');
    expect(result.fallback).toBe(false);
    expect(result.text).toBe('Hello from Claude');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('calls the OpenAI-compatible chat/completions shape and returns trimmed text', async () => {
    process.env.OPENAI_API_KEY = 'sk-b';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '  Hi from GPT  ' } }] }),
    }) as any;

    const { complete } = await import('../src/llm');
    const result = await complete('Say hi');
    expect(result.provider).toBe('openai');
    expect(result.text).toBe('Hi from GPT');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({ method: 'POST' })
    );
  });
});

describe('LLM: complete() fallback on provider failure', () => {
  it('falls back to mock text when the active provider throws (network error)', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-a';
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as any;

    const { complete } = await import('../src/llm');
    const result = await complete('Test prompt');
    expect(result.provider).toBe('mock');
    expect(result.fallback).toBe(true);
    expect(result.text).toContain('Test prompt');
  });

  it('falls back to mock text when the provider returns a non-ok HTTP status', async () => {
    process.env.OPENAI_API_KEY = 'sk-b';
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limited',
    }) as any;

    const { complete } = await import('../src/llm');
    const result = await complete('Another prompt');
    expect(result.provider).toBe('mock');
    expect(result.fallback).toBe(true);
  });

  it('never throws even when both the real provider and fetch itself are broken', async () => {
    process.env.GEMINI_API_KEY = 'sk-g';
    global.fetch = jest.fn().mockRejectedValue(new Error('DNS failure')) as any;
    const { complete } = await import('../src/llm');
    await expect(complete('Resilience check')).resolves.toBeTruthy();
  });
});

describe('LLM: mock provider is deterministic', () => {
  it('mockProvider.complete echoes a truncated prompt with a marker prefix', async () => {
    const { mockProvider } = await import('../src/llm/adapters/mock');
    const text = await mockProvider.complete('hello world');
    expect(text).toBe('【mock】hello world');
  });

  it('mockProvider.isConfigured() is always true', async () => {
    const { mockProvider } = await import('../src/llm/adapters/mock');
    expect(await mockProvider.isConfigured()).toBe(true);
  });

  it('mockProvider truncates prompts longer than 240 chars', async () => {
    const { mockProvider } = await import('../src/llm/adapters/mock');
    const longPrompt = 'x'.repeat(300);
    const text = await mockProvider.complete(longPrompt);
    expect(text.length).toBeLessThanOrEqual(240 + '【mock】'.length);
  });
});

describe('LLM: DB-stored credentials (Connect/Disconnect from the app UI)', () => {
  it('a provider with no env var becomes configured once a key is stored', async () => {
    const { setStoredCredential, getProvidersMeta } = await import('../src/llm');
    let meta = await getProvidersMeta();
    expect(meta.find((p) => p.id === 'gemini')?.configured).toBe(false);

    await setStoredCredential('gemini', 'stored-gemini-key');
    meta = await getProvidersMeta();
    const gemini = meta.find((p) => p.id === 'gemini');
    expect(gemini?.configured).toBe(true);
    expect(gemini?.hasStoredKey).toBe(true);
    expect(gemini?.envConfigured).toBe(false);
  });

  it('complete() uses the stored key when no env var is set', async () => {
    const { setStoredCredential, complete } = await import('../src/llm');
    await setStoredCredential('gemini', 'stored-gemini-key');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'Hi from stored-key Gemini' }] } }] }),
    }) as any;

    const result = await complete('Say hi');
    expect(result.provider).toBe('gemini');
    expect(result.fallback).toBe(false);
    expect(result.text).toBe('Hi from stored-key Gemini');
    // The stored key should be used as the Gemini API's `key` query param.
    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain('key=stored-gemini-key');
  });

  it('an env var always wins over a stored key', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-env-wins';
    const { setStoredCredential, getProvidersMeta } = await import('../src/llm');
    await setStoredCredential('claude', 'stored-key-should-be-ignored');

    const meta = await getProvidersMeta();
    const claude = meta.find((p) => p.id === 'claude');
    expect(claude?.configured).toBe(true);
    expect(claude?.envConfigured).toBe(true);
    // Still reports the stored key exists, even though env takes priority for actual use.
    expect(claude?.hasStoredKey).toBe(true);
  });

  it('deleteStoredCredential removes it and the provider reverts to unconfigured', async () => {
    const { setStoredCredential, deleteStoredCredential, getProvidersMeta } = await import('../src/llm');
    await setStoredCredential('deepseek', 'stored-deepseek-key');
    let meta = await getProvidersMeta();
    expect(meta.find((p) => p.id === 'deepseek')?.configured).toBe(true);

    await deleteStoredCredential('deepseek');
    meta = await getProvidersMeta();
    const deepseek = meta.find((p) => p.id === 'deepseek');
    expect(deepseek?.configured).toBe(false);
    expect(deepseek?.hasStoredKey).toBe(false);
  });

  it('the custom provider requires both a stored apiKey and baseUrl to be usable', async () => {
    const { setStoredCredential, complete } = await import('../src/llm');
    await setStoredCredential('custom', 'stored-custom-key', 'https://my-llm.example.com/v1');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Hi from custom' } }] }),
    }) as any;

    const result = await complete('Say hi');
    expect(result.provider).toBe('custom');
    expect(result.text).toBe('Hi from custom');
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('https://my-llm.example.com/v1/chat/completions');
  });

  it('setActiveConfig lets you select a provider that is only configured via a stored key', async () => {
    const { setStoredCredential, setActiveConfig, resolveActiveProviderId } = await import('../src/llm');
    await setStoredCredential('openai', 'stored-openai-key');
    await setActiveConfig('openai');
    expect(await resolveActiveProviderId()).toBe('openai');
  });
});

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
    expect(mockProvider.isConfigured()).toBe(true);
  });

  it('mockProvider truncates prompts longer than 240 chars', async () => {
    const { mockProvider } = await import('../src/llm/adapters/mock');
    const longPrompt = 'x'.repeat(300);
    const text = await mockProvider.complete(longPrompt);
    expect(text.length).toBeLessThanOrEqual(240 + '【mock】'.length);
  });
});

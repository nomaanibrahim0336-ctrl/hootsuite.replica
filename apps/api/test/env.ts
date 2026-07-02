// Runs before any module import in tests — pins the test environment.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:/tmp/socialhub-test.db';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.SCHEDULER_ENABLED = 'false';
// Ensure no real LLM keys leak into tests → always uses the offline mock provider.
delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.GEMINI_API_KEY;
delete process.env.DEEPSEEK_API_KEY;
delete process.env.CUSTOM_LLM_BASE_URL;
delete process.env.LLM_PROVIDER;

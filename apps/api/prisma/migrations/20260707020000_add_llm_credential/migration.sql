-- CreateTable: user-entered LLM provider API keys (env vars still take priority)
CREATE TABLE IF NOT EXISTS "LlmCredential" (
    "provider" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "baseUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LlmCredential_pkey" PRIMARY KEY ("provider")
);

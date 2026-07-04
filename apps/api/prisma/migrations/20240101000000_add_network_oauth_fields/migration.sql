-- AlterTable: add OAuth token fields to Network
ALTER TABLE "Network" ADD COLUMN IF NOT EXISTS "accessToken"     TEXT;
ALTER TABLE "Network" ADD COLUMN IF NOT EXISTS "refreshToken"    TEXT;
ALTER TABLE "Network" ADD COLUMN IF NOT EXISTS "tokenExpiresAt"  TIMESTAMP(3);
ALTER TABLE "Network" ADD COLUMN IF NOT EXISTS "pageId"          TEXT;
ALTER TABLE "Network" ADD COLUMN IF NOT EXISTS "pageAccessToken" TEXT;

-- AlterTable: add OAuth token fields to Network
ALTER TABLE "Network" ADD COLUMN "accessToken"     TEXT;
ALTER TABLE "Network" ADD COLUMN "refreshToken"    TEXT;
ALTER TABLE "Network" ADD COLUMN "tokenExpiresAt"  DATETIME;
ALTER TABLE "Network" ADD COLUMN "pageId"          TEXT;
ALTER TABLE "Network" ADD COLUMN "pageAccessToken" TEXT;

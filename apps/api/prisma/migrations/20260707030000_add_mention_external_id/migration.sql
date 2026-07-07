-- AlterTable: track provider-synced mentions/comments (e.g. Zernio listening)
ALTER TABLE "Mention" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Mention_externalId_key') THEN
    ALTER TABLE "Mention" ADD CONSTRAINT "Mention_externalId_key" UNIQUE ("externalId");
  END IF;
END $$;

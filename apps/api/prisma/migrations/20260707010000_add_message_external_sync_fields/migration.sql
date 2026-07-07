-- AlterTable: track provider-synced conversations/messages (e.g. Zernio inbox)
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "accountId" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Message_externalId_key') THEN
    ALTER TABLE "Message" ADD CONSTRAINT "Message_externalId_key" UNIQUE ("externalId");
  END IF;
END $$;

ALTER TABLE "MessageReply" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MessageReply_externalId_key') THEN
    ALTER TABLE "MessageReply" ADD CONSTRAINT "MessageReply_externalId_key" UNIQUE ("externalId");
  END IF;
END $$;

-- AlterTable: add internal notes field to Message
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "notes" TEXT;

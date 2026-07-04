-- AlterTable: add Ayrshare profile key to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ayrshareProfileKey" TEXT;

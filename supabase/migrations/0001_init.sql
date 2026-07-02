-- SocialHub — initial schema for Supabase (Postgres 17)
-- Mirrors apps/api/prisma/schema.postgres.prisma exactly (generated via
-- `prisma migrate diff --from-empty --to-schema-datamodel schema.postgres.prisma`).
-- Paste-ready for the Supabase SQL Editor, or run via the Supabase CLI:
--   supabase db push
--
-- The Express API connects with the Postgres connection string (service-role
-- level access, not the anon/publishable key), so it bypasses RLS by design —
-- RLS is enabled below as defense-in-depth for any direct/anon access, with a
-- deny-all default policy set. Adjust policies if you add Supabase Auth later.

begin;

-- ============================================================================
-- Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS "User" (
    "id"           TEXT NOT NULL,
    "email"        TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role"         TEXT NOT NULL DEFAULT 'owner',
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Network" (
    "id"          TEXT NOT NULL,
    "type"        TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "username"    TEXT NOT NULL,
    "followers"   INTEGER NOT NULL DEFAULT 0,
    "connected"   BOOLEAN NOT NULL DEFAULT true,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Network_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Post" (
    "id"             TEXT NOT NULL,
    "content"        TEXT NOT NULL,
    "networks"       TEXT NOT NULL,          -- JSON-encoded string[]
    "status"         TEXT NOT NULL DEFAULT 'draft',
    "hashtags"       TEXT,                    -- JSON-encoded string[]
    "scheduledAt"    TIMESTAMP(3),
    "publishedAt"    TIMESTAMP(3),
    "engagements"    TEXT,                    -- JSON-encoded engagement object
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    "approvalStatus" TEXT NOT NULL DEFAULT 'none', -- none | pending | approved | rejected
    "submittedBy"    TEXT,
    "approvedBy"     TEXT,
    "authorId"       TEXT,
    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id"        TEXT NOT NULL,
    "action"    TEXT NOT NULL,
    "entity"    TEXT NOT NULL,
    "entityId"  TEXT,
    "userId"    TEXT,
    "meta"      TEXT,                         -- JSON-encoded details
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AdvocacyContent" (
    "id"        TEXT NOT NULL,
    "title"     TEXT NOT NULL,
    "body"      TEXT NOT NULL,
    "category"  TEXT NOT NULL DEFAULT 'General',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdvocacyContent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AdvocacyShare" (
    "id"            TEXT NOT NULL,
    "employeeName"  TEXT NOT NULL,
    "employeeEmail" TEXT NOT NULL,
    "reach"         INTEGER NOT NULL DEFAULT 0,
    "sharedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentId"     TEXT NOT NULL,
    CONSTRAINT "AdvocacyShare_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Message" (
    "id"         TEXT NOT NULL,
    "network"    TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "senderUser" TEXT NOT NULL,
    "content"    TEXT NOT NULL,
    "type"       TEXT NOT NULL DEFAULT 'dm',
    "status"     TEXT NOT NULL DEFAULT 'unread',
    "assignedTo" TEXT,
    "sentiment"  TEXT NOT NULL DEFAULT 'neutral',
    "isRead"     BOOLEAN NOT NULL DEFAULT false,
    "timestamp"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MessageReply" (
    "id"        TEXT NOT NULL,
    "content"   TEXT NOT NULL,
    "isFromUs"  BOOLEAN NOT NULL DEFAULT true,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messageId" TEXT NOT NULL,
    CONSTRAINT "MessageReply_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SavedReply" (
    "id"      TEXT NOT NULL,
    "title"   TEXT NOT NULL,
    "content" TEXT NOT NULL,
    CONSTRAINT "SavedReply_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Stream" (
    "id"           TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "keywords"     TEXT NOT NULL,             -- JSON-encoded string[]
    "sources"      TEXT NOT NULL,             -- JSON-encoded string[]
    "isActive"     BOOLEAN NOT NULL DEFAULT true,
    "mentionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Stream_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Mention" (
    "id"         TEXT NOT NULL,
    "network"    TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorUser" TEXT NOT NULL,
    "content"    TEXT NOT NULL,
    "sentiment"  TEXT NOT NULL DEFAULT 'neutral',
    "likes"      INTEGER NOT NULL DEFAULT 0,
    "shares"     INTEGER NOT NULL DEFAULT 0,
    "comments"   INTEGER NOT NULL DEFAULT 0,
    "timestamp"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "streamId"   TEXT,
    CONSTRAINT "Mention_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Report" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "type"      TEXT NOT NULL DEFAULT 'custom',
    "networks"  TEXT NOT NULL,               -- JSON-encoded string[]
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerId"   TEXT,
    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AppSetting" (
    "key"   TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

CREATE TABLE IF NOT EXISTS "TeamMember" (
    "id"       TEXT NOT NULL,
    "name"     TEXT NOT NULL,
    "email"    TEXT NOT NULL,
    "role"     TEXT NOT NULL DEFAULT 'viewer',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Indexes & foreign keys
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- Query-pattern indexes matching the API's filters/sorts (not in the Prisma
-- diff since Prisma doesn't auto-index scalar filter columns).
CREATE INDEX IF NOT EXISTS "Post_status_idx"        ON "Post"("status");
CREATE INDEX IF NOT EXISTS "Post_scheduledAt_idx"    ON "Post"("scheduledAt");
CREATE INDEX IF NOT EXISTS "Post_authorId_idx"       ON "Post"("authorId");
CREATE INDEX IF NOT EXISTS "Message_status_idx"      ON "Message"("status");
CREATE INDEX IF NOT EXISTS "Message_network_idx"     ON "Message"("network");
CREATE INDEX IF NOT EXISTS "Mention_streamId_idx"    ON "Mention"("streamId");
CREATE INDEX IF NOT EXISTS "Mention_sentiment_idx"   ON "Mention"("sentiment");
CREATE INDEX IF NOT EXISTS "MessageReply_messageId_idx" ON "MessageReply"("messageId");
CREATE INDEX IF NOT EXISTS "AdvocacyShare_contentId_idx" ON "AdvocacyShare"("contentId");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx"  ON "AuditLog"("createdAt");

DO $$ BEGIN
  ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AdvocacyShare" ADD CONSTRAINT "AdvocacyShare_contentId_fkey"
    FOREIGN KEY ("contentId") REFERENCES "AdvocacyContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MessageReply" ADD CONSTRAINT "MessageReply_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Mention" ADD CONSTRAINT "Mention_streamId_fkey"
    FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Report" ADD CONSTRAINT "Report_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- Row Level Security
-- The API connects via the Postgres connection string (not the anon key), so
-- it always operates as a privileged role and is unaffected by RLS. Enabling
-- RLS with no permissive policies simply blocks anon/authenticated (PostgREST)
-- access by default — defense in depth if this project's data API is ever
-- exposed. Add explicit policies if you introduce Supabase Auth end-user access.
-- ============================================================================

ALTER TABLE "User"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Network"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Post"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdvocacyContent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdvocacyShare"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MessageReply"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SavedReply"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Stream"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Mention"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Report"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppSetting"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeamMember"      ENABLE ROW LEVEL SECURITY;

commit;

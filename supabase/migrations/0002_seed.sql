-- SocialHub — demo seed data, mirroring apps/api/prisma/seed.ts exactly
-- (same users, posts, messages, streams, mentions, reports, team, advocacy).
-- Safe to re-run: truncates the seeded tables first, like the Prisma seed does.
-- Requires pgcrypto for gen_random_uuid() — Supabase has this enabled by default.

begin;

create extension if not exists pgcrypto;

-- Reset (dev/demo only — same order as prisma/seed.ts to respect FKs)
truncate table
  "MessageReply", "Message", "Mention", "Stream", "Post", "Report",
  "SavedReply", "Network", "TeamMember", "AdvocacyShare", "AdvocacyContent", "User"
restart identity cascade;

-- Owner user. Password is "demo1234" (bcrypt, cost 10) — same as the Prisma seed.
insert into "User" ("id", "email", "name", "passwordHash", "role", "createdAt")
values (
  gen_random_uuid()::text,
  'nomaan.ibrahim0336@gmail.com',
  'Nomaan Ibrahim',
  '$2b$10$ItLDYSnZ4kC0CYoX6hHMJuZwRt.3moPvyYbeaerD.261Cl9r1XP36',
  'owner',
  now()
);

-- Networks
insert into "Network" ("id", "type", "name", "username", "followers", "connected", "connectedAt") values
  (gen_random_uuid()::text, 'facebook',  'SocialHub Inc.', '@socialhub',      48200, true,  now()),
  (gen_random_uuid()::text, 'twitter',   'SocialHub',      '@socialhub',      31450, true,  now()),
  (gen_random_uuid()::text, 'instagram', 'socialhub',      '@socialhub.app',  62890, true,  now()),
  (gen_random_uuid()::text, 'linkedin',  'SocialHub Inc.', 'socialhub-inc',   18700, true,  now()),
  (gen_random_uuid()::text, 'tiktok',    'SocialHub',      '@socialhub',          0, false, now());

-- Posts (scheduledAt/publishedAt offsets match seed.ts's at(offsetDays, hour))
insert into "Post" ("id", "content", "networks", "status", "hashtags", "scheduledAt", "publishedAt", "engagements", "authorId", "createdAt", "updatedAt")
select
  gen_random_uuid()::text,
  '🚀 Big news! Our AI caption generator is now live.',
  '["twitter","linkedin"]', 'scheduled', '["#AI","#SocialMedia"]',
  date_trunc('day', now() + interval '1 day') + interval '9 hours', null, null,
  u."id", now(), now()
from "User" u where u."email" = 'nomaan.ibrahim0336@gmail.com';

insert into "Post" ("id", "content", "networks", "status", "scheduledAt", "authorId", "createdAt", "updatedAt")
select
  gen_random_uuid()::text,
  'Behind the scenes at our HQ ✨',
  '["instagram","facebook"]', 'scheduled',
  date_trunc('day', now() + interval '1 day') + interval '14 hours',
  u."id", now(), now()
from "User" u where u."email" = 'nomaan.ibrahim0336@gmail.com';

insert into "Post" ("id", "content", "networks", "status", "scheduledAt", "authorId", "createdAt", "updatedAt")
select
  gen_random_uuid()::text,
  '5 tips to boost your engagement rate this quarter 🧵',
  '["twitter"]', 'scheduled',
  date_trunc('day', now() + interval '2 days') + interval '11 hours',
  u."id", now(), now()
from "User" u where u."email" = 'nomaan.ibrahim0336@gmail.com';

insert into "Post" ("id", "content", "networks", "status", "publishedAt", "engagements", "authorId", "createdAt", "updatedAt")
select
  gen_random_uuid()::text,
  'New feature drop: Unified Inbox now supports TikTok comments! 🎉',
  '["facebook","twitter","instagram"]', 'published',
  date_trunc('day', now() - interval '2 days') + interval '10 hours',
  '{"likes":1240,"comments":89,"shares":156,"impressions":45200}',
  u."id", now(), now()
from "User" u where u."email" = 'nomaan.ibrahim0336@gmail.com';

insert into "Post" ("id", "content", "networks", "status", "publishedAt", "engagements", "authorId", "createdAt", "updatedAt")
select
  gen_random_uuid()::text,
  'Customer spotlight: How @brightlabs grew 3x with SocialHub 📈',
  '["linkedin","twitter"]', 'published',
  date_trunc('day', now() - interval '3 days') + interval '12 hours',
  '{"likes":890,"comments":45,"shares":210,"impressions":32100}',
  u."id", now(), now()
from "User" u where u."email" = 'nomaan.ibrahim0336@gmail.com';

insert into "Post" ("id", "content", "networks", "status", "authorId", "createdAt", "updatedAt")
select gen_random_uuid()::text, 'Draft: Q3 product roadmap teaser.', '["linkedin"]', 'draft', u."id", now(), now()
from "User" u where u."email" = 'nomaan.ibrahim0336@gmail.com';

-- Messages
insert into "Message" ("id", "network", "senderName", "senderUser", "content", "type", "status", "sentiment", "isRead", "timestamp")
values (gen_random_uuid()::text, 'facebook', 'Emma Watson', '@emma_w', 'Love this product! When is the Android app coming out?', 'comment', 'unread', 'positive', false, now() - interval '1 hour');

insert into "Message" ("id", "network", "senderName", "senderUser", "content", "type", "status", "sentiment", "isRead", "timestamp")
values (gen_random_uuid()::text, 'twitter', 'James Carter', '@jcarter', 'I was charged twice this month, can you help?', 'dm', 'unread', 'negative', false, now() - interval '3 hours');

insert into "Message" ("id", "network", "senderName", "senderUser", "content", "type", "status", "assignedTo", "sentiment", "isRead", "timestamp")
values (gen_random_uuid()::text, 'instagram', 'Sofia Reyes', '@sofiar', 'Your customer support is amazing 🙌', 'mention', 'assigned', 'Sarah Lee', 'positive', true, now() - interval '6 hours');

with m4 as (
  insert into "Message" ("id", "network", "senderName", "senderUser", "content", "type", "status", "sentiment", "isRead", "timestamp")
  values (gen_random_uuid()::text, 'linkedin', 'Liam Chen', '@liamc', 'Is there a student discount available?', 'comment', 'resolved', 'neutral', true, now() - interval '26 hours')
  returning "id"
)
insert into "MessageReply" ("id", "content", "isFromUs", "timestamp", "messageId")
select gen_random_uuid()::text, 'Yes! Email us for 30% off.', true, now() - interval '25 hours', m4."id" from m4;

-- Saved replies
insert into "SavedReply" ("id", "title", "content") values
  (gen_random_uuid()::text, 'Thanks', 'Thank you so much for your kind words! 💜'),
  (gen_random_uuid()::text, 'Billing help', 'Sorry for the trouble! Please DM us your account email.'),
  (gen_random_uuid()::text, 'Feature request', 'Great suggestion! Added to our roadmap. 🚀');

-- Streams
insert into "Stream" ("id", "name", "keywords", "sources", "isActive", "mentionCount", "createdAt")
values (gen_random_uuid()::text, 'Brand Mentions', '["socialhub","@socialhub"]', '["twitter","instagram","facebook"]', true, 342, now());

insert into "Stream" ("id", "name", "keywords", "sources", "isActive", "mentionCount", "createdAt")
values (gen_random_uuid()::text, 'Competitor Watch', '["hootsuite","buffer"]', '["twitter","linkedin"]', true, 1284, now());

-- Mentions (attached to the Brand Mentions stream)
insert into "Mention" ("id", "streamId", "network", "authorName", "authorUser", "content", "sentiment", "likes", "shares", "comments", "timestamp")
select gen_random_uuid()::text, s."id", 'twitter', 'Emma Watson', '@emma_w', 'Just switched to @socialhub and my workflow is 10x better!', 'positive', 33, 5, 2, now() - interval '2 hours'
from "Stream" s where s."name" = 'Brand Mentions';

insert into "Mention" ("id", "streamId", "network", "authorName", "authorUser", "content", "sentiment", "likes", "shares", "comments", "timestamp")
select gen_random_uuid()::text, s."id", 'instagram', 'James Carter', '@jcarter', 'socialhub vs hootsuite — which one do you recommend?', 'neutral', 46, 7, 4, now() - interval '5 hours'
from "Stream" s where s."name" = 'Brand Mentions';

insert into "Mention" ("id", "streamId", "network", "authorName", "authorUser", "content", "sentiment", "likes", "shares", "comments", "timestamp")
select gen_random_uuid()::text, s."id", 'facebook', 'Sofia Reyes', '@sofiar', 'Not happy with the pricing changes at socialhub tbh', 'negative', 12, 1, 8, now() - interval '9 hours'
from "Stream" s where s."name" = 'Brand Mentions';

-- Reports
insert into "Report" ("id", "name", "type", "networks", "ownerId", "createdAt")
select gen_random_uuid()::text, 'Monthly Engagement Overview', 'Engagement', '["facebook","instagram","twitter"]', u."id", now()
from "User" u where u."email" = 'nomaan.ibrahim0336@gmail.com';

insert into "Report" ("id", "name", "type", "networks", "ownerId", "createdAt")
select gen_random_uuid()::text, 'Follower Growth Q2', 'Follower Growth', '["instagram","linkedin"]', u."id", now()
from "User" u where u."email" = 'nomaan.ibrahim0336@gmail.com';

-- Team
insert into "TeamMember" ("id", "name", "email", "role", "joinedAt") values
  (gen_random_uuid()::text, 'Nomaan Ibrahim', 'nomaan.ibrahim0336@gmail.com', 'owner',  now()),
  (gen_random_uuid()::text, 'Sarah Lee',      'sarah@socialhub.app',          'admin',  now()),
  (gen_random_uuid()::text, 'David Okafor',   'david@socialhub.app',          'editor', now());

-- Advocacy content + shares
insert into "AdvocacyContent" ("id", "title", "body", "category", "createdAt")
values (gen_random_uuid()::text, 'Product launch announcement', '🚀 SocialHub AI is here! Share the news with your network.', 'Launch', now());

insert into "AdvocacyContent" ("id", "title", "body", "category", "createdAt")
values (gen_random_uuid()::text, 'We are hiring!', 'Join our team — check out open roles at socialhub.app/careers', 'Recruiting', now());

insert into "AdvocacyShare" ("id", "employeeName", "employeeEmail", "reach", "contentId", "sharedAt")
select gen_random_uuid()::text, 'Sarah Lee', 'sarah@socialhub.app', 3200, c."id", now()
from "AdvocacyContent" c where c."title" = 'Product launch announcement';

insert into "AdvocacyShare" ("id", "employeeName", "employeeEmail", "reach", "contentId", "sharedAt")
select gen_random_uuid()::text, 'David Okafor', 'david@socialhub.app', 1800, c."id", now()
from "AdvocacyContent" c where c."title" = 'Product launch announcement';

commit;

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const j = JSON.stringify;
const now = Date.now();
const day = 86400000;
const at = (offset: number, hour = 10) => {
  const d = new Date(now + offset * day);
  d.setHours(hour, 0, 0, 0);
  return d;
};

async function main() {
  // Reset (dev only)
  await prisma.messageReply.deleteMany();
  await prisma.message.deleteMany();
  await prisma.mention.deleteMany();
  await prisma.stream.deleteMany();
  await prisma.post.deleteMany();
  await prisma.report.deleteMany();
  await prisma.savedReply.deleteMany();
  await prisma.network.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.user.deleteMany();

  const owner = await prisma.user.create({
    data: {
      email: 'nomaan.ibrahim0336@gmail.com',
      name: 'Nomaan Ibrahim',
      passwordHash: await bcrypt.hash('demo1234', 10),
      role: 'owner',
    },
  });

  await prisma.network.createMany({
    data: [
      { type: 'facebook', name: 'SocialHub Inc.', username: '@socialhub', followers: 48200, connected: true },
      { type: 'twitter', name: 'SocialHub', username: '@socialhub', followers: 31450, connected: true },
      { type: 'instagram', name: 'socialhub', username: '@socialhub.app', followers: 62890, connected: true },
      { type: 'linkedin', name: 'SocialHub Inc.', username: 'socialhub-inc', followers: 18700, connected: true },
      { type: 'tiktok', name: 'SocialHub', username: '@socialhub', followers: 0, connected: false },
    ],
  });

  await prisma.post.createMany({
    data: [
      { content: '🚀 Big news! Our AI caption generator is now live.', networks: j(['twitter', 'linkedin']), status: 'scheduled', scheduledAt: at(1, 9), hashtags: j(['#AI', '#SocialMedia']), authorId: owner.id },
      { content: 'Behind the scenes at our HQ ✨', networks: j(['instagram', 'facebook']), status: 'scheduled', scheduledAt: at(1, 14), authorId: owner.id },
      { content: '5 tips to boost your engagement rate this quarter 🧵', networks: j(['twitter']), status: 'scheduled', scheduledAt: at(2, 11), authorId: owner.id },
      { content: 'New feature drop: Unified Inbox now supports TikTok comments! 🎉', networks: j(['facebook', 'twitter', 'instagram']), status: 'published', publishedAt: at(-2, 10), engagements: j({ likes: 1240, comments: 89, shares: 156, impressions: 45200 }), authorId: owner.id },
      { content: 'Customer spotlight: How @brightlabs grew 3x with SocialHub 📈', networks: j(['linkedin', 'twitter']), status: 'published', publishedAt: at(-3, 12), engagements: j({ likes: 890, comments: 45, shares: 210, impressions: 32100 }), authorId: owner.id },
      { content: 'Draft: Q3 product roadmap teaser.', networks: j(['linkedin']), status: 'draft', authorId: owner.id },
    ],
  });

  const m1 = await prisma.message.create({ data: { network: 'facebook', senderName: 'Emma Watson', senderUser: '@emma_w', content: 'Love this product! When is the Android app coming out?', type: 'comment', status: 'unread', sentiment: 'positive', isRead: false, timestamp: new Date(now - 3600000) } });
  await prisma.message.create({ data: { network: 'twitter', senderName: 'James Carter', senderUser: '@jcarter', content: 'I was charged twice this month, can you help?', type: 'dm', status: 'unread', sentiment: 'negative', isRead: false, timestamp: new Date(now - 3 * 3600000) } });
  await prisma.message.create({ data: { network: 'instagram', senderName: 'Sofia Reyes', senderUser: '@sofiar', content: 'Your customer support is amazing 🙌', type: 'mention', status: 'assigned', assignedTo: 'Sarah Lee', sentiment: 'positive', isRead: true, timestamp: new Date(now - 6 * 3600000) } });
  const m4 = await prisma.message.create({ data: { network: 'linkedin', senderName: 'Liam Chen', senderUser: '@liamc', content: 'Is there a student discount available?', type: 'comment', status: 'resolved', sentiment: 'neutral', isRead: true, timestamp: new Date(now - 26 * 3600000) } });
  await prisma.messageReply.create({ data: { messageId: m4.id, content: 'Yes! Email us for 30% off.', isFromUs: true, timestamp: new Date(now - 25 * 3600000) } });
  void m1;

  await prisma.savedReply.createMany({
    data: [
      { title: 'Thanks', content: 'Thank you so much for your kind words! 💜' },
      { title: 'Billing help', content: 'Sorry for the trouble! Please DM us your account email.' },
      { title: 'Feature request', content: 'Great suggestion! Added to our roadmap. 🚀' },
    ],
  });

  const s1 = await prisma.stream.create({ data: { name: 'Brand Mentions', keywords: j(['socialhub', '@socialhub']), sources: j(['twitter', 'instagram', 'facebook']), isActive: true, mentionCount: 342 } });
  await prisma.stream.create({ data: { name: 'Competitor Watch', keywords: j(['hootsuite', 'buffer']), sources: j(['twitter', 'linkedin']), isActive: true, mentionCount: 1284 } });

  await prisma.mention.createMany({
    data: [
      { streamId: s1.id, network: 'twitter', authorName: 'Emma Watson', authorUser: '@emma_w', content: 'Just switched to @socialhub and my workflow is 10x better!', sentiment: 'positive', likes: 33, shares: 5, comments: 2, timestamp: new Date(now - 2 * 3600000) },
      { streamId: s1.id, network: 'instagram', authorName: 'James Carter', authorUser: '@jcarter', content: 'socialhub vs hootsuite — which one do you recommend?', sentiment: 'neutral', likes: 46, shares: 7, comments: 4, timestamp: new Date(now - 5 * 3600000) },
      { streamId: s1.id, network: 'facebook', authorName: 'Sofia Reyes', authorUser: '@sofiar', content: 'Not happy with the pricing changes at socialhub tbh', sentiment: 'negative', likes: 12, shares: 1, comments: 8, timestamp: new Date(now - 9 * 3600000) },
    ],
  });

  await prisma.report.createMany({
    data: [
      { name: 'Monthly Engagement Overview', type: 'Engagement', networks: j(['facebook', 'instagram', 'twitter']), ownerId: owner.id },
      { name: 'Follower Growth Q2', type: 'Follower Growth', networks: j(['instagram', 'linkedin']), ownerId: owner.id },
    ],
  });

  await prisma.teamMember.createMany({
    data: [
      { name: 'Nomaan Ibrahim', email: 'nomaan.ibrahim0336@gmail.com', role: 'owner' },
      { name: 'Sarah Lee', email: 'sarah@socialhub.app', role: 'admin' },
      { name: 'David Okafor', email: 'david@socialhub.app', role: 'editor' },
    ],
  });

  const c1 = await prisma.advocacyContent.create({ data: { title: 'Product launch announcement', body: '🚀 SocialHub AI is here! Share the news with your network.', category: 'Launch' } });
  await prisma.advocacyContent.create({ data: { title: 'We are hiring!', body: 'Join our team — check out open roles at socialhub.app/careers', category: 'Recruiting' } });
  await prisma.advocacyShare.create({ data: { contentId: c1.id, employeeName: 'Sarah Lee', employeeEmail: 'sarah@socialhub.app', reach: 3200 } });
  await prisma.advocacyShare.create({ data: { contentId: c1.id, employeeName: 'David Okafor', employeeEmail: 'david@socialhub.app', reach: 1800 } });

  console.log('✅ Seed complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

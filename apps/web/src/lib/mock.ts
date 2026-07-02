import type {
  Network,
  Post,
  Message,
  SavedReply,
  Stream,
  Mention,
  SentimentPoint,
  AnalyticsMetric,
  AnalyticsPoint,
  NetworkBreakdown,
  Report,
  TeamMember,
  User,
  NetworkType,
  AdvocacyContent,
  AdvocacyLeader,
  ActivityItem,
  AuditEntry,
} from './types';

export const currentUser: User = {
  id: 'u1',
  email: 'nomaan.ibrahim0336@gmail.com',
  name: 'Nomaan Ibrahim',
  role: 'owner',
  createdAt: '2025-01-12T09:00:00Z',
};

export const networks: Network[] = [
  { id: 'n1', type: 'facebook', name: 'SocialHub Inc.', username: '@socialhub', followers: 48200, connected: true, connectedAt: '2025-02-01' },
  { id: 'n2', type: 'twitter', name: 'SocialHub', username: '@socialhub', followers: 31450, connected: true, connectedAt: '2025-02-01' },
  { id: 'n3', type: 'instagram', name: 'socialhub', username: '@socialhub.app', followers: 62890, connected: true, connectedAt: '2025-02-03' },
  { id: 'n4', type: 'linkedin', name: 'SocialHub Inc.', username: 'socialhub-inc', followers: 18700, connected: true, connectedAt: '2025-02-05' },
  { id: 'n5', type: 'tiktok', name: 'SocialHub', username: '@socialhub', followers: 0, connected: false, connectedAt: '' },
];

const now = Date.now();
const day = 86400000;
const iso = (offsetDays: number, hour = 10): string => {
  const d = new Date(now + offsetDays * day);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

export const posts: Post[] = [
  { id: 'p1', content: '🚀 Big news! Our AI caption generator is now live. Create scroll-stopping content in seconds.', networks: ['twitter', 'linkedin'], status: 'scheduled', scheduledAt: iso(1, 9), hashtags: ['#AI', '#SocialMedia'], createdAt: iso(-1), updatedAt: iso(-1) },
  { id: 'p2', content: 'Behind the scenes at our HQ ✨ Meet the team building the future of social.', networks: ['instagram', 'facebook'], status: 'scheduled', scheduledAt: iso(1, 14), hashtags: ['#TeamCulture'], createdAt: iso(-1), updatedAt: iso(-1) },
  { id: 'p3', content: '5 tips to boost your engagement rate this quarter 🧵', networks: ['twitter'], status: 'scheduled', scheduledAt: iso(2, 11), createdAt: iso(-1), updatedAt: iso(-1) },
  { id: 'p4', content: 'Weekend vibes 🌴 What are you posting this weekend?', networks: ['instagram'], status: 'scheduled', scheduledAt: iso(3, 16), createdAt: iso(-1), updatedAt: iso(-1) },
  { id: 'p5', content: 'How we scaled to 1M scheduled posts — a deep dive on our infrastructure.', networks: ['linkedin'], status: 'scheduled', scheduledAt: iso(4, 10), createdAt: iso(-1), updatedAt: iso(-1) },
  { id: 'p6', content: 'New feature drop: Unified Inbox now supports TikTok comments! 🎉', networks: ['facebook', 'twitter', 'instagram'], status: 'published', publishedAt: iso(-2, 10), engagements: { likes: 1240, comments: 89, shares: 156, impressions: 45200 }, createdAt: iso(-3), updatedAt: iso(-2) },
  { id: 'p7', content: 'Customer spotlight: How @brightlabs grew 3x with SocialHub 📈', networks: ['linkedin', 'twitter'], status: 'published', publishedAt: iso(-3, 12), engagements: { likes: 890, comments: 45, shares: 210, impressions: 32100 }, createdAt: iso(-4), updatedAt: iso(-3) },
  { id: 'p8', content: 'Monday motivation 💪 Your content calendar is your best friend.', networks: ['instagram', 'facebook'], status: 'published', publishedAt: iso(-5, 9), engagements: { likes: 2100, comments: 134, shares: 98, impressions: 58900 }, createdAt: iso(-6), updatedAt: iso(-5) },
  { id: 'p9', content: 'Draft: Q3 product roadmap teaser — need approval before publishing.', networks: ['linkedin'], status: 'draft', createdAt: iso(-1), updatedAt: iso(-1) },
  { id: 'p10', content: 'Failed to publish — token expired. Reconnect Instagram to retry.', networks: ['instagram'], status: 'failed', scheduledAt: iso(-1, 8), createdAt: iso(-2), updatedAt: iso(-1) },
];

const senders = [
  ['Emma Watson', '@emma_w'], ['James Carter', '@jcarter'], ['Sofia Reyes', '@sofiar'],
  ['Liam Chen', '@liamc'], ['Ava Patel', '@avap'], ['Noah Kim', '@noahk'],
  ['Mia Torres', '@miat'], ['Lucas Brown', '@lucasb'],
];
const netCycle: NetworkType[] = ['facebook', 'twitter', 'instagram', 'linkedin'];
const msgTexts = [
  'Love this product! When is the Android app coming out?',
  'I was charged twice this month, can you help?',
  'Your customer support is amazing 🙌',
  'Is there a student discount available?',
  'The scheduling feature saved me hours. Thank you!',
  'Having trouble connecting my LinkedIn account.',
  'Can you add support for Pinterest?',
  'This is the best social tool I have used. 10/10',
  'My analytics report is not loading, any ideas?',
  'Do you offer an enterprise plan for 50+ seats?',
];
const sentiments = ['positive', 'negative', 'positive', 'neutral', 'positive', 'negative', 'neutral', 'positive', 'negative', 'neutral'] as const;

export const messages: Message[] = msgTexts.map((content, i) => ({
  id: `m${i + 1}`,
  network: netCycle[i % netCycle.length],
  sender: { name: senders[i % senders.length][0], username: senders[i % senders.length][1] },
  content,
  type: i % 3 === 0 ? 'comment' : i % 3 === 1 ? 'dm' : 'mention',
  status: i < 4 ? 'unread' : i < 7 ? 'assigned' : 'resolved',
  assignedTo: i >= 4 && i < 7 ? 'Sarah Lee' : undefined,
  timestamp: new Date(now - i * 3.5 * 3600000).toISOString(),
  isRead: i >= 4,
  sentiment: sentiments[i],
  thread: i >= 7
    ? [{ id: `r${i}`, content: 'Thanks for reaching out! We are on it. 🙏', isFromUs: true, timestamp: new Date(now - i * 3 * 3600000).toISOString() }]
    : [],
}));

export const savedReplies: SavedReply[] = [
  { id: 'sr1', title: 'Thanks', content: 'Thank you so much for your kind words! 💜 We really appreciate it.' },
  { id: 'sr2', title: 'Billing help', content: 'Sorry for the trouble! Please DM us your account email and we will resolve it right away.' },
  { id: 'sr3', title: 'Feature request', content: 'Great suggestion! We have added it to our roadmap. Stay tuned. 🚀' },
  { id: 'sr4', title: 'Support link', content: 'You can reach our support team 24/7 at help.socialhub.app — happy to help!' },
];

export const streams: Stream[] = [
  { id: 's1', name: 'Brand Mentions', keywords: ['socialhub', '@socialhub', 'social hub'], sources: ['twitter', 'instagram', 'facebook'], isActive: true, mentionCount: 342, createdAt: '2025-03-01' },
  { id: 's2', name: 'Competitor Watch', keywords: ['hootsuite', 'buffer', 'sprout social'], sources: ['twitter', 'linkedin'], isActive: true, mentionCount: 1284, createdAt: '2025-03-05' },
  { id: 's3', name: 'Industry Trends', keywords: ['social media marketing', '#smm', 'content strategy'], sources: ['twitter', 'linkedin', 'instagram'], isActive: false, mentionCount: 5620, createdAt: '2025-03-10' },
];

const mentionTexts = [
  'Just switched to @socialhub and my workflow is 10x better!',
  'Anyone else finding social media scheduling a nightmare? Looking at socialhub.',
  'socialhub vs hootsuite — which one do you recommend?',
  '@socialhub your new dashboard is gorgeous 😍',
  'Not happy with the pricing changes at socialhub tbh',
  'The social hub analytics are so detailed, love it.',
  'Migrating our whole team to social hub this week 🚀',
  'socialhub support replied in 2 minutes. Impressive.',
  'Wish socialhub had a native Pinterest integration.',
  'Content strategy tip: batch your posts with socialhub.',
];

export const mentions: Mention[] = mentionTexts.map((content, i) => ({
  id: `mt${i + 1}`,
  streamId: 's1',
  network: netCycle[i % netCycle.length],
  author: { name: senders[i % senders.length][0], username: senders[i % senders.length][1] },
  content,
  sentiment: sentiments[i],
  timestamp: new Date(now - i * 2.2 * 3600000).toISOString(),
  engagements: { likes: 20 + i * 13, shares: 3 + i * 2, comments: 1 + i },
}));

export const sentimentTrend: SentimentPoint[] = Array.from({ length: 14 }, (_, i) => ({
  date: new Date(now - (13 - i) * day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  positive: 40 + Math.round(Math.sin(i / 2) * 12 + i),
  neutral: 20 + Math.round(Math.cos(i / 3) * 6),
  negative: 8 + Math.round(Math.abs(Math.sin(i / 4)) * 6),
}));

export const dashboardMetrics: AnalyticsMetric[] = [
  { label: 'Total Posts', value: 248, change: 12.5, changeType: 'increase' },
  { label: 'Scheduled', value: 32, change: 8.1, changeType: 'increase' },
  { label: 'Published (30d)', value: 186, change: 4.3, changeType: 'increase' },
  { label: 'Total Followers', value: 161240, change: 2.7, changeType: 'increase' },
];

export const analyticsMetrics: AnalyticsMetric[] = [
  { label: 'Impressions', value: 1284000, change: 14.2, changeType: 'increase' },
  { label: 'Engagements', value: 89400, change: 9.8, changeType: 'increase' },
  { label: 'Follower Growth', value: 4320, change: 21.4, changeType: 'increase' },
  { label: 'Link Clicks', value: 27600, change: -3.1, changeType: 'decrease' },
];

export const analyticsTrend: AnalyticsPoint[] = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(now - (29 - i) * day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  impressions: 30000 + Math.round(Math.sin(i / 3) * 8000 + i * 400),
  engagements: 2200 + Math.round(Math.cos(i / 4) * 700 + i * 30),
  clicks: 700 + Math.round(Math.sin(i / 5) * 200 + i * 8),
}));

export const networkBreakdown: NetworkBreakdown[] = [
  { network: 'instagram', value: 38 },
  { network: 'facebook', value: 27 },
  { network: 'twitter', value: 21 },
  { network: 'linkedin', value: 14 },
];

export const reports: Report[] = [
  { id: 'rp1', name: 'Monthly Engagement Overview', type: 'Engagement', networks: ['facebook', 'instagram', 'twitter'], createdAt: '2026-06-01' },
  { id: 'rp2', name: 'Follower Growth Q2', type: 'Follower Growth', networks: ['instagram', 'linkedin'], createdAt: '2026-05-15' },
  { id: 'rp3', name: 'Competitor Benchmark', type: 'Custom', networks: ['twitter', 'linkedin'], createdAt: '2026-05-02' },
  { id: 'rp4', name: 'Campaign ROI — Summer Launch', type: 'Reach', networks: ['facebook', 'instagram'], createdAt: '2026-04-20' },
];

export const reportTemplates = [
  { id: 't1', name: 'Engagement Report', desc: 'Likes, comments, shares & engagement rate across networks.' },
  { id: 't2', name: 'Follower Growth', desc: 'Track audience growth and net new followers over time.' },
  { id: 't3', name: 'Post Performance', desc: 'Top performing posts ranked by reach and engagement.' },
  { id: 't4', name: 'Competitor Benchmark', desc: 'Compare your performance against competitors.' },
  { id: 't5', name: 'ROI & Conversions', desc: 'Measure revenue and conversions from social activity.' },
  { id: 't6', name: 'Team Productivity', desc: 'Posts created, response times & approval metrics.' },
];

export const team: TeamMember[] = [
  { id: 't1', name: 'Nomaan Ibrahim', email: 'nomaan.ibrahim0336@gmail.com', role: 'owner', joinedAt: '2025-01-12' },
  { id: 't2', name: 'Sarah Lee', email: 'sarah@socialhub.app', role: 'admin', joinedAt: '2025-02-20' },
  { id: 't3', name: 'David Okafor', email: 'david@socialhub.app', role: 'editor', joinedAt: '2025-03-11' },
  { id: 't4', name: 'Priya Nair', email: 'priya@socialhub.app', role: 'editor', joinedAt: '2025-04-02' },
  { id: 't5', name: 'Marco Rossi', email: 'marco@socialhub.app', role: 'viewer', joinedAt: '2025-05-18' },
];

// Approval status on a few posts (drives the approvals queue + chips).
posts.forEach((p) => {
  if (!p.approvalStatus) p.approvalStatus = 'none';
});
posts[8] && (posts[8].approvalStatus = 'pending'); // the draft
if (posts[0]) posts[0].approvalStatus = 'approved';
export const pendingApprovals = () => posts.filter((p) => p.approvalStatus === 'pending');

export const advocacyContent: AdvocacyContent[] = [
  { id: 'ac1', title: 'Product launch announcement', body: '🚀 SocialHub AI is here! Create scroll-stopping content in seconds. Share the news with your network.', category: 'Launch', shareCount: 42 },
  { id: 'ac2', title: 'We are hiring!', body: 'Join our team — we are looking for engineers, designers and marketers. Check open roles at socialhub.app/careers 🌱', category: 'Recruiting', shareCount: 18 },
  { id: 'ac3', title: 'Customer success story', body: 'See how @brightlabs grew 3x with SocialHub. Real results, real growth. 📈', category: 'Social Proof', shareCount: 27 },
  { id: 'ac4', title: 'Industry report 2026', body: 'Our State of Social 2026 report is live — 40+ pages of trends and benchmarks. Download free.', category: 'Content', shareCount: 63 },
];

export const advocacyLeaderboard: AdvocacyLeader[] = [
  { name: 'Priya Nair', shares: 34, reach: 128400 },
  { name: 'Sarah Lee', shares: 29, reach: 96200 },
  { name: 'David Okafor', shares: 21, reach: 71800 },
  { name: 'Marco Rossi', shares: 12, reach: 38900 },
];

export const advocacyStats = { totalShares: 96, totalReach: 335300, activeAdvocates: 12 };

export const activityStream: ActivityItem[] = [
  { id: 'a1', kind: 'message', network: 'facebook', actor: 'Emma Watson', text: 'Love this product! When is the Android app coming out?', timestamp: new Date(now - 0.4 * 3600000).toISOString(), sentiment: 'positive' },
  { id: 'a2', kind: 'mention', network: 'twitter', actor: 'Ava Patel', text: 'Just switched to @socialhub and my workflow is 10x better!', timestamp: new Date(now - 1.1 * 3600000).toISOString(), sentiment: 'positive' },
  { id: 'a3', kind: 'published', network: 'instagram', actor: 'You', text: 'New feature drop: Unified Inbox now supports TikTok comments! 🎉', timestamp: new Date(now - 2 * 3600000).toISOString() },
  { id: 'a4', kind: 'message', network: 'twitter', actor: 'James Carter', text: 'I was charged twice this month, can you help?', timestamp: new Date(now - 3 * 3600000).toISOString(), sentiment: 'negative' },
  { id: 'a5', kind: 'approval', network: 'linkedin', actor: 'Sarah Lee', text: 'approved “Q3 product roadmap teaser”', timestamp: new Date(now - 4.5 * 3600000).toISOString() },
  { id: 'a6', kind: 'mention', network: 'facebook', actor: 'Sofia Reyes', text: 'Not happy with the pricing changes at socialhub tbh', timestamp: new Date(now - 6 * 3600000).toISOString(), sentiment: 'negative' },
];

export const brandHealth = { score: 82, delta: 3.4, positive: 68, neutral: 22, negative: 10 };

// Best-time-to-post heuristic (engagement index 0-100 per weekday hour bucket).
export const bestTimes = [
  { day: 'Mon', hour: '9 AM', score: 74 },
  { day: 'Tue', hour: '10 AM', score: 91 },
  { day: 'Wed', hour: '12 PM', score: 83 },
  { day: 'Thu', hour: '5 PM', score: 79 },
  { day: 'Fri', hour: '11 AM', score: 88 },
];

export const auditLog: AuditEntry[] = [
  { id: 'au1', action: 'post.approve', entity: 'Q3 product roadmap teaser', actor: 'Sarah Lee', timestamp: new Date(now - 4.5 * 3600000).toISOString() },
  { id: 'au2', action: 'post.publish', entity: 'New feature drop', actor: 'Nomaan Ibrahim', timestamp: new Date(now - 2 * 3600000).toISOString() },
  { id: 'au3', action: 'team.invite', entity: 'marco@socialhub.app', actor: 'Nomaan Ibrahim', timestamp: new Date(now - 26 * 3600000).toISOString() },
  { id: 'au4', action: 'advocacy.share', entity: 'Product launch announcement', actor: 'Priya Nair', timestamp: new Date(now - 30 * 3600000).toISOString() },
  { id: 'au5', action: 'network.connect', entity: 'Instagram', actor: 'Nomaan Ibrahim', timestamp: new Date(now - 72 * 3600000).toISOString() },
];

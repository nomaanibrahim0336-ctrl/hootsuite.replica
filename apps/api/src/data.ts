// In-memory mock data store for the SocialHub API (Phase 2 — no real DB).
import { randomUUID } from 'crypto';

export type NetworkType = 'facebook' | 'twitter' | 'linkedin' | 'instagram' | 'tiktok';
export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';
export type MessageStatus = 'unread' | 'assigned' | 'resolved';
export type SentimentType = 'positive' | 'negative' | 'neutral';
export type UserRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
}

const now = Date.now();
const day = 86400000;
const iso = (offset: number, hour = 10): string => {
  const d = new Date(now + offset * day);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

export const db = {
  users: [] as User[],

  networks: [
    { id: 'n1', type: 'facebook', name: 'SocialHub Inc.', username: '@socialhub', followers: 48200, connected: true, connectedAt: '2025-02-01' },
    { id: 'n2', type: 'twitter', name: 'SocialHub', username: '@socialhub', followers: 31450, connected: true, connectedAt: '2025-02-01' },
    { id: 'n3', type: 'instagram', name: 'socialhub', username: '@socialhub.app', followers: 62890, connected: true, connectedAt: '2025-02-03' },
    { id: 'n4', type: 'linkedin', name: 'SocialHub Inc.', username: 'socialhub-inc', followers: 18700, connected: true, connectedAt: '2025-02-05' },
    { id: 'n5', type: 'tiktok', name: 'SocialHub', username: '@socialhub', followers: 0, connected: false, connectedAt: '' },
  ] as any[],

  posts: [
    { id: 'p1', content: '🚀 Big news! Our AI caption generator is now live.', networks: ['twitter', 'linkedin'], status: 'scheduled', scheduledAt: iso(1, 9), hashtags: ['#AI', '#SocialMedia'], createdAt: iso(-1), updatedAt: iso(-1) },
    { id: 'p2', content: 'Behind the scenes at our HQ ✨', networks: ['instagram', 'facebook'], status: 'scheduled', scheduledAt: iso(1, 14), createdAt: iso(-1), updatedAt: iso(-1) },
    { id: 'p3', content: '5 tips to boost your engagement rate this quarter 🧵', networks: ['twitter'], status: 'scheduled', scheduledAt: iso(2, 11), createdAt: iso(-1), updatedAt: iso(-1) },
    { id: 'p6', content: 'New feature drop: Unified Inbox now supports TikTok comments! 🎉', networks: ['facebook', 'twitter', 'instagram'], status: 'published', publishedAt: iso(-2, 10), engagements: { likes: 1240, comments: 89, shares: 156, impressions: 45200 }, createdAt: iso(-3), updatedAt: iso(-2) },
    { id: 'p7', content: 'Customer spotlight: How @brightlabs grew 3x with SocialHub 📈', networks: ['linkedin', 'twitter'], status: 'published', publishedAt: iso(-3, 12), engagements: { likes: 890, comments: 45, shares: 210, impressions: 32100 }, createdAt: iso(-4), updatedAt: iso(-3) },
    { id: 'p9', content: 'Draft: Q3 product roadmap teaser.', networks: ['linkedin'], status: 'draft', createdAt: iso(-1), updatedAt: iso(-1) },
  ] as any[],

  messages: [
    { id: 'm1', network: 'facebook', sender: { name: 'Emma Watson', username: '@emma_w' }, content: 'Love this product! When is the Android app coming out?', type: 'comment', status: 'unread', timestamp: new Date(now - 1 * 3600000).toISOString(), isRead: false, sentiment: 'positive', thread: [] },
    { id: 'm2', network: 'twitter', sender: { name: 'James Carter', username: '@jcarter' }, content: 'I was charged twice this month, can you help?', type: 'dm', status: 'unread', timestamp: new Date(now - 3 * 3600000).toISOString(), isRead: false, sentiment: 'negative', thread: [] },
    { id: 'm3', network: 'instagram', sender: { name: 'Sofia Reyes', username: '@sofiar' }, content: 'Your customer support is amazing 🙌', type: 'mention', status: 'assigned', assignedTo: 'Sarah Lee', timestamp: new Date(now - 6 * 3600000).toISOString(), isRead: true, sentiment: 'positive', thread: [] },
    { id: 'm4', network: 'linkedin', sender: { name: 'Liam Chen', username: '@liamc' }, content: 'Is there a student discount available?', type: 'comment', status: 'resolved', timestamp: new Date(now - 26 * 3600000).toISOString(), isRead: true, sentiment: 'neutral', thread: [{ id: 'r1', content: 'Yes! Email us for 30% off.', isFromUs: true, timestamp: new Date(now - 25 * 3600000).toISOString() }] },
  ] as any[],

  savedReplies: [
    { id: 'sr1', title: 'Thanks', content: 'Thank you so much for your kind words! 💜' },
    { id: 'sr2', title: 'Billing help', content: 'Sorry for the trouble! Please DM us your account email.' },
    { id: 'sr3', title: 'Feature request', content: 'Great suggestion! Added to our roadmap. 🚀' },
  ] as any[],

  streams: [
    { id: 's1', name: 'Brand Mentions', keywords: ['socialhub', '@socialhub'], sources: ['twitter', 'instagram', 'facebook'], isActive: true, mentionCount: 342, createdAt: '2025-03-01' },
    { id: 's2', name: 'Competitor Watch', keywords: ['hootsuite', 'buffer'], sources: ['twitter', 'linkedin'], isActive: true, mentionCount: 1284, createdAt: '2025-03-05' },
  ] as any[],

  mentions: [
    { id: 'mt1', streamId: 's1', network: 'twitter', author: { name: 'Emma Watson', username: '@emma_w' }, content: 'Just switched to @socialhub and my workflow is 10x better!', sentiment: 'positive', timestamp: new Date(now - 2 * 3600000).toISOString(), engagements: { likes: 33, shares: 5, comments: 2 } },
    { id: 'mt2', streamId: 's1', network: 'instagram', author: { name: 'James Carter', username: '@jcarter' }, content: 'socialhub vs hootsuite — which one do you recommend?', sentiment: 'neutral', timestamp: new Date(now - 5 * 3600000).toISOString(), engagements: { likes: 46, shares: 7, comments: 4 } },
    { id: 'mt3', streamId: 's1', network: 'facebook', author: { name: 'Sofia Reyes', username: '@sofiar' }, content: 'Not happy with the pricing changes at socialhub tbh', sentiment: 'negative', timestamp: new Date(now - 9 * 3600000).toISOString(), engagements: { likes: 12, shares: 1, comments: 8 } },
  ] as any[],

  reports: [
    { id: 'rp1', name: 'Monthly Engagement Overview', type: 'Engagement', networks: ['facebook', 'instagram', 'twitter'], createdAt: '2026-06-01' },
    { id: 'rp2', name: 'Follower Growth Q2', type: 'Follower Growth', networks: ['instagram', 'linkedin'], createdAt: '2026-05-15' },
  ] as any[],

  team: [
    { id: 't1', name: 'Nomaan Ibrahim', email: 'nomaan.ibrahim0336@gmail.com', role: 'owner', joinedAt: '2025-01-12' },
    { id: 't2', name: 'Sarah Lee', email: 'sarah@socialhub.app', role: 'admin', joinedAt: '2025-02-20' },
    { id: 't3', name: 'David Okafor', email: 'david@socialhub.app', role: 'editor', joinedAt: '2025-03-11' },
  ] as any[],
};

// Analytics generators
export function analyticsTrend() {
  return Array.from({ length: 30 }, (_, i) => ({
    date: new Date(now - (29 - i) * day).toISOString().slice(0, 10),
    impressions: 30000 + Math.round(Math.sin(i / 3) * 8000 + i * 400),
    engagements: 2200 + Math.round(Math.cos(i / 4) * 700 + i * 30),
    clicks: 700 + Math.round(Math.sin(i / 5) * 200 + i * 8),
  }));
}

export function sentimentTrend() {
  return Array.from({ length: 14 }, (_, i) => ({
    date: new Date(now - (13 - i) * day).toISOString().slice(0, 10),
    positive: 40 + Math.round(Math.sin(i / 2) * 12 + i),
    neutral: 20 + Math.round(Math.cos(i / 3) * 6),
    negative: 8 + Math.round(Math.abs(Math.sin(i / 4)) * 6),
  }));
}

export const analyticsMetrics = [
  { label: 'Impressions', value: 1284000, change: 14.2, changeType: 'increase' },
  { label: 'Engagements', value: 89400, change: 9.8, changeType: 'increase' },
  { label: 'Follower Growth', value: 4320, change: 21.4, changeType: 'increase' },
  { label: 'Link Clicks', value: 27600, change: -3.1, changeType: 'decrease' },
];

export const networkBreakdown = [
  { network: 'instagram', value: 38 },
  { network: 'facebook', value: 27 },
  { network: 'twitter', value: 21 },
  { network: 'linkedin', value: 14 },
];

export const uid = () => randomUUID();

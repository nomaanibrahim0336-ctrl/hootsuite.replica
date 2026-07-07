// Frontend-local type mirror of @hootsuite/shared (kept standalone for Phase 1).
export type NetworkType = 'facebook' | 'twitter' | 'linkedin' | 'instagram' | 'tiktok';
export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';
export type MessageStatus = 'unread' | 'assigned' | 'resolved';
export type SentimentType = 'positive' | 'negative' | 'neutral';
export type UserRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
  createdAt: string;
}

export interface Network {
  id: string;
  type: NetworkType;
  name: string;
  username: string;
  followers: number;
  connected: boolean;
  connectedAt: string;
}

export interface Post {
  id: string;
  content: string;
  networks: NetworkType[];
  status: PostStatus;
  approvalStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  scheduledAt?: string;
  publishedAt?: string;
  hashtags?: string[];
  engagements?: {
    likes: number;
    comments: number;
    shares: number;
    impressions: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AdvocacyContent {
  id: string;
  title: string;
  body: string;
  category: string;
  shareCount: number;
}

export interface AdvocacyLeader {
  name: string;
  shares: number;
  reach: number;
}

export interface ActivityItem {
  id: string;
  kind: 'message' | 'mention' | 'published' | 'approval';
  network: NetworkType;
  actor: string;
  text: string;
  timestamp: string;
  sentiment?: SentimentType;
}

export interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  actor: string;
  timestamp: string;
}

export interface MessageReply {
  id: string;
  content: string;
  isFromUs: boolean;
  timestamp: string;
}

export interface Message {
  id: string;
  network: NetworkType;
  sender: { name: string; username: string };
  content: string;
  type: 'dm' | 'comment' | 'mention';
  status: MessageStatus;
  assignedTo?: string;
  timestamp: string;
  isRead: boolean;
  sentiment: SentimentType;
  thread: MessageReply[];
  notes?: string;
}

export interface SavedReply {
  id: string;
  title: string;
  content: string;
}

export interface Stream {
  id: string;
  name: string;
  keywords: string[];
  sources: NetworkType[];
  isActive: boolean;
  mentionCount: number;
  createdAt: string;
}

export interface Mention {
  id: string;
  streamId: string;
  network: NetworkType;
  author: { name: string; username: string };
  content: string;
  sentiment: SentimentType;
  timestamp: string;
  engagements: { likes: number; shares: number; comments: number };
}

export interface SentimentPoint {
  date: string;
  positive: number;
  neutral: number;
  negative: number;
}

export interface AnalyticsMetric {
  label: string;
  value: number;
  change: number;
  changeType: 'increase' | 'decrease';
}

export interface AnalyticsPoint {
  date: string;
  impressions: number;
  engagements: number;
  clicks: number;
}

export interface NetworkBreakdown {
  network: NetworkType;
  value: number;
}

export interface Report {
  id: string;
  name: string;
  type: string;
  networks: NetworkType[];
  createdAt: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  joinedAt: string;
}

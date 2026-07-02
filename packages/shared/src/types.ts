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

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface Network {
  id: string;
  type: NetworkType;
  name: string;
  username: string;
  avatar?: string;
  followers: number;
  connected: boolean;
  connectedAt: string;
}

export interface Post {
  id: string;
  content: string;
  networks: NetworkType[];
  status: PostStatus;
  scheduledAt?: string;
  publishedAt?: string;
  mediaUrls?: string[];
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

export interface Message {
  id: string;
  network: NetworkType;
  sender: {
    name: string;
    username: string;
    avatar?: string;
  };
  content: string;
  status: MessageStatus;
  assignedTo?: string;
  timestamp: string;
  isRead: boolean;
  thread?: MessageReply[];
}

export interface MessageReply {
  id: string;
  content: string;
  isFromUs: boolean;
  timestamp: string;
}

export interface SavedReply {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

export interface Stream {
  id: string;
  name: string;
  keywords: string[];
  sources: NetworkType[];
  isActive: boolean;
  createdAt: string;
}

export interface Mention {
  id: string;
  streamId: string;
  network: NetworkType;
  author: {
    name: string;
    username: string;
    avatar?: string;
  };
  content: string;
  sentiment: SentimentType;
  url?: string;
  timestamp: string;
  engagements: {
    likes: number;
    shares: number;
    comments: number;
  };
}

export interface AnalyticsMetric {
  label: string;
  value: number;
  change: number;
  changeType: 'increase' | 'decrease';
  network?: NetworkType;
}

export interface AnalyticsDataPoint {
  date: string;
  impressions: number;
  engagements: number;
  clicks: number;
  followers: number;
}

export interface Report {
  id: string;
  name: string;
  type: 'engagement' | 'reach' | 'follower-growth' | 'custom';
  networks: NetworkType[];
  dateRange: {
    start: string;
    end: string;
  };
  createdAt: string;
  lastExported?: string;
}

export interface TeamMember {
  id: string;
  user: User;
  role: UserRole;
  joinedAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
}

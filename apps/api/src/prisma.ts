import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// --- Serialization helpers (SQLite has no native array/JSON column) ---
export const toJson = (v: unknown): string => JSON.stringify(v ?? null);
export const fromJson = <T>(v: string | null | undefined, fallback: T): T => {
  if (!v) return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
};

// --- Row → API shape mappers (match Phase 2 response contracts) ---
export const mapPost = (p: any) => ({
  id: p.id,
  content: p.content,
  networks: fromJson<string[]>(p.networks, []),
  status: p.status,
  hashtags: fromJson<string[] | undefined>(p.hashtags, undefined),
  scheduledAt: p.scheduledAt?.toISOString?.() ?? p.scheduledAt ?? undefined,
  publishedAt: p.publishedAt?.toISOString?.() ?? p.publishedAt ?? undefined,
  engagements: fromJson<any>(p.engagements, undefined),
  approvalStatus: p.approvalStatus ?? 'none',
  submittedBy: p.submittedBy ?? undefined,
  approvedBy: p.approvedBy ?? undefined,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

export const mapMessage = (m: any) => ({
  id: m.id,
  network: m.network,
  sender: { name: m.senderName, username: m.senderUser },
  content: m.content,
  type: m.type,
  status: m.status,
  assignedTo: m.assignedTo ?? undefined,
  sentiment: m.sentiment,
  isRead: m.isRead,
  notes: m.notes ?? '',
  timestamp: m.timestamp,
  thread: (m.replies ?? []).map((r: any) => ({
    id: r.id,
    content: r.content,
    isFromUs: r.isFromUs,
    timestamp: r.timestamp,
  })),
});

export const mapStream = (s: any) => ({
  id: s.id,
  name: s.name,
  keywords: fromJson<string[]>(s.keywords, []),
  sources: fromJson<string[]>(s.sources, []),
  isActive: s.isActive,
  mentionCount: s.mentionCount,
  createdAt: s.createdAt,
});

export const mapMention = (m: any) => ({
  id: m.id,
  streamId: m.streamId ?? undefined,
  network: m.network,
  author: { name: m.authorName, username: m.authorUser },
  content: m.content,
  sentiment: m.sentiment,
  timestamp: m.timestamp,
  engagements: { likes: m.likes, shares: m.shares, comments: m.comments },
});

export const mapReport = (r: any) => ({
  id: r.id,
  name: r.name,
  type: r.type,
  networks: fromJson<string[]>(r.networks, []),
  createdAt: r.createdAt,
});

import clsx, { type ClassValue } from 'clsx';
import type { NetworkType, SentimentType } from './types';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toString();
}

export const NETWORK_META: Record<
  NetworkType,
  { label: string; color: string; bg: string; short: string }
> = {
  facebook: { label: 'Facebook', color: '#1877f2', bg: '#e7f0fe', short: 'FB' },
  twitter: { label: 'Twitter / X', color: '#0f1419', bg: '#e8e8e9', short: 'X' },
  linkedin: { label: 'LinkedIn', color: '#0a66c2', bg: '#e6f0f8', short: 'IN' },
  instagram: { label: 'Instagram', color: '#e1306c', bg: '#fce7ef', short: 'IG' },
  tiktok: { label: 'TikTok', color: '#010101', bg: '#e8e8e9', short: 'TT' },
};

export const NETWORK_LIMITS: Record<NetworkType, number> = {
  facebook: 63206,
  twitter: 280,
  linkedin: 3000,
  instagram: 2200,
  tiktok: 2200,
};

export const SENTIMENT_META: Record<
  SentimentType,
  { label: string; color: string; bg: string }
> = {
  positive: { label: 'Positive', color: '#10b981', bg: '#d1fae5' },
  neutral: { label: 'Neutral', color: '#64748b', bg: '#e2e8f0' },
  negative: { label: 'Negative', color: '#ef4444', bg: '#fee2e2' },
};

export function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

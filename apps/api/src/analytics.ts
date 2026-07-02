// Computed analytics series. These are deterministic generators rather than
// stored rows; Phase 6 will replace them with real metric rollups.
const now = Date.now();
const day = 86400000;

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

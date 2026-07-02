// Lightweight lexicon-based sentiment classifier. Deterministic and dependency-free.
// Phase 5 will optionally replace this with a real ML/LLM classifier.

const POSITIVE = [
  'love', 'great', 'amazing', 'awesome', 'excellent', 'best', 'fantastic', 'happy',
  'good', 'wonderful', 'perfect', 'thank', 'thanks', 'better', 'gorgeous', 'impressive',
  'recommend', 'switched', '10x', 'saved', '🙌', '😍', '💜', '🚀', '🎉',
];
const NEGATIVE = [
  'hate', 'bad', 'terrible', 'awful', 'worst', 'poor', 'broken', 'bug', 'issue',
  'problem', 'charged', 'trouble', 'not happy', 'unhappy', 'disappointed', 'nightmare',
  'expensive', 'refund', 'cancel', 'slow', 'fail', 'failed', 'error', '😡', '👎',
];

export type Sentiment = 'positive' | 'negative' | 'neutral';

export function classifySentiment(text: string): Sentiment {
  const t = (text || '').toLowerCase();
  let score = 0;
  for (const w of POSITIVE) if (t.includes(w)) score++;
  for (const w of NEGATIVE) if (t.includes(w)) score--;
  if (score > 0) return 'positive';
  if (score < 0) return 'negative';
  return 'neutral';
}

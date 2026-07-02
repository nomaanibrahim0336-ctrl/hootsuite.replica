import { Router } from 'express';
import { complete, getStatus, getProvidersMeta, setActiveConfig, ProviderId } from '../llm';
import { classifySentiment } from '../sentiment';
import { requirePermission, PERMISSIONS } from '../rbac';

const router = Router();

// --- Provider management ---
router.get('/status', async (_req, res) => {
  res.json({ success: true, data: await getStatus() });
});

router.get('/providers', async (_req, res) => {
  res.json({ success: true, data: await getProvidersMeta() });
});

router.put('/config', requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  const { provider, model } = req.body ?? {};
  if (!provider) return res.status(400).json({ success: false, error: 'provider is required' });
  try {
    await setActiveConfig(provider as ProviderId, model);
    res.json({ success: true, data: await getStatus() });
  } catch (e) {
    res.status(400).json({ success: false, error: (e as Error).message });
  }
});

// --- Generation ---
router.post('/caption', async (req, res) => {
  const { prompt = 'your product', tone = 'professional', length = 200 } = req.body ?? {};
  const system = 'You are an expert social media copywriter. Reply with ONLY the caption text, no preamble.';
  const p = `Write a ${tone} social media caption of about ${length} characters about: ${prompt}. Include tasteful emoji.`;
  const { text, provider, fallback } = await complete(p, { system, maxTokens: 300 });
  const useMock = fallback || provider === 'mock';
  const caption = useMock ? mockCaption(prompt, tone) : text;
  res.json({ success: true, data: { caption, provider, fallback: useMock } });
});

router.post('/hashtags', async (req, res) => {
  const { topic = 'social media', count = 8 } = req.body ?? {};
  const system = 'You output only hashtags, space-separated, each starting with #. No other text.';
  const p = `Generate ${count} relevant, high-reach hashtags for: ${topic}`;
  const { text, provider, fallback } = await complete(p, { system, maxTokens: 150 });
  const useMock = fallback || provider === 'mock';
  const parsed = Array.from(new Set((text.match(/#[\p{L}0-9_]+/gu) ?? []))).slice(0, Number(count));
  const hashtags = useMock || parsed.length === 0 ? mockHashtags(topic, Number(count)) : parsed;
  res.json({ success: true, data: { hashtags, provider, fallback: useMock || parsed.length === 0 } });
});

router.post('/ideas', async (req, res) => {
  const { industry = 'tech', count = 5 } = req.body ?? {};
  const system = 'You output a numbered list of concise social media post ideas, one per line.';
  const p = `Generate ${count} engaging social media post ideas for a brand in the ${industry} industry.`;
  const { text, provider, fallback } = await complete(p, { system, maxTokens: 400 });
  const useMock = fallback || provider === 'mock';
  const parsed = text.split('\n').map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean).slice(0, Number(count));
  const ideas = useMock || parsed.length === 0 ? mockIdeas(industry, Number(count)) : parsed;
  res.json({ success: true, data: { ideas, provider, fallback: useMock || parsed.length === 0 } });
});

// LLM-backed sentiment with lexicon fallback.
router.post('/sentiment', async (req, res) => {
  const { text = '' } = req.body ?? {};
  const system = 'Classify sentiment. Reply with exactly one word: positive, negative, or neutral.';
  const { text: out, provider, fallback } = await complete(`Text: "${text}"`, { system, maxTokens: 5, temperature: 0 });
  let sentiment = out.toLowerCase().trim();
  if (!['positive', 'negative', 'neutral'].includes(sentiment)) sentiment = classifySentiment(text);
  res.json({ success: true, data: { sentiment, provider, fallback: fallback || !['positive', 'negative', 'neutral'].includes(out.toLowerCase().trim()) } });
});

// --- Offline fallbacks (used when no provider key is configured) ---
function mockCaption(prompt: string, tone: string): string {
  const openers: Record<string, string> = {
    professional: '📊 Insights that matter:',
    casual: '👋 Hey friends!',
    playful: '✨ Plot twist:',
    bold: '🔥 Stop scrolling.',
  };
  return `${openers[tone] ?? openers.professional} Here is why ${prompt} is a game-changer. Save this and share it with your team. 🚀`;
}
function mockHashtags(topic: string, count: number): string[] {
  const base = String(topic).toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ').filter(Boolean);
  const extras = ['marketing', 'growth', 'trending', 'contentcreator', 'digital', 'strategy', 'branding', 'viral'];
  return Array.from(new Set([...base, ...extras].map((w) => `#${w}`))).slice(0, count);
}
function mockIdeas(industry: string, count: number): string[] {
  return [
    `Behind-the-scenes look at a day in ${industry}`,
    `5 myths about ${industry} — busted`,
    `A customer success story from the ${industry} world`,
    `Quick tip Tuesday: level up your ${industry} game`,
    `Ask the audience: your biggest ${industry} challenge?`,
    `Trend alert: what is next for ${industry} in 2026`,
  ].slice(0, count);
}

export default router;

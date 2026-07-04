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

// Campaign generator: turn a single brief into a batch of ready-to-schedule posts.
router.post('/campaign', async (req, res) => {
  const { brief = 'our product', count = 5, tone = 'professional', networks = ['twitter', 'linkedin'] } = req.body ?? {};
  const n = Math.min(Math.max(Number(count) || 5, 1), 12);
  const system =
    'You are a senior social media strategist. Output ONLY a numbered list, one post per line, ' +
    'no preamble, no hashtags block — write each post as a complete ready-to-publish caption with tasteful emoji.';
  const p = `Write ${n} distinct ${tone} social media posts for a campaign about: ${brief}. Vary the angle of each (tip, story, question, stat, announcement).`;
  const { text, provider, fallback } = await complete(p, { system, maxTokens: 900 });
  const useMock = fallback || provider === 'mock';
  let posts = text
    .split('\n')
    .map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, n);
  if (useMock || posts.length === 0) posts = mockCampaign(String(brief), n, String(tone));
  const data = posts.map((content) => ({ content, networks }));
  res.json({ success: true, data: { posts: data, provider, fallback: useMock || posts.length === 0 } });
});

// Repurpose one post into per-network variants (X truncation, LinkedIn long-form, IG hooks, etc.).
router.post('/repurpose', async (req, res) => {
  const { content = '', networks = ['twitter', 'linkedin', 'instagram'] } = req.body ?? {};
  const nets: string[] = Array.isArray(networks) ? networks : [];
  const system =
    'You adapt one social post for different platforms. For each requested network, output a line in the exact ' +
    'form "network: adapted caption". Keep X/twitter under 280 chars, make LinkedIn more professional/long-form, ' +
    'Instagram punchy with emoji, TikTok casual with a hook. No other text.';
  const p = `Original post: "${content}"\nAdapt it for: ${nets.join(', ')}`;
  const { text, provider, fallback } = await complete(p, { system, maxTokens: 600 });
  const useMock = fallback || provider === 'mock';
  const variants: Record<string, string> = {};
  if (!useMock) {
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([a-zA-Z/ ]+?)\s*:\s*(.+)$/);
      if (m) {
        const key = m[1].toLowerCase().replace('/', '').replace('x', 'twitter').trim();
        if (nets.includes(key)) variants[key] = m[2].trim();
      }
    }
  }
  for (const net of nets) if (!variants[net]) variants[net] = mockRepurpose(String(content), net);
  res.json({ success: true, data: { variants, provider, fallback: useMock || Object.keys(variants).length === 0 } });
});

// Draft a reply to an inbox message, tuned to its sentiment.
router.post('/reply', async (req, res) => {
  const { message = '', sentiment = 'neutral', tone = 'friendly' } = req.body ?? {};
  const system = 'You are a helpful brand support agent. Reply with ONLY the suggested reply text, no preamble. Keep it concise and on-brand.';
  const p = `A customer wrote (${sentiment} sentiment): "${message}". Draft a ${tone} reply.`;
  const { text, provider, fallback } = await complete(p, { system, maxTokens: 200 });
  const useMock = fallback || provider === 'mock';
  const reply = useMock ? mockReply(String(sentiment)) : text.trim();
  res.json({ success: true, data: { reply, provider, fallback: useMock } });
});

// --- Offline fallbacks (used when no provider key is configured) ---
function mockCampaign(brief: string, count: number, tone: string): string[] {
  const angles = [
    `🚀 Big news about ${brief} — here's why it matters for you.`,
    `💡 Quick tip: get more out of ${brief} with this one change.`,
    `🤔 What's the hardest part of ${brief}? Tell us below 👇`,
    `📊 The numbers on ${brief} might surprise you.`,
    `✨ Behind the scenes of how we approach ${brief}.`,
    `🔥 Stop scrolling — ${brief} is about to change your workflow.`,
    `📣 Customer story: how ${brief} made a real difference.`,
    `🧵 A short thread on everything you should know about ${brief}.`,
    `⏰ Best time to think about ${brief}? Right now.`,
    `🎯 Three reasons ${brief} deserves your attention this week.`,
    `🙌 We asked our team about ${brief} — here's what they said.`,
    `📈 How ${brief} drives real, measurable results.`,
  ];
  return angles.slice(0, count);
}
function mockRepurpose(content: string, network: string): string {
  const trimmed = content.length > 240 ? content.slice(0, 237) + '…' : content;
  switch (network) {
    case 'twitter':
      return trimmed;
    case 'linkedin':
      return `${content}\n\nWhat's your take? I'd love to hear how your team approaches this.`;
    case 'instagram':
      return `✨ ${content} ✨\n\nDouble-tap if you agree! 💬👇`;
    case 'tiktok':
      return `POV: ${content} 🎬 #fyp`;
    default:
      return content;
  }
}
function mockReply(sentiment: string): string {
  if (sentiment === 'negative') return "So sorry to hear that! 🙏 Please DM us your account email and we'll make this right straight away.";
  if (sentiment === 'positive') return 'Thank you so much for the kind words! 💜 It means a lot to our whole team.';
  return 'Thanks for reaching out! Happy to help — could you share a little more detail so we can point you in the right direction?';
}

// --- Offline fallbacks for the original generators ---
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

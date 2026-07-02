import { Router } from 'express';

const router = Router();

// Mock AI endpoints — deterministic-ish generated content (no external LLM call in Phase 2).
router.post('/caption', (req, res) => {
  const { prompt = 'your product', tone = 'professional' } = req.body ?? {};
  const openers: Record<string, string> = {
    professional: '📊 Insights that matter:',
    casual: '👋 Hey friends!',
    playful: '✨ Plot twist:',
    bold: '🔥 Stop scrolling.',
  };
  const opener = openers[tone] ?? openers.professional;
  const caption = `${opener} Here is why ${prompt} is a game-changer. Save this post and share it with your team. 🚀`;
  res.json({ success: true, data: { caption } });
});

router.post('/hashtags', (req, res) => {
  const { topic = 'social media', count = 8 } = req.body ?? {};
  const base = String(topic).toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ').filter(Boolean);
  const extras = ['marketing', 'growth', 'trending', 'contentcreator', 'digital', 'strategy', 'branding', 'viral'];
  const tags = [...base.map((w) => `#${w}`), ...extras.map((w) => `#${w}`)]
    .slice(0, Number(count))
    .map((t) => t.replace(/\s/g, ''));
  res.json({ success: true, data: { hashtags: Array.from(new Set(tags)) } });
});

router.post('/ideas', (req, res) => {
  const { industry = 'tech', count = 5 } = req.body ?? {};
  const templates = [
    `Behind-the-scenes look at a day in ${industry}`,
    `5 myths about ${industry} — busted`,
    `A customer success story from the ${industry} world`,
    `Quick tip Tuesday: level up your ${industry} game`,
    `Ask the audience: what is your biggest ${industry} challenge?`,
    `Trend alert: what is next for ${industry} in 2026`,
    `Meet the team building the future of ${industry}`,
  ];
  res.json({ success: true, data: { ideas: templates.slice(0, Number(count)) } });
});

export default router;

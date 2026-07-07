import { createApp } from './app';
import { startScheduler } from './scheduler';
import { ensureZernioWebhookRegistered } from './zernioWebhookSetup';

const PORT = Number(process.env.PORT) || 3001;
const app = createApp();

app.listen(PORT, () => {
  console.log(`🚀 SocialHub API listening on http://localhost:${PORT}`);
  startScheduler();
  ensureZernioWebhookRegistered().catch((e) => console.error('[zernio-webhook] startup registration error:', e.message));
});

export default app;

import { createApp } from './app';
import { startScheduler } from './scheduler';

const PORT = Number(process.env.PORT) || 3001;
const app = createApp();

app.listen(PORT, () => {
  console.log(`🚀 SocialHub API listening on http://localhost:${PORT}`);
  startScheduler();
});

export default app;

import { Router } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../prisma';
import { signTokens, verifyRefresh } from '../auth';

const router = Router();

const publicUser = (u: any) => ({ id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.createdAt });

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body ?? {};
  if (!email || !password || !name) {
    return res.status(400).json({ success: false, error: 'email, password and name are required' });
  }
  if (await prisma.user.findUnique({ where: { email } })) {
    return res.status(409).json({ success: false, error: 'Email already registered' });
  }
  const user = await prisma.user.create({
    data: { email, name, passwordHash: await bcrypt.hash(password, 10), role: 'owner' },
  });
  res.status(201).json({ success: true, data: { user: publicUser(user), ...signTokens(user.id) } });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  let user = await prisma.user.findUnique({ where: { email } });
  // Demo convenience: unknown email creates a session user.
  if (!user) {
    user = await prisma.user.create({
      data: { email: email || 'demo@socialhub.app', name: 'Demo User', passwordHash: '', role: 'owner' },
    });
    return res.json({ success: true, data: { user: publicUser(user), ...signTokens(user.id) } });
  }
  const ok = user.passwordHash ? await bcrypt.compare(password ?? '', user.passwordHash) : true;
  if (!ok) return res.status(401).json({ success: false, error: 'Invalid credentials' });
  res.json({ success: true, data: { user: publicUser(user), ...signTokens(user.id) } });
});

router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body ?? {};
  const userId = refreshToken && verifyRefresh(refreshToken);
  if (!userId) return res.status(401).json({ success: false, error: 'Invalid refresh token' });
  res.json({ success: true, data: signTokens(userId) });
});

router.post('/logout', (_req, res) => res.json({ success: true, data: null }));

export default router;

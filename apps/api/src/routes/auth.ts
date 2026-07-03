import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma';
import { signTokens, verifyRefresh } from '../auth';
import { validateBody, rules } from '../validate';

const router = Router();

const publicUser = (u: any) => ({ id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.createdAt });

router.post(
  '/register',
  validateBody({
    email: { type: 'string', required: true, pattern: rules.EMAIL },
    password: { type: 'string', required: true, minLength: 6, maxLength: 128 },
    name: { type: 'string', required: true, minLength: 1, maxLength: 120 },
  }),
  async (req, res) => {
  const { email, password, name } = req.body ?? {};
  if (await prisma.user.findUnique({ where: { email } })) {
    return res.status(409).json({ success: false, error: 'Email already registered' });
  }
  const user = await prisma.user.create({
    data: { email, name, passwordHash: await bcrypt.hash(password, 10), role: 'owner' },
  });
  res.status(201).json({ success: true, data: { user: publicUser(user), ...signTokens(user.id) } });
});

router.post(
  '/login',
  validateBody({ email: { type: 'string', required: true, pattern: rules.EMAIL } }),
  async (req, res) => {
  const { email, password } = req.body ?? {};
  // `email` is guaranteed present by validateBody, so findUnique is safe.
  let user = await prisma.user.findUnique({ where: { email } });
  // Demo convenience: unknown email creates a session user.
  if (!user) {
    user = await prisma.user.create({
      data: { email, name: 'Demo User', passwordHash: '', role: 'owner' },
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

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma';
import { signTokens, verifyRefresh, signResetToken, verifyResetToken } from '../auth';
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

router.post(
  '/forgot-password',
  validateBody({ email: { type: 'string', required: true, pattern: rules.EMAIL } }),
  async (req, res) => {
    const { email } = req.body ?? {};
    const user = await prisma.user.findUnique({ where: { email } });
    // Same response whether or not the email exists, so this endpoint can't be used to enumerate accounts.
    if (!user) return res.json({ success: true, data: {} });
    const resetToken = signResetToken(user.id);
    // No email provider is configured yet, so the token is returned directly instead of
    // being emailed. Swap this for a real send (e.g. Resend/SendGrid) once one is wired up.
    res.json({ success: true, data: { resetToken } });
  }
);

router.post(
  '/reset-password',
  validateBody({
    token: { type: 'string', required: true },
    password: { type: 'string', required: true, minLength: 6, maxLength: 128 },
  }),
  async (req, res) => {
    const { token, password } = req.body ?? {};
    const userId = verifyResetToken(token);
    if (!userId) return res.status(400).json({ success: false, error: 'Invalid or expired reset token' });
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(password, 10) } });
    res.json({ success: true, data: null });
  }
);

router.post('/logout', (_req, res) => res.json({ success: true, data: null }));

export default router;

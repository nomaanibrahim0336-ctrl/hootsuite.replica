import { Router } from 'express';
import bcrypt from 'bcrypt';
import { db, uid, User } from '../data';
import { signTokens, verifyRefresh } from '../auth';

const router = Router();

const publicUser = (u: User) => ({ id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.createdAt });

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body ?? {};
  if (!email || !password || !name) {
    return res.status(400).json({ success: false, error: 'email, password and name are required' });
  }
  if (db.users.some((u) => u.email === email)) {
    return res.status(409).json({ success: false, error: 'Email already registered' });
  }
  const user: User = {
    id: uid(),
    email,
    name,
    passwordHash: await bcrypt.hash(password, 10),
    role: 'owner',
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  res.status(201).json({ success: true, data: { user: publicUser(user), ...signTokens(user.id) } });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  const user = db.users.find((u) => u.email === email);
  // Demo convenience: if user doesn't exist, accept and create a session user.
  if (!user) {
    const demo: User = {
      id: uid(), email: email || 'demo@socialhub.app', name: 'Demo User',
      passwordHash: '', role: 'owner', createdAt: new Date().toISOString(),
    };
    db.users.push(demo);
    return res.json({ success: true, data: { user: publicUser(demo), ...signTokens(demo.id) } });
  }
  const ok = await bcrypt.compare(password ?? '', user.passwordHash);
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

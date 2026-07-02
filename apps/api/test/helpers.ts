import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

export const app = createApp();

let counter = 0;

/** Register a fresh user and return { token, userId, email }. */
export async function authAs(role: 'owner' | 'admin' | 'editor' | 'viewer' = 'owner') {
  const email = `user${Date.now()}_${counter++}@test.com`;
  const res = await request(app).post('/api/auth/register').send({ email, password: 'secret123', name: 'Test User' });
  const token = res.body.data.accessToken as string;
  const userId = res.body.data.user.id as string;
  if (role !== 'owner') await prisma.user.update({ where: { id: userId }, data: { role } });
  return { token, userId, email };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function seedStream() {
  return prisma.stream.create({
    data: { name: 'Test Stream', keywords: JSON.stringify(['brand']), sources: JSON.stringify(['twitter']), isActive: true, mentionCount: 0 },
  });
}

export async function seedMessage() {
  return prisma.message.create({
    data: { network: 'twitter', senderName: 'Tester', senderUser: '@tester', content: 'hello there', type: 'dm', status: 'unread', sentiment: 'neutral', isRead: false },
  });
}

export async function seedReport() {
  return prisma.report.create({ data: { name: 'Test Report', type: 'Engagement', networks: JSON.stringify(['twitter']) } });
}

export async function seedAdvocacy() {
  return prisma.advocacyContent.create({ data: { title: 'Share me', body: 'body', category: 'General' } });
}

export async function closeDb() {
  await prisma.$disconnect();
}

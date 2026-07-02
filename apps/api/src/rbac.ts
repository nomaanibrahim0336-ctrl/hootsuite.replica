import { Response, NextFunction } from 'express';
import { AuthedRequest } from './auth';
import { prisma } from './prisma';

export type Role = 'owner' | 'admin' | 'editor' | 'viewer';

// Role hierarchy → the set of permissions each role holds.
export const PERMISSIONS = {
  CREATE_POST: 'create_post',
  PUBLISH_POST: 'publish_post',
  APPROVE_POST: 'approve_post',
  VIEW_ANALYTICS: 'view_analytics',
  MANAGE_TEAM: 'manage_team',
  MANAGE_ADVOCACY: 'manage_advocacy',
  MANAGE_SETTINGS: 'manage_settings',
  VIEW_AUDIT: 'view_audit',
} as const;

const ALL = Object.values(PERMISSIONS);
export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  owner: ALL,
  admin: ALL,
  editor: [PERMISSIONS.CREATE_POST, PERMISSIONS.PUBLISH_POST, PERMISSIONS.VIEW_ANALYTICS],
  viewer: [PERMISSIONS.VIEW_ANALYTICS],
};

export async function getRole(userId?: string): Promise<Role> {
  if (!userId) return 'viewer';
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return (user?.role as Role) ?? 'viewer';
}

/** Middleware: require that the caller's role holds a given permission. */
export function requirePermission(permission: string) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    const role = await getRole(req.userId);
    if (!ROLE_PERMISSIONS[role]?.includes(permission)) {
      return res.status(403).json({ success: false, error: `Forbidden: requires ${permission}` });
    }
    next();
  };
}

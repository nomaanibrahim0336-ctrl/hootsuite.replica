import { prisma, toJson } from './prisma';

/** Record an action to the audit trail. Fire-and-forget; never throws to the caller. */
export async function logAudit(
  userId: string | undefined,
  action: string,
  entity: string,
  entityId?: string,
  meta?: unknown
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: { userId: userId ?? null, action, entity, entityId: entityId ?? null, meta: meta ? toJson(meta) : null },
    });
  } catch (e) {
    console.error('[audit] failed to log', e);
  }
}

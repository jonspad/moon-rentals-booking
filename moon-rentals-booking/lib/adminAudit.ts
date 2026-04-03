import { prisma } from '@/lib/prisma';

export async function recordAdminAction(input: {
  action: string;
  entity: string;
  entityId?: number | null;
  metadata?: unknown;
}) {
  try {
    await prisma.adminAction.create({
      data: {
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        metadata:
          input.metadata === undefined ? null : JSON.stringify(input.metadata),
      },
    });
  } catch (error) {
    console.error('Failed to record admin action:', error);
  }
}

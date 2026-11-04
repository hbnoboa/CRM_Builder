import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** A propria pessoa + quem esta em alguma equipe com ela (na empresa). */
export async function teammateIds(prisma: PrismaService, userId: string, tenantId: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ userId: string }>>(Prisma.sql`
    SELECT DISTINCT other."userId"
    FROM "TeamMember" mine
    JOIN "Team" t ON t.id = mine."teamId" AND t."tenantId" = ${tenantId}
    JOIN "TeamMember" other ON other."teamId" = mine."teamId"
    WHERE mine."userId" = ${userId}
  `);
  return [...new Set([userId, ...rows.map((r) => r.userId)])];
}

/** Filtro por criador a partir da lista (null = sem restricao). */
export function creatorFilter(ids: string[] | null): string | { in: string[] } | undefined {
  if (!ids) return undefined;
  return ids.length === 1 ? ids[0] : { in: ids };
}

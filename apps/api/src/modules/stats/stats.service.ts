import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  // Helper: PLATFORM_ADMIN ve tudo, demais filtram por tenant
  private getWhere(tenantId: string, roleType: string) {
    if (roleType === 'PLATFORM_ADMIN') return {};
    return { tenantId };
  }

  async getDashboardStats(tenantId: string, roleType: string) {
    const where = this.getWhere(tenantId, roleType);

    const [
      totalEntities,
      totalRecords,
      totalPages,
      totalApis,
      totalUsers,
      totalTenants,
    ] = await Promise.all([
      this.prisma.entity.count({ where }),
      this.prisma.entityData.count({ where }),
      this.prisma.page.count({ where }),
      this.prisma.customEndpoint.count({ where }),
      this.prisma.user.count({ where }),
      roleType === 'PLATFORM_ADMIN'
        ? this.prisma.tenant.count()
        : Promise.resolve(0),
    ]);

    return {
      totalEntities,
      totalRecords,
      totalPages,
      totalApis,
      totalUsers,
      ...(roleType === 'PLATFORM_ADMIN' ? { totalTenants } : {}),
    };
  }

  async getRecordsOverTime(tenantId: string, role: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Tentar usar Materialized View primeiro (mais rapido)
    try {
      const isPlatformAdmin = role === 'PLATFORM_ADMIN';

      // Query otimizada usando agregacao no banco
      let records: Array<{ record_date: Date; count: bigint }>;

      if (isPlatformAdmin) {
        records = await this.prisma.$queryRaw`
          SELECT
            DATE_TRUNC('day', "createdAt") as record_date,
            COUNT(*) as count
          FROM "EntityData"
          WHERE "createdAt" >= ${startDate}
            AND "deletedAt" IS NULL
          GROUP BY DATE_TRUNC('day', "createdAt")
          ORDER BY record_date ASC
        `;
      } else {
        records = await this.prisma.$queryRaw`
          SELECT
            DATE_TRUNC('day', "createdAt") as record_date,
            COUNT(*) as count
          FROM "EntityData"
          WHERE "createdAt" >= ${startDate}
            AND "deletedAt" IS NULL
            AND "tenantId" = ${tenantId}
          GROUP BY DATE_TRUNC('day', "createdAt")
          ORDER BY record_date ASC
        `;
      }

      // Converter para formato esperado
      const grouped = new Map(
        records.map((r) => [
          r.record_date.toISOString().split('T')[0],
          Number(r.count),
        ]),
      );

      // Fill missing dates with 0
      const result: { date: string; count: number }[] = [];
      const currentDate = new Date(startDate);
      const today = new Date();

      while (currentDate <= today) {
        const dateStr = currentDate.toISOString().split('T')[0];
        result.push({
          date: dateStr,
          count: grouped.get(dateStr) || 0,
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }

      return result;
    } catch (error) {
      // Fallback para query Prisma se raw query falhar
      console.error('Raw query failed, falling back to Prisma:', error);
      return this.getRecordsOverTimeFallback(tenantId, role, days);
    }
  }

  // Fallback method (menos eficiente, mas funciona)
  private async getRecordsOverTimeFallback(tenantId: string, role: string, days: number) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const baseWhere = this.getWhere(tenantId, role);

    // Usar groupBy do Prisma para evitar carregar todos registros
    const grouped = await this.prisma.entityData.groupBy({
      by: ['createdAt'],
      where: {
        ...baseWhere,
        createdAt: { gte: startDate },
        deletedAt: null,
      },
      _count: { id: true },
    });

    // Agrupar por dia
    const dateMap = new Map<string, number>();
    for (const item of grouped) {
      const dateStr = item.createdAt.toISOString().split('T')[0];
      dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + item._count.id);
    }

    // Fill missing dates
    const result: { date: string; count: number }[] = [];
    const currentDate = new Date(startDate);
    const today = new Date();

    while (currentDate <= today) {
      const dateStr = currentDate.toISOString().split('T')[0];
      result.push({
        date: dateStr,
        count: dateMap.get(dateStr) || 0,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  }

  async getEntitiesDistribution(tenantId: string, role: string) {
    const where = this.getWhere(tenantId, role);

    // Usar groupBy para evitar N+1 (1 query ao inves de N+1)
    const [entities, counts] = await Promise.all([
      this.prisma.entity.findMany({
        where,
        select: { id: true, name: true, slug: true },
      }),
      this.prisma.entityData.groupBy({
        by: ['entityId'],
        where,
        _count: { id: true },
      }),
    ]);

    const countMap = new Map(
      counts.map((c) => [c.entityId, c._count.id]),
    );

    return entities
      .map((entity) => ({
        name: entity.name,
        slug: entity.slug,
        records: countMap.get(entity.id) || 0,
      }))
      .filter((item) => item.records > 0);
  }

  async getUsersActivity(tenantId: string, role: string, days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const where = this.getWhere(tenantId, role);
    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        lastLoginAt: true,
      },
      orderBy: { lastLoginAt: { sort: 'desc', nulls: 'last' } },
      take: 10,
    });

    return users;
  }

  async getRecentActivity(tenantId: string, role: string, limit: number = 10) {
    const where = this.getWhere(tenantId, role);

    const [records, pages, entities] = await Promise.all([
      this.prisma.entityData.findMany({
        where,
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          entity: { select: { name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      }),
      this.prisma.page.findMany({
        where,
        select: {
          id: true,
          title: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      }),
      this.prisma.entity.findMany({
        where,
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      }),
    ]);

    const activities = [
      ...records.map((r) => ({
        id: r.id,
        type: 'record' as const,
        action:
          r.createdAt.getTime() === r.updatedAt.getTime()
            ? ('created' as const)
            : ('updated' as const),
        name: `Registro`,
        entityName: r.entity.name,
        timestamp: r.updatedAt.toISOString(),
      })),
      ...pages.map((p) => ({
        id: p.id,
        type: 'page' as const,
        action:
          p.createdAt.getTime() === p.updatedAt.getTime()
            ? ('created' as const)
            : ('updated' as const),
        name: p.title,
        timestamp: p.updatedAt.toISOString(),
      })),
      ...entities.map((e) => ({
        id: e.id,
        type: 'entity' as const,
        action:
          e.createdAt.getTime() === e.updatedAt.getTime()
            ? ('created' as const)
            : ('updated' as const),
        name: e.name,
        timestamp: e.updatedAt.toISOString(),
      })),
    ];

    // Sort by timestamp and take top N
    return activities
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, limit);
  }
}

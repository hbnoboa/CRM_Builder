import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats(tenantId: string, organizationId?: string) {
    // EntityData não tem workspaceId, apenas tenantId
    const whereEntity = {
      tenantId,
    };

    // Page, Entity e CustomEndpoint têm workspaceId (opcional)
    const whereWithWorkspace = {
      tenantId,
      ...(organizationId && { workspaceId: organizationId }),
    };

    const [
      totalEntities,
      totalRecords,
      totalPages,
      totalApis,
      totalUsers,
      totalOrganizations,
    ] = await Promise.all([
      this.prisma.entity.count({ where: whereWithWorkspace }),
      this.prisma.entityData.count({ where: whereEntity }),
      this.prisma.page.count({ where: whereWithWorkspace }),
      this.prisma.customEndpoint.count({ where: whereWithWorkspace }),
      this.prisma.user.count({ where: { tenantId } }),
      this.prisma.organization.count({ where: { tenantId } }),
    ]);

    return {
      totalEntities,
      totalRecords,
      totalPages,
      totalApis,
      totalUsers,
      totalOrganizations,
    };
  }

  async getRecordsOverTime(
    tenantId: string,
    organizationId?: string,
    days: number = 30,
  ) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const records = await this.prisma.entityData.findMany({
      where: {
        tenantId,
        createdAt: { gte: startDate },
      },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date
    const grouped = records.reduce(
      (acc: Record<string, number>, record: { createdAt: Date }) => {
        const date = record.createdAt.toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      },
      {},
    );

    // Fill missing dates with 0
    const result: { date: string; count: number }[] = [];
    const currentDate = new Date(startDate);
    const today = new Date();

    while (currentDate <= today) {
      const dateStr = currentDate.toISOString().split('T')[0];
      result.push({
        date: dateStr,
        count: grouped[dateStr] || 0,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  }

  async getEntitiesDistribution(tenantId: string, organizationId?: string) {
    const whereWithWorkspace = {
      tenantId,
      ...(organizationId && { workspaceId: organizationId }),
    };

    const entities = await this.prisma.entity.findMany({
      where: whereWithWorkspace,
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    const distribution = await Promise.all(
      entities.map(async (entity) => {
        const count = await this.prisma.entityData.count({
          where: {
            entityId: entity.id,
            tenantId,
          },
        });

        return {
          name: entity.name,
          slug: entity.slug,
          records: count,
        };
      }),
    );

    return distribution.filter((item) => item.records > 0);
  }

  async getUsersActivity(tenantId: string, days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const users = await this.prisma.user.findMany({
      where: { tenantId },
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

  async getRecentActivity(
    tenantId: string,
    organizationId?: string,
    limit: number = 10,
  ) {
    const whereEntity = {
      tenantId,
    };

    const whereWithWorkspace = {
      tenantId,
      ...(organizationId && { workspaceId: organizationId }),
    };

    const [records, pages, entities] = await Promise.all([
      this.prisma.entityData.findMany({
        where: whereEntity,
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
        where: whereWithWorkspace,
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
        where: whereWithWorkspace,
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

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomRoleService } from '../custom-role/custom-role.service';
import { CurrentUser } from '../../common/types';
import { RoleType } from '../../common/decorators/roles.decorator';
import { getEffectiveTenantId } from '../../common/utils/tenant.util';
import { buildFilterClause } from '../../common/utils/build-filter-clause';
import { Prisma } from '@prisma/client';
import { DataFilterDto } from '../custom-role/dto/custom-role.dto';

interface GlobalFilter {
  fieldSlug: string;
  fieldType: string;
  operator: string;
  value: unknown;
  value2?: unknown;
}

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly customRoleService: CustomRoleService,
  ) {}

  // Helper: resolve tenantId e roleType a partir do user
  private resolveContext(user: CurrentUser, queryTenantId?: string) {
    const roleType = (user.customRole?.roleType || 'USER') as RoleType;
    const effectiveTenantId = getEffectiveTenantId(user, queryTenantId);
    // PLATFORM_ADMIN vendo tenant especifico = trata como 'filtered' (ve tudo daquele tenant)
    const effectiveRole = (roleType === 'PLATFORM_ADMIN' && queryTenantId) ? 'filtered' : roleType;
    return { effectiveTenantId, roleType, effectiveRole };
  }

  // Helper: base where para tenant
  private getWhere(tenantId: string, effectiveRole: string) {
    if (effectiveRole === 'PLATFORM_ADMIN') return {};
    return { tenantId };
  }

  /**
   * Retorna entidades acessiveis ao usuario.
   * CUSTOM roles: apenas entidades com canRead=true na permissions[].
   * Outros roles: todas as entidades do tenant.
   */
  private async getAccessibleEntities(
    user: CurrentUser,
    effectiveTenantId: string,
    roleType: RoleType | string,
  ) {
    const where: Prisma.EntityWhereInput = { tenantId: effectiveTenantId };

    // CUSTOM role: filtrar por entidades com canRead
    if (roleType === 'CUSTOM') {
      const accessibleSlugs = await this.customRoleService.getUserAccessibleEntities(user.id);
      if (accessibleSlugs.length === 0) return [];
      where.slug = { in: accessibleSlugs };
    }

    const entities = await this.prisma.entity.findMany({
      where,
      select: { id: true, slug: true, name: true, settings: true, fields: true },
    });

    // Identificar sub-entidades (referenciadas por campo type=sub-entity)
    const subEntitySlugs = new Set<string>();
    for (const entity of entities) {
      const fields = (entity.fields as unknown as Array<{ type: string; subEntitySlug?: string }>) || [];
      for (const field of fields) {
        if (field.type === 'sub-entity' && field.subEntitySlug) {
          subEntitySlugs.add(field.subEntitySlug);
        }
      }
    }

    // Excluir sub-entidades
    return entities.filter((e) => !subEntitySlugs.has(e.slug));
  }

  /**
   * Conta registros de uma entidade aplicando filtros de role (scope + dataFilters + globalFilters).
   */
  private async countFilteredRecords(
    entity: { id: string; slug: string; settings: unknown },
    user: CurrentUser,
    effectiveTenantId: string,
    roleType: RoleType | string,
  ): Promise<{ active: number; archived: number }> {
    // Base where
    const where: Prisma.EntityDataWhereInput = {
      entityId: entity.id,
      tenantId: effectiveTenantId,
    };

    // Aplicar scope (own = apenas registros criados pelo usuario)
    if (roleType === 'CUSTOM' || roleType === 'USER') {
      const scope = await this.customRoleService.getEntityScope(user.id, entity.slug);
      if (scope === 'own') {
        where.createdById = user.id;
      }
    } else if (roleType !== 'PLATFORM_ADMIN' && roleType !== 'ADMIN' && roleType !== 'MANAGER' && roleType !== 'VIEWER' && roleType !== 'filtered') {
      // Unknown role type, restrict to own
      where.createdById = user.id;
    }

    // Aplicar filtros globais da entidade
    const entitySettings = entity.settings as Record<string, unknown> | null;
    const globalFilters = (entitySettings?.globalFilters || []) as GlobalFilter[];
    if (globalFilters.length > 0) {
      this.applyFilters(where, globalFilters);
    }

    // Aplicar filtros de dados por role
    if (roleType !== 'PLATFORM_ADMIN' && roleType !== 'ADMIN' && roleType !== 'filtered' && user.customRole) {
      const roleFilters = this.customRoleService.getRoleDataFilters(
        user.customRole as { roleType: string; permissions: unknown },
        entity.slug,
      );
      if (roleFilters.length > 0) {
        this.applyFilters(where, roleFilters as unknown as GlobalFilter[]);
      }
    }

    // Construir where para archived (mesma estrutura)
    const archivedWhere: Prisma.ArchivedEntityDataWhereInput = {};
    if (where.entityId) archivedWhere.entityId = where.entityId as string;
    if (where.tenantId) archivedWhere.tenantId = where.tenantId as string;
    if (where.createdById) archivedWhere.createdById = where.createdById as string;
    if (where.AND) archivedWhere.AND = where.AND as Prisma.ArchivedEntityDataWhereInput[];

    const [active, archived] = await Promise.all([
      this.prisma.entityData.count({ where }),
      this.prisma.archivedEntityData.count({ where: archivedWhere }),
    ]);

    return { active, archived };
  }

  /** Aplica filtros na clausula WHERE */
  private applyFilters(where: Prisma.EntityDataWhereInput, filters: GlobalFilter[]): void {
    if (!filters || filters.length === 0) return;
    if (!where.AND) where.AND = [];
    const andArray = where.AND as Prisma.EntityDataWhereInput[];

    for (const filter of filters) {
      const clause = buildFilterClause(filter.fieldSlug, filter.fieldType, filter.operator, filter.value, filter.value2);
      if (clause) andArray.push(clause);
    }
  }

  async getDashboardStats(user: CurrentUser, queryTenantId?: string) {
    const { effectiveTenantId, roleType, effectiveRole } = this.resolveContext(user, queryTenantId);
    const where = this.getWhere(effectiveTenantId, effectiveRole);

    // Buscar entidades acessiveis
    const entities = await this.getAccessibleEntities(user, effectiveTenantId, roleType);

    // Contar registros filtrados por entity
    let totalRecords = 0;
    if (entities.length > 0) {
      const counts = await Promise.all(
        entities.map((e) => this.countFilteredRecords(e, user, effectiveTenantId, roleType)),
      );
      totalRecords = counts.reduce((sum, c) => sum + c.active + c.archived, 0);
    }

    const [totalUsers, totalTenants] = await Promise.all([
      this.prisma.user.count({ where }),
      roleType === 'PLATFORM_ADMIN'
        ? this.prisma.tenant.count()
        : Promise.resolve(0),
    ]);

    return {
      totalEntities: entities.length,
      totalRecords,
      totalUsers,
      ...(roleType === 'PLATFORM_ADMIN' ? { totalTenants } : {}),
    };
  }

  async getRecordsOverTime(user: CurrentUser, queryTenantId?: string, days: number = 30) {
    const { effectiveTenantId, roleType } = this.resolveContext(user, queryTenantId);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Buscar entidades acessiveis
    const entities = await this.getAccessibleEntities(user, effectiveTenantId, roleType);
    const entityIds = entities.map((e) => e.id);

    if (entityIds.length === 0) {
      return this.fillDates(startDate, {});
    }

    // Base where com filtro de data e entidades acessiveis
    const where: Prisma.EntityDataWhereInput = {
      entityId: { in: entityIds },
      tenantId: effectiveTenantId,
      createdAt: { gte: startDate },
    };

    // Aplicar scope para USER/CUSTOM
    if (roleType === 'USER') {
      where.createdById = user.id;
    } else if (roleType === 'CUSTOM') {
      // Para CUSTOM, verificar se alguma entidade tem scope 'own'
      // Simplificacao: se todas as entidades tem scope 'own', filtrar
      const hasOwnScope = await this.hasAnyOwnScope(user, entities);
      if (hasOwnScope) {
        where.createdById = user.id;
      }
    }

    const records = await this.prisma.entityData.findMany({
      where,
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const grouped = records.reduce(
      (acc: Record<string, number>, record: { createdAt: Date }) => {
        const date = record.createdAt.toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      },
      {},
    );

    return this.fillDates(startDate, grouped);
  }

  private fillDates(startDate: Date, grouped: Record<string, number>) {
    const result: { date: string; count: number }[] = [];
    const currentDate = new Date(startDate);
    const today = new Date();

    while (currentDate <= today) {
      const dateStr = currentDate.toISOString().split('T')[0];
      result.push({ date: dateStr, count: grouped[dateStr] || 0 });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  }

  /** Verifica se o usuario tem scope 'own' em alguma entidade */
  private async hasAnyOwnScope(
    user: CurrentUser,
    entities: { slug: string }[],
  ): Promise<boolean> {
    const permissions = (user.customRole?.permissions || []) as Array<{
      entitySlug: string;
      scope?: 'all' | 'own';
    }>;

    for (const entity of entities) {
      const perm = permissions.find((p) => p.entitySlug === entity.slug);
      if (perm?.scope === 'own') return true;
    }
    return false;
  }

  async getEntitiesDistribution(user: CurrentUser, queryTenantId?: string) {
    const { effectiveTenantId, roleType } = this.resolveContext(user, queryTenantId);

    // Buscar entidades acessiveis
    const entities = await this.getAccessibleEntities(user, effectiveTenantId, roleType);

    if (entities.length === 0) return [];

    // Contar registros filtrados por entity
    const results = await Promise.all(
      entities.map(async (entity) => {
        const counts = await this.countFilteredRecords(entity, user, effectiveTenantId, roleType);
        return {
          name: entity.name,
          slug: entity.slug,
          records: counts.active + counts.archived,
        };
      }),
    );

    return results.filter((item) => item.records > 0);
  }

  async getUsersActivity(user: CurrentUser, queryTenantId?: string, days: number = 7) {
    const { effectiveTenantId, effectiveRole } = this.resolveContext(user, queryTenantId);
    const where = this.getWhere(effectiveTenantId, effectiveRole);

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

  async getRecentActivity(user: CurrentUser, queryTenantId?: string, limit: number = 10) {
    const { effectiveTenantId, roleType, effectiveRole } = this.resolveContext(user, queryTenantId);
    const where = this.getWhere(effectiveTenantId, effectiveRole);

    // Para entidades, filtrar pelas acessiveis
    const entities = await this.getAccessibleEntities(user, effectiveTenantId, roleType);
    const entityIds = entities.map((e) => e.id);

    const recordsWhere: Prisma.EntityDataWhereInput = {
      ...where,
      ...(entityIds.length > 0 ? { entityId: { in: entityIds } } : { entityId: '__none__' }),
    };

    // Aplicar scope para USER/CUSTOM
    if (roleType === 'USER') {
      recordsWhere.createdById = user.id;
    } else if (roleType === 'CUSTOM') {
      const hasOwnScope = await this.hasAnyOwnScope(user, entities);
      if (hasOwnScope) {
        recordsWhere.createdById = user.id;
      }
    }

    const [records, entitiesList] = await Promise.all([
      this.prisma.entityData.findMany({
        where: recordsWhere,
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          entity: { select: { name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      }),
      this.prisma.entity.findMany({
        where: {
          ...where,
          ...(entityIds.length > 0 ? { id: { in: entityIds } } : { id: '__none__' }),
        },
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
      ...entitiesList.map((e) => ({
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

    return activities
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, limit);
  }
}

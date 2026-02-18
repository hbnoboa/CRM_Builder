import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, ReportVisibility, TenantScope } from '@prisma/client';
import {
  CreateReportDto,
  UpdateReportDto,
  ExecuteReportDto,
  ReportComponentDto,
  Aggregation,
} from './dto/report.dto';
import { CurrentUser, PaginationQuery, parsePaginationParams, createPaginationMeta } from '../../common/types';

export interface QueryReportDto extends PaginationQuery {
  visibility?: ReportVisibility;
  createdById?: string;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // CRUD Operations
  // ═══════════════════════════════════════════════════════════════════════════

  async create(dto: CreateReportDto, user: CurrentUser) {
    const roleType = user.customRole?.roleType;

    // Validar tenantScope (apenas Platform Admin pode usar ALL ou SELECTED)
    if (dto.tenantScope && dto.tenantScope !== 'CURRENT') {
      if (roleType !== 'PLATFORM_ADMIN') {
        throw new ForbiddenException('Apenas Platform Admin pode criar relatorios multi-tenant');
      }
    }

    return this.prisma.report.create({
      data: {
        tenantId: user.tenantId,
        createdById: user.id,
        name: dto.name,
        description: dto.description,
        icon: dto.icon,
        color: dto.color,
        components: (dto.components || []) as unknown as Prisma.JsonArray,
        layoutConfig: dto.layoutConfig as unknown as Prisma.JsonObject,
        visibility: dto.visibility || ReportVisibility.PRIVATE,
        sharedWith: dto.sharedWith as unknown as Prisma.JsonObject,
        tenantScope: dto.tenantScope || TenantScope.CURRENT,
        selectedTenants: dto.selectedTenants || [],
        showInDashboard: dto.showInDashboard || false,
        dashboardOrder: dto.dashboardOrder || 0,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });
  }

  /**
   * Buscar relatorios para exibir no dashboard
   */
  async findDashboardReports(user: CurrentUser) {
    const roleType = user.customRole?.roleType;

    // Construir WHERE para relatorios visiveis no dashboard
    const where: Prisma.ReportWhereInput = {
      showInDashboard: true,
    };

    // Platform Admin pode ver de qualquer tenant
    if (roleType !== 'PLATFORM_ADMIN') {
      where.tenantId = user.tenantId;

      // Filtrar por visibilidade (usuarios comuns so veem o que tem acesso)
      where.OR = [
        { createdById: user.id }, // Proprio
        { visibility: ReportVisibility.PUBLIC }, // Publico
        { visibility: ReportVisibility.ORGANIZATION }, // Organizacao
        {
          sharedWith: {
            path: ['canView'],
            array_contains: user.id,
          },
        },
      ];
    }

    const reports = await this.prisma.report.findMany({
      where,
      orderBy: [
        { dashboardOrder: 'asc' },
        { updatedAt: 'desc' },
      ],
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    return reports;
  }

  async findAll(user: CurrentUser, query: QueryReportDto = {}) {
    const { page, limit, skip } = parsePaginationParams(query);
    const { search, visibility, createdById, sortBy = 'updatedAt', sortOrder = 'desc' } = query;
    const roleType = user.customRole?.roleType;

    // Construir WHERE
    const where: Prisma.ReportWhereInput = {};

    // Platform Admin pode ver de qualquer tenant
    if (roleType !== 'PLATFORM_ADMIN') {
      where.tenantId = user.tenantId;

      // Filtrar por visibilidade (usuarios comuns so veem o que tem acesso)
      where.OR = [
        { createdById: user.id }, // Proprio
        { visibility: ReportVisibility.PUBLIC }, // Publico
        { visibility: ReportVisibility.ORGANIZATION }, // Organizacao
        // Team (simplificado - seria necessario logica de time)
        {
          AND: [
            { visibility: ReportVisibility.TEAM },
            { createdById: user.id }, // Por enquanto, so proprio
          ],
        },
        // Compartilhado explicitamente
        {
          sharedWith: {
            path: ['canView'],
            array_contains: user.id,
          },
        },
      ];
    }

    if (visibility) {
      where.visibility = visibility;
    }

    if (createdById) {
      where.createdById = createdById;
    }

    if (search) {
      where.AND = [
        ...(where.AND as Prisma.ReportWhereInput[] || []),
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true, avatar: true },
          },
          tenant: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      data,
      meta: createPaginationMeta(total, page, limit),
    };
  }

  async findOne(id: string, user: CurrentUser) {
    const roleType = user.customRole?.roleType;

    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        tenant: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('Relatorio nao encontrado');
    }

    // Verificar acesso
    if (roleType !== 'PLATFORM_ADMIN') {
      if (report.tenantId !== user.tenantId) {
        throw new ForbiddenException('Acesso negado a este relatorio');
      }

      const hasAccess = this.checkReportAccess(report, user);
      if (!hasAccess) {
        throw new ForbiddenException('Acesso negado a este relatorio');
      }
    }

    return report;
  }

  async update(id: string, dto: UpdateReportDto, user: CurrentUser) {
    const report = await this.findOne(id, user);
    const roleType = user.customRole?.roleType;

    // Verificar permissao de edicao
    const canEdit = this.canEditReport(report, user);
    if (!canEdit) {
      throw new ForbiddenException('Sem permissao para editar este relatorio');
    }

    // Validar tenantScope
    if (dto.tenantScope && dto.tenantScope !== 'CURRENT') {
      if (roleType !== 'PLATFORM_ADMIN') {
        throw new ForbiddenException('Apenas Platform Admin pode criar relatorios multi-tenant');
      }
    }

    return this.prisma.report.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        icon: dto.icon,
        color: dto.color,
        components: dto.components as unknown as Prisma.JsonArray,
        layoutConfig: dto.layoutConfig as unknown as Prisma.JsonObject,
        visibility: dto.visibility,
        sharedWith: dto.sharedWith as unknown as Prisma.JsonObject,
        tenantScope: dto.tenantScope,
        selectedTenants: dto.selectedTenants,
        showInDashboard: dto.showInDashboard,
        dashboardOrder: dto.dashboardOrder,
        updatedAt: new Date(),
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });
  }

  async remove(id: string, user: CurrentUser) {
    const report = await this.findOne(id, user);
    const roleType = user.customRole?.roleType;

    // Apenas criador ou admin pode deletar
    if (report.createdById !== user.id && roleType !== 'PLATFORM_ADMIN' && roleType !== 'ADMIN') {
      throw new ForbiddenException('Sem permissao para deletar este relatorio');
    }

    return this.prisma.report.delete({ where: { id } });
  }

  async duplicate(id: string, user: CurrentUser) {
    const report = await this.findOne(id, user);

    return this.prisma.report.create({
      data: {
        tenantId: user.tenantId,
        createdById: user.id,
        name: `${report.name} (Copia)`,
        description: report.description,
        icon: report.icon,
        color: report.color,
        components: report.components as Prisma.JsonArray,
        layoutConfig: report.layoutConfig as Prisma.JsonObject,
        visibility: ReportVisibility.PRIVATE, // Copia sempre e privada
        tenantScope: TenantScope.CURRENT,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Execute Report (Buscar dados)
  // ═══════════════════════════════════════════════════════════════════════════

  async execute(id: string, user: CurrentUser, dto: ExecuteReportDto = {}) {
    const report = await this.findOne(id, user);
    const roleType = user.customRole?.roleType;
    const components = report.components as unknown as ReportComponentDto[];

    // Determinar tenants a consultar
    let tenantFilter: string[] = [];

    if (report.tenantScope === 'CURRENT') {
      tenantFilter = [user.tenantId];
    } else if (report.tenantScope === 'ALL') {
      if (roleType !== 'PLATFORM_ADMIN') {
        throw new ForbiddenException('Apenas Platform Admin pode executar relatorios multi-tenant');
      }
      // Vazio = todos
      tenantFilter = [];
    } else if (report.tenantScope === 'SELECTED') {
      if (roleType !== 'PLATFORM_ADMIN') {
        throw new ForbiddenException('Apenas Platform Admin pode executar relatorios multi-tenant');
      }
      tenantFilter = report.selectedTenants;
    }

    // Override com dto.tenantId se fornecido
    if (dto.tenantId && roleType === 'PLATFORM_ADMIN') {
      tenantFilter = [dto.tenantId];
    }

    // Executar cada componente
    const results = await Promise.all(
      components.map(async (component) => {
        try {
          const data = await this.executeComponent(component, tenantFilter, dto);
          return {
            id: component.id,
            type: component.type,
            title: component.title,
            data,
            error: null,
          };
        } catch (error) {
          this.logger.error(`Erro ao executar componente ${component.id}:`, error);
          return {
            id: component.id,
            type: component.type,
            title: component.title,
            data: null,
            error: error.message,
          };
        }
      })
    );

    return {
      report: {
        id: report.id,
        name: report.name,
        description: report.description,
        layoutConfig: report.layoutConfig,
      },
      components: results,
      generatedAt: new Date(),
      tenantScope: report.tenantScope,
    };
  }

  private async executeComponent(
    component: ReportComponentDto,
    tenantFilter: string[],
    dto: ExecuteReportDto,
  ) {
    const { entity, filters, dateRange } = component.dataSource;

    // Buscar entidade
    const entityRecord = await this.prisma.entity.findFirst({
      where: { slug: entity },
    });

    if (!entityRecord) {
      throw new Error(`Entidade '${entity}' nao encontrada`);
    }

    // Construir WHERE base
    const where: Prisma.EntityDataWhereInput = {
      entityId: entityRecord.id,
      deletedAt: null,
    };

    // Filtro de tenant
    if (tenantFilter.length > 0) {
      where.tenantId = { in: tenantFilter };
    }

    // Filtro de data
    const effectiveDateRange = dto.overrideDateRange || dateRange;
    if (effectiveDateRange) {
      const { start, end } = this.calculateDateRange(effectiveDateRange);
      const dateField = effectiveDateRange.field || 'createdAt';

      if (dateField === 'createdAt' || dateField === 'updatedAt') {
        where[dateField] = {
          gte: start,
          lte: end,
        };
      }
    }

    // Executar baseado no tipo
    switch (component.type) {
      case 'stats-card':
      case 'kpi':
        return this.executeStatsCard(where, component.config);

      case 'bar-chart':
      case 'line-chart':
      case 'area-chart':
        return this.executeChart(where, component.config, entityRecord);

      case 'pie-chart':
        return this.executePieChart(where, component.config, entityRecord);

      case 'table':
        return this.executeTable(where, component.config);

      case 'trend':
        return this.executeTrend(where, component.config);

      default:
        throw new Error(`Tipo de componente nao suportado: ${component.type}`);
    }
  }

  private async executeStatsCard(where: Prisma.EntityDataWhereInput, config: any) {
    const { measure, aggregation } = config;

    if (measure === '_count' || aggregation === 'count') {
      const count = await this.prisma.entityData.count({ where });
      return { value: count };
    }

    // Para outros campos, precisa agregar via raw query ou buscar todos
    // Simplificado: retorna count
    const count = await this.prisma.entityData.count({ where });
    return { value: count };
  }

  private async executeChart(
    where: Prisma.EntityDataWhereInput,
    config: any,
    entity: any,
  ) {
    const { dimension, measure, aggregation } = config;

    // Buscar dados e agregar em memoria (simplificado)
    // Em producao, usar raw SQL para melhor performance
    const records = await this.prisma.entityData.findMany({
      where,
      take: 1000,
      orderBy: { createdAt: 'desc' },
    });

    // Agrupar por dimensao
    const grouped = new Map<string, number>();

    for (const record of records) {
      const data = record.data as Record<string, any>;
      const dimValue = String(data[dimension] || 'N/A');
      const measureValue = measure === '_count' ? 1 : Number(data[measure]) || 0;

      const current = grouped.get(dimValue) || 0;

      switch (aggregation) {
        case 'sum':
        case 'count':
          grouped.set(dimValue, current + measureValue);
          break;
        case 'avg':
          // Simplificado: soma e divide depois
          grouped.set(dimValue, current + measureValue);
          break;
        case 'max':
          grouped.set(dimValue, Math.max(current, measureValue));
          break;
        case 'min':
          grouped.set(dimValue, current === 0 ? measureValue : Math.min(current, measureValue));
          break;
      }
    }

    return Array.from(grouped.entries()).map(([name, value]) => ({
      name,
      value,
    }));
  }

  private async executePieChart(
    where: Prisma.EntityDataWhereInput,
    config: any,
    entity: any,
  ) {
    // Mesmo que chart, mas formatado para pie
    return this.executeChart(where, config, entity);
  }

  private async executeTable(where: Prisma.EntityDataWhereInput, config: any) {
    const { columns, sortBy, sortOrder, limit } = config;

    const records = await this.prisma.entityData.findMany({
      where,
      take: limit || 10,
      orderBy: { [sortBy || 'createdAt']: sortOrder || 'desc' },
    });

    return records.map((record) => {
      const data = record.data as Record<string, any>;
      const row: Record<string, any> = { id: record.id };

      for (const col of columns || []) {
        row[col] = data[col];
      }

      return row;
    });
  }

  private async executeTrend(where: Prisma.EntityDataWhereInput, config: any) {
    // Comparar periodo atual vs anterior
    const currentCount = await this.prisma.entityData.count({ where });

    // Simplificado: retorna apenas valor atual
    return {
      current: currentCount,
      previous: 0,
      change: 0,
      changePercent: 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Analytics (Materialized Views)
  // ═══════════════════════════════════════════════════════════════════════════

  async getTenantAnalytics(user: CurrentUser) {
    const roleType = user.customRole?.roleType;

    if (roleType !== 'PLATFORM_ADMIN') {
      throw new ForbiddenException('Apenas Platform Admin pode ver analytics de todos tenants');
    }

    // Usar Materialized View
    const result = await this.prisma.$queryRaw`
      SELECT * FROM mv_tenant_analytics
      ORDER BY total_records DESC
    `;

    return result;
  }

  async getEntityDistribution(user: CurrentUser, tenantId?: string) {
    const roleType = user.customRole?.roleType;
    const effectiveTenantId = roleType === 'PLATFORM_ADMIN' && tenantId
      ? tenantId
      : user.tenantId;

    // Usar Materialized View
    const result = await this.prisma.$queryRaw`
      SELECT * FROM mv_entity_distribution
      WHERE tenant_id = ${effectiveTenantId}
      ORDER BY total_records DESC
    `;

    return result;
  }

  async getRecordsOverTime(user: CurrentUser, tenantId?: string, days: number = 30) {
    const roleType = user.customRole?.roleType;
    const effectiveTenantId = roleType === 'PLATFORM_ADMIN' && tenantId
      ? tenantId
      : user.tenantId;

    // Usar Materialized View
    const result = await this.prisma.$queryRaw`
      SELECT
        record_date,
        SUM(records_created) as records_created,
        SUM(records_deleted) as records_deleted
      FROM mv_records_over_time
      WHERE tenant_id = ${effectiveTenantId}
        AND record_date > NOW() - INTERVAL '${days} days'
      GROUP BY record_date
      ORDER BY record_date ASC
    `;

    return result;
  }

  async refreshAnalytics() {
    // Chamar funcao de refresh
    await this.prisma.$executeRaw`SELECT refresh_analytics_views()`;
    return { refreshed: true, at: new Date() };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private checkReportAccess(report: any, user: CurrentUser): boolean {
    // Dono sempre tem acesso
    if (report.createdById === user.id) {
      return true;
    }

    // Verificar visibility
    switch (report.visibility) {
      case ReportVisibility.PUBLIC:
        return true;
      case ReportVisibility.ORGANIZATION:
        return report.tenantId === user.tenantId;
      case ReportVisibility.TEAM:
        // Simplificado: apenas mesmo tenant
        return report.tenantId === user.tenantId;
      case ReportVisibility.PRIVATE:
        // Verificar sharedWith
        const sharedWith = report.sharedWith as { canView?: string[]; canEdit?: string[] };
        return sharedWith?.canView?.includes(user.id) || sharedWith?.canEdit?.includes(user.id);
      default:
        return false;
    }
  }

  private canEditReport(report: any, user: CurrentUser): boolean {
    const roleType = user.customRole?.roleType;

    // Platform Admin pode editar tudo
    if (roleType === 'PLATFORM_ADMIN') {
      return true;
    }

    // Dono pode editar
    if (report.createdById === user.id) {
      return true;
    }

    // Verificar sharedWith.canEdit
    const sharedWith = report.sharedWith as { canView?: string[]; canEdit?: string[] };
    return sharedWith?.canEdit?.includes(user.id) || false;
  }

  private calculateDateRange(dateRange: any): { start: Date; end: Date } {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    switch (dateRange.preset) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
        start = new Date(now.getFullYear(), quarterMonth, 1);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      case 'custom':
        start = new Date(dateRange.startDate || now);
        end = new Date(dateRange.endDate || now);
        break;
      default:
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { start, end };
  }
}

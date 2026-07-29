import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/types';
import { getEffectiveTenantId } from '../../common/utils/tenant.util';
import { hasPlatformAccess, hasFullTenantAccess } from '../../common/utils/platform-access';
import { CreateDashboardTemplateDto, UpdateDashboardTemplateDto } from './dto/dashboard-template.dto';

@Injectable()
export class DashboardTemplateService {
  private readonly logger = new Logger(DashboardTemplateService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: CurrentUser, queryTenantId?: string) {
    const tenantId = getEffectiveTenantId(user, queryTenantId);

    return this.prisma.dashboardTemplate.findMany({
      where: { tenantId },
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string, user: CurrentUser, queryTenantId?: string) {
    const tenantId = getEffectiveTenantId(user, queryTenantId);

    const template = await this.prisma.dashboardTemplate.findFirst({
      where: { id, tenantId },
    });

    if (!template) {
      throw new NotFoundException('Template de dashboard nao encontrado');
    }

    return template;
  }

  /**
   * Resolve o template atribuido ao role do usuario para uma entidade especifica.
   * Retorna null se nao ha template atribuido.
   */
  async findMyTemplate(entitySlug: string, user: CurrentUser, queryTenantId?: string) {
    const tenantId = getEffectiveTenantId(user, queryTenantId);
    // "Vê todos os templates" = quem gerencia dashboards (permissão), não roleType.
    const mp = user.customRole?.modulePermissions as Record<string, Record<string, boolean>> | undefined;
    const isAdmin = hasPlatformAccess(user.customRole?.modulePermissions) || hasFullTenantAccess(user.customRole?.modulePermissions) || mp?.dashboard?.canUpdate === true;

    if (!isAdmin && !user.customRoleId) return null;

    // PLATFORM_ADMIN ve todos os templates; outros veem os atribuidos ao seu role
    // OU os com roleIds vazio (= visivel a todos os roles, inclui auto-gerados).
    const templates = await this.prisma.dashboardTemplate.findMany({
      where: {
        tenantId,
        entitySlug,
        isActive: true,
        ...(!isAdmin && {
          OR: [
            { roleIds: { isEmpty: true } },
            { roleIds: { has: user.customRoleId } },
          ],
        }),
      },
      orderBy: { priority: 'desc' },
      take: 1,
    });

    return templates[0] || null;
  }

  /**
   * Lista todos os templates atribuidos ao role do usuario para uma entidade.
   * PLATFORM_ADMIN ve todos os templates do tenant.
   * Retorna lista resumida (sem layout/widgets pesados).
   */
  async findMyTemplates(entitySlug: string, user: CurrentUser, queryTenantId?: string) {
    const tenantId = getEffectiveTenantId(user, queryTenantId);
    // "Vê todos os templates" = quem gerencia dashboards (permissão), não roleType.
    const mp = user.customRole?.modulePermissions as Record<string, Record<string, boolean>> | undefined;
    const isAdmin = hasPlatformAccess(user.customRole?.modulePermissions) || hasFullTenantAccess(user.customRole?.modulePermissions) || mp?.dashboard?.canUpdate === true;

    if (!isAdmin && !user.customRoleId) return [];

    return this.prisma.dashboardTemplate.findMany({
      where: {
        tenantId,
        entitySlug,
        isActive: true,
        ...(!isAdmin && {
          OR: [
            { roleIds: { isEmpty: true } },
            { roleIds: { has: user.customRoleId } },
          ],
        }),
      },
      orderBy: { priority: 'desc' },
      select: { id: true, name: true, description: true, priority: true },
    });
  }

  async create(dto: CreateDashboardTemplateDto, user: CurrentUser, queryTenantId?: string) {
    const tenantId = getEffectiveTenantId(user, queryTenantId);

    // Auto-resolve nome unico: se ja existe, adiciona sufixo incremental
    let name = dto.name;
    let attempt = 0;
    while (true) {
      const existing = await this.prisma.dashboardTemplate.findUnique({
        where: { tenantId_name: { tenantId, name } },
      });
      if (!existing) break;
      attempt++;
      name = `${dto.name} (${attempt})`;
    }

    return this.prisma.dashboardTemplate.create({
      data: {
        tenantId,
        name,
        description: dto.description,
        entitySlug: dto.entitySlug,
        layout: (dto.layout as object) || [],
        widgets: (dto.widgets as object) || {},
        tabs: (dto.tabs as object) || [],
        settings: (dto.settings as object) || {},
        roleIds: dto.roleIds || [],
        priority: dto.priority ?? 0,
      },
    });
  }

  /** Widget id sentinela do dashboard "Tabela" auto-gerado de cada entidade. */
  private static readonly TABLE_WIDGET_ID = 'w-data-table-1';
  /** Tipos de campo que nao viram coluna na tabela automatica. */
  private static readonly NON_COLUMN_FIELD_TYPES = ['sub-entity', 'map', 'json', 'signature'];

  /**
   * Cria ou re-sincroniza o dashboard "Tabela" padrao de uma entidade.
   *
   * Idempotente: se ja existe (pelo widget sentinela `w-data-table-1` no entitySlug),
   * reconcilia o `displayFields` do widget — preserva a ordem/visibilidade escolhida pelo
   * usuario, remove slugs de campos que nao existem mais e adiciona campos novos no fim.
   * Se nao existe, cria do zero com `roleIds: []` (= visivel a todos os roles, inclusive
   * os criados no futuro). Deve ser chamado em entity.create e entity.update.
   */
  async syncTableTemplate(
    entity: { name: string; slug: string },
    fields: Array<{ slug: string; type: string }>,
    user: CurrentUser,
    queryTenantId?: string,
  ) {
    const tenantId = getEffectiveTenantId(user, queryTenantId);
    const widgetId = DashboardTemplateService.TABLE_WIDGET_ID;

    const candidateFields = fields
      .filter((f) => !DashboardTemplateService.NON_COLUMN_FIELD_TYPES.includes(f.type))
      .map((f) => f.slug);

    // Procura o template padrao da entidade pelo widget sentinela.
    const templates = await this.prisma.dashboardTemplate.findMany({
      where: { tenantId, entitySlug: entity.slug },
      orderBy: { createdAt: 'asc' },
    });
    const existing = templates.find((t) => {
      const w = (t.widgets as Record<string, unknown>) || {};
      return !!w[widgetId];
    });

    if (existing) {
      // Reconcilia displayFields preservando a ordem atual.
      const widgets = { ...((existing.widgets as Record<string, any>) || {}) };
      const widget = widgets[widgetId] || {};
      const prevDisplay: string[] = Array.isArray(widget?.config?.displayFields)
        ? widget.config.displayFields
        : [];
      const candidateSet = new Set(candidateFields);
      const prevSet = new Set(prevDisplay);
      const reconciled = [
        ...prevDisplay.filter((s) => candidateSet.has(s)), // mantem ordem, descarta mortos
        ...candidateFields.filter((s) => !prevSet.has(s)), // adiciona novos no fim
      ];

      // No-op se nada mudou (evita escrita desnecessaria).
      const sameDisplay =
        reconciled.length === prevDisplay.length &&
        reconciled.every((s, i) => s === prevDisplay[i]);
      const sameTitle = widget?.title === entity.name;
      if (sameDisplay && sameTitle) return existing;

      widgets[widgetId] = {
        ...widget,
        type: widget.type || 'data-table',
        title: entity.name,
        config: { ...(widget.config || {}), displayFields: reconciled },
      };

      return this.update(existing.id, { widgets } as UpdateDashboardTemplateDto, user, queryTenantId);
    }

    // Nao existe: cria do zero.
    return this.create(
      {
        name: `${entity.name} - Tabela`,
        entitySlug: entity.slug,
        roleIds: [], // [] = visivel a todos os roles (inclui futuros)
        priority: 0,
        layout: [{ i: widgetId, x: 0, y: 0, w: 12, h: 10, minW: 6, minH: 6 }],
        widgets: {
          [widgetId]: {
            type: 'data-table',
            title: entity.name,
            config: {
              displayFields: candidateFields,
              pageSize: 25,
              allowCreate: true,
              allowEdit: true,
              allowDelete: true,
              allowExport: true,
              allowImport: true,
              allowBatchSelect: true,
            },
          },
        },
      } as CreateDashboardTemplateDto,
      user,
      queryTenantId,
    );
  }

  async update(id: string, dto: UpdateDashboardTemplateDto, user: CurrentUser, queryTenantId?: string) {
    const tenantId = getEffectiveTenantId(user, queryTenantId);

    // Verificar que o template existe e pertence ao tenant
    const template = await this.prisma.dashboardTemplate.findFirst({
      where: { id, tenantId },
    });

    if (!template) {
      throw new NotFoundException('Template de dashboard nao encontrado');
    }

    // Se mudou o nome, verificar unicidade
    if (dto.name && dto.name !== template.name) {
      const existing = await this.prisma.dashboardTemplate.findUnique({
        where: { tenantId_name: { tenantId, name: dto.name } },
      });

      if (existing) {
        throw new ConflictException(`Ja existe um template com o nome "${dto.name}"`);
      }
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.entitySlug !== undefined) data.entitySlug = dto.entitySlug;
    if (dto.layout !== undefined) data.layout = dto.layout as object;
    if (dto.widgets !== undefined) data.widgets = dto.widgets as object;
    if (dto.roleIds !== undefined) data.roleIds = dto.roleIds;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.tabs !== undefined) data.tabs = dto.tabs as object;
    if (dto.settings !== undefined) data.settings = dto.settings as object;

    return this.prisma.dashboardTemplate.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, user: CurrentUser, queryTenantId?: string) {
    const tenantId = getEffectiveTenantId(user, queryTenantId);

    const template = await this.prisma.dashboardTemplate.findFirst({
      where: { id, tenantId },
    });

    if (!template) {
      throw new NotFoundException('Template de dashboard nao encontrado');
    }

    await this.prisma.dashboardTemplate.delete({ where: { id } });
    return { deleted: true };
  }
}

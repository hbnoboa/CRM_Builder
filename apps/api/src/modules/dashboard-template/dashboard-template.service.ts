import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/types';
import { getEffectiveTenantId } from '../../common/utils/tenant.util';
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
    const customRoleId = user.customRoleId;

    if (!customRoleId) return null;

    // Busca templates ativos que contem o roleId do usuario
    const templates = await this.prisma.dashboardTemplate.findMany({
      where: {
        tenantId,
        entitySlug,
        isActive: true,
        roleIds: { has: customRoleId },
      },
      orderBy: { priority: 'desc' },
      take: 1,
    });

    return templates[0] || null;
  }

  async create(dto: CreateDashboardTemplateDto, user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);

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
        roleIds: dto.roleIds || [],
        priority: dto.priority ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateDashboardTemplateDto, user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);

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

    return this.prisma.dashboardTemplate.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);

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

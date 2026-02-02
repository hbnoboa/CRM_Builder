import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EntityService } from '../entity/entity.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class DataService {
  constructor(
    private prisma: PrismaService,
    private entityService: EntityService,
  ) {}

  async create(entitySlug: string, workspaceId: string, dto: any, currentUser: any) {
    // Buscar entidade
    const entity = await this.entityService.findBySlug(workspaceId, entitySlug, currentUser);

    // Validar dados
    const errors = this.entityService.validateData(entity.fields as any[], dto.data || {});
    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }

    return this.prisma.entityData.create({
      data: {
        tenantId: currentUser.tenantId,
        entityId: entity.id,
        data: dto.data || {},
        createdById: currentUser.id,
        updatedById: currentUser.id,
      },
    });
  }

  async findAll(
    entitySlug: string,
    workspaceId: string,
    query: any,
    currentUser: any,
  ) {
    const { page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    // Buscar entidade
    const entity = await this.entityService.findBySlug(workspaceId, entitySlug, currentUser);

    // Base where
    const where: any = {
      tenantId: currentUser.tenantId,
      entityId: entity.id,
    };

    // Aplicar filtro de escopo baseado na role
    this.applyScope(where, currentUser, 'read');

    // Busca textual
    if (search) {
      // Buscar em campos de busca configurados na entidade
      const settings = entity.settings as any;
      const searchFields = settings?.searchFields || [];
      
      if (searchFields.length > 0) {
        where.OR = searchFields.map((field: string) => ({
          data: {
            path: [field],
            string_contains: search,
            mode: 'insensitive',
          },
        }));
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.entityData.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          updatedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      this.prisma.entityData.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      entity: {
        id: entity.id,
        name: entity.name,
        namePlural: entity.namePlural,
        slug: entity.slug,
        fields: entity.fields,
        settings: entity.settings,
      },
    };
  }

  async findOne(entitySlug: string, workspaceId: string, id: string, currentUser: any) {
    const entity = await this.entityService.findBySlug(workspaceId, entitySlug, currentUser);

    const record = await this.prisma.entityData.findFirst({
      where: {
        id,
        entityId: entity.id,
        tenantId: currentUser.tenantId,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        updatedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!record) {
      throw new NotFoundException('Registro não encontrado');
    }

    return {
      ...record,
      entity: {
        id: entity.id,
        name: entity.name,
        slug: entity.slug,
        fields: entity.fields,
      },
    };
  }

  async update(entitySlug: string, workspaceId: string, id: string, dto: any, currentUser: any) {
    const entity = await this.entityService.findBySlug(workspaceId, entitySlug, currentUser);

    // Buscar registro
    const record = await this.prisma.entityData.findFirst({
      where: {
        id,
        entityId: entity.id,
        tenantId: currentUser.tenantId,
      },
    });

    if (!record) {
      throw new NotFoundException('Registro não encontrado');
    }

    // Verificar permissão de escopo
    this.checkScope(record, currentUser, 'update');

    // Validar dados
    const errors = this.entityService.validateData(entity.fields as any[], dto.data || {});
    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }

    // Merge dos dados existentes com os novos
    const mergedData = {
      ...(record.data as object),
      ...dto.data,
    };

    return this.prisma.entityData.update({
      where: { id },
      data: {
        data: mergedData,
        updatedById: currentUser.id,
      },
    });
  }

  async remove(entitySlug: string, workspaceId: string, id: string, currentUser: any) {
    const entity = await this.entityService.findBySlug(workspaceId, entitySlug, currentUser);

    const record = await this.prisma.entityData.findFirst({
      where: {
        id,
        entityId: entity.id,
        tenantId: currentUser.tenantId,
      },
    });

    if (!record) {
      throw new NotFoundException('Registro não encontrado');
    }

    // Verificar permissão de escopo
    this.checkScope(record, currentUser, 'delete');

    await this.prisma.entityData.delete({ where: { id } });

    return { message: 'Registro excluído com sucesso' };
  }

  // Aplicar filtros de escopo na query
  private applyScope(where: any, user: any, action: string) {
    // Admin e Platform Admin veem tudo
    if (user.role === UserRole.PLATFORM_ADMIN || user.role === UserRole.ADMIN) {
      return;
    }

    // Manager vê tudo do tenant (para leitura)
    if (user.role === UserRole.MANAGER && action === 'read') {
      return;
    }

    // User e Viewer veem apenas da equipe (organização)
    if (user.organizationId) {
      // Buscar usuários da mesma organização
      where.createdBy = {
        organizationId: user.organizationId,
      };
    }
  }

  // Verificar se usuário pode modificar o registro
  private checkScope(record: any, user: any, action: string) {
    // Admin e Platform Admin podem tudo
    if (user.role === UserRole.PLATFORM_ADMIN || user.role === UserRole.ADMIN) {
      return;
    }

    // Viewer não pode modificar
    if (user.role === UserRole.VIEWER) {
      throw new ForbiddenException('Você não tem permissão para modificar registros');
    }

    // Manager pode modificar registros da equipe
    if (user.role === UserRole.MANAGER) {
      // Para simplificar, permitimos se está no mesmo tenant
      // Em produção, verificar se createdBy está na mesma organização
      return;
    }

    // User só pode modificar próprios registros
    if (user.role === UserRole.USER) {
      if (record.createdById !== user.id) {
        throw new ForbiddenException('Você só pode modificar registros criados por você');
      }
    }
  }
}

import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import {
  CurrentUser,
  PaginationQuery,
  parsePaginationParams,
  createPaginationMeta,
  encodeCursor,
  decodeCursor,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '../../common/types';
import { Prisma } from '@prisma/client';
import { RoleType } from '../../common/decorators/roles.decorator';
import { getEffectiveTenantId } from '../../common/utils/tenant.util';
import { GlobalFilterDto } from './dto/update-global-filters.dto';

export type QueryEntityDto = PaginationQuery;

export interface FieldDefinition {
  slug: string;
  name: string;
  label?: string;
  type: string; // text, number, email, date, boolean, select, api-select, relation, etc.
  required?: boolean;
  unique?: boolean;
  default?: string | number | boolean | null;
  options?: { value: string; label: string; color?: string }[] | string[];
  validations?: Record<string, unknown>;
  relation?: {
    entity: string;
    displayField: string;
  };
  // Campos especificos para api-select
  apiEndpoint?: string; // Custom API path (ex: "/corretores")
  valueField?: string; // Campo para usar como valor (default: id)
  labelField?: string; // Campo para usar como label (default: name)
  autoFillFields?: Array<{
    sourceField: string; // Campo fonte da API
    targetField: string; // Campo destino nesta entidade
  }>;
}

export interface CreateEntityDto {
  name: string;
  namePlural?: string;
  slug?: string;
  description?: string;
  icon?: string;
  color?: string;
  fields?: FieldDefinition[];
  settings?: Record<string, unknown>;
  isSystem?: boolean;
}

export interface UpdateEntityDto {
  name?: string;
  namePlural?: string;
  description?: string;
  icon?: string;
  color?: string;
  fields?: FieldDefinition[];
  settings?: Record<string, unknown>;
}

@Injectable()
export class EntityService {
  private readonly logger = new Logger(EntityService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  async create(dto: CreateEntityDto & { tenantId?: string }, currentUser: CurrentUser) {
    const targetTenantId = getEffectiveTenantId(currentUser, dto.tenantId);

    // Gerar slug a partir do nome se nao fornecido
    const slug = (dto.slug || dto.name)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/--+/g, '-');

    // Verificar se slug ja existe no tenant
    const existing = await this.prisma.entity.findFirst({
      where: {
        tenantId: targetTenantId,
        slug,
      },
    });

    if (existing) {
      throw new ConflictException('Entidade com este slug ja existe');
    }

    // Gerar namePlural se nao fornecido
    const namePlural = dto.namePlural || `${dto.name}s`;

    // Garantir que cada campo tenha slug (usa name como fallback)
    const processedFields = (dto.fields || []).map(f => ({
      ...f,
      slug: f.slug || f.name,
    }));

    const entity = await this.prisma.entity.create({
      data: {
        name: dto.name,
        namePlural,
        slug,
        description: dto.description,
        icon: dto.icon,
        color: dto.color,
        tenantId: targetTenantId,
        fields: processedFields as unknown as Prisma.InputJsonValue,
        settings: (dto.settings || {}) as Prisma.InputJsonValue,
        isSystem: dto.isSystem || false,
      },
    });

    // Enviar notificacao para o tenant
    this.notificationService.notifyEntityCreated(
      targetTenantId,
      entity.name,
      currentUser.name,
    ).catch((err) => this.logger.error('Failed to send notification', err));

    return entity;
  }

  async findAll(currentUser: CurrentUser, query: QueryEntityDto = {}) {
    const { page, limit, skip } = parsePaginationParams(query);
    const { search, sortBy = 'name', sortOrder = 'asc', tenantId: queryTenantId, cursor } = query;

    // PLATFORM_ADMIN pode ver de qualquer tenant ou todos
    const roleType = currentUser.customRole?.roleType as RoleType | undefined;
    const where: Prisma.EntityWhereInput = {};

    if (roleType === 'PLATFORM_ADMIN') {
      if (queryTenantId) {
        where.tenantId = queryTenantId;
      }
    } else {
      where.tenantId = currentUser.tenantId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Cursor pagination
    const useCursor = !!cursor;
    let cursorClause: { id: string } | undefined;
    let skipClause: number | undefined;

    if (useCursor) {
      const decodedCursor = decodeCursor(cursor);
      if (decodedCursor) {
        cursorClause = { id: decodedCursor.id };
        skipClause = 1;
      }
    } else {
      skipClause = skip;
    }

    // OrderBy com id como tiebreaker
    const orderBy: Prisma.EntityOrderByWithRelationInput[] = [
      { [sortBy]: sortOrder },
    ];
    if (sortBy !== 'id') {
      orderBy.push({ id: sortOrder });
    }

    // Buscar limit + 1 para detectar hasNextPage
    const takeWithExtra = limit + 1;

    const findManyArgs: Prisma.EntityFindManyArgs = {
      where,
      take: takeWithExtra,
      orderBy,
      include: {
        _count: {
          select: { data: true },
        },
        tenant: {
          select: { id: true, name: true, slug: true },
        },
      },
    };

    if (useCursor && cursorClause) {
      findManyArgs.cursor = cursorClause;
      findManyArgs.skip = 1;
    } else {
      findManyArgs.skip = skipClause;
    }

    const [rawData, total] = await Promise.all([
      this.prisma.entity.findMany(findManyArgs),
      this.prisma.entity.count({ where }),
    ]);

    // Detectar proxima pagina
    const hasNextPage = rawData.length > limit;
    const data = hasNextPage ? rawData.slice(0, limit) : rawData;
    const hasPreviousPage = useCursor ? true : page > 1;

    // Gerar cursores
    let nextCursor: string | undefined;
    let previousCursor: string | undefined;

    if (data.length > 0) {
      const lastItem = data[data.length - 1];
      const firstItem = data[0];

      if (hasNextPage) {
        nextCursor = encodeCursor({
          id: lastItem.id,
          sortField: sortBy,
          sortValue: (lastItem as Record<string, unknown>)[sortBy] as string,
        });
      }

      if (hasPreviousPage && useCursor) {
        previousCursor = encodeCursor({
          id: firstItem.id,
          sortField: sortBy,
          sortValue: (firstItem as Record<string, unknown>)[sortBy] as string,
        });
      }
    }

    return {
      data,
      meta: createPaginationMeta(total, page, limit, {
        hasNextPage,
        hasPreviousPage,
        nextCursor,
        previousCursor,
      }),
    };
  }

  async findBySlug(slug: string, currentUser: CurrentUser, tenantId?: string) {
    // PLATFORM_ADMIN pode buscar entidade de qualquer tenant se nao especificar tenantId
    const roleType = currentUser.customRole?.roleType as RoleType | undefined;
    const where: Prisma.EntityWhereInput = { slug };

    if (roleType === 'PLATFORM_ADMIN') {
      // Se tenantId for especificado, filtra por ele; senao, busca em qualquer tenant
      if (tenantId) {
        where.tenantId = tenantId;
      }
    } else {
      // Usuarios normais sempre filtram pelo proprio tenant
      where.tenantId = currentUser.tenantId;
    }

    const entity = await this.prisma.entity.findFirst({
      where,
    });

    if (!entity) {
      throw new NotFoundException(`Entidade "${slug}" nao encontrada`);
    }

    return entity;
  }

  async findOne(id: string, currentUser: CurrentUser) {
    // PLATFORM_ADMIN pode ver entidade de qualquer tenant
    const roleType = currentUser.customRole?.roleType as RoleType | undefined;
    const whereClause: Prisma.EntityWhereInput = { id };
    if (roleType !== 'PLATFORM_ADMIN') {
      whereClause.tenantId = currentUser.tenantId;
    }

    const entity = await this.prisma.entity.findFirst({
      where: whereClause,
      include: {
        tenant: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!entity) {
      throw new NotFoundException('Entidade nao encontrada');
    }

    return entity;
  }

  async update(id: string, dto: UpdateEntityDto, currentUser: CurrentUser) {
    await this.findOne(id, currentUser);

    const updateData: Prisma.EntityUpdateInput = {
      name: dto.name,
      namePlural: dto.namePlural,
      description: dto.description,
      icon: dto.icon,
      color: dto.color,
    };

    if (dto.fields !== undefined) {
      const processedFields = dto.fields.map((f: any) => ({
        ...f,
        slug: f.slug || f.name,
      }));
      updateData.fields = processedFields as unknown as Prisma.InputJsonValue;
    }
    if (dto.settings !== undefined) {
      updateData.settings = dto.settings as Prisma.InputJsonValue;
    }

    return this.prisma.entity.update({
      where: { id },
      data: updateData,
    });
  }

  async updateColumnConfig(id: string, visibleColumns: string[], currentUser: CurrentUser) {
    const entity = await this.findOne(id, currentUser);
    const currentSettings = (entity.settings as Record<string, unknown>) || {};
    const settings = { ...currentSettings, columnConfig: { visibleColumns } };

    return this.prisma.entity.update({
      where: { id },
      data: { settings: settings as Prisma.InputJsonValue },
    });
  }

  async updateGlobalFilters(id: string, globalFilters: GlobalFilterDto[], currentUser: CurrentUser) {
    const entity = await this.findOne(id, currentUser);
    const currentSettings = (entity.settings as Record<string, unknown>) || {};
    const settings = { ...currentSettings, globalFilters };

    return this.prisma.entity.update({
      where: { id },
      data: { settings: settings as unknown as Prisma.InputJsonValue },
    });
  }

  async remove(id: string, currentUser: CurrentUser) {
    await this.findOne(id, currentUser);

    // Isso tambem deleta todos os dados da entidade (cascade)
    await this.prisma.entity.delete({ where: { id } });

    return { message: 'Entidade excluida com sucesso' };
  }

  // Validar dados baseado na definicao dos campos
  validateData(fields: FieldDefinition[], data: Record<string, any>): string[] {
    const errors: string[] = [];

    for (const field of fields) {
      const value = data[field.slug];

      // Verificar campos obrigatorios
      if (field.required && (value === undefined || value === null || value === '')) {
        errors.push(`Campo "${field.name}" e obrigatorio`);
        continue;
      }

      // Pular validacao se campo vazio e nao obrigatorio
      if (value === undefined || value === null || value === '') {
        continue;
      }

      // Validacoes por tipo
      switch (field.type) {
        case 'email':
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors.push(`"${field.name}" deve ser um email valido`);
          }
          break;

        case 'number':
        case 'decimal':
        case 'currency':
          if (isNaN(Number(value))) {
            errors.push(`"${field.name}" deve ser um numero`);
          }
          break;

        case 'url':
          try {
            new URL(value);
          } catch {
            errors.push(`"${field.name}" deve ser uma URL valida`);
          }
          break;

        case 'select':
          if (field.options) {
            const validValues = field.options.map((o) => typeof o === 'string' ? o : o.value);
            if (!validValues.includes(value)) {
              errors.push(`"${field.name}" deve ser um dos valores: ${validValues.join(', ')}`);
            }
          }
          break;

        case 'multiselect':
          if (field.options && Array.isArray(value)) {
            const validValues = field.options.map((o) => typeof o === 'string' ? o : o.value);
            for (const v of value) {
              if (!validValues.includes(v)) {
                errors.push(`"${field.name}" contem valor invalido: ${v}`);
              }
            }
          }
          break;
      }
    }

    return errors;
  }
}

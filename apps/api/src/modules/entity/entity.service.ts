import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { AuditService } from '../audit/audit.service';
import { CustomRoleService } from '../custom-role/custom-role.service';
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
import { buildFilterClause } from '../../common/utils/build-filter-clause';
import { GlobalFilterDto } from './dto/update-global-filters.dto';

export type QueryEntityDto = PaginationQuery;

// Interface para condicao de validacao
export interface FieldCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'is_empty' | 'is_not_empty';
  value: unknown;
}

// Interface para validador customizado
export interface FieldValidator {
  type: 'regex' | 'min' | 'max' | 'minLength' | 'maxLength' | 'custom';
  config: Record<string, unknown>;
  message: string;
}

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
  // Validacoes condicionais
  requiredIf?: FieldCondition;
  visibleIf?: FieldCondition;
  readOnlyIf?: FieldCondition;
  validators?: FieldValidator[];
}

export interface CreateEntityDto {
  name: string;
  namePlural?: string;
  slug?: string;
  description?: string;
  icon?: string;
  color?: string;
  category?: string;
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
  category?: string;
  fields?: FieldDefinition[];
  settings?: Record<string, unknown>;
}

@Injectable()
export class EntityService {
  private readonly logger = new Logger(EntityService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private auditService: AuditService,
    private customRoleService: CustomRoleService,
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
        category: dto.category || null,
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

    // Audit log
    this.auditService.log(currentUser, {
      action: 'create',
      resource: 'entity',
      resourceId: entity.id,
      newData: entity as unknown as Record<string, unknown>,
      metadata: { name: entity.name, slug: entity.slug },
    }).catch(() => {});

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
          select: { data: true, archivedData: true },
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

  async findAllGrouped(currentUser: CurrentUser, queryTenantId?: string) {
    const roleType = (currentUser.customRole?.roleType || 'USER') as RoleType;
    const effectiveTenantId = getEffectiveTenantId(currentUser, queryTenantId);
    const where: Prisma.EntityWhereInput = {};

    if (roleType === 'PLATFORM_ADMIN') {
      if (queryTenantId) {
        where.tenantId = queryTenantId;
      }
    } else {
      where.tenantId = currentUser.tenantId;
    }

    // CUSTOM roles: filtrar apenas entidades com canRead
    if (roleType === 'CUSTOM') {
      const accessibleSlugs = await this.customRoleService.getUserAccessibleEntities(currentUser.id);
      if (accessibleSlugs.length === 0) {
        return [];
      }
      where.slug = { in: accessibleSlugs };
    }

    const entities = await this.prisma.entity.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    // Identificar sub-entidades (referenciadas por campo type=sub-entity em outra entidade)
    const subEntitySlugs = new Set<string>();
    // Mapear parent slug -> sub-entity slugs
    const parentToSubEntities = new Map<string, string[]>();
    for (const entity of entities) {
      const fields = (entity.fields as unknown as Array<{ type: string; subEntitySlug?: string }>) || [];
      for (const field of fields) {
        if (field.type === 'sub-entity' && field.subEntitySlug) {
          subEntitySlugs.add(field.subEntitySlug);
          const existing = parentToSubEntities.get(entity.slug) || [];
          existing.push(field.subEntitySlug);
          parentToSubEntities.set(entity.slug, existing);
        }
      }
    }

    // Criar lookup de sub-entidades por slug
    const entityBySlug = new Map(entities.map((e) => [e.slug, e]));

    // Excluir sub-entidades do sidebar (entidades top-level apenas)
    const topLevelEntities = entities.filter((e) => !subEntitySlugs.has(e.slug));

    // Computar contagens filtradas por entidade (scope + dataFilters + globalFilters)
    const entitiesWithCounts = await Promise.all(
      topLevelEntities.map(async (entity) => {
        const counts = await this.countFilteredEntityRecords(entity, currentUser, effectiveTenantId, roleType);

        // Anexar sub-entidades (id, name, slug, icon, color) para o sidebar
        const subSlugs = parentToSubEntities.get(entity.slug) || [];
        const subEntities = subSlugs
          .map((slug) => entityBySlug.get(slug))
          .filter(Boolean)
          .map((sub) => ({
            id: sub!.id,
            name: sub!.name,
            slug: sub!.slug,
            icon: (sub as any).icon || null,
            color: (sub as any).color || null,
          }));

        return {
          ...entity,
          _count: { data: counts.active, archivedData: counts.archived },
          ...(subEntities.length > 0 ? { subEntities } : {}),
        };
      }),
    );

    // Agrupar por categoria
    const grouped: Record<string, typeof entitiesWithCounts> = {};
    for (const entity of entitiesWithCounts) {
      const cat = entity.category || '';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(entity);
    }

    return Object.entries(grouped).map(([category, items]) => ({
      category: category || null,
      entities: items,
    }));
  }

  /**
   * Conta registros filtrados de uma entidade (scope + dataFilters + globalFilters).
   * Usado pelo sidebar para mostrar contagens corretas por role.
   */
  private async countFilteredEntityRecords(
    entity: { id: string; slug: string; settings: Prisma.JsonValue },
    user: CurrentUser,
    effectiveTenantId: string,
    roleType: RoleType | string,
  ): Promise<{ active: number; archived: number }> {
    const where: Prisma.EntityDataWhereInput = {
      entityId: entity.id,
      tenantId: effectiveTenantId,
    };

    // Scope: 'own' = apenas registros criados pelo usuario
    if (roleType === 'CUSTOM') {
      const scope = await this.customRoleService.getEntityScope(user.id, entity.slug);
      if (scope === 'own') {
        where.createdById = user.id;
      }
    } else if (roleType === 'USER') {
      where.createdById = user.id;
    }

    // Filtros globais da entidade
    const entitySettings = entity.settings as Record<string, unknown> | null;
    const globalFilters = (entitySettings?.globalFilters || []) as Array<{
      fieldSlug: string; fieldType: string; operator: string; value: unknown; value2?: unknown;
    }>;
    if (globalFilters.length > 0) {
      if (!where.AND) where.AND = [];
      const andArray = where.AND as Prisma.EntityDataWhereInput[];
      for (const f of globalFilters) {
        const clause = buildFilterClause(f.fieldSlug, f.fieldType, f.operator, f.value, f.value2);
        if (clause) andArray.push(clause);
      }
    }

    // Filtros de dados por role (permissions[].dataFilters)
    if (roleType !== 'PLATFORM_ADMIN' && roleType !== 'ADMIN' && user.customRole) {
      const roleFilters = this.customRoleService.getRoleDataFilters(
        user.customRole as { roleType: string; permissions: unknown },
        entity.slug,
      );
      if (roleFilters.length > 0) {
        if (!where.AND) where.AND = [];
        const andArray = where.AND as Prisma.EntityDataWhereInput[];
        for (const f of roleFilters) {
          const clause = buildFilterClause(f.fieldSlug, f.fieldType, f.operator, f.value, f.value2);
          if (clause) andArray.push(clause);
        }
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
    const oldEntity = await this.findOne(id, currentUser);

    const updateData: Prisma.EntityUpdateInput = {
      name: dto.name,
      namePlural: dto.namePlural,
      description: dto.description,
      icon: dto.icon,
      color: dto.color,
      ...(dto.category !== undefined && { category: dto.category || null }),
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

    const updatedEntity = await this.prisma.entity.update({
      where: { id },
      data: updateData,
    });

    // Audit log
    this.auditService.log(currentUser, {
      action: 'update',
      resource: 'entity',
      resourceId: id,
      oldData: { name: oldEntity.name, slug: oldEntity.slug, description: oldEntity.description, icon: oldEntity.icon, color: oldEntity.color },
      newData: dto as unknown as Record<string, unknown>,
      metadata: { name: updatedEntity.name, slug: updatedEntity.slug },
    }).catch(() => {});

    return updatedEntity;
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
    const oldEntity = await this.findOne(id, currentUser);

    // Isso tambem deleta todos os dados da entidade (cascade)
    await this.prisma.entity.delete({ where: { id } });

    // Audit log
    this.auditService.log(currentUser, {
      action: 'delete',
      resource: 'entity',
      resourceId: id,
      oldData: { name: oldEntity.name, slug: oldEntity.slug, description: oldEntity.description },
      metadata: { name: oldEntity.name, slug: oldEntity.slug },
    }).catch(() => {});

    return { message: 'Entidade excluida com sucesso' };
  }

  // Validar dados baseado na definicao dos campos
  validateData(fields: FieldDefinition[], data: Record<string, any>): string[] {
    const errors: string[] = [];

    for (const field of fields) {
      const value = data[field.slug];

      // Verificar requiredIf (condicional)
      if (field.requiredIf && this.evaluateCondition(field.requiredIf, data)) {
        if (value === undefined || value === null || value === '') {
          errors.push(`Campo "${field.name}" e obrigatorio nesta condicao`);
          continue;
        }
      }

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
        case 'formula':
        case 'rollup':
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
        case 'radio-group':
          // Permite valores customizados (opcao "Outros" no frontend)
          break;

        case 'multiselect':
        case 'checkbox-group':
        case 'tags':
          // Permite valores customizados (opcao "Outros" no frontend)
          break;
      }

      // Executar validators customizados
      if (field.validators && field.validators.length > 0) {
        for (const validator of field.validators) {
          const validationError = this.runValidator(validator, value, field.name);
          if (validationError) {
            errors.push(validationError);
          }
        }
      }
    }

    return errors;
  }

  /**
   * Avalia uma condicao de validacao
   */
  private evaluateCondition(condition: FieldCondition, data: Record<string, any>): boolean {
    const fieldValue = data[condition.field];
    const expectedValue = condition.value;

    switch (condition.operator) {
      case 'equals':
        return fieldValue === expectedValue;
      case 'not_equals':
        return fieldValue !== expectedValue;
      case 'contains':
        return String(fieldValue || '').includes(String(expectedValue));
      case 'gt':
        return Number(fieldValue) > Number(expectedValue);
      case 'gte':
        return Number(fieldValue) >= Number(expectedValue);
      case 'lt':
        return Number(fieldValue) < Number(expectedValue);
      case 'lte':
        return Number(fieldValue) <= Number(expectedValue);
      case 'in':
        return Array.isArray(expectedValue) && expectedValue.includes(fieldValue);
      case 'is_empty':
        return fieldValue === undefined || fieldValue === null || fieldValue === '' ||
          (Array.isArray(fieldValue) && fieldValue.length === 0);
      case 'is_not_empty':
        return fieldValue !== undefined && fieldValue !== null && fieldValue !== '' &&
          !(Array.isArray(fieldValue) && fieldValue.length === 0);
      default:
        return false;
    }
  }

  /**
   * Executa um validator customizado
   */
  private runValidator(validator: FieldValidator, value: unknown, fieldName: string): string | null {
    switch (validator.type) {
      case 'regex': {
        const pattern = validator.config.pattern as string;
        if (pattern && !new RegExp(pattern).test(String(value))) {
          return validator.message || `"${fieldName}" nao corresponde ao padrao esperado`;
        }
        break;
      }

      case 'min': {
        const min = validator.config.value as number;
        if (Number(value) < min) {
          return validator.message || `"${fieldName}" deve ser no minimo ${min}`;
        }
        break;
      }

      case 'max': {
        const max = validator.config.value as number;
        if (Number(value) > max) {
          return validator.message || `"${fieldName}" deve ser no maximo ${max}`;
        }
        break;
      }

      case 'minLength': {
        const minLength = validator.config.value as number;
        if (String(value).length < minLength) {
          return validator.message || `"${fieldName}" deve ter no minimo ${minLength} caracteres`;
        }
        break;
      }

      case 'maxLength': {
        const maxLength = validator.config.value as number;
        if (String(value).length > maxLength) {
          return validator.message || `"${fieldName}" deve ter no maximo ${maxLength} caracteres`;
        }
        break;
      }

      case 'custom': {
        // Para validators customizados, apenas retorna a mensagem se value for invalido
        // A logica customizada deve ser implementada no frontend
        break;
      }
    }

    return null;
  }
}

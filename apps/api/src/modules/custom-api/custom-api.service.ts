import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthType as PrismaAuthType, Prisma } from '@prisma/client';
import { CreateCustomApiDto, UpdateCustomApiDto, HttpMethod, ApiMode, FilterOperator } from './dto/custom-api.dto';
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
import * as vm from 'vm';

// Interfaces para configuracao visual
interface VisualFilter {
  field: string;
  operator: FilterOperator;
  value?: any;
}

interface VisualQueryParam {
  field: string;
  operator: FilterOperator;
  paramName: string;
  defaultValue?: any;
  required?: boolean;
}

interface VisualOrderBy {
  field: string;
  direction: 'asc' | 'desc';
}

// Interface para campos do inputSchema (valores dinamicos)
interface InputSchemaField {
  fieldSlug: string;
  enabled: boolean;
  valueMode: 'manual' | 'auto';
  manualValue?: unknown;   // Valor digitado pelo usuario (texto, numero, data)
  dynamicValue?: string;   // Placeholder do sistema ({{user.email}}, {{now}}, etc)
}

interface InputSchema {
  _v?: number;
  selectedFields?: InputSchemaField[];
  filters?: VisualFilter[];
  orderBy?: VisualOrderBy[];
}

export interface QueryCustomApiDto extends PaginationQuery {
  isActive?: boolean;
  method?: HttpMethod;
  cursor?: string;
}

interface EndpointExecutionContext {
  body: Record<string, unknown>;
  query: Record<string, string>;
  headers: Record<string, string>;
  user?: CurrentUser;
  tenantId: string;
  prisma: PrismaService;
}

@Injectable()
export class CustomApiService {
  private readonly logger = new Logger(CustomApiService.name);

  constructor(private prisma: PrismaService) {}

  async create(data: CreateCustomApiDto, tenantId: string) {
    // Check if path already exists for this tenant and method
    const existing = await this.prisma.customEndpoint.findFirst({
      where: {
        tenantId,
        path: data.path,
        method: data.method,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Endpoint ${data.method} ${data.path} ja existe neste tenant`,
      );
    }

    // Validar entidade fonte se modo visual
    if (data.mode === ApiMode.VISUAL && data.sourceEntityId) {
      const entity = await this.prisma.entity.findFirst({
        where: { id: data.sourceEntityId, tenantId },
      });
      if (!entity) {
        throw new BadRequestException('Entidade fonte nao encontrada');
      }
    }

    return this.prisma.customEndpoint.create({
      data: {
        name: data.name,
        description: data.description,
        path: data.path,
        method: data.method,
        // Modo da API
        mode: data.mode || 'visual',
        // Configuracao visual
        sourceEntityId: data.sourceEntityId,
        selectedFields: data.selectedFields || [],
        filters: (data.filters || []) as unknown as Prisma.InputJsonValue,
        queryParams: (data.queryParams || []) as unknown as Prisma.InputJsonValue,
        orderBy: data.orderBy ? (data.orderBy as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        limitRecords: data.limitRecords,
        responseType: data.responseType || 'records',
        // Configuracao codigo (legado)
        requestSchema: data.inputSchema,
        responseSchema: data.outputSchema,
        logic: data.logic || [],
        // Seguranca
        auth: (data.auth as PrismaAuthType) || PrismaAuthType.JWT,
        permissions: data.allowedRoles || [],
        rateLimit: data.rateLimitConfig?.requests || 100,
        isActive: data.isActive ?? true,
        tenantId,
      },
      include: {
        sourceEntity: true,
      },
    });
  }

  async findAll(tenantId: string, query: QueryCustomApiDto = {}) {
    const { page, limit, skip } = parsePaginationParams(query);
    const { search, isActive, method, sortBy = 'createdAt', sortOrder = 'desc', cursor } = query;

    const where: Prisma.CustomEndpointWhereInput = {
      tenantId,
    };

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (method) {
      where.method = method;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { path: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Cursor pagination
    const useCursor = !!cursor;
    let cursorClause: { id: string } | undefined;

    if (useCursor) {
      const decodedCursor = decodeCursor(cursor);
      if (decodedCursor) {
        cursorClause = { id: decodedCursor.id };
      }
    }

    const orderBy: Prisma.CustomEndpointOrderByWithRelationInput[] = [
      { [sortBy]: sortOrder },
    ];
    if (sortBy !== 'id') {
      orderBy.push({ id: sortOrder });
    }

    const takeWithExtra = limit + 1;

    const findManyArgs: Prisma.CustomEndpointFindManyArgs = {
      where,
      take: takeWithExtra,
      orderBy,
      include: {
        sourceEntity: {
          select: {
            id: true,
            name: true,
            slug: true,
            fields: true,
          },
        },
      },
    };

    if (useCursor && cursorClause) {
      findManyArgs.cursor = cursorClause;
      findManyArgs.skip = 1;
    } else {
      findManyArgs.skip = skip;
    }

    const [rawData, total] = await Promise.all([
      this.prisma.customEndpoint.findMany(findManyArgs),
      this.prisma.customEndpoint.count({ where }),
    ]);

    const hasNextPage = rawData.length > limit;
    const data = hasNextPage ? rawData.slice(0, limit) : rawData;
    const hasPreviousPage = useCursor ? true : page > 1;

    let nextCursor: string | undefined;
    let previousCursor: string | undefined;

    if (data.length > 0) {
      const lastItem = data[data.length - 1];
      const firstItem = data[0];

      if (hasNextPage) {
        nextCursor = encodeCursor({ id: lastItem.id, sortField: sortBy });
      }
      if (hasPreviousPage && useCursor) {
        previousCursor = encodeCursor({ id: firstItem.id, sortField: sortBy });
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

  async findOne(id: string, tenantId: string) {
    const endpoint = await this.prisma.customEndpoint.findFirst({
      where: { id, tenantId },
      include: {
        sourceEntity: {
          select: {
            id: true,
            name: true,
            slug: true,
            fields: true,
          },
        },
      },
    });

    if (!endpoint) {
      throw new NotFoundException('Endpoint nao encontrado');
    }

    return endpoint;
  }

  async update(id: string, data: UpdateCustomApiDto, tenantId: string) {
    await this.findOne(id, tenantId);

    // Check if new path conflicts with existing
    if (data.path || data.method) {
      const existing = await this.prisma.customEndpoint.findFirst({
        where: {
          tenantId,
          path: data.path,
          method: data.method,
          NOT: { id },
        },
      });

      if (existing) {
        throw new BadRequestException(
          `Endpoint ${data.method} ${data.path} ja existe neste tenant`,
        );
      }
    }

    // Validar entidade fonte se modo visual
    if (data.sourceEntityId) {
      const entity = await this.prisma.entity.findFirst({
        where: { id: data.sourceEntityId, tenantId },
      });
      if (!entity) {
        throw new BadRequestException('Entidade fonte nao encontrada');
      }
    }

    return this.prisma.customEndpoint.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        path: data.path,
        method: data.method,
        // Modo da API
        mode: data.mode,
        // Configuracao visual
        sourceEntityId: data.sourceEntityId,
        selectedFields: data.selectedFields,
        filters: data.filters ? (data.filters as unknown as Prisma.InputJsonValue) : undefined,
        queryParams: data.queryParams ? (data.queryParams as unknown as Prisma.InputJsonValue) : undefined,
        orderBy: data.orderBy ? (data.orderBy as unknown as Prisma.InputJsonValue) : undefined,
        limitRecords: data.limitRecords,
        responseType: data.responseType,
        // Configuracao codigo
        requestSchema: data.inputSchema,
        responseSchema: data.outputSchema,
        logic: data.logic,
        // Seguranca
        auth: data.auth as PrismaAuthType,
        permissions: data.allowedRoles,
        rateLimit: data.rateLimitConfig?.requests,
        isActive: data.isActive,
      },
      include: {
        sourceEntity: true,
      },
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    return this.prisma.customEndpoint.delete({
      where: { id },
    });
  }

  async toggleActive(id: string, tenantId: string) {
    const endpoint = await this.findOne(id, tenantId);

    return this.prisma.customEndpoint.update({
      where: { id },
      data: { isActive: !endpoint.isActive },
    });
  }

  async activate(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    return this.prisma.customEndpoint.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async deactivate(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    return this.prisma.customEndpoint.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // Execute custom endpoint logic
  async executeEndpoint(
    tenantId: string,
    path: string,
    method: HttpMethod,
    body: Record<string, unknown>,
    query: Record<string, string>,
    headers: Record<string, string>,
    user?: CurrentUser,
  ) {
    const endpoint = await this.prisma.customEndpoint.findFirst({
      where: {
        tenantId,
        path,
        method,
        isActive: true,
      },
      include: {
        sourceEntity: true,
      },
    });

    if (!endpoint) {
      throw new NotFoundException('Endpoint nao encontrado ou inativo');
    }

    // Check role permissions
    const permissions = endpoint.permissions as string[];
    if (permissions?.length > 0 && user) {
      const roleType = user.customRole?.roleType;
      if (!roleType || !permissions.includes(roleType)) {
        throw new BadRequestException('Acesso nao autorizado');
      }
    }

    // Executar baseado no modo
    if (endpoint.mode === 'visual') {
      return this.executeVisualMode(endpoint, method, query, body, user, tenantId);
    }

    // Modo code (legado)
    const logic = endpoint.logic as string | null;
    if (logic && typeof logic === 'string') {
      return this.executeLogic(logic, {
        body,
        query,
        headers,
        user,
        tenantId,
        prisma: this.prisma,
      });
    }

    return { success: true, message: 'Endpoint executed' };
  }

  // Executar modo visual
  private async executeVisualMode(
    endpoint: any,
    method: HttpMethod,
    queryParams: Record<string, string>,
    body: Record<string, unknown>,
    user?: CurrentUser,
    tenantId?: string,
  ) {
    // Verificar se tem entidade fonte
    if (!endpoint.sourceEntityId) {
      throw new BadRequestException('API visual sem entidade fonte configurada');
    }

    // Buscar entidade para validar campos
    const entity = await this.prisma.entity.findUnique({
      where: { id: endpoint.sourceEntityId },
    });

    if (!entity) {
      throw new BadRequestException('Entidade fonte nao encontrada');
    }

    // POST/PUT/PATCH = escrita (criar/atualizar registro)
    if (method === HttpMethod.POST || method === HttpMethod.PUT || method === HttpMethod.PATCH) {
      return this.executeVisualWrite(endpoint, entity, body, user, tenantId);
    }

    // GET/DELETE = leitura
    return this.executeVisualRead(endpoint, queryParams, body, tenantId);
  }

  // Executar escrita (POST/PUT/PATCH)
  private async executeVisualWrite(
    endpoint: any,
    entity: any,
    body: Record<string, unknown>,
    user?: CurrentUser,
    tenantId?: string,
  ) {
    const effectiveTenantId = tenantId || endpoint.tenantId;

    // Processar inputSchema para obter valores dinamicos
    const inputSchema = endpoint.requestSchema as InputSchema | null;
    const schemaFields = inputSchema?.selectedFields || [];

    // Montar dados do registro
    const recordData: Record<string, unknown> = { ...body };

    // Processar campos com valores configurados (manual ou auto)
    for (const field of schemaFields) {
      if (!field.enabled) continue;

      switch (field.valueMode) {
        case 'auto':
          // Substituir placeholders como {{user.email}}
          if (field.dynamicValue) {
            const resolvedValue = this.resolveDynamicValue(field.dynamicValue, user);
            if (resolvedValue !== undefined) {
              recordData[field.fieldSlug] = resolvedValue;
            }
          }
          break;

        case 'manual':
          // Usar valor fixo digitado pelo usuario
          if (field.manualValue !== undefined) {
            recordData[field.fieldSlug] = field.manualValue;
          }
          break;
      }
    }

    this.logger.log(`Creating record for entity ${entity.slug} with data: ${JSON.stringify(recordData)}`);

    // Criar registro
    const created = await this.prisma.entityData.create({
      data: {
        tenantId: effectiveTenantId,
        entityId: entity.id,
        data: recordData as Prisma.InputJsonValue,
        createdById: user?.id,
        updatedById: user?.id,
      },
    });

    return {
      success: true,
      message: 'Registro criado com sucesso',
      data: {
        id: created.id,
        ...recordData,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      },
    };
  }

  // Resolver valor dinamico (substituir placeholders)
  private resolveDynamicValue(template: string, user?: CurrentUser): unknown {
    if (!template) return undefined;

    // Mapa de valores disponiveis
    const now = new Date();
    const values: Record<string, unknown> = {
      'user.id': user?.id,
      'user.email': user?.email,
      'user.name': user?.name,
      'user.roleType': user?.customRole?.roleType,
      'user.tenantId': user?.tenantId,
      'now': now.toISOString(),
      'today': now.toISOString().split('T')[0],
      'timestamp': now.getTime(),
    };

    // Se template e exatamente um placeholder, retornar valor diretamente
    const singleMatch = template.match(/^\{\{(.+?)\}\}$/);
    if (singleMatch) {
      const key = singleMatch[1].trim();
      return values[key];
    }

    // Se template tem multiplos placeholders ou texto misto, substituir todos
    let result = template;
    for (const [key, value] of Object.entries(values)) {
      result = result.replace(new RegExp(`\\{\\{\\s*${key.replace('.', '\\.')}\\s*\\}\\}`, 'g'), String(value ?? ''));
    }

    return result;
  }

  // Executar leitura (GET)
  private async executeVisualRead(
    endpoint: any,
    queryParams: Record<string, string>,
    body: Record<string, unknown>,
    tenantId?: string,
  ) {
    // Construir filtros
    const filters: any = {};

    // Filtros fixos
    const fixedFilters = (endpoint.filters || []) as VisualFilter[];
    for (const filter of fixedFilters) {
      this.applyFilter(filters, filter.field, filter.operator, filter.value);
    }

    // Filtros dinamicos (da URL)
    const dynamicParams = (endpoint.queryParams || []) as VisualQueryParam[];
    for (const param of dynamicParams) {
      const value = queryParams[param.paramName] ?? body[param.paramName] ?? param.defaultValue;

      if (param.required && (value === undefined || value === null || value === '')) {
        throw new BadRequestException(`Parametro obrigatorio: ${param.paramName}`);
      }

      if (value !== undefined && value !== null && value !== '') {
        this.applyFilter(filters, param.field, param.operator, value);
      }
    }

    // Montar query com isolamento de tenant
    const effectiveTenantId = tenantId || endpoint.tenantId;
    const where: Prisma.EntityDataWhereInput = {
      entityId: endpoint.sourceEntityId,
      tenantId: effectiveTenantId,
    };

    // Aplicar filtros no campo data (JSON)
    if (Object.keys(filters).length > 0) {
      where.data = {
        path: Object.keys(filters),
        ...filters,
      };
    }

    // Ordenacao
    let orderBy: Prisma.EntityDataOrderByWithRelationInput | undefined;
    const orderConfig = endpoint.orderBy as VisualOrderBy | null;
    if (orderConfig) {
      // Se ordenar por campo do data, usar createdAt como fallback
      // (Prisma nao suporta ordenar por campo JSON diretamente)
      orderBy = { createdAt: orderConfig.direction };
    } else {
      orderBy = { createdAt: 'desc' };
    }

    // Se responseType = count, retornar apenas a contagem
    if (endpoint.responseType === 'count') {
      const count = await this.prisma.entityData.count({ where });
      return { count };
    }

    // Executar query
    const results = await this.prisma.entityData.findMany({
      where,
      orderBy,
      take: endpoint.limitRecords || undefined,
    });

    // Filtrar campos selecionados
    const selectedFields = (endpoint.selectedFields || []) as string[];

    if (selectedFields.length > 0) {
      return results.map((record) => {
        const data = record.data as Record<string, unknown>;
        const filtered: Record<string, unknown> = { id: record.id };

        for (const field of selectedFields) {
          if (field in data) {
            filtered[field] = data[field];
          }
        }

        // Adicionar metadata
        filtered.createdAt = record.createdAt;
        filtered.updatedAt = record.updatedAt;

        return filtered;
      });
    }

    // Retornar todos os campos
    return results.map((record) => ({
      id: record.id,
      ...(record.data as Record<string, unknown>),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }));
  }

  // Aplicar filtro baseado no operador
  private applyFilter(
    filters: Record<string, unknown>,
    field: string,
    operator: FilterOperator,
    value: unknown,
  ) {
    switch (operator) {
      case FilterOperator.EQUALS:
        filters[field] = value;
        break;
      case FilterOperator.NOT_EQUALS:
        filters[field] = { not: value };
        break;
      case FilterOperator.CONTAINS:
        filters[field] = { contains: value, mode: 'insensitive' };
        break;
      case FilterOperator.NOT_CONTAINS:
        filters[field] = { not: { contains: value } };
        break;
      case FilterOperator.STARTS_WITH:
        filters[field] = { startsWith: value };
        break;
      case FilterOperator.ENDS_WITH:
        filters[field] = { endsWith: value };
        break;
      case FilterOperator.GREATER_THAN:
        filters[field] = { gt: value };
        break;
      case FilterOperator.GREATER_THAN_OR_EQUAL:
        filters[field] = { gte: value };
        break;
      case FilterOperator.LESS_THAN:
        filters[field] = { lt: value };
        break;
      case FilterOperator.LESS_THAN_OR_EQUAL:
        filters[field] = { lte: value };
        break;
      case FilterOperator.IN:
        filters[field] = { in: Array.isArray(value) ? value : [value] };
        break;
      case FilterOperator.NOT_IN:
        filters[field] = { notIn: Array.isArray(value) ? value : [value] };
        break;
      case FilterOperator.IS_NULL:
        filters[field] = null;
        break;
      case FilterOperator.IS_NOT_NULL:
        filters[field] = { not: null };
        break;
      default:
        filters[field] = value;
    }
  }

  private async executeLogic(
    code: string,
    context: EndpointExecutionContext,
  ) {
    try {
      // Create a sandboxed context
      const sandbox = {
        body: context.body,
        query: context.query,
        headers: context.headers,
        user: context.user,
        tenantId: context.tenantId,
        // Limited Prisma access
        db: {
          entityData: {
            findMany: (args: Prisma.EntityDataFindManyArgs) =>
              context.prisma.entityData.findMany({
                ...args,
                where: { ...args.where, entity: { tenantId: context.tenantId } },
              }),
            findFirst: (args: Prisma.EntityDataFindFirstArgs) =>
              context.prisma.entityData.findFirst({
                ...args,
                where: { ...args.where, entity: { tenantId: context.tenantId } },
              }),
            create: (args: Prisma.EntityDataCreateArgs) =>
              context.prisma.entityData.create(args),
            update: (args: Prisma.EntityDataUpdateArgs) =>
              context.prisma.entityData.update(args),
          },
        },
        console: {
          log: (...args: unknown[]) => this.logger.log(args.map(String).join(' ')),
          error: (...args: unknown[]) => this.logger.error(args.map(String).join(' ')),
        },
        JSON,
        Date,
        Math,
        result: null as unknown,
      };

      // Create VM context and run code
      const script = new vm.Script(`
        (async () => {
          ${code}
        })().then(r => { result = r; });
      `);

      const vmContext = vm.createContext(sandbox);
      script.runInContext(vmContext, { timeout: 5000 });

      // Wait for async execution
      await new Promise((resolve) => setTimeout(resolve, 100));

      return sandbox.result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error executing custom logic: ${errorMessage}`);
      throw new BadRequestException(`Erro na execucao: ${errorMessage}`);
    }
  }

  // Get endpoint stats
  async getEndpointStats(tenantId: string) {
    const endpoints = await this.prisma.customEndpoint.findMany({
      where: { tenantId },
    });

    return {
      total: endpoints.length,
      active: endpoints.filter((e) => e.isActive).length,
      byMethod: {
        GET: endpoints.filter((e) => e.method === 'GET').length,
        POST: endpoints.filter((e) => e.method === 'POST').length,
        PUT: endpoints.filter((e) => e.method === 'PUT').length,
        PATCH: endpoints.filter((e) => e.method === 'PATCH').length,
        DELETE: endpoints.filter((e) => e.method === 'DELETE').length,
      },
    };
  }
}

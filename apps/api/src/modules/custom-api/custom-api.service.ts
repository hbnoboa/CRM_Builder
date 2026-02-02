import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthType as PrismaAuthType, Prisma } from '@prisma/client';
import { CreateCustomApiDto, UpdateCustomApiDto, HttpMethod } from './dto/custom-api.dto';
import {
  CurrentUser,
  PaginationQuery,
  parsePaginationParams,
  createPaginationMeta,
} from '../../common/types';
import * as vm from 'vm';

export interface QueryCustomApiDto extends PaginationQuery {
  isActive?: boolean;
  method?: HttpMethod;
}

interface EndpointExecutionContext {
  body: Record<string, unknown>;
  query: Record<string, string>;
  headers: Record<string, string>;
  user?: CurrentUser;
  workspaceId: string;
  prisma: PrismaService;
}

@Injectable()
export class CustomApiService {
  private readonly logger = new Logger(CustomApiService.name);

  constructor(private prisma: PrismaService) {}

  async create(data: CreateCustomApiDto, workspaceId: string, tenantId: string) {
    // Check if path already exists for this workspace and method
    const existing = await this.prisma.customEndpoint.findFirst({
      where: {
        workspaceId,
        path: data.path,
        method: data.method,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Endpoint ${data.method} ${data.path} já existe neste workspace`,
      );
    }

    return this.prisma.customEndpoint.create({
      data: {
        name: data.name,
        description: data.description,
        path: data.path,
        method: data.method,
        requestSchema: data.inputSchema,
        responseSchema: data.outputSchema,
        logic: data.logic || [],
        auth: (data.auth as PrismaAuthType) || PrismaAuthType.JWT,
        permissions: data.allowedRoles || [],
        rateLimit: data.rateLimitConfig?.requests || 100,
        isActive: data.isActive ?? true,
        workspaceId,
        tenantId,
      },
    });
  }

  async findAll(workspaceId: string, query: QueryCustomApiDto = {}) {
    const { page, limit, skip } = parsePaginationParams(query);
    const { search, isActive, method, sortBy = 'createdAt', sortOrder = 'desc' } = query;

    const where: Prisma.CustomEndpointWhereInput = {
      workspaceId,
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

    const [data, total] = await Promise.all([
      this.prisma.customEndpoint.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.customEndpoint.count({ where }),
    ]);

    return {
      data,
      meta: createPaginationMeta(total, page, limit),
    };
  }

  async findOne(id: string, workspaceId: string) {
    const endpoint = await this.prisma.customEndpoint.findFirst({
      where: { id, workspaceId },
    });

    if (!endpoint) {
      throw new NotFoundException('Endpoint não encontrado');
    }

    return endpoint;
  }

  async update(id: string, data: UpdateCustomApiDto, workspaceId: string) {
    await this.findOne(id, workspaceId);

    // Check if new path conflicts with existing
    if (data.path || data.method) {
      const existing = await this.prisma.customEndpoint.findFirst({
        where: {
          workspaceId,
          path: data.path,
          method: data.method,
          NOT: { id },
        },
      });

      if (existing) {
        throw new BadRequestException(
          `Endpoint ${data.method} ${data.path} já existe neste workspace`,
        );
      }
    }

    return this.prisma.customEndpoint.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        path: data.path,
        method: data.method,
        requestSchema: data.inputSchema,
        responseSchema: data.outputSchema,
        logic: data.logic,
        auth: data.auth as PrismaAuthType,
        permissions: data.allowedRoles,
        rateLimit: data.rateLimitConfig?.requests,
        isActive: data.isActive,
      },
    });
  }

  async remove(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);

    return this.prisma.customEndpoint.delete({
      where: { id },
    });
  }

  async toggleActive(id: string, workspaceId: string) {
    const endpoint = await this.findOne(id, workspaceId);

    return this.prisma.customEndpoint.update({
      where: { id },
      data: { isActive: !endpoint.isActive },
    });
  }

  async activate(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);

    return this.prisma.customEndpoint.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async deactivate(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);

    return this.prisma.customEndpoint.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // Execute custom endpoint logic
  async executeEndpoint(
    workspaceId: string,
    path: string,
    method: HttpMethod,
    body: Record<string, unknown>,
    query: Record<string, string>,
    headers: Record<string, string>,
    user?: CurrentUser,
  ) {
    const endpoint = await this.prisma.customEndpoint.findFirst({
      where: {
        workspaceId,
        path,
        method,
        isActive: true,
      },
    });

    if (!endpoint) {
      throw new NotFoundException('Endpoint não encontrado ou inativo');
    }

    // Check role permissions
    const permissions = endpoint.permissions as string[];
    if (permissions?.length > 0 && user) {
      if (!permissions.includes(user.role)) {
        throw new BadRequestException('Acesso não autorizado');
      }
    }

    // Execute logic if defined
    const logic = endpoint.logic as string | null;
    if (logic && typeof logic === 'string') {
      return this.executeLogic(logic, {
        body,
        query,
        headers,
        user,
        workspaceId,
        prisma: this.prisma,
      });
    }

    return { success: true, message: 'Endpoint executed' };
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
        workspaceId: context.workspaceId,
        // Limited Prisma access
        db: {
          entityData: {
            findMany: (args: Prisma.EntityDataFindManyArgs) =>
              context.prisma.entityData.findMany({
                ...args,
                where: { ...args.where, entity: { workspaceId: context.workspaceId } },
              }),
            findFirst: (args: Prisma.EntityDataFindFirstArgs) =>
              context.prisma.entityData.findFirst({
                ...args,
                where: { ...args.where, entity: { workspaceId: context.workspaceId } },
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
  async getEndpointStats(workspaceId: string) {
    const endpoints = await this.prisma.customEndpoint.findMany({
      where: { workspaceId },
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

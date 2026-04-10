import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CurrentUser } from '../../common/types/auth.types';
import { QueryAuditLogDto } from './dto/audit-log.dto';
import { buildCursorResponse } from '../../common/utils/cursor-pagination.util';

export type AuditAction = 'create' | 'update' | 'delete';
export type AuditResource =
  | 'entity_data'
  | 'user'
  | 'entity'
  | 'custom_role'
  | 'custom_api'
  | 'page';

export interface AuditLogInput {
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}

const SENSITIVE_PATTERNS = [
  /password/i, /token/i, /secret/i, /key/i, /credential/i,
  /authorization/i, /credit.?card/i, /ssn/i, /cpf/i, /cnpj/i,
];

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log an audit event. Fire-and-forget — never throws to the caller.
   */
  async log(user: CurrentUser, input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          action: input.action,
          resource: input.resource,
          resourceId: input.resourceId ?? null,
          oldData: input.oldData ? this.sanitize(input.oldData) as Prisma.InputJsonValue : Prisma.JsonNull,
          newData: input.newData ? this.sanitize(input.newData) as Prisma.InputJsonValue : Prisma.JsonNull,
          metadata: input.metadata as Prisma.InputJsonValue ?? Prisma.JsonNull,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to write audit log: ${error}`);
    }
  }

  /**
   * Query audit logs with pagination and filters. PLATFORM_ADMIN only.
   * Busca em AuditLog (ativos) e ArchivedAuditLog (arquivados) quando necessário.
   */
  async findAll(query: QueryAuditLogDto) {
    const { page = 1, limit = 50, cursor, tenantId, action, resource, userId, dateFrom, dateTo, search } = query;
    const skip = (page - 1) * limit;
    const useCursor = !!cursor;

    // Determinar se precisa buscar logs arquivados (> 90 dias)
    const archiveCutoffDate = new Date();
    archiveCutoffDate.setDate(archiveCutoffDate.getDate() - 90);

    const needsArchived = dateFrom && new Date(dateFrom) < archiveCutoffDate;

    // Construir where clause
    const where: Prisma.AuditLogWhereInput = {};
    const whereArchived: Prisma.ArchivedAuditLogWhereInput = {};

    if (tenantId) {
      where.tenantId = tenantId;
      whereArchived.tenantId = tenantId;
    }
    if (action) {
      where.action = action;
      whereArchived.action = action;
    }
    if (resource) {
      where.resource = resource;
      whereArchived.resource = resource;
    }
    if (userId) {
      where.userId = userId;
      whereArchived.userId = userId;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      whereArchived.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
        whereArchived.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo);
        whereArchived.createdAt.lte = new Date(dateTo);
      }
    }

    if (search) {
      where.OR = [
        { resourceId: { contains: search, mode: 'insensitive' } },
        { action: { contains: search, mode: 'insensitive' } },
        { resource: { contains: search, mode: 'insensitive' } },
      ];
      whereArchived.OR = [
        { resourceId: { contains: search, mode: 'insensitive' } },
        { action: { contains: search, mode: 'insensitive' } },
        { resource: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Cursor pagination para logs recentes (mais eficiente)
    if (useCursor && !needsArchived) {
      const takeWithExtra = limit + 1;
      const items = await this.prisma.auditLog.findMany({
        where,
        take: takeWithExtra,
        orderBy: { createdAt: 'desc' },
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,
        }),
      });

      // Enrich with user info
      const userIds = [...new Set(items.map((l) => l.userId).filter(Boolean))] as string[];
      const users = userIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
      const userMap = new Map(users.map((u) => [u.id, u]));

      const enrichedItems = items.map((log) => ({
        ...log,
        userName: log.userId ? userMap.get(log.userId)?.name ?? null : null,
        userEmail: log.userId ? userMap.get(log.userId)?.email ?? null : null,
        isArchived: false,
      }));

      const response = buildCursorResponse({
        items: enrichedItems,
        limit,
        getCursorValue: (item) => item.id,
      });

      return {
        ...response,
        meta: {
          ...response.meta,
          includesArchived: false,
          activeCount: null, // Não calculamos total em cursor mode
          archivedCount: 0,
        },
      };
    }

    // Offset pagination (legacy ou com archived)
    const [activeLogs, activeTotal, archivedLogs, archivedTotal] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
      needsArchived
        ? this.prisma.archivedAuditLog.findMany({
            where: whereArchived,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
          })
        : [],
      needsArchived
        ? this.prisma.archivedAuditLog.count({ where: whereArchived })
        : 0,
    ]);

    // Combinar e ordenar logs
    const rawData = [...activeLogs, ...archivedLogs].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    const total = activeTotal + archivedTotal;

    // Enrich with user info
    const userIds = [...new Set(rawData.map((l) => l.userId).filter(Boolean))] as string[];
    const users = userIds.length > 0
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const data = rawData.map((log) => ({
      ...log,
      userName: log.userId ? userMap.get(log.userId)?.name ?? null : null,
      userEmail: log.userId ? userMap.get(log.userId)?.email ?? null : null,
      isArchived: 'archivedAt' in log, // Flag para indicar se é arquivado
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        includesArchived: needsArchived,
        activeCount: activeTotal,
        archivedCount: archivedTotal,
      },
    };
  }

  /**
   * Export audit logs for a date range as JSON buffer.
   */
  async exportRange(where: Prisma.AuditLogWhereInput): Promise<{ buffer: Buffer; count: number }> {
    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    const json = JSON.stringify(logs, null, 2);
    return {
      buffer: Buffer.from(json, 'utf-8'),
      count: logs.length,
    };
  }

  /**
   * Delete audit logs matching a where clause. Used by backup cron.
   */
  async deleteRange(where: Prisma.AuditLogWhereInput): Promise<number> {
    const result = await this.prisma.auditLog.deleteMany({ where });
    return result.count;
  }

  /**
   * Strip sensitive fields from data before persisting (case-insensitive, recursive).
   */
  private sanitize(data: Record<string, unknown>): Record<string, unknown> {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (SENSITIVE_PATTERNS.some(p => p.test(key))) {
        cleaned[key] = '[REDACTED]';
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        cleaned[key] = this.sanitize(value as Record<string, unknown>);
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }
}

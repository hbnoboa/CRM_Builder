import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CurrentUser } from '../../common/types/auth.types';
import { QueryAuditLogDto } from './dto/audit-log.dto';

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
   */
  async findAll(query: QueryAuditLogDto) {
    const { page = 1, limit = 50, tenantId, action, resource, userId, dateFrom, dateTo, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};

    if (tenantId) where.tenantId = tenantId;
    if (action) where.action = action;
    if (resource) where.resource = resource;
    if (userId) where.userId = userId;

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    if (search) {
      where.OR = [
        { resourceId: { contains: search, mode: 'insensitive' } },
        { action: { contains: search, mode: 'insensitive' } },
        { resource: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [rawData, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

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
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
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

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  UnprocessableEntityException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CurrentUser } from '../../common/types/auth.types';
import { QueryAuditLogDto } from './dto/audit-log.dto';
import { buildCursorResponse } from '../../common/utils/cursor-pagination.util';
import { hasPlatformAccess } from '../../common/utils/platform-access';

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
          // Impersonacao: registra o ator real (quem assumiu a identidade).
          impersonatedById: user.impersonatedBy?.id ?? null,
          impersonatedByName: user.impersonatedBy?.name ?? null,
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
   * #19 item 7: "desfazer" sobre audit + soft-delete. Operacionaliza o
   * "reversivel + auditavel" da spec §7.4. Suportado para `entity_data`:
   *   - create -> soft-delete o registro criado (lossless)
   *   - delete -> restaura o registro (lossless: a linha soft-deletada continua intacta)
   *   - update -> grava o oldData de volta (BLOQUEADO se o log tiver campos
   *     sensiveis mascarados como [REDACTED], pois restaurar corromperia os dados)
   * O proprio revert vira um novo evento de auditoria (espinha imutavel).
   */
  async revert(user: CurrentUser, auditLogId: string) {
    const log = await this.prisma.auditLog.findUnique({ where: { id: auditLogId } });
    if (!log) throw new NotFoundException('Audit log nao encontrado');

    // Multi-tenant: so reverte log do proprio tenant (salvo acesso de plataforma).
    const isPlatform = hasPlatformAccess(user.customRole?.modulePermissions);
    if (!isPlatform && log.tenantId !== user.tenantId) {
      throw new NotFoundException('Audit log nao encontrado');
    }

    if (log.resource !== 'entity_data') {
      throw new BadRequestException('Revert suportado apenas para entity_data');
    }
    if (!log.resourceId) throw new BadRequestException('Audit log sem resourceId');

    const record = await this.prisma.entityData.findUnique({ where: { id: log.resourceId } });
    if (!record) throw new NotFoundException('Registro alvo nao existe mais');
    if (record.tenantId !== log.tenantId) {
      throw new BadRequestException('Inconsistencia de tenant no registro alvo');
    }

    // Acao inversa que sera registrada na espinha de auditoria.
    let revertAction: AuditAction;
    try {
      if (log.action === 'create') {
        if (record.deletedAt) throw new BadRequestException('Registro ja esta excluido');
        await this.prisma.entityData.update({
          where: { id: record.id },
          data: { deletedAt: new Date() },
        });
        revertAction = 'delete';
      } else if (log.action === 'delete') {
        if (!record.deletedAt) throw new BadRequestException('Registro nao esta excluido');
        await this.prisma.entityData.update({
          where: { id: record.id },
          data: { deletedAt: null },
        });
        revertAction = 'create';
      } else if (log.action === 'update') {
        const oldData = log.oldData as Record<string, unknown> | null;
        if (!oldData || typeof oldData !== 'object') {
          throw new BadRequestException('Audit sem oldData para reverter');
        }
        if (this.hasRedacted(oldData)) {
          throw new UnprocessableEntityException(
            'Revert de update bloqueado: o log contem campos sensiveis mascarados ([REDACTED]); restaurar corromperia os dados.',
          );
        }
        await this.prisma.entityData.update({
          where: { id: record.id },
          data: { data: oldData as Prisma.InputJsonValue },
        });
        revertAction = 'update';
      } else {
        throw new BadRequestException('Acao nao reversivel');
      }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          'Revert violaria um campo unico (outro registro vivo ja usa esse valor).',
        );
      }
      throw error;
    }

    // Espinha imutavel: o revert e um novo evento auditado.
    await this.log(user, {
      action: revertAction,
      resource: 'entity_data',
      resourceId: record.id,
      metadata: { revertOf: log.id, originalAction: log.action },
    });

    return { reverted: true, auditLogId: log.id, originalAction: log.action, recordId: record.id };
  }

  /** Detecta valores mascarados ([REDACTED]) recursivamente. */
  private hasRedacted(obj: Record<string, unknown>): boolean {
    for (const value of Object.values(obj)) {
      if (value === '[REDACTED]') return true;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        if (this.hasRedacted(value as Record<string, unknown>)) return true;
      }
    }
    return false;
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

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { PlatformStaffPrincipal } from './platform-permissions';

export interface PlatformAuditEntry {
  action: string;
  targetType: string;
  targetId?: string;
  tenantId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

@Injectable()
export class PlatformAuditService {
  private readonly logger = new Logger(PlatformAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(staff: PlatformStaffPrincipal, entry: PlatformAuditEntry): Promise<void> {
    try {
      await this.prisma.platformAuditLog.create({
        data: {
          staffId: staff.id,
          staffName: staff.name,
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId,
          tenantId: entry.tenantId,
          metadata: entry.metadata as Prisma.InputJsonValue | undefined,
          ip: entry.ip,
        },
      });
    } catch (error) {
      // Auditoria nao derruba a acao, mas fica no log do servidor.
      this.logger.error(`Falha ao auditar ${entry.action} por ${staff.email}`, error as Error);
    }
  }

  async findAll(query: { tenantId?: string; staffId?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    const where: Prisma.PlatformAuditLogWhereInput = {
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.staffId ? { staffId: query.staffId } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.platformAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.platformAuditLog.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditArchiveService {
  private readonly logger = new Logger(AuditArchiveService.name);

  // Configurações
  private readonly ARCHIVE_AFTER_DAYS = 90; // Arquivar logs > 90 dias
  private readonly DELETE_AFTER_DAYS = 365; // Deletar logs arquivados > 1 ano
  private readonly BATCH_SIZE = 1000; // Processar em lotes de 1000

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cron job diário (3h AM): Arquiva logs antigos > 90 dias
   * Move logs de AuditLog para ArchivedAuditLog
   */
  @Cron('0 3 * * *', {
    name: 'archive-old-audit-logs',
    timeZone: 'America/Sao_Paulo',
  })
  async archiveOldLogs(): Promise<void> {
    const startTime = Date.now();
    this.logger.log('🗄️ Iniciando arquivamento de audit logs antigos...');

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.ARCHIVE_AFTER_DAYS);

      let totalArchived = 0;
      let hasMore = true;

      while (hasMore) {
        // 1. Buscar lote de logs antigos
        const logs = await this.prisma.auditLog.findMany({
          where: {
            createdAt: { lt: cutoffDate },
          },
          take: this.BATCH_SIZE,
          orderBy: { createdAt: 'asc' },
        });

        if (logs.length === 0) {
          hasMore = false;
          break;
        }

        // 2. Mover para tabela de archive
        await this.prisma.archivedAuditLog.createMany({
          data: logs.map(log => ({
            id: log.id,
            tenantId: log.tenantId,
            userId: log.userId,
            action: log.action,
            resource: log.resource,
            resourceId: log.resourceId,
            oldData: log.oldData as any,
            newData: log.newData as any,
            metadata: log.metadata as any,
            createdAt: log.createdAt,
            archivedAt: new Date(),
          })),
          skipDuplicates: true, // Evitar erros se já foi arquivado
        });

        // 3. Deletar da tabela principal
        await this.prisma.auditLog.deleteMany({
          where: {
            id: { in: logs.map(l => l.id) },
          },
        });

        totalArchived += logs.length;

        this.logger.debug(
          `📦 Lote processado: ${logs.length} logs (total: ${totalArchived})`
        );
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ Arquivamento concluído: ${totalArchived} audit logs em ${duration}ms\n` +
        `   Cutoff: ${cutoffDate.toISOString()}`
      );

      // Retornar estatísticas
      return {
        archived: totalArchived,
        cutoffDate: cutoffDate.toISOString(),
        durationMs: duration,
      } as any;

    } catch (error) {
      this.logger.error(
        `❌ Erro ao arquivar audit logs: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Cron job semanal (Domingo 4h AM): Deleta logs arquivados muito antigos > 1 ano
   */
  @Cron('0 4 * * 0', {
    name: 'delete-very-old-audit-logs',
    timeZone: 'America/Sao_Paulo',
  })
  async deleteVeryOldLogs(): Promise<void> {
    const startTime = Date.now();
    this.logger.log('🗑️ Iniciando deleção de audit logs arquivados muito antigos...');

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.DELETE_AFTER_DAYS);

      const result = await this.prisma.archivedAuditLog.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
        },
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ Deleção concluída: ${result.count} audit logs arquivados em ${duration}ms\n` +
        `   Cutoff: ${cutoffDate.toISOString()}`
      );

      return {
        deleted: result.count,
        cutoffDate: cutoffDate.toISOString(),
        durationMs: duration,
      } as any;

    } catch (error) {
      this.logger.error(
        `❌ Erro ao deletar audit logs arquivados: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Método manual para arquivar logs (útil para testes ou execução ad-hoc)
   */
  async manualArchive(daysOld: number = this.ARCHIVE_AFTER_DAYS): Promise<{
    archived: number;
    cutoffDate: string;
    durationMs: number;
  }> {
    this.logger.log(`🔧 Arquivamento manual iniciado (dias: ${daysOld})`);

    const startTime = Date.now();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    let totalArchived = 0;
    let hasMore = true;

    while (hasMore) {
      const logs = await this.prisma.auditLog.findMany({
        where: {
          createdAt: { lt: cutoffDate },
        },
        take: this.BATCH_SIZE,
      });

      if (logs.length === 0) {
        hasMore = false;
        break;
      }

      await this.prisma.archivedAuditLog.createMany({
        data: logs.map(log => ({
          id: log.id,
          tenantId: log.tenantId,
          userId: log.userId,
          action: log.action,
          resource: log.resource,
          resourceId: log.resourceId,
          oldData: log.oldData as any,
          newData: log.newData as any,
          metadata: log.metadata as any,
          createdAt: log.createdAt,
          archivedAt: new Date(),
        })),
        skipDuplicates: true,
      });

      await this.prisma.auditLog.deleteMany({
        where: {
          id: { in: logs.map(l => l.id) },
        },
      });

      totalArchived += logs.length;
    }

    const duration = Date.now() - startTime;

    return {
      archived: totalArchived,
      cutoffDate: cutoffDate.toISOString(),
      durationMs: duration,
    };
  }

  /**
   * Método manual para deletar logs arquivados (útil para testes)
   */
  async manualDelete(daysOld: number = this.DELETE_AFTER_DAYS): Promise<{
    deleted: number;
    cutoffDate: string;
    durationMs: number;
  }> {
    this.logger.log(`🔧 Deleção manual iniciada (dias: ${daysOld})`);

    const startTime = Date.now();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.prisma.archivedAuditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    const duration = Date.now() - startTime;

    return {
      deleted: result.count,
      cutoffDate: cutoffDate.toISOString(),
      durationMs: duration,
    };
  }

  /**
   * Retorna estatísticas sobre audit logs
   */
  async getStats(): Promise<{
    active: {
      total: number;
      oldestDate: Date | null;
      newestDate: Date | null;
      byTenant: Array<{ tenantId: string; count: number }>;
    };
    archived: {
      total: number;
      oldestDate: Date | null;
      newestDate: Date | null;
      byTenant: Array<{ tenantId: string; count: number }>;
    };
    config: {
      archiveAfterDays: number;
      deleteAfterDays: number;
      batchSize: number;
    };
  }> {
    // Estatísticas de logs ativos
    const [
      activeTotal,
      activeOldest,
      activeNewest,
      activeByTenant,
    ] = await Promise.all([
      this.prisma.auditLog.count(),
      this.prisma.auditLog.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      this.prisma.auditLog.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      this.prisma.auditLog.groupBy({
        by: ['tenantId'],
        _count: { tenantId: true },
        orderBy: { _count: { tenantId: 'desc' } },
        take: 10,
      }),
    ]);

    // Estatísticas de logs arquivados
    const [
      archivedTotal,
      archivedOldest,
      archivedNewest,
      archivedByTenant,
    ] = await Promise.all([
      this.prisma.archivedAuditLog.count(),
      this.prisma.archivedAuditLog.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      this.prisma.archivedAuditLog.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      this.prisma.archivedAuditLog.groupBy({
        by: ['tenantId'],
        _count: { tenantId: true },
        orderBy: { _count: { tenantId: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      active: {
        total: activeTotal,
        oldestDate: activeOldest?.createdAt || null,
        newestDate: activeNewest?.createdAt || null,
        byTenant: activeByTenant.map(t => ({
          tenantId: t.tenantId,
          count: t._count.tenantId,
        })),
      },
      archived: {
        total: archivedTotal,
        oldestDate: archivedOldest?.createdAt || null,
        newestDate: archivedNewest?.createdAt || null,
        byTenant: archivedByTenant.map(t => ({
          tenantId: t.tenantId,
          count: t._count.tenantId,
        })),
      },
      config: {
        archiveAfterDays: this.ARCHIVE_AFTER_DAYS,
        deleteAfterDays: this.DELETE_AFTER_DAYS,
        batchSize: this.BATCH_SIZE,
      },
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';

const BATCH_SIZE = 1000;
const RETENTION_MONTHS = 3;

@Injectable()
export class ArchiveService {
  private readonly logger = new Logger(ArchiveService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) {}

  /**
   * Runs at 03:00 on the 1st of every month.
   * Archives EntityData older than 3 months:
   *   1. Copy to ArchivedEntityData (lightweight table)
   *   2. Backup JSON to GCS
   *   3. Delete from EntityData (frees PowerSync indexes)
   */
  @Cron('0 3 1 * *')
  async handleMonthlyArchival() {
    this.logger.log('Starting monthly EntityData archival...');
    await this.runArchival();
  }

  /**
   * Manual trigger for archival (called from controller).
   */
  async runArchival(): Promise<{
    totalArchived: number;
    totalDeleted: number;
    errors: string[];
  }> {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - RETENTION_MONTHS);

    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let totalArchived = 0;
    let totalDeleted = 0;
    const errors: string[] = [];

    try {
      // Get all tenants
      const tenants = await this.prisma.tenant.findMany({
        select: { id: true, name: true },
      });

      for (const tenant of tenants) {
        // Get entities for this tenant
        const entities = await this.prisma.entity.findMany({
          where: { tenantId: tenant.id },
          select: { id: true, slug: true, name: true },
        });

        for (const entity of entities) {
          try {
            const result = await this.archiveEntityData(
              tenant.id,
              tenant.name,
              entity.id,
              entity.slug,
              cutoffDate,
              yearMonth,
            );
            totalArchived += result.archived;
            totalDeleted += result.deleted;
          } catch (error) {
            const msg = `Erro ao arquivar ${entity.slug} do tenant ${tenant.name}: ${error}`;
            this.logger.error(msg);
            errors.push(msg);
          }
        }
      }

      this.logger.log(
        `Archival concluido: ${totalArchived} arquivados, ${totalDeleted} removidos da tabela principal`,
      );
    } catch (error) {
      this.logger.error(`Archival falhou: ${error}`);
      errors.push(`Erro geral: ${error}`);
    }

    return { totalArchived, totalDeleted, errors };
  }

  private async archiveEntityData(
    tenantId: string,
    tenantName: string,
    entityId: string,
    entitySlug: string,
    cutoffDate: Date,
    yearMonth: string,
  ): Promise<{ archived: number; deleted: number }> {
    let archived = 0;
    let deleted = 0;

    // Process in batches
    while (true) {
      const records = await this.prisma.entityData.findMany({
        where: {
          tenantId,
          entityId,
          createdAt: { lt: cutoffDate },
          deletedAt: null,
        },
        take: BATCH_SIZE,
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          tenantId: true,
          entityId: true,
          data: true,
          parentRecordId: true,
          createdAt: true,
          updatedAt: true,
          createdById: true,
          updatedById: true,
        },
      });

      if (records.length === 0) break;

      const ids = records.map((r) => r.id);

      // 1. Archive child records FIRST (prevents CASCADE data loss)
      // Find ALL child records in EntityData that have parentRecordId pointing to these records
      // (regardless of createdAt — children can be newer than parents)
      const childRecords = await this.prisma.entityData.findMany({
        where: {
          parentRecordId: { in: ids },
          deletedAt: null,
        },
        select: {
          id: true,
          tenantId: true,
          entityId: true,
          data: true,
          parentRecordId: true,
          createdAt: true,
          updatedAt: true,
          createdById: true,
          updatedById: true,
        },
      });

      if (childRecords.length > 0) {
        // Filter out children already archived
        const childIds = childRecords.map((r) => r.id);
        const alreadyArchived = await this.prisma.archivedEntityData.findMany({
          where: { id: { in: childIds } },
          select: { id: true },
        });
        const alreadyArchivedSet = new Set(alreadyArchived.map((r) => r.id));
        const newChildren = childRecords.filter((r) => !alreadyArchivedSet.has(r.id));

        if (newChildren.length > 0) {
          await this.prisma.archivedEntityData.createMany({
            data: newChildren.map((r) => ({
              id: r.id,
              tenantId: r.tenantId,
              entityId: r.entityId,
              data: r.data as Prisma.InputJsonValue,
              parentRecordId: r.parentRecordId,
              createdAt: r.createdAt,
              updatedAt: r.updatedAt,
              createdById: r.createdById,
              updatedById: r.updatedById,
            })),
            skipDuplicates: true,
          });

          archived += newChildren.length;

          this.logger.log(
            `[${tenantName}/${entitySlug}] Arquivados ${newChildren.length} sub-registros filhos (CASCADE protection)`,
          );
        }
      }

      // 2. Archive the parent records
      await this.prisma.archivedEntityData.createMany({
        data: records.map((r) => ({
          id: r.id,
          tenantId: r.tenantId,
          entityId: r.entityId,
          data: r.data as Prisma.InputJsonValue,
          parentRecordId: r.parentRecordId,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          createdById: r.createdById,
          updatedById: r.updatedById,
        })),
        skipDuplicates: true,
      });

      archived += records.length;

      // 3. Delete from EntityData (CASCADE will also delete children, but they're safe in Archived)
      const deleteResult = await this.prisma.entityData.deleteMany({
        where: { id: { in: ids } },
      });
      deleted += deleteResult.count;

      this.logger.log(
        `[${tenantName}/${entitySlug}] Arquivados ${records.length} registros (batch)`,
      );
    }

    // 3. Upload JSON backup to GCS (if any records were archived)
    if (archived > 0) {
      try {
        const allArchived = await this.prisma.archivedEntityData.findMany({
          where: {
            tenantId,
            entityId,
            archivedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          },
          orderBy: { createdAt: 'asc' },
        });

        const jsonContent = JSON.stringify(allArchived, null, 2);
        const buffer = Buffer.from(jsonContent, 'utf-8');
        const fileName = `${entitySlug}-${yearMonth}.json`;

        await this.uploadService.uploadBuffer(
          buffer,
          fileName,
          'application/json',
          tenantId,
          'archives/entity-data',
        );

        this.logger.log(
          `[${tenantName}/${entitySlug}] Backup GCS: archives/entity-data/${fileName} (${archived} registros)`,
        );
      } catch (error) {
        this.logger.error(
          `[${tenantName}/${entitySlug}] Falha no backup GCS: ${error}`,
        );
        // Don't fail the archival — data is safe in ArchivedEntityData
      }
    }

    return { archived, deleted };
  }

  /**
   * Returns archive stats per entity per tenant.
   */
  async getStats(): Promise<
    Array<{
      tenantId: string;
      tenantName: string;
      entityId: string;
      entitySlug: string;
      archivedCount: number;
      activeCount: number;
      oldestArchived: Date | null;
      newestArchived: Date | null;
    }>
  > {
    const tenants = await this.prisma.tenant.findMany({
      select: { id: true, name: true },
    });

    const stats = [];

    for (const tenant of tenants) {
      const entities = await this.prisma.entity.findMany({
        where: { tenantId: tenant.id },
        select: { id: true, slug: true },
      });

      for (const entity of entities) {
        const [archivedAgg, activeCount] = await Promise.all([
          this.prisma.archivedEntityData.aggregate({
            where: { tenantId: tenant.id, entityId: entity.id },
            _count: true,
            _min: { createdAt: true },
            _max: { createdAt: true },
          }),
          this.prisma.entityData.count({
            where: { tenantId: tenant.id, entityId: entity.id, deletedAt: null },
          }),
        ]);

        if (archivedAgg._count > 0 || activeCount > 0) {
          stats.push({
            tenantId: tenant.id,
            tenantName: tenant.name,
            entityId: entity.id,
            entitySlug: entity.slug,
            archivedCount: archivedAgg._count,
            activeCount,
            oldestArchived: archivedAgg._min.createdAt,
            newestArchived: archivedAgg._max.createdAt,
          });
        }
      }
    }

    return stats;
  }
}

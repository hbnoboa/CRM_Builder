import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { ArchiveService } from '../archive/archive.service';
import { AuditArchiveService } from '../audit/audit-archive.service';

const AUDIT_COLD_AFTER_DAYS = 365;
const AUDIT_COLD_BATCH = 1000;

/**
 * Ponto UNICO de retencao/arquivamento/backup do sistema.
 *
 * Antes a logica estava espalhada em 3 crons que se contradiziam
 * (ArchiveService, AuditArchiveService, AuditBackupService): o backup mensal
 * de audit logs despejava logs com < 90 dias num arquivo no GCS e os apagava,
 * de modo que nunca chegavam a ArchivedAuditLog. Resultado: dados de auditoria
 * partidos entre tabela e arquivos soltos, e leituras tinham que olhar nos dois.
 *
 * Politica de tiers (a FONTE DE LEITURA e sempre o BANCO; GCS = so backup frio):
 *   EntityData: hot(EntityData) --3 meses--> warm(ArchivedEntityData) [+backup GCS]
 *   AuditLog:   hot(AuditLog)   --90 dias--> warm(ArchivedAuditLog)
 *               warm            --365 dias--> cold(GCS .json) --entao--> hard delete
 *
 * Leituras nunca dependem de arquivo: union de hot+warm no banco. O GCS so
 * existe para disaster-recovery do tier frio (audit > 1 ano).
 */
@Injectable()
export class DataLifecycleService {
  private readonly logger = new Logger(DataLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
    private readonly archiveService: ArchiveService,
    private readonly auditArchiveService: AuditArchiveService,
  ) {}

  /** Diario 03:00 (America/Sao_Paulo): audit logs hot -> warm. */
  @Cron('0 3 * * *', { name: 'lifecycle-audit-archive', timeZone: 'America/Sao_Paulo' })
  async dailyAuditArchive(): Promise<void> {
    this.logger.log('[lifecycle] audit hot -> warm...');
    await this.auditArchiveService.archiveOldLogs();
  }

  /** Semanal Dom 04:00 (America/Sao_Paulo): audit warm > 365d -> GCS -> hard delete. */
  @Cron('0 4 * * 0', { name: 'lifecycle-audit-cold', timeZone: 'America/Sao_Paulo' })
  async weeklyAuditColdTier(): Promise<void> {
    this.logger.log('[lifecycle] audit cold tier (export + purge)...');
    await this.runAuditColdTier();
  }

  /** Mensal dia 1, 03:00: EntityData hot -> warm + backup GCS. */
  @Cron('0 3 1 * *', { name: 'lifecycle-entitydata-archive' })
  async monthlyEntityDataArchive(): Promise<void> {
    this.logger.log('[lifecycle] EntityData hot -> warm...');
    await this.archiveService.runArchival();
  }

  /**
   * Cold tier de audit: exporta ArchivedAuditLog > 365d para o GCS (backup) e
   * SO ENTAO faz hard delete. Export-antes-de-deletar garante que o tier frio e
   * um backup real, nunca perda silenciosa (corrige o bug do antigo
   * AuditBackupService, que apagava logs ainda dentro da janela quente).
   */
  async runAuditColdTier(): Promise<{ exported: number; deleted: number; errors: string[] }> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - AUDIT_COLD_AFTER_DAYS);

    let exported = 0;
    let deleted = 0;
    const errors: string[] = [];

    try {
      // Processa em lotes; cada lote vira um arquivo JSON estavel no GCS antes
      // de ser removido do banco.
      while (true) {
        const batch = await this.prisma.archivedAuditLog.findMany({
          where: { createdAt: { lt: cutoff } },
          take: AUDIT_COLD_BATCH,
          orderBy: { createdAt: 'asc' },
        });

        if (batch.length === 0) break;

        const first = batch[0].createdAt;
        const ym = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}`;
        const fileName = `${ym}-${first.getTime()}.json`;

        const buffer = Buffer.from(JSON.stringify(batch, null, 2), 'utf-8');
        await this.uploadService.uploadBuffer(
          buffer,
          fileName,
          'application/json',
          'platform',
          'audit-logs/cold',
        );

        const ids = batch.map((r) => r.id);
        const del = await this.prisma.archivedAuditLog.deleteMany({
          where: { id: { in: ids } },
        });

        exported += batch.length;
        deleted += del.count;

        this.logger.log(
          `[lifecycle] cold tier: exportado audit-logs/cold/${fileName} (${batch.length}) e removido do banco`,
        );
      }
    } catch (error) {
      const msg = `[lifecycle] cold tier falhou: ${error}`;
      this.logger.error(msg);
      errors.push(String(error));
    }

    return { exported, deleted, errors };
  }

  /**
   * Executa TODO o ciclo de vida manualmente (teste/ad-hoc/disaster-recovery).
   * Ordem: audit hot->warm, audit cold tier, EntityData hot->warm.
   */
  async runAll(): Promise<{
    auditArchived: unknown;
    auditCold: { exported: number; deleted: number; errors: string[] };
    entityData: { totalArchived: number; totalDeleted: number; errors: string[] };
  }> {
    this.logger.log('[lifecycle] runAll manual...');
    const auditArchived = await this.auditArchiveService.archiveOldLogs();
    const auditCold = await this.runAuditColdTier();
    const entityData = await this.archiveService.runArchival();
    return { auditArchived, auditCold, entityData };
  }

  /** Estatisticas consolidadas de retencao (EntityData + AuditLog). */
  async getStats(): Promise<{
    entityData: unknown;
    auditLog: unknown;
    policy: {
      entityDataRetentionMonths: number;
      auditArchiveAfterDays: number;
      auditColdAfterDays: number;
      readSource: string;
    };
  }> {
    const [entityData, auditLog] = await Promise.all([
      this.archiveService.getStats(),
      this.auditArchiveService.getStats(),
    ]);

    return {
      entityData,
      auditLog,
      policy: {
        entityDataRetentionMonths: 3,
        auditArchiveAfterDays: 90,
        auditColdAfterDays: AUDIT_COLD_AFTER_DAYS,
        readSource: 'banco (hot + warm); GCS apenas backup frio',
      },
    };
  }
}

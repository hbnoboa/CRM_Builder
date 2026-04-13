import { Process, Processor, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { EntityService } from '../entity/entity.service';
import { NotificationService } from '../notification/notification.service';
import * as XLSX from 'xlsx';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ImportError } from './dto/import-data.dto';

interface ImportJobData {
  importId: string;
  entitySlug: string;
  fieldMapping: Record<string, string>;
  userId: string;
  tenantId: string;
  userName: string;
}

@Processor('data-import')
export class ImportQueueProcessor {
  private readonly logger = new Logger(ImportQueueProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entityService: EntityService,
    private readonly notificationService: NotificationService,
  ) {}

  @OnQueueActive()
  onActive(job: Job<ImportJobData>) {
    this.logger.log(`🔄 Iniciando importação ${job.data.importId} (Job ${job.id})`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job<ImportJobData>, result: any) {
    this.logger.log(`✅ Importação ${job.data.importId} concluída: ${result.imported} registros`);
  }

  @OnQueueFailed()
  onFailed(job: Job<ImportJobData>, error: Error) {
    this.logger.error(`❌ Importação ${job.data.importId} falhou: ${error.message}`, error.stack);
  }

  @Process()
  async handleImport(job: Job<ImportJobData>): Promise<{ imported: number; errors: number }> {
    const { importId, entitySlug, fieldMapping, userId, tenantId, userName } = job.data;

    this.logger.log(`📋 Processando importação ${importId} da entidade ${entitySlug}`);

    try {
      // 1. Carregar arquivo Excel
      const filePath = path.join('/tmp', 'imports', `${importId}.xlsx`);
      const fileBuffer = await fs.readFile(filePath);
      const workbook = XLSX.read(fileBuffer);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

      this.logger.log(`📊 ${rows.length} linhas encontradas no arquivo`);

      // 2. Buscar entity
      const entity = await this.prisma.entity.findFirst({
        where: { slug: entitySlug, tenantId },
      });

      if (!entity) {
        throw new Error(`Entidade ${entitySlug} não encontrada`);
      }

      const entityFields = (entity.fields as any[]) || [];

      // 3. Processar em chunks de 100
      const CHUNK_SIZE = 100;
      const errors: ImportError[] = [];
      let imported = 0;

      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);

        for (let j = 0; j < chunk.length; j++) {
          const rowIndex = i + j;
          const row = chunk[j];

          try {
            // Mapear colunas Excel → campos Entity
            const mappedData: Record<string, unknown> = {};

            for (const [excelColumn, entityField] of Object.entries(fieldMapping)) {
              const value = row[excelColumn];
              if (value !== undefined && value !== null && value !== '') {
                mappedData[entityField] = value;
              }
            }

            // Validar dados básicos
            for (const field of entityFields) {
              if (field.required && !(field.key in mappedData)) {
                throw new Error(`Campo obrigatório ausente: ${field.label || field.key}`);
              }
            }

            // Criar registro via EntityData
            await this.prisma.entityData.create({
              data: {
                tenantId,
                entityId: entity.id,
                data: mappedData as any,
                createdById: userId,
                updatedById: userId,
              },
            });

            imported++;
          } catch (error) {
            const err = error as Error;
            errors.push({
              row: rowIndex + 2, // +2 (header + 1-indexed)
              data: row,
              error: err.message,
            });

            this.logger.warn(`Erro na linha ${rowIndex + 2}: ${err.message}`);
          }
        }

        // Atualizar progresso
        const progress = Math.round(((i + chunk.length) / rows.length) * 100);
        await job.progress(progress);

        // Notificar via WebSocket (sem persistir)
        this.notificationService.notifyUser(
          userId,
          {
            type: 'info',
            title: 'Importando dados',
            message: `Progresso: ${progress}% (${imported}/${rows.length})`,
            data: {
              importId,
              progress,
              imported,
              errors: errors.length,
              total: rows.length,
            },
          },
          tenantId,
          false, // não persistir
        );

        this.logger.debug(`📦 Chunk processado: ${i + chunk.length}/${rows.length} (${progress}%)`);
      }

      // 4. Gerar relatório de erros (se houver)
      let reportUrl: string | undefined;
      if (errors.length > 0) {
        reportUrl = await this.generateErrorReport(importId, errors);
      }

      // 5. Notificar conclusão (persistir)
      await this.notificationService.notifyUser(
        userId,
        {
          type: errors.length > 0 ? 'warning' : 'success',
          title: 'Importação concluída',
          message: `Importados ${imported} de ${rows.length} registros${errors.length > 0 ? `. ${errors.length} erros encontrados.` : ''}`,
          data: {
            importId,
            entitySlug,
            imported,
            errors: errors.length,
            total: rows.length,
            reportUrl,
          },
        },
        tenantId,
        true, // persistir
      );

      // 6. Limpar arquivo temporário
      await fs.unlink(filePath).catch(() => {});

      return { imported, errors: errors.length };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Erro fatal na importação ${importId}: ${err.message}`, err.stack);

      // Notificar erro (persistir)
      await this.notificationService.notifyUser(
        userId,
        {
          type: 'error',
          title: 'Importação falhou',
          message: `Erro ao importar: ${err.message}`,
          data: {
            importId,
            entitySlug,
            error: err.message,
          },
        },
        tenantId,
        true, // persistir
      );

      throw error;
    }
  }

  /**
   * Gera relatório CSV com erros da importação
   */
  private async generateErrorReport(importId: string, errors: ImportError[]): Promise<string> {
    const reportDir = path.join('/tmp', 'import-reports');
    await fs.mkdir(reportDir, { recursive: true });

    const reportPath = path.join(reportDir, `${importId}-errors.csv`);

    // Gerar CSV
    const csvLines = ['Linha,Erro,Dados'];
    for (const error of errors) {
      const dataStr = JSON.stringify(error.data).replace(/"/g, '""');
      csvLines.push(`${error.row},"${error.error}","${dataStr}"`);
    }

    await fs.writeFile(reportPath, csvLines.join('\n'), 'utf-8');

    this.logger.log(`📄 Relatório de erros gerado: ${reportPath}`);

    // Retornar URL relativo (será servido por endpoint separado)
    return `/data/import/report/${importId}`;
  }
}

import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { AutomationExecutorService } from '../entity-automation/automation-executor.service';

export interface AutomationJob {
  automationId: string;
  recordId: string;
  trigger: string;
  userId: string;
  tenantId: string;
  entitySlug: string;
  metadata?: Record<string, unknown>;
}

@Processor('automation-execution')
export class AutomationQueueProcessor {
  private readonly logger = new Logger(AutomationQueueProcessor.name);

  constructor(
    private readonly automationExecutor: AutomationExecutorService,
  ) {}

  @Process()
  async handleAutomation(job: Job<AutomationJob>) {
    const { automationId, recordId, trigger, userId, tenantId, entitySlug, metadata } = job.data;

    this.logger.log(
      `[Queue] Executando automation ${automationId} para record ${recordId} (trigger: ${trigger})`
    );

    const startTime = Date.now();

    try {
      // Executar a automation
      await this.automationExecutor.executeById(automationId, {
        recordId,
        trigger,
        userId,
        tenantId,
        entitySlug,
        metadata,
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `[Queue] Automation ${automationId} concluída em ${duration}ms`
      );

      return {
        success: true,
        duration,
        completedAt: new Date().toISOString(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `[Queue] Erro na automation ${automationId} após ${duration}ms: ${errorMessage}`,
        errorStack
      );

      // Lançar erro para Bull processar retry
      throw error;
    }
  }

  @Process('bulk-automation')
  async handleBulkAutomation(job: Job<{ jobs: AutomationJob[] }>) {
    const { jobs } = job.data;

    this.logger.log(`[Queue] Processando ${jobs.length} automações em lote`);

    const results = {
      total: jobs.length,
      success: 0,
      failed: 0,
      errors: [] as Array<{ automationId: string; error: string }>,
    };

    for (const automationJob of jobs) {
      try {
        await this.handleAutomation({ data: automationJob } as Job<AutomationJob>);
        results.success++;
      } catch (error) {
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.errors.push({
          automationId: automationJob.automationId,
          error: errorMessage,
        });
      }

      // Atualizar progresso
      await job.progress(Math.round((results.success + results.failed) / results.total * 100));
    }

    this.logger.log(
      `[Queue] Lote concluído: ${results.success} sucesso, ${results.failed} falhas`
    );

    return results;
  }
}

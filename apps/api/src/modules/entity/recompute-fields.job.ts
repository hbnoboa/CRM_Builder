import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ComputedFieldMaterializerService } from './computed-field-materializer.service';

@Injectable()
export class RecomputeFieldsJob {
  private readonly logger = new Logger(RecomputeFieldsJob.name);

  constructor(
    private readonly materializer: ComputedFieldMaterializerService,
  ) {}

  /**
   * Recomputa campos baseados em tempo (timers e SLA status) a cada 6 horas
   * Timers e SLA status mudam com o passar do tempo mesmo sem updates
   */
  @Cron('0 */6 * * *', {
    name: 'recompute-time-based-fields',
    timeZone: 'America/Sao_Paulo',
  })
  async handleRecomputeTimeBasedFields() {
    this.logger.log('⏰ Cron: Iniciando recompute de campos temporais...');

    try {
      await this.materializer.recomputeTimeBasedFields();
      this.logger.log('✅ Cron: Recompute de campos temporais concluído');
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `❌ Cron: Erro ao recomputar campos temporais: ${err.message}`,
        err.stack,
      );
    }
  }
}

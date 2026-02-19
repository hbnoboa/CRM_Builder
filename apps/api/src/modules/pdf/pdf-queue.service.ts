import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PDF_QUEUE_NAME, PdfGenerationJobData } from './pdf-worker.processor';

@Injectable()
export class PdfQueueService {
  private readonly logger = new Logger(PdfQueueService.name);

  constructor(@InjectQueue(PDF_QUEUE_NAME) private readonly pdfQueue: Queue<PdfGenerationJobData>) {}

  /**
   * Adiciona um job de geracao de PDF na fila
   */
  async addGenerationJob(data: PdfGenerationJobData): Promise<string> {
    const job = await this.pdfQueue.add('generate', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 24 * 60 * 60, // Manter por 24 horas
        count: 1000,
      },
      removeOnFail: {
        age: 7 * 24 * 60 * 60, // Manter falhas por 7 dias
      },
    });

    this.logger.log(`Added PDF generation job ${job.id} for generation ${data.generationId}`);
    return job.id ?? data.generationId;
  }

  /**
   * Adiciona multiplos jobs de geracao em batch
   */
  async addBatchGenerationJobs(jobs: PdfGenerationJobData[]): Promise<string[]> {
    const bulkJobs = jobs.map((data) => ({
      name: 'generate',
      data,
      opts: {
        attempts: 3,
        backoff: {
          type: 'exponential' as const,
          delay: 2000,
        },
        removeOnComplete: {
          age: 24 * 60 * 60,
          count: 1000,
        },
        removeOnFail: {
          age: 7 * 24 * 60 * 60,
        },
      },
    }));

    const addedJobs = await this.pdfQueue.addBulk(bulkJobs);

    this.logger.log(`Added ${addedJobs.length} PDF generation jobs in batch`);
    return addedJobs.map((job) => job.id ?? '');
  }

  /**
   * Retorna estatisticas da fila
   */
  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.pdfQueue.getWaitingCount(),
      this.pdfQueue.getActiveCount(),
      this.pdfQueue.getCompletedCount(),
      this.pdfQueue.getFailedCount(),
      this.pdfQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }

  /**
   * Limpa jobs completados antigos
   */
  async cleanOldJobs(gracePeriod = 24 * 60 * 60 * 1000) {
    await this.pdfQueue.clean(gracePeriod, 1000, 'completed');
    this.logger.log('Cleaned old completed jobs');
  }

  /**
   * Pausa a fila (para manutencao)
   */
  async pauseQueue() {
    await this.pdfQueue.pause();
    this.logger.log('PDF queue paused');
  }

  /**
   * Retoma a fila
   */
  async resumeQueue() {
    await this.pdfQueue.resume();
    this.logger.log('PDF queue resumed');
  }
}

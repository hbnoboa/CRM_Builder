import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PdfGeneratorService } from './pdf-generator.service';

export const PDF_QUEUE_NAME = 'pdf-generation';

export interface PdfGenerationJobData {
  generationId: string;
  tenantId: string;
  userId: string;
}

@Processor(PDF_QUEUE_NAME)
export class PdfWorkerProcessor extends WorkerHost {
  private readonly logger = new Logger(PdfWorkerProcessor.name);

  constructor(private readonly pdfGeneratorService: PdfGeneratorService) {
    super();
  }

  async process(job: Job<PdfGenerationJobData>): Promise<void> {
    this.logger.log(`Processing PDF generation job ${job.id} for generation ${job.data.generationId}`);

    try {
      await this.pdfGeneratorService.processGeneration(job.data);
      this.logger.log(`PDF generation job ${job.id} completed successfully`);
    } catch (error) {
      this.logger.error(`PDF generation job ${job.id} failed: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job<PdfGenerationJobData>) {
    this.logger.debug(`Job ${job.id} is now active`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<PdfGenerationJobData>) {
    this.logger.log(`Job ${job.id} completed for generation ${job.data.generationId}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<PdfGenerationJobData> | undefined, error: Error) {
    this.logger.error(`Job ${job?.id} failed: ${error.message}`, error.stack);
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string) {
    this.logger.warn(`Job ${jobId} has stalled`);
  }
}

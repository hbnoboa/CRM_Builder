import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PdfController } from './pdf.controller';
import { PdfTemplateService } from './pdf-template.service';
import { PdfGenerationService } from './pdf-generation.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { PdfQueueService } from './pdf-queue.service';
import { PdfWorkerProcessor, PDF_QUEUE_NAME } from './pdf-worker.processor';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { DataSourceModule } from '../data-source/data-source.module';

@Module({
  imports: [
    PrismaModule,
    NotificationModule,
    DataSourceModule,
    BullModule.registerQueue({
      name: PDF_QUEUE_NAME,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    }),
  ],
  controllers: [PdfController],
  providers: [
    PdfTemplateService,
    PdfGenerationService,
    PdfGeneratorService,
    PdfQueueService,
    PdfWorkerProcessor,
  ],
  exports: [
    PdfTemplateService,
    PdfGenerationService,
    PdfGeneratorService,
    PdfQueueService,
  ],
})
export class PdfModule {}

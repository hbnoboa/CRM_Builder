import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { UploadModule } from '../upload/upload.module';
import { PdfController } from './pdf.controller';
import { PdfTemplateService } from './pdf-template.service';
import { PdfGeneratorService } from './pdf-generator.service';

@Module({
  imports: [PrismaModule, UploadModule],
  controllers: [PdfController],
  providers: [PdfTemplateService, PdfGeneratorService],
  exports: [PdfTemplateService, PdfGeneratorService],
})
export class PdfModule {}

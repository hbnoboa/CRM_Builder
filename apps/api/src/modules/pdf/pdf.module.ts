import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PdfController } from './pdf.controller';
import { PdfTemplateService } from './pdf-template.service';
import { PdfGeneratorService } from './pdf-generator.service';

@Module({
  imports: [PrismaModule],
  controllers: [PdfController],
  providers: [PdfTemplateService, PdfGeneratorService],
  exports: [PdfTemplateService, PdfGeneratorService],
})
export class PdfModule {}

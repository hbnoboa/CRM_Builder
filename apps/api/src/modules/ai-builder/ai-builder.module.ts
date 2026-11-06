import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EntityModule } from '../entity/entity.module';
import { DashboardTemplateModule } from '../dashboard-template/dashboard-template.module';
import { PdfModule } from '../pdf/pdf.module';
import { AiBuilderController } from './ai-builder.controller';
import { AiBuilderService } from './ai-builder.service';

@Module({
  imports: [PrismaModule, EntityModule, DashboardTemplateModule, PdfModule],
  controllers: [AiBuilderController],
  providers: [AiBuilderService],
})
export class AiBuilderModule {}

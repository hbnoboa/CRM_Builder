import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EntityDataQueryModule } from '../../common/services/entity-data-query.module';
import { DataModule } from '../data/data.module';
import { DashboardTemplateModule } from '../dashboard-template/dashboard-template.module';
import { AiBuilderModule } from '../ai-builder/ai-builder.module';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';

@Module({
  imports: [PrismaModule, EntityDataQueryModule, DataModule, DashboardTemplateModule, AiBuilderModule],
  controllers: [DeliveryController],
  providers: [DeliveryService],
})
export class DeliveryModule {}

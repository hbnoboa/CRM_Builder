import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EntityDataQueryModule } from '../../common/services/entity-data-query.module';
import { DataModule } from '../data/data.module';
import { DashboardTemplateModule } from '../dashboard-template/dashboard-template.module';
import { AiBuilderModule } from '../ai-builder/ai-builder.module';
import { NotificationModule } from '../notification/notification.module';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';
import { IfoodClient } from './ifood.client';
import { IfoodService } from './ifood.service';

@Module({
  imports: [PrismaModule, EntityDataQueryModule, DataModule, DashboardTemplateModule, AiBuilderModule, NotificationModule],
  controllers: [DeliveryController],
  providers: [DeliveryService, IfoodClient, IfoodService],
})
export class DeliveryModule {}

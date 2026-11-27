import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EntityDataQueryModule } from '../../common/services/entity-data-query.module';
import { DataModule } from '../data/data.module';
import { DashboardTemplateModule } from '../dashboard-template/dashboard-template.module';
import { AiBuilderModule } from '../ai-builder/ai-builder.module';
import { NotificationModule } from '../notification/notification.module';
import { DeliveryController } from './delivery.controller';
import { Food99WebhookController } from './food99-webhook.controller';
import { Food99Client } from './food99.client';
import { Food99Service } from './food99.service';
import { DeliveryService } from './delivery.service';
import { IfoodClient } from './ifood.client';
import { IfoodMenuService } from './ifood-menu.service';
import { IfoodService } from './ifood.service';

@Module({
  imports: [PrismaModule, EntityDataQueryModule, DataModule, DashboardTemplateModule, AiBuilderModule, NotificationModule],
  controllers: [DeliveryController, Food99WebhookController],
  providers: [DeliveryService, IfoodClient, IfoodMenuService, IfoodService, Food99Client, Food99Service],
})
export class DeliveryModule {}

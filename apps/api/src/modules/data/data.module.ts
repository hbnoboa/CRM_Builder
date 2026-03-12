import { Module, forwardRef } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DataService } from './data.service';
import { DataIoService } from './data-io.service';
import { ComputedFieldsService } from './computed-fields.service';
import { DataController } from './data.controller';
import { EntityModule } from '../entity/entity.module';
import { NotificationModule } from '../notification/notification.module';
import { CustomRoleModule } from '../custom-role/custom-role.module';
import { WebhookModule } from '../webhook/webhook.module';
import { ActionChainModule } from '../action-chain/action-chain.module';
import { EntityAutomationModule } from '../entity-automation/entity-automation.module';
import { EntityDataQueryModule } from '../../common/services/entity-data-query.module';

@Module({
  imports: [
    EntityModule,
    EntityDataQueryModule,
    NotificationModule,
    CustomRoleModule,
    forwardRef(() => WebhookModule),
    forwardRef(() => ActionChainModule),
    forwardRef(() => EntityAutomationModule),
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  ],
  controllers: [DataController],
  providers: [DataService, DataIoService, ComputedFieldsService],
  exports: [DataService, DataIoService, ComputedFieldsService],
})
export class DataModule {}

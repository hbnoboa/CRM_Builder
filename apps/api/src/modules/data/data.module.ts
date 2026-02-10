import { Module } from '@nestjs/common';
import { DataService } from './data.service';
import { DataController } from './data.controller';
import { EntityModule } from '../entity/entity.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [EntityModule, NotificationModule],
  controllers: [DataController],
  providers: [DataService],
  exports: [DataService],
})
export class DataModule {}

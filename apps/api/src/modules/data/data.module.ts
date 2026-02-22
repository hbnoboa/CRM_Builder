import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DataService } from './data.service';
import { DataIoService } from './data-io.service';
import { DataController } from './data.controller';
import { EntityModule } from '../entity/entity.module';
import { NotificationModule } from '../notification/notification.module';
import { CustomRoleModule } from '../custom-role/custom-role.module';

@Module({
  imports: [
    EntityModule,
    NotificationModule,
    CustomRoleModule,
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  ],
  controllers: [DataController],
  providers: [DataService, DataIoService],
  exports: [DataService, DataIoService],
})
export class DataModule {}

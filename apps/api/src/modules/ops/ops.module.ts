import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { UploadModule } from '../upload/upload.module';
import { SystemHealthController } from './system-health.controller';
import { SystemHealthService } from './system-health.service';

@Module({
  imports: [
    UploadModule,
    BullModule.registerQueue({ name: 'data-import' }, { name: 'automation-execution' }),
  ],
  controllers: [SystemHealthController],
  providers: [SystemHealthService],
})
export class OpsModule {}

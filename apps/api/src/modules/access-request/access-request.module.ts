import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { AccessRequestController, AccessRequestPublicController } from './access-request.controller';
import { AccessRequestService } from './access-request.service';

@Module({
  imports: [NotificationModule],
  controllers: [AccessRequestPublicController, AccessRequestController],
  providers: [AccessRequestService],
})
export class AccessRequestModule {}

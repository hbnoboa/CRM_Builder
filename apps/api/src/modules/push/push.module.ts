import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PushController, WebPushController } from './push.controller';
import { PushService } from './push.service';
import { WebPushService } from './web-push.service';

@Module({
  imports: [PrismaModule],
  controllers: [PushController, WebPushController],
  providers: [PushService, WebPushService],
  exports: [PushService, WebPushService],
})
export class PushModule {}

import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { PlatformAuditService } from '../platform/platform-audit.service';
import { SupportConsoleController, SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [NotificationModule],
  controllers: [SupportController, SupportConsoleController],
  providers: [SupportService, PlatformAuditService],
})
export class SupportModule {}

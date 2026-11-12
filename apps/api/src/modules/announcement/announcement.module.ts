import { Module } from '@nestjs/common';
import { PlatformAuditService } from '../platform/platform-audit.service';
import { AnnouncementConsoleController, AnnouncementController } from './announcement.controller';
import { AnnouncementService } from './announcement.service';

@Module({
  controllers: [AnnouncementController, AnnouncementConsoleController],
  providers: [AnnouncementService, PlatformAuditService],
})
export class AnnouncementModule {}

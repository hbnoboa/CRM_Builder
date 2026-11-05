import { Module } from '@nestjs/common';
import { PlatformAuditService } from '../platform/platform-audit.service';
import { LeadsConsoleController, LeadsPublicController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  controllers: [LeadsPublicController, LeadsConsoleController],
  providers: [LeadsService, PlatformAuditService],
})
export class LeadsModule {}

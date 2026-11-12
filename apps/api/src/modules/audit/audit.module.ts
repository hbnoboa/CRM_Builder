import { Module, Global } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuditService } from './audit.service';
import { AuditArchiveService } from './audit-archive.service';
import { AuditController } from './audit.controller';
import { UploadModule } from '../upload/upload.module';

@Global()
@Module({
  imports: [
    ScheduleModule.forRoot(),
    UploadModule,
  ],
  controllers: [AuditController],
  providers: [AuditService, AuditArchiveService],
  exports: [AuditService, AuditArchiveService],
})
export class AuditModule {}

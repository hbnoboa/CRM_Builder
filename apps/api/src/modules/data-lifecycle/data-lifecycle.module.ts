import { Module } from '@nestjs/common';
import { DataLifecycleService } from './data-lifecycle.service';
import { DataLifecycleController } from './data-lifecycle.controller';
import { UploadModule } from '../upload/upload.module';
import { ArchiveModule } from '../archive/archive.module';

/**
 * Orquestrador unico de retencao/arquivamento. Importa ArchiveModule (engine de
 * EntityData) e usa AuditArchiveService via AuditModule (@Global, exportado).
 */
@Module({
  imports: [UploadModule, ArchiveModule],
  controllers: [DataLifecycleController],
  providers: [DataLifecycleService],
  exports: [DataLifecycleService],
})
export class DataLifecycleModule {}

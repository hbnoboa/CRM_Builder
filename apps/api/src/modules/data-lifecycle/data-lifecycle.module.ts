import { Module } from '@nestjs/common';
import { DataLifecycleService } from './data-lifecycle.service';
import { UploadModule } from '../upload/upload.module';
import { ArchiveModule } from '../archive/archive.module';

/**
 * Orquestrador unico de retencao/arquivamento. Importa ArchiveModule (engine de
 * EntityData) e usa AuditArchiveService via AuditModule (@Global, exportado).
 */
@Module({
  imports: [UploadModule, ArchiveModule],
  // Sem controller: as operacoes sao globais (todas as empresas) e nao cabem em
  // nenhum cargo de empresa. Se voltarem, entram no console da plataforma.
  providers: [DataLifecycleService],
  exports: [DataLifecycleService],
})
export class DataLifecycleModule {}

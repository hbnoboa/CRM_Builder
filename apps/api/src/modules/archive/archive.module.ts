import { Module } from '@nestjs/common';
import { ArchiveService } from './archive.service';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [UploadModule],
  // Sem controller: as operacoes sao globais (todas as empresas) e nao cabem em
  // nenhum cargo de empresa. Se voltarem, entram no console da plataforma.
  providers: [ArchiveService],
  exports: [ArchiveService],
})
export class ArchiveModule {}

import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { DataModule } from '../data/data.module';
import { AuditModule } from '../audit/audit.module';
import { PdfModule } from '../pdf/pdf.module';
import { UploadModule } from '../upload/upload.module';
import { EntityDataQueryModule } from '../../common/services/entity-data-query.module';
import { CustomRoleModule } from '../custom-role/custom-role.module';

@Module({
  imports: [PrismaModule, DataModule, AuditModule, PdfModule, UploadModule, EntityDataQueryModule, CustomRoleModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}

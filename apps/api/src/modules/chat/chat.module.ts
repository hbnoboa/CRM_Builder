import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { DataModule } from '../data/data.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, DataModule, AuditModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}

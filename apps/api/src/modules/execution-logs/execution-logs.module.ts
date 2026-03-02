import { Module } from '@nestjs/common';
import { ExecutionLogsService } from './execution-logs.service';
import { ExecutionLogsController } from './execution-logs.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ExecutionLogsService],
  controllers: [ExecutionLogsController],
  exports: [ExecutionLogsService],
})
export class ExecutionLogsModule {}

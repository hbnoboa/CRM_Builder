import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EntityModule } from '../entity/entity.module';
import { AiBuilderController } from './ai-builder.controller';
import { AiBuilderService } from './ai-builder.service';

@Module({
  imports: [PrismaModule, EntityModule],
  controllers: [AiBuilderController],
  providers: [AiBuilderService],
})
export class AiBuilderModule {}

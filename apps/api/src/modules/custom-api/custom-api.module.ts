import { Module } from '@nestjs/common';
import { CustomApiService } from './custom-api.service';
import { CustomApiController, DynamicApiController } from './custom-api.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CustomApiController, DynamicApiController],
  providers: [CustomApiService],
  exports: [CustomApiService],
})
export class CustomApiModule {}

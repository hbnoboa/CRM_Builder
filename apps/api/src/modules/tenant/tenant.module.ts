import { Module } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantCopyService } from './tenant-copy.service';
import { TenantController } from './tenant.controller';

@Module({
  controllers: [TenantController],
  providers: [TenantService, TenantCopyService],
  exports: [TenantService],
})
export class TenantModule {}

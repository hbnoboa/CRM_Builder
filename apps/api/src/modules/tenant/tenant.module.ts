import { Module } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantCopyService } from './tenant-copy.service';
import { TenantController } from './tenant.controller';
import { SubscriptionController } from './subscription.controller';

@Module({
  controllers: [TenantController, SubscriptionController],
  providers: [TenantService, TenantCopyService],
  exports: [TenantService],
})
export class TenantModule {}

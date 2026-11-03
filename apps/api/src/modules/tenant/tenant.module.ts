import { Module } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantCopyService } from './tenant-copy.service';
import { TenantOverviewService } from './tenant-overview.service';
import { TenantController } from './tenant.controller';
import { SubscriptionController } from './subscription.controller';

@Module({
  controllers: [TenantController, SubscriptionController],
  providers: [TenantService, TenantCopyService, TenantOverviewService],
  exports: [TenantService, TenantCopyService],
})
export class TenantModule {}

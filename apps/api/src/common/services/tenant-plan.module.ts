import { Global, Module } from '@nestjs/common';
import { TenantPlanService } from './tenant-plan.service';

@Global()
@Module({
  providers: [TenantPlanService],
  exports: [TenantPlanService],
})
export class TenantPlanModule {}

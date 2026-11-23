import { Module } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantCopyService } from './tenant-copy.service';
import { TenantOverviewService } from './tenant-overview.service';
import { TenantController } from './tenant.controller';
import { SubscriptionController } from './subscription.controller';
import { TenantAppPublicController } from './tenant-app-public.controller';
import { TenantAppService } from './tenant-app.service';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [UploadModule],
  controllers: [TenantController, SubscriptionController, TenantAppPublicController],
  providers: [TenantService, TenantCopyService, TenantOverviewService, TenantAppService],
  exports: [TenantService, TenantCopyService],
})
export class TenantModule {}

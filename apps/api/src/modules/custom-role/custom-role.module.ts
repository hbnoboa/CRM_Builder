import { Module } from '@nestjs/common';
import { CustomRoleService } from './custom-role.service';
import { CustomRoleController } from './custom-role.controller';
import { PermissionCacheService } from './permission-cache.service';
import { VisibilityRecomputeJob } from './visibility-recompute.job';

@Module({
  controllers: [CustomRoleController],
  providers: [CustomRoleService, PermissionCacheService, VisibilityRecomputeJob],
  exports: [CustomRoleService, PermissionCacheService],
})
export class CustomRoleModule {}

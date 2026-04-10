import { Module } from '@nestjs/common';
import { CustomRoleService } from './custom-role.service';
import { CustomRoleController } from './custom-role.controller';
import { PermissionCacheService } from './permission-cache.service';

@Module({
  controllers: [CustomRoleController],
  providers: [CustomRoleService, PermissionCacheService],
  exports: [CustomRoleService, PermissionCacheService],
})
export class CustomRoleModule {}

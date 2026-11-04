import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ServiceScope } from '../../common/service-scope/service-scope.decorator';
import { PlatformAuthGuard } from '../platform/platform-jwt.strategy';
import { PlatformPermissionGuard, RequirePlatformPermission } from '../platform/platform-permissions';
import { SystemHealthService } from './system-health.service';

@ApiTags('Platform')
@ServiceScope('admin')
@Controller('platform/health')
@UseGuards(PlatformAuthGuard, PlatformPermissionGuard)
@ApiBearerAuth()
export class SystemHealthController {
  constructor(private readonly health: SystemHealthService) {}

  @Get()
  @RequirePlatformPermission('health.read')
  @ApiOperation({ summary: 'Saude do sistema (console)' })
  snapshot() {
    return this.health.snapshot();
  }
}

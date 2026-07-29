import { ServiceScope } from '../../common/service-scope/service-scope.decorator';
import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DataLifecycleService } from './data-lifecycle.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ModulePermissionGuard } from '../../common/guards/module-permission.guard';
import { RequireModulePermission } from '../../common/decorators/module-permission.decorator';

@ServiceScope('admin')
@Controller('data-lifecycle')
@ApiTags('Data Lifecycle')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
export class DataLifecycleController {
  constructor(private readonly lifecycle: DataLifecycleService) {}

  @Get('stats')
  @RequireModulePermission('archive', 'canRead')
  @ApiOperation({ summary: 'Estatisticas consolidadas de retencao (EntityData + AuditLog)' })
  async getStats() {
    return this.lifecycle.getStats();
  }

  @Post('run')
  @RequireModulePermission('archive', 'canPermanentDelete')
  @ApiOperation({ summary: 'Executar TODO o ciclo de vida manualmente' })
  async runAll() {
    return this.lifecycle.runAll();
  }

  @Post('audit-cold')
  @RequireModulePermission('archive', 'canPermanentDelete')
  @ApiOperation({ summary: 'Executar apenas o cold tier de audit (export GCS + purge)' })
  async runAuditCold() {
    return this.lifecycle.runAuditColdTier();
  }
}

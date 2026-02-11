import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StatsService } from './stats.service';

@ApiTags('Stats')
@Controller('stats')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Obter estatisticas do dashboard' })
  async getDashboardStats(@CurrentUser() user: any, @Query('tenantId') tenantId?: string) {
    const roleType = user.customRole?.roleType;
    const effectiveTenantId = roleType === 'PLATFORM_ADMIN' && tenantId ? tenantId : user.tenantId;
    return this.statsService.getDashboardStats(effectiveTenantId, roleType === 'PLATFORM_ADMIN' && tenantId ? 'filtered' : roleType);
  }

  @Get('records-over-time')
  @ApiOperation({ summary: 'Registros ao longo do tempo' })
  async getRecordsOverTime(
    @CurrentUser() user: any,
    @Query('days') days?: number,
    @Query('tenantId') tenantId?: string,
  ) {
    const roleType = user.customRole?.roleType;
    const effectiveTenantId = roleType === 'PLATFORM_ADMIN' && tenantId ? tenantId : user.tenantId;
    return this.statsService.getRecordsOverTime(effectiveTenantId, roleType === 'PLATFORM_ADMIN' && tenantId ? 'filtered' : roleType, days || 30);
  }

  @Get('entities-distribution')
  @ApiOperation({ summary: 'Distribuicao de registros por entidade' })
  async getEntitiesDistribution(@CurrentUser() user: any, @Query('tenantId') tenantId?: string) {
    const roleType = user.customRole?.roleType;
    const effectiveTenantId = roleType === 'PLATFORM_ADMIN' && tenantId ? tenantId : user.tenantId;
    return this.statsService.getEntitiesDistribution(effectiveTenantId, roleType === 'PLATFORM_ADMIN' && tenantId ? 'filtered' : roleType);
  }

  @Get('users-activity')
  @ApiOperation({ summary: 'Atividade dos usuarios' })
  async getUsersActivity(
    @CurrentUser() user: any,
    @Query('days') days?: number,
    @Query('tenantId') tenantId?: string,
  ) {
    const roleType = user.customRole?.roleType;
    const effectiveTenantId = roleType === 'PLATFORM_ADMIN' && tenantId ? tenantId : user.tenantId;
    return this.statsService.getUsersActivity(effectiveTenantId, roleType === 'PLATFORM_ADMIN' && tenantId ? 'filtered' : roleType, days || 7);
  }

  @Get('recent-activity')
  @ApiOperation({ summary: 'Atividades recentes' })
  async getRecentActivity(
    @CurrentUser() user: any,
    @Query('limit') limit?: number,
    @Query('tenantId') tenantId?: string,
  ) {
    const roleType = user.customRole?.roleType;
    const effectiveTenantId = roleType === 'PLATFORM_ADMIN' && tenantId ? tenantId : user.tenantId;
    return this.statsService.getRecentActivity(effectiveTenantId, roleType === 'PLATFORM_ADMIN' && tenantId ? 'filtered' : roleType, limit || 10);
  }
}

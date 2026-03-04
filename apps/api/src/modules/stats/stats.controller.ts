import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';
import { StatsService } from './stats.service';
import { checkModulePermission } from '../../common/utils/check-module-permission';

@ApiTags('Stats')
@Controller('stats')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Obter estatisticas do dashboard' })
  async getDashboardStats(@CurrentUser() user: CurrentUserType, @Query('tenantId') tenantId?: string) {
    checkModulePermission(user, 'dashboard', 'canRead');
    return this.statsService.getDashboardStats(user, tenantId);
  }

  @Get('records-over-time')
  @ApiOperation({ summary: 'Registros ao longo do tempo' })
  async getRecordsOverTime(
    @CurrentUser() user: CurrentUserType,
    @Query('days') days?: number,
    @Query('tenantId') tenantId?: string,
  ) {
    checkModulePermission(user, 'dashboard', 'canRead');
    return this.statsService.getRecordsOverTime(user, tenantId, days || 30);
  }

  @Get('entities-distribution')
  @ApiOperation({ summary: 'Distribuicao de registros por entidade' })
  async getEntitiesDistribution(@CurrentUser() user: CurrentUserType, @Query('tenantId') tenantId?: string) {
    checkModulePermission(user, 'dashboard', 'canRead');
    return this.statsService.getEntitiesDistribution(user, tenantId);
  }

  @Get('users-activity')
  @ApiOperation({ summary: 'Atividade dos usuarios' })
  async getUsersActivity(
    @CurrentUser() user: CurrentUserType,
    @Query('days') days?: number,
    @Query('tenantId') tenantId?: string,
  ) {
    checkModulePermission(user, 'dashboard', 'canRead');
    return this.statsService.getUsersActivity(user, tenantId, days || 7);
  }

  @Get('recent-activity')
  @ApiOperation({ summary: 'Atividades recentes' })
  async getRecentActivity(
    @CurrentUser() user: CurrentUserType,
    @Query('limit') limit?: number,
    @Query('tenantId') tenantId?: string,
  ) {
    checkModulePermission(user, 'dashboard', 'canRead');
    return this.statsService.getRecentActivity(user, tenantId, limit || 10);
  }
}

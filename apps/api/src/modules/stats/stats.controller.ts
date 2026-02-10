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
  async getDashboardStats(@CurrentUser() user: any) {
    return this.statsService.getDashboardStats(user.tenantId, user.role);
  }

  @Get('records-over-time')
  @ApiOperation({ summary: 'Registros ao longo do tempo' })
  async getRecordsOverTime(
    @CurrentUser() user: any,
    @Query('days') days?: number,
  ) {
    return this.statsService.getRecordsOverTime(user.tenantId, user.role, days || 30);
  }

  @Get('entities-distribution')
  @ApiOperation({ summary: 'Distribuicao de registros por entidade' })
  async getEntitiesDistribution(@CurrentUser() user: any) {
    return this.statsService.getEntitiesDistribution(user.tenantId, user.role);
  }

  @Get('users-activity')
  @ApiOperation({ summary: 'Atividade dos usuarios' })
  async getUsersActivity(
    @CurrentUser() user: any,
    @Query('days') days?: number,
  ) {
    return this.statsService.getUsersActivity(user.tenantId, user.role, days || 7);
  }

  @Get('recent-activity')
  @ApiOperation({ summary: 'Atividades recentes' })
  async getRecentActivity(
    @CurrentUser() user: any,
    @Query('limit') limit?: number,
  ) {
    return this.statsService.getRecentActivity(user.tenantId, user.role, limit || 10);
  }
}

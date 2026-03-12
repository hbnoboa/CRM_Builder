import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
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

  // ═══════════════════════════════════════════════════════════════════════
  // Stats por Entidade (Dashboard Widgets)
  // ═══════════════════════════════════════════════════════════════════════

  @Get('entity/:entitySlug/record-count')
  @ApiOperation({ summary: 'Contagem de registros de uma entidade' })
  async getEntityRecordCount(
    @Param('entitySlug') entitySlug: string,
    @CurrentUser() user: CurrentUserType,
    @Query('comparePeriod') comparePeriod?: string,
    @Query('days') days?: number,
    @Query('filters') filters?: string,
    @Query('dateStart') dateStart?: string,
    @Query('dateEnd') dateEnd?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    checkModulePermission(user, 'data', 'canRead');
    return this.statsService.getEntityRecordCount(user, entitySlug, tenantId, {
      comparePeriod: comparePeriod === 'previous',
      days: days ? Number(days) : 30,
      filters,
      dateStart,
      dateEnd,
    });
  }

  @Get('entity/:entitySlug/records-over-time')
  @ApiOperation({ summary: 'Registros ao longo do tempo para uma entidade' })
  async getEntityRecordsOverTime(
    @Param('entitySlug') entitySlug: string,
    @CurrentUser() user: CurrentUserType,
    @Query('days') days?: number,
    @Query('filters') filters?: string,
    @Query('dateStart') dateStart?: string,
    @Query('dateEnd') dateEnd?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    checkModulePermission(user, 'data', 'canRead');
    return this.statsService.getEntityRecordsOverTime(user, entitySlug, tenantId, days ? Number(days) : 30, { filters, dateStart, dateEnd });
  }

  @Get('entity/:entitySlug/field-distribution')
  @ApiOperation({ summary: 'Distribuicao de valores de um campo' })
  async getFieldDistribution(
    @Param('entitySlug') entitySlug: string,
    @CurrentUser() user: CurrentUserType,
    @Query('fieldSlug') fieldSlug: string,
    @Query('limit') limit?: number,
    @Query('filters') filters?: string,
    @Query('dateStart') dateStart?: string,
    @Query('dateEnd') dateEnd?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    checkModulePermission(user, 'data', 'canRead');
    return this.statsService.getFieldDistribution(user, entitySlug, fieldSlug, tenantId, limit ? Number(limit) : 20, { filters, dateStart, dateEnd });
  }

  @Get('entity/:entitySlug/cross-field-distribution')
  @ApiOperation({ summary: 'Distribuicao cruzada de dois campos' })
  async getCrossFieldDistribution(
    @Param('entitySlug') entitySlug: string,
    @CurrentUser() user: CurrentUserType,
    @Query('rowField') rowField: string,
    @Query('columnField') columnField: string,
    @Query('limit') limit?: number,
    @Query('filters') filters?: string,
    @Query('dateStart') dateStart?: string,
    @Query('dateEnd') dateEnd?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    checkModulePermission(user, 'data', 'canRead');
    return this.statsService.getCrossFieldDistribution(
      user, entitySlug, rowField, columnField, tenantId,
      { limit: limit ? Number(limit) : 20, filters, dateStart, dateEnd },
    );
  }

  @Get('entity/:entitySlug/field-aggregation')
  @ApiOperation({ summary: 'Agregacao de um campo numerico' })
  async getFieldAggregation(
    @Param('entitySlug') entitySlug: string,
    @CurrentUser() user: CurrentUserType,
    @Query('fieldSlug') fieldSlug: string,
    @Query('aggregation') aggregation?: string,
    @Query('comparePeriod') comparePeriod?: string,
    @Query('days') days?: number,
    @Query('filters') filters?: string,
    @Query('dateStart') dateStart?: string,
    @Query('dateEnd') dateEnd?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    checkModulePermission(user, 'data', 'canRead');
    return this.statsService.getFieldAggregation(user, entitySlug, fieldSlug, tenantId, {
      aggregation: aggregation || 'sum',
      comparePeriod: comparePeriod === 'previous',
      days: days ? Number(days) : 30,
      filters,
      dateStart,
      dateEnd,
    });
  }

  @Get('entity/:entitySlug/field-trend')
  @ApiOperation({ summary: 'Tendencia de um campo numerico ao longo do tempo' })
  async getFieldTrend(
    @Param('entitySlug') entitySlug: string,
    @CurrentUser() user: CurrentUserType,
    @Query('fieldSlug') fieldSlug: string,
    @Query('aggregation') aggregation?: string,
    @Query('days') days?: number,
    @Query('filters') filters?: string,
    @Query('dateStart') dateStart?: string,
    @Query('dateEnd') dateEnd?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    checkModulePermission(user, 'data', 'canRead');
    return this.statsService.getFieldTrend(user, entitySlug, fieldSlug, tenantId, {
      aggregation: aggregation || 'sum',
      days: days ? Number(days) : 30,
      filters,
      dateStart,
      dateEnd,
    });
  }

  @Get('entity/:entitySlug/recent-activity')
  @ApiOperation({ summary: 'Atividades recentes de uma entidade' })
  async getEntityRecentActivity(
    @Param('entitySlug') entitySlug: string,
    @CurrentUser() user: CurrentUserType,
    @Query('limit') limit?: number,
    @Query('filters') filters?: string,
    @Query('dateStart') dateStart?: string,
    @Query('dateEnd') dateEnd?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    checkModulePermission(user, 'data', 'canRead');
    return this.statsService.getEntityRecentActivity(user, entitySlug, tenantId, limit ? Number(limit) : 10, { filters, dateStart, dateEnd });
  }

  @Get('entity/:entitySlug/top-records')
  @ApiOperation({ summary: 'Top registros de uma entidade' })
  async getEntityTopRecords(
    @Param('entitySlug') entitySlug: string,
    @CurrentUser() user: CurrentUserType,
    @Query('limit') limit?: number,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('fields') fields?: string,
    @Query('filters') filters?: string,
    @Query('dateStart') dateStart?: string,
    @Query('dateEnd') dateEnd?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    checkModulePermission(user, 'data', 'canRead');
    return this.statsService.getEntityTopRecords(user, entitySlug, tenantId, {
      limit: limit ? Number(limit) : 5,
      sortBy: sortBy || 'createdAt',
      sortOrder: (sortOrder || 'desc') as 'asc' | 'desc',
      fields: fields ? fields.split(',') : undefined,
      filters,
      dateStart,
      dateEnd,
    });
  }

  @Get('entity/:entitySlug/field-ratio')
  @ApiOperation({ summary: 'Ratio entre dois campos numericos (suporta cross-entity)' })
  async getFieldRatio(
    @Param('entitySlug') entitySlug: string,
    @CurrentUser() user: CurrentUserType,
    @Query('numeratorField') numeratorField: string,
    @Query('denominatorField') denominatorField: string,
    @Query('denominatorEntitySlug') denominatorEntitySlug?: string,
    @Query('aggregation') aggregation?: string,
    @Query('comparePeriod') comparePeriod?: string,
    @Query('days') days?: number,
    @Query('filters') filters?: string,
    @Query('dateStart') dateStart?: string,
    @Query('dateEnd') dateEnd?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    checkModulePermission(user, 'data', 'canRead');
    return this.statsService.getFieldRatio(user, entitySlug, numeratorField, denominatorField, tenantId, {
      aggregation: aggregation || 'sum',
      comparePeriod: comparePeriod === 'previous',
      days: days ? Number(days) : 30,
      denominatorEntitySlug,
      filters,
      dateStart,
      dateEnd,
    });
  }

  @Get('entity/:entitySlug/distinct-count')
  @ApiOperation({ summary: 'Contagem de combinacoes distintas de campos' })
  async getDistinctCount(
    @Param('entitySlug') entitySlug: string,
    @CurrentUser() user: CurrentUserType,
    @Query('fields') fields: string,
    @Query('comparePeriod') comparePeriod?: string,
    @Query('days') days?: number,
    @Query('filterField') filterField?: string,
    @Query('filterValue') filterValue?: string,
    @Query('filters') filters?: string,
    @Query('dateStart') dateStart?: string,
    @Query('dateEnd') dateEnd?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    checkModulePermission(user, 'data', 'canRead');
    const fieldSlugs = fields ? fields.split(',') : [];
    return this.statsService.getDistinctCount(user, entitySlug, fieldSlugs, tenantId, {
      comparePeriod: comparePeriod === 'previous',
      days: days ? Number(days) : 30,
      filterField,
      filterValue,
      filters,
      dateStart,
      dateEnd,
    });
  }

  @Get('entity/:entitySlug/grouped-data')
  @ApiOperation({ summary: 'Dados agrupados por campos com agregacoes' })
  async getGroupedData(
    @Param('entitySlug') entitySlug: string,
    @CurrentUser() user: CurrentUserType,
    @Query('groupBy') groupBy: string,
    @Query('aggregations') aggregations?: string,
    @Query('crossEntityCount') crossEntityCount?: string,
    @Query('limit') limit?: number,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('filters') filters?: string,
    @Query('dateStart') dateStart?: string,
    @Query('dateEnd') dateEnd?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    checkModulePermission(user, 'data', 'canRead');
    const groupByFields = groupBy ? groupBy.split(',') : [];
    let parsedAggregations: Array<{ type: string; fieldSlug?: string; alias: string; distinctFields?: string[] }> | undefined;
    let parsedCrossEntityCount: { entitySlug: string; matchFields: Array<{ source: string; target: string }>; alias: string } | undefined;

    try { if (aggregations) parsedAggregations = JSON.parse(aggregations); } catch { /* ignore */ }
    try { if (crossEntityCount) parsedCrossEntityCount = JSON.parse(crossEntityCount); } catch { /* ignore */ }

    return this.statsService.getGroupedData(user, entitySlug, groupByFields, tenantId, {
      aggregations: parsedAggregations as never,
      crossEntityCount: parsedCrossEntityCount,
      limit: limit ? Number(limit) : 50,
      sortBy,
      sortOrder: (sortOrder || 'desc') as 'asc' | 'desc',
      filters,
      dateStart,
      dateEnd,
    });
  }

  @Get('entity/:entitySlug/funnel')
  @ApiOperation({ summary: 'Dados de funil para um campo de etapas' })
  async getEntityFunnel(
    @Param('entitySlug') entitySlug: string,
    @CurrentUser() user: CurrentUserType,
    @Query('fieldSlug') fieldSlug: string,
    @Query('stages') stages?: string,
    @Query('filters') filters?: string,
    @Query('dateStart') dateStart?: string,
    @Query('dateEnd') dateEnd?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    checkModulePermission(user, 'data', 'canRead');
    return this.statsService.getEntityFunnel(user, entitySlug, fieldSlug, tenantId, stages ? stages.split(',') : undefined, { filters, dateStart, dateEnd });
  }
}

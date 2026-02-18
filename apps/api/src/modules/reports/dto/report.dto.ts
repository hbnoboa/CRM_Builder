import {
  IsString,
  IsOptional,
  IsArray,
  IsObject,
  IsEnum,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Enums
export enum ReportVisibility {
  PRIVATE = 'PRIVATE',
  TEAM = 'TEAM',
  ORGANIZATION = 'ORGANIZATION',
  PUBLIC = 'PUBLIC',
}

export enum TenantScope {
  CURRENT = 'CURRENT',
  ALL = 'ALL',
  SELECTED = 'SELECTED',
}

export enum ComponentType {
  BAR_CHART = 'bar-chart',
  LINE_CHART = 'line-chart',
  AREA_CHART = 'area-chart',
  PIE_CHART = 'pie-chart',
  STATS_CARD = 'stats-card',
  KPI = 'kpi',
  TABLE = 'table',
  TREND = 'trend',
  GAUGE = 'gauge',
}

export enum Aggregation {
  SUM = 'sum',
  COUNT = 'count',
  AVG = 'avg',
  MIN = 'min',
  MAX = 'max',
}

export enum ComponentWidth {
  FULL = 'full',
  HALF = 'half',
  THIRD = 'third',
}

// Sub-DTOs para componentes
export class DateRangeDto {
  @IsString()
  @IsOptional()
  field?: string;

  @IsString()
  preset: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;
}

export class FilterDto {
  @IsString()
  fieldSlug: string;

  @IsString()
  operator: string;

  @IsString()
  @IsOptional()
  value?: string;

  @IsString()
  @IsOptional()
  value2?: string;
}

export class DataSourceDto {
  @IsString()
  entity: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FilterDto)
  filters?: FilterDto[];

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => DateRangeDto)
  dateRange?: DateRangeDto;
}

export class ChartConfigDto {
  @IsString()
  @IsOptional()
  measure?: string;

  @IsEnum(Aggregation)
  @IsOptional()
  aggregation?: Aggregation;

  @IsString()
  @IsOptional()
  dimension?: string;

  @IsArray()
  @IsOptional()
  colors?: string[];

  @IsOptional()
  showLegend?: boolean;

  @IsOptional()
  stacked?: boolean;

  @IsOptional()
  compareWithPrevious?: boolean;

  // Para tabelas
  @IsArray()
  @IsOptional()
  columns?: string[];

  @IsString()
  @IsOptional()
  sortBy?: string;

  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  limit?: number;

  // Para KPI/gauge
  @IsOptional()
  target?: number;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsString()
  @IsOptional()
  format?: string;
}

export class ReportComponentDto {
  @IsString()
  id: string;

  @IsEnum(ComponentType)
  type: ComponentType;

  @IsOptional()
  order?: number;

  @IsEnum(ComponentWidth)
  @IsOptional()
  width?: ComponentWidth;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => DataSourceDto)
  dataSource: DataSourceDto;

  @IsObject()
  @ValidateNested()
  @Type(() => ChartConfigDto)
  config: ChartConfigDto;
}

export class LayoutConfigDto {
  @IsOptional()
  columns?: number;

  @IsOptional()
  gaps?: number;
}

export class SharedWithDto {
  @IsArray()
  @IsOptional()
  canView?: string[];

  @IsArray()
  @IsOptional()
  canEdit?: string[];
}

// Main DTOs
export class CreateReportDto {
  @ApiProperty({ example: 'Vendas Mensais' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  showInDashboard?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  dashboardOrder?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ type: [ReportComponentDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ReportComponentDto)
  components?: ReportComponentDto[];

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => LayoutConfigDto)
  layoutConfig?: LayoutConfigDto;

  @ApiPropertyOptional({ enum: ReportVisibility })
  @IsEnum(ReportVisibility)
  @IsOptional()
  visibility?: ReportVisibility;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => SharedWithDto)
  sharedWith?: SharedWithDto;

  @ApiPropertyOptional({ enum: TenantScope })
  @IsEnum(TenantScope)
  @IsOptional()
  tenantScope?: TenantScope;

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  selectedTenants?: string[];
}

export class UpdateReportDto {
  @ApiPropertyOptional()
  @IsString()
  @MinLength(1)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  showInDashboard?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  dashboardOrder?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ type: [ReportComponentDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ReportComponentDto)
  components?: ReportComponentDto[];

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => LayoutConfigDto)
  layoutConfig?: LayoutConfigDto;

  @ApiPropertyOptional({ enum: ReportVisibility })
  @IsEnum(ReportVisibility)
  @IsOptional()
  visibility?: ReportVisibility;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => SharedWithDto)
  sharedWith?: SharedWithDto;

  @ApiPropertyOptional({ enum: TenantScope })
  @IsEnum(TenantScope)
  @IsOptional()
  tenantScope?: TenantScope;

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  selectedTenants?: string[];
}

export class ExecuteReportDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  tenantId?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  overrideFilters?: Record<string, FilterDto[]>;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  overrideDateRange?: DateRangeDto;
}

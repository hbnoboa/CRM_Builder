// ═══════════════════════════════════════════════════════════════════════
// Dashboard Template Types
// ═══════════════════════════════════════════════════════════════════════

export type WidgetType =
  | 'kpi-card'
  | 'number-card'
  | 'area-chart'
  | 'line-chart'
  | 'bar-chart'
  | 'column-chart'
  | 'pie-chart'
  | 'donut-chart'
  | 'funnel-chart'
  | 'gauge-chart'
  | 'mini-table'
  | 'activity-feed'
  | 'filter-slicer';

export interface WidgetConfig {
  type: WidgetType;
  title?: string;
  config: {
    // KPI / Aggregation
    fieldSlug?: string;
    aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max';
    showComparison?: boolean;
    comparisonPeriod?: number;
    thresholds?: { warn: number; danger: number };

    // Charts
    dataSource?: 'records-over-time' | 'field-distribution' | 'field-trend' | 'funnel';
    groupByField?: string;
    days?: number;
    chartColor?: string;
    chartColors?: string[];
    showLegend?: boolean;
    stacked?: boolean;

    // Funnel
    stages?: string[];

    // Gauge
    gaugeMin?: number;
    gaugeMax?: number;
    gaugeTarget?: number;

    // Mini Table
    limit?: number;
    displayFields?: string[];
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';

    // Activity Feed
    activityLimit?: number;

    // Filter Slicer
    filterFields?: string[];
    slicerType?: 'dropdown' | 'date-range' | 'numeric-range' | 'relative-date' | 'tile';
    relativeDateOptions?: string[];
  };
}

export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export interface DashboardTemplate {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  entitySlug?: string;
  layout: LayoutItem[];
  widgets: Record<string, WidgetConfig>;
  roleIds: string[];
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDashboardTemplateData {
  tenantId?: string;
  name: string;
  description?: string;
  entitySlug?: string;
  layout?: LayoutItem[];
  widgets?: Record<string, WidgetConfig>;
  roleIds?: string[];
  priority?: number;
  isActive?: boolean;
}

export interface UpdateDashboardTemplateData extends Partial<CreateDashboardTemplateData> {}

// ═══════════════════════════════════════════════════════════════════════
// Entity Stats Response Types
// ═══════════════════════════════════════════════════════════════════════

export interface PeriodComparison {
  current: number;
  previous: number;
  changePercent: number;
  changeAbsolute: number;
}

export interface EntityRecordCount {
  total: number;
  active: number;
  archived: number;
  periodComparison?: PeriodComparison;
}

export interface TimeSeriesPoint {
  date: string;
  count: number;
}

export interface FieldDistributionItem {
  value: string;
  label: string;
  count: number;
}

export interface FieldAggregation {
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  periodComparison?: PeriodComparison;
}

export interface FieldTrendPoint {
  date: string;
  value: number;
}

export interface RecentActivityItem {
  id: string;
  action: 'created' | 'updated';
  timestamp: string;
  data: Record<string, unknown>;
  userName?: string;
}

export interface TopRecord {
  id: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface FunnelStage {
  stage: string;
  label: string;
  count: number;
  percentage: number;
}

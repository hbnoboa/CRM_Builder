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
  | 'filter-slicer'
  | 'stacked-bar-chart'
  | 'heatmap-chart'
  | 'scatter-chart'
  | 'treemap-chart'
  | 'grouped-bar-chart'
  | 'zone-diagram'
  | 'image-gallery'
  | 'stat-list'
  | 'data-table'
  | 'sub-entity-list'
  | 'sub-entity-timeline'
  | 'kanban-board';

export interface WidgetConfig {
  type: WidgetType;
  title?: string;
  config: {
    // Cross-entity: use a different entity slug for this widget
    entitySlugOverride?: string;

    // KPI / Aggregation
    fieldSlug?: string;
    aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinct';
    distinctFields?: string[]; // fields to combine for distinct count (e.g. ['navio','viagem'])
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

    // Cross-field (stacked-bar, grouped-bar, heatmap, scatter)
    rowField?: string;
    columnField?: string;
    colorScale?: string[];
    showValues?: boolean;
    orientation?: 'horizontal' | 'vertical';

    // Reference lines (line-chart, bar-chart, column-chart, area-chart, grouped-bar-chart)
    referenceLines?: { value: number; label?: string; color?: string; strokeDasharray?: string }[];

    // KPI ratio mode (kpi-card)
    ratioFieldSlug?: string;
    ratioMode?: 'percentage' | 'ratio';
    ratioEntitySlug?: string; // different entity for denominator (cross-entity ratio)

    // Mini-table computed columns
    computedColumns?: {
      label: string;
      type: 'duration' | 'percentage' | 'difference';
      fieldA?: string;
      fieldB?: string;
      format?: string;
      // Badge thresholds: colored badge for percentage columns
      badgeThresholds?: { value: number; color: string; label?: string }[];
    }[];

    // Bar/Column chart: show ratio labels (e.g. "3/10 (30%)")
    showRatio?: boolean;

    // Image gallery
    imageField?: string;
    imageFields?: string[];           // multiple image fields per record
    childEntitySlug?: string;         // also fetch photos from this child entity
    childImageFields?: string[];      // image fields in the child entity
    galleryColumns?: number;

    // Zone diagram
    zoneField?: string;
    zoneLabels?: Record<string, string>;
    zoneColorField?: string;

    // Stat list
    listStyle?: 'simple' | 'ranked' | 'colored';
    valueSuffix?: string;
    showTotal?: boolean;              // show total count prominently above list

    // Filtered distinct (KPI distinct ratio)
    filterField?: string;
    filterValue?: string;

    // Data table
    allowCreate?: boolean;
    allowEdit?: boolean;
    allowDelete?: boolean;
    allowExport?: boolean;
    allowImport?: boolean;
    allowBatchSelect?: boolean;
    pageSize?: number;
    defaultSortField?: string;
    defaultSortOrder?: 'asc' | 'desc';

    // Kanban board
    cardTitleField?: string;
    cardSubtitleFields?: string[];
    cardBadgeField?: string;
    columnOrder?: string[];

    // Grouped mode (mini-table agrupado)
    groupByFields?: string[];
    tableColumns?: string[];
    aggregations?: Array<{
      type: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinctCount' | 'mode' | 'first';
      fieldSlug?: string;
      alias: string;
      distinctFields?: string[];
    }>;
    crossEntityCount?: {
      entitySlug: string;
      matchFields?: Array<{ source: string; target: string }>;
      matchBy?: 'fields' | 'children';
      alias: string;
    };
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

export interface DashboardTab {
  id: string;
  label: string;
  icon?: string;
  widgetIds: string[];
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
  tabs?: DashboardTab[];
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
  tabs?: DashboardTab[];
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

export interface CrossFieldDistribution {
  rows: { value: string; label: string }[];
  columns: { value: string; label: string }[];
  matrix: Record<string, Record<string, number>>;
  maxValue: number;
}

export interface FieldRatioResult {
  numerator: number;
  denominator: number;
  ratio: number;
  percentage: number;
  periodComparison?: PeriodComparison;
}

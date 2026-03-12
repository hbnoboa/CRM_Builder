'use client';

import { useMemo, useState } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import { useMyDashboardTemplate } from '@/hooks/use-dashboard-templates';
import { useEntities } from '@/hooks/use-entities';
import { DashboardFilterProvider, WidgetProvider, useDashboardFilters } from './dashboard-filter-context';
import { DashboardFilterBar } from './dashboard-filter-bar';
import { RecordDetailModal } from './record-detail-modal';
import { WidgetWrapper } from './widget-wrapper';
import { KpiCardWidget } from './kpi-card-widget';
import { NumberCardWidget } from './number-card-widget';
import { AreaChartWidget } from './area-chart-widget';
import { LineChartWidget } from './line-chart-widget';
import { BarChartWidget } from './bar-chart-widget';
import { ColumnChartWidget } from './column-chart-widget';
import { PieChartWidget } from './pie-chart-widget';
import { DonutChartWidget } from './donut-chart-widget';
import { FunnelChartWidget } from './funnel-chart-widget';
import { GaugeChartWidget } from './gauge-chart-widget';
import { MiniTableWidget } from './mini-table-widget';
import { ActivityFeedWidget } from './activity-feed-widget';
import { FilterSlicerWidget } from './filter-slicer-widget';
import { StackedBarChartWidget } from './stacked-bar-chart-widget';
import { HeatmapChartWidget } from './heatmap-chart-widget';
import { ScatterChartWidget } from './scatter-chart-widget';
import { TreemapChartWidget } from './treemap-chart-widget';
import { GroupedBarChartWidget } from './grouped-bar-chart-widget';
import { ZoneDiagramWidget } from './zone-diagram-widget';
import { ImageGalleryWidget } from './image-gallery-widget';
import { StatListWidget } from './stat-list-widget';
import { cn } from '@/lib/utils';
import type { WidgetConfig, WidgetType } from '@crm-builder/shared';

import 'react-grid-layout/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

type EntityFieldLike = { slug: string; name: string; label?: string; type: string };
type EntityLike = { slug: string; name: string; fields?: EntityFieldLike[] };

interface EntityDashboardProps {
  entitySlug: string;
  entityFields?: EntityFieldLike[];
}

function renderWidget(
  widgetId: string,
  widgetConfig: WidgetConfig,
  entitySlug: string,
  entityFields?: EntityFieldLike[],
  allEntities?: EntityLike[],
) {
  const effectiveSlug = widgetConfig.config.entitySlugOverride || entitySlug;

  // Resolve entity fields for overridden entities
  let effectiveFields = entityFields;
  if (widgetConfig.config.entitySlugOverride && allEntities) {
    const overrideEntity = allEntities.find((e) => e.slug === widgetConfig.config.entitySlugOverride);
    if (overrideEntity?.fields) {
      effectiveFields = overrideEntity.fields;
    }
  }

  const commonProps = {
    entitySlug: effectiveSlug,
    config: widgetConfig.config,
    title: widgetConfig.title,
  };

  switch (widgetConfig.type as WidgetType) {
    case 'kpi-card':
      return <KpiCardWidget {...commonProps} />;
    case 'number-card':
      return <NumberCardWidget {...commonProps} />;
    case 'area-chart':
      return <AreaChartWidget {...commonProps} />;
    case 'line-chart':
      return <LineChartWidget {...commonProps} />;
    case 'bar-chart':
      return <BarChartWidget {...commonProps} />;
    case 'column-chart':
      return <ColumnChartWidget {...commonProps} />;
    case 'pie-chart':
      return <PieChartWidget {...commonProps} />;
    case 'donut-chart':
      return <DonutChartWidget {...commonProps} />;
    case 'funnel-chart':
      return <FunnelChartWidget {...commonProps} />;
    case 'gauge-chart':
      return <GaugeChartWidget {...commonProps} />;
    case 'mini-table':
      return <MiniTableWidget {...commonProps} entityFields={effectiveFields} />;
    case 'activity-feed':
      return <ActivityFeedWidget {...commonProps} />;
    case 'filter-slicer':
      return <FilterSlicerWidget {...commonProps} />;
    case 'stacked-bar-chart':
      return <StackedBarChartWidget {...commonProps} />;
    case 'heatmap-chart':
      return <HeatmapChartWidget {...commonProps} />;
    case 'scatter-chart':
      return <ScatterChartWidget {...commonProps} />;
    case 'treemap-chart':
      return <TreemapChartWidget {...commonProps} />;
    case 'grouped-bar-chart':
      return <GroupedBarChartWidget {...commonProps} />;
    case 'zone-diagram':
      return <ZoneDiagramWidget {...commonProps} />;
    case 'image-gallery':
      return <ImageGalleryWidget {...commonProps} />;
    case 'stat-list':
      return <StatListWidget {...commonProps} />;
    default:
      return (
        <WidgetWrapper title={widgetConfig.title}>
          <div className="text-xs text-muted-foreground text-center">
            Widget desconhecido: {widgetConfig.type}
          </div>
        </WidgetWrapper>
      );
  }
}

export function EntityDashboard({ entitySlug, entityFields }: EntityDashboardProps) {
  const { data: template, isLoading } = useMyDashboardTemplate(entitySlug);
  const { data: entitiesData } = useEntities();

  // Check if any widget uses entitySlugOverride to decide if we need the entities list
  const allEntities = useMemo(() => {
    if (!entitiesData) return undefined;
    const list = Array.isArray(entitiesData) ? entitiesData : (entitiesData as { data?: unknown[] })?.data || [];
    return list as EntityLike[];
  }, [entitiesData]);

  const layouts = useMemo(() => {
    if (!template?.layout) return {};
    return {
      lg: template.layout,
      md: template.layout.map((item) => ({
        ...item,
        w: Math.min(item.w, 10),
      })),
      sm: template.layout.map((item) => ({
        ...item,
        w: Math.min(item.w, 6),
        x: 0,
      })),
    };
  }, [template?.layout]);

  // Tabs support
  const tabs = (template as { tabs?: { id: string; label: string; icon?: string; widgetIds: string[] }[] })?.tabs;
  const hasTabs = tabs && tabs.length > 1;
  const [activeTabId, setActiveTabId] = useState<string | undefined>(undefined);

  if (isLoading || !template) return null;

  const allWidgetEntries = Object.entries(template.widgets || {});
  if (allWidgetEntries.length === 0) return null;

  // Filter widgets by active tab
  const effectiveTabId = activeTabId || tabs?.[0]?.id;
  const activeTab = hasTabs ? tabs.find((t) => t.id === effectiveTabId) : undefined;
  const widgetEntries = activeTab
    ? allWidgetEntries.filter(([id]) => activeTab.widgetIds.includes(id))
    : allWidgetEntries;

  // Filter layout to only include visible widgets
  const visibleWidgetIds = new Set(widgetEntries.map(([id]) => id));
  const filteredLayouts = hasTabs
    ? {
        lg: (template.layout || []).filter((item) => visibleWidgetIds.has(item.i)),
        md: (template.layout || []).filter((item) => visibleWidgetIds.has(item.i)).map((item) => ({
          ...item, w: Math.min(item.w, 10),
        })),
        sm: (template.layout || []).filter((item) => visibleWidgetIds.has(item.i)).map((item) => ({
          ...item, w: Math.min(item.w, 6), x: 0,
        })),
      }
    : layouts;

  return (
    <DashboardFilterProvider mainEntitySlug={entitySlug}>
      <div className="mb-4">
        <DashboardFilterBar entityFields={entityFields} />
        {hasTabs && (
          <div className="flex gap-1 mb-3 border-b">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                  (effectiveTabId === tab.id)
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
        <ResponsiveGridLayout
          key={effectiveTabId || '__all__'}
          className="layout"
          layouts={filteredLayouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768 }}
          cols={{ lg: 12, md: 10, sm: 6 }}
          rowHeight={30}
          margin={[12, 12]}
          isDraggable={false}
          isResizable={false}
          compactType="vertical"
          containerPadding={[0, 0]}
        >
          {widgetEntries.map(([widgetId, widgetConfig]) => {
            const wc = widgetConfig as WidgetConfig;
            const effectiveSlug = wc.config.entitySlugOverride || entitySlug;
            return (
              <div key={widgetId}>
                <WidgetProvider entitySlug={effectiveSlug} widgetId={widgetId}>
                  {renderWidget(widgetId, wc, entitySlug, entityFields, allEntities)}
                </WidgetProvider>
              </div>
            );
          })}
        </ResponsiveGridLayout>
        <DrillThroughContainer />
      </div>
    </DashboardFilterProvider>
  );
}

function DrillThroughContainer() {
  const { drillRecord, closeDrillThrough } = useDashboardFilters();
  if (!drillRecord) return null;
  return (
    <RecordDetailModal
      entitySlug={drillRecord.entitySlug}
      recordId={drillRecord.recordId}
      open
      onOpenChange={(open) => { if (!open) closeDrillThrough(); }}
    />
  );
}

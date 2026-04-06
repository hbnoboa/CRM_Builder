'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import { useMyDashboardTemplate, useDashboardTemplate } from '@/hooks/use-dashboard-templates';
import { useEntities } from '@/hooks/use-entities';
import { EntityDataProvider, useEntityData, useEntityDataOptional } from '@/components/entity-data/entity-data-context';
import { DashboardFilterProvider, WidgetProvider, useDashboardFilters } from './dashboard-filter-context';
import type { CrossFilter, FieldFilter } from '@/components/entity-data/unified-filter-types';
import { Database } from 'lucide-react';
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
import { DataTableWidget } from './data-table-widget';
import SubEntityListWidget from './sub-entity-list-widget';
import SubEntityTimelineWidget from './sub-entity-timeline-widget';
import { KanbanBoardWidget } from './kanban-board-widget';
import { cn } from '@/lib/utils';
import type { WidgetConfig, WidgetType } from '@crm-builder/shared';

import 'react-grid-layout/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

type EntityFieldLike = { slug: string; name: string; label?: string; type: string };
type EntityLike = { slug: string; name: string; fields?: EntityFieldLike[] };

interface EntityDashboardProps {
  entitySlug: string;
  entityFields?: EntityFieldLike[];
  templateId?: string;
  externalFilters?: Array<{ fieldSlug: string; operator: string; value: unknown; value2?: unknown }>;
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
    case 'data-table':
      return <DataTableWidget {...commonProps} />;
    case 'sub-entity-list':
      return <SubEntityListWidget config={widgetConfig.config} />;
    case 'sub-entity-timeline':
      return <SubEntityTimelineWidget config={widgetConfig.config} />;
    case 'kanban-board':
      return <KanbanBoardWidget {...commonProps} />;
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

export function EntityDashboard({ entitySlug, entityFields, templateId, externalFilters }: EntityDashboardProps) {
  const myTemplate = useMyDashboardTemplate(templateId ? undefined : entitySlug);
  const specificTemplate = useDashboardTemplate(templateId);
  const { data: template, isLoading } = templateId ? specificTemplate : myTemplate;
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
  // Track visited tabs so we can keep them mounted (avoid remount on tab switch)
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set());

  // Active tab (computed before any early returns to keep hook order stable)
  const effectiveTabId = activeTabId || tabs?.[0]?.id;

  // Mark tab as visited when it becomes active
  useEffect(() => {
    if (!hasTabs || !effectiveTabId) return;
    setVisitedTabs(prev => {
      if (prev.has(effectiveTabId)) return prev;
      const next = new Set(prev);
      next.add(effectiveTabId);
      return next;
    });
  }, [hasTabs, effectiveTabId]);

  if (isLoading || !template) return null;

  const allWidgetEntries = Object.entries(template.widgets || {});
  if (allWidgetEntries.length === 0) return null;

  // For non-tabbed dashboards, render all widgets
  if (!hasTabs) {
    return (
      <EntityDataProvider entitySlug={entitySlug}>
      <DashboardFilterProvider mainEntitySlug={entitySlug} externalFilters={externalFilters}>
        <WidgetProvider entitySlug={entitySlug} widgetId="__bridge__">
          <DashboardFilterBridge />
        </WidgetProvider>
        <div className="mb-4">

          <DashboardFilterBar entityFields={entityFields} />
          <RecordCountBadge />
          <ResponsiveGridLayout
            className="layout"
            layouts={layouts}
            breakpoints={{ lg: 1200, md: 996, sm: 768 }}
            cols={{ lg: 12, md: 10, sm: 6 }}
            rowHeight={30}
            margin={[12, 12]}
            isDraggable={false}
            isResizable={false}
            compactType="vertical"
            containerPadding={[0, 0]}
          >
            {allWidgetEntries.map(([widgetId, widgetConfig]) => {
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
      </EntityDataProvider>
    );
  }

  // Tabbed: render visited tabs, show only active (no remount on tab switch)
  return (
    <EntityDataProvider entitySlug={entitySlug}>
    <DashboardFilterProvider mainEntitySlug={entitySlug}>
      <WidgetProvider entitySlug={entitySlug} widgetId="__bridge__">
        <DashboardFilterBridge />
      </WidgetProvider>
      <div className="mb-4">
        <DashboardFilterBar entityFields={entityFields} />
        <RecordCountBadge />
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
        {tabs.map((tab) => {
          const isActive = effectiveTabId === tab.id;
          const wasVisited = visitedTabs.has(tab.id);
          if (!wasVisited) return null;

          const tabWidgetEntries = allWidgetEntries.filter(([id]) => tab.widgetIds.includes(id));
          const tabWidgetIds = new Set(tabWidgetEntries.map(([id]) => id));
          const tabLayouts = {
            lg: (template.layout || []).filter((item) => tabWidgetIds.has(item.i)),
            md: (template.layout || []).filter((item) => tabWidgetIds.has(item.i)).map((item) => ({
              ...item, w: Math.min(item.w, 10),
            })),
            sm: (template.layout || []).filter((item) => tabWidgetIds.has(item.i)).map((item) => ({
              ...item, w: Math.min(item.w, 6), x: 0,
            })),
          };

          return (
            <div key={tab.id} style={{ display: isActive ? undefined : 'none' }}>
              <ResponsiveGridLayout
                className="layout"
                layouts={tabLayouts}
                breakpoints={{ lg: 1200, md: 996, sm: 768 }}
                cols={{ lg: 12, md: 10, sm: 6 }}
                rowHeight={30}
                margin={[12, 12]}
                isDraggable={false}
                isResizable={false}
                compactType="vertical"
                containerPadding={[0, 0]}
              >
                {tabWidgetEntries.map(([widgetId, widgetConfig]) => {
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
            </div>
          );
        })}
        <DrillThroughContainer />
      </div>
    </DashboardFilterProvider>
    </EntityDataProvider>
  );
}

/**
 * Syncs DashboardFilterProvider cross-filters → EntityDataProvider cross-filters.
 * This ensures that when a chart widget emits a cross-filter (via DashboardFilterProvider),
 * it also applies to the data-table and other client-side computed widgets (via EntityDataProvider).
 */
function DashboardFilterBridge() {
  const { crossFilters, slicerFilters, dateRange } = useDashboardFilters();
  const entityCtx = useEntityDataOptional();
  const prevRef = useRef<string>('');
  const prevServerRef = useRef<string>('');
  const setFiltersRef = useRef(entityCtx?.setFilters);
  setFiltersRef.current = entityCtx?.setFilters;
  const setServerDashRef = useRef(entityCtx?.setServerDashFilters);
  setServerDashRef.current = entityCtx?.setServerDashFilters;

  useEffect(() => {
    if (!setFiltersRef.current) return;

    // Separate cross-entity prefixed filters (need server-side resolution)
    const clientCrossFilters: CrossFilter[] = [];
    const serverFilterItems: Array<{ fieldSlug: string; operator: string; value: unknown }> = [];

    for (const cf of crossFilters) {
      if (cf.fieldSlug.startsWith('parent.') || cf.fieldSlug.startsWith('child.') || cf.fieldSlug.startsWith('_hasChildren')) {
        // Server-side only
        serverFilterItems.push({
          fieldSlug: cf.fieldSlug,
          operator: cf.values.length > 1 ? 'in' : 'equals',
          value: cf.values.length > 1 ? cf.values : cf.values[0],
        });
      } else {
        clientCrossFilters.push({ fieldSlug: cf.fieldSlug, values: cf.values, entitySlug: cf.entitySlug });
      }
    }

    for (const sf of slicerFilters) {
      if (sf.fieldSlug.startsWith('parent.') || sf.fieldSlug.startsWith('child.') || sf.fieldSlug.startsWith('_hasChildren')) {
        // Server-side only
        serverFilterItems.push({
          fieldSlug: sf.fieldSlug,
          operator: sf.operator,
          value: sf.value,
          ...(sf.fieldType && { fieldType: sf.fieldType }),
        });
      }
    }

    // Convert same-entity slicer filters to client-side field filters
    const slicerFieldFilters: FieldFilter[] = slicerFilters
      .filter(sf => !sf.fieldSlug.startsWith('parent.') && !sf.fieldSlug.startsWith('child.') && !sf.fieldSlug.startsWith('_hasChildren'))
      .map(sf => ({
        id: `slicer-${sf.fieldSlug}`,
        fieldSlug: sf.fieldSlug,
        fieldType: sf.fieldType || 'text',
        operator: sf.operator as FieldFilter['operator'],
        value: sf.value,
      }));

    // Update client-side filters
    const clientKey = JSON.stringify({ cf: clientCrossFilters, sf: slicerFieldFilters, dr: dateRange });
    if (clientKey !== prevRef.current) {
      prevRef.current = clientKey;
      setFiltersRef.current({
        crossFilters: clientCrossFilters,
        fieldFilters: slicerFieldFilters,
        dateRange,
      });
    }

    // Update server-side dashboard filters (triggers API refetch)
    const serverKey = JSON.stringify(serverFilterItems);
    if (serverKey !== prevServerRef.current) {
      prevServerRef.current = serverKey;
      setServerDashRef.current?.(serverFilterItems.length > 0 ? serverKey : undefined);
    }
  }, [crossFilters, slicerFilters, dateRange]);

  return null;
}


function RecordCountBadge() {
  const ctx = useEntityDataOptional();
  if (!ctx) return null;
  const total = ctx.allRecords.length;
  const filtered = ctx.sortedRecords.length;
  const isFiltered = filtered < total;
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
      <Database className="h-3.5 w-3.5" />
      {isFiltered
        ? <span>{filtered.toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')} registros</span>
        : <span>{total.toLocaleString('pt-BR')} registros</span>
      }
    </div>
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

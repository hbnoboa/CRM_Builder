'use client';

import { useMemo } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import { useMyDashboardTemplate } from '@/hooks/use-dashboard-templates';
import { DashboardFilterProvider } from './dashboard-filter-context';
import { DashboardFilterBar } from './dashboard-filter-bar';
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
import type { WidgetConfig, WidgetType } from '@crm-builder/shared';

import 'react-grid-layout/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface EntityDashboardProps {
  entitySlug: string;
  entityFields?: Array<{ slug: string; name: string; label?: string; type: string }>;
}

function renderWidget(
  widgetId: string,
  widgetConfig: WidgetConfig,
  entitySlug: string,
  entityFields?: Array<{ slug: string; name: string; label?: string; type: string }>,
) {
  const effectiveSlug = widgetConfig.config.entitySlugOverride || entitySlug;
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
      return <MiniTableWidget {...commonProps} entityFields={entityFields} />;
    case 'activity-feed':
      return <ActivityFeedWidget {...commonProps} />;
    case 'filter-slicer':
      return <FilterSlicerWidget {...commonProps} />;
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

  if (isLoading || !template) return null;

  const widgetEntries = Object.entries(template.widgets || {});
  if (widgetEntries.length === 0) return null;

  return (
    <DashboardFilterProvider>
      <div className="mb-4">
        <DashboardFilterBar entityFields={entityFields} />
        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768 }}
          cols={{ lg: 12, md: 10, sm: 6 }}
          rowHeight={30}
          margin={[12, 12]}
          isDraggable={false}
          isResizable={false}
          containerPadding={[0, 0]}
        >
          {widgetEntries.map(([widgetId, widgetConfig]) => (
            <div key={widgetId}>
              {renderWidget(widgetId, widgetConfig as WidgetConfig, entitySlug, entityFields)}
            </div>
          ))}
        </ResponsiveGridLayout>
      </div>
    </DashboardFilterProvider>
  );
}

import type { WidgetType } from '@crm-builder/shared';
import {
  BarChart3,
  LineChart,
  PieChart,
  Activity,
  Hash,
  TrendingUp,
  Table2,
  Filter,
  Gauge,
  type LucideIcon,
} from 'lucide-react';

export interface WidgetDefinition {
  type: WidgetType;
  label: string;
  icon: LucideIcon;
  defaultLayout: { w: number; h: number; minW: number; minH: number };
}

export const WIDGET_REGISTRY: Record<WidgetType, WidgetDefinition> = {
  'kpi-card': {
    type: 'kpi-card',
    label: 'KPI Card',
    icon: TrendingUp,
    defaultLayout: { w: 3, h: 3, minW: 2, minH: 2 },
  },
  'number-card': {
    type: 'number-card',
    label: 'Numero',
    icon: Hash,
    defaultLayout: { w: 2, h: 2, minW: 2, minH: 2 },
  },
  'area-chart': {
    type: 'area-chart',
    label: 'Area',
    icon: Activity,
    defaultLayout: { w: 6, h: 5, minW: 3, minH: 3 },
  },
  'line-chart': {
    type: 'line-chart',
    label: 'Linha',
    icon: LineChart,
    defaultLayout: { w: 6, h: 5, minW: 3, minH: 3 },
  },
  'bar-chart': {
    type: 'bar-chart',
    label: 'Barras',
    icon: BarChart3,
    defaultLayout: { w: 6, h: 5, minW: 3, minH: 3 },
  },
  'column-chart': {
    type: 'column-chart',
    label: 'Colunas',
    icon: BarChart3,
    defaultLayout: { w: 6, h: 5, minW: 3, minH: 3 },
  },
  'pie-chart': {
    type: 'pie-chart',
    label: 'Pizza',
    icon: PieChart,
    defaultLayout: { w: 4, h: 5, minW: 3, minH: 3 },
  },
  'donut-chart': {
    type: 'donut-chart',
    label: 'Rosca',
    icon: PieChart,
    defaultLayout: { w: 4, h: 5, minW: 3, minH: 3 },
  },
  'funnel-chart': {
    type: 'funnel-chart',
    label: 'Funil',
    icon: Filter,
    defaultLayout: { w: 4, h: 6, minW: 3, minH: 4 },
  },
  'gauge-chart': {
    type: 'gauge-chart',
    label: 'Gauge',
    icon: Gauge,
    defaultLayout: { w: 3, h: 4, minW: 2, minH: 3 },
  },
  'mini-table': {
    type: 'mini-table',
    label: 'Tabela',
    icon: Table2,
    defaultLayout: { w: 8, h: 6, minW: 4, minH: 4 },
  },
  'activity-feed': {
    type: 'activity-feed',
    label: 'Atividades',
    icon: Activity,
    defaultLayout: { w: 4, h: 6, minW: 3, minH: 4 },
  },
  'filter-slicer': {
    type: 'filter-slicer',
    label: 'Filtro',
    icon: Filter,
    defaultLayout: { w: 3, h: 2, minW: 2, minH: 2 },
  },
};

export const WIDGET_TYPES = Object.keys(WIDGET_REGISTRY) as WidgetType[];

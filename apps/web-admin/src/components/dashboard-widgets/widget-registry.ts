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
  Grid3X3,
  LayoutGrid,
  ScatterChart,
  Image,
  List,
  type LucideIcon,
} from 'lucide-react';

export type WidgetCategory = 'indicators' | 'charts' | 'distribution' | 'analysis' | 'data';

export const WIDGET_CATEGORIES: Record<WidgetCategory, string> = {
  indicators: 'Indicadores',
  charts: 'Graficos',
  distribution: 'Distribuicao',
  analysis: 'Analise',
  data: 'Dados',
};

export interface WidgetDefinition {
  type: WidgetType;
  label: string;
  icon: LucideIcon;
  category: WidgetCategory;
  defaultLayout: { w: number; h: number; minW: number; minH: number };
}

export const WIDGET_REGISTRY: Record<WidgetType, WidgetDefinition> = {
  'kpi-card': {
    type: 'kpi-card',
    label: 'KPI Card',
    icon: TrendingUp,
    category: 'indicators',
    defaultLayout: { w: 3, h: 3, minW: 2, minH: 2 },
  },
  'number-card': {
    type: 'number-card',
    label: 'Numero',
    icon: Hash,
    category: 'indicators',
    defaultLayout: { w: 2, h: 2, minW: 2, minH: 2 },
  },
  'area-chart': {
    type: 'area-chart',
    label: 'Area',
    icon: Activity,
    category: 'charts',
    defaultLayout: { w: 6, h: 5, minW: 3, minH: 3 },
  },
  'line-chart': {
    type: 'line-chart',
    label: 'Linha',
    icon: LineChart,
    category: 'charts',
    defaultLayout: { w: 6, h: 5, minW: 3, minH: 3 },
  },
  'bar-chart': {
    type: 'bar-chart',
    label: 'Barras',
    icon: BarChart3,
    category: 'charts',
    defaultLayout: { w: 6, h: 5, minW: 3, minH: 3 },
  },
  'column-chart': {
    type: 'column-chart',
    label: 'Colunas',
    icon: BarChart3,
    category: 'charts',
    defaultLayout: { w: 6, h: 5, minW: 3, minH: 3 },
  },
  'pie-chart': {
    type: 'pie-chart',
    label: 'Pizza',
    icon: PieChart,
    category: 'distribution',
    defaultLayout: { w: 4, h: 5, minW: 3, minH: 3 },
  },
  'donut-chart': {
    type: 'donut-chart',
    label: 'Rosca',
    icon: PieChart,
    category: 'distribution',
    defaultLayout: { w: 4, h: 5, minW: 3, minH: 3 },
  },
  'funnel-chart': {
    type: 'funnel-chart',
    label: 'Funil',
    icon: Filter,
    category: 'distribution',
    defaultLayout: { w: 4, h: 6, minW: 3, minH: 4 },
  },
  'gauge-chart': {
    type: 'gauge-chart',
    label: 'Gauge',
    icon: Gauge,
    category: 'indicators',
    defaultLayout: { w: 3, h: 4, minW: 2, minH: 3 },
  },
  'mini-table': {
    type: 'mini-table',
    label: 'Tabela',
    icon: Table2,
    category: 'data',
    defaultLayout: { w: 8, h: 6, minW: 4, minH: 4 },
  },
  'activity-feed': {
    type: 'activity-feed',
    label: 'Atividades',
    icon: Activity,
    category: 'data',
    defaultLayout: { w: 4, h: 6, minW: 3, minH: 4 },
  },
  'filter-slicer': {
    type: 'filter-slicer',
    label: 'Filtro',
    icon: Filter,
    category: 'data',
    defaultLayout: { w: 3, h: 2, minW: 2, minH: 2 },
  },
  'stacked-bar-chart': {
    type: 'stacked-bar-chart',
    label: 'Barras Empilhadas',
    icon: BarChart3,
    category: 'analysis',
    defaultLayout: { w: 6, h: 5, minW: 4, minH: 3 },
  },
  'heatmap-chart': {
    type: 'heatmap-chart',
    label: 'Mapa de Calor',
    icon: Grid3X3,
    category: 'analysis',
    defaultLayout: { w: 8, h: 6, minW: 4, minH: 4 },
  },
  'scatter-chart': {
    type: 'scatter-chart',
    label: 'Dispersao',
    icon: ScatterChart,
    category: 'analysis',
    defaultLayout: { w: 6, h: 5, minW: 4, minH: 3 },
  },
  'treemap-chart': {
    type: 'treemap-chart',
    label: 'Treemap',
    icon: LayoutGrid,
    category: 'distribution',
    defaultLayout: { w: 6, h: 5, minW: 3, minH: 3 },
  },
  'grouped-bar-chart': {
    type: 'grouped-bar-chart',
    label: 'Barras Agrupadas',
    icon: BarChart3,
    category: 'analysis',
    defaultLayout: { w: 6, h: 5, minW: 4, minH: 3 },
  },
  'zone-diagram': {
    type: 'zone-diagram',
    label: 'Diagrama Zonas',
    icon: Grid3X3,
    category: 'analysis',
    defaultLayout: { w: 4, h: 5, minW: 3, minH: 3 },
  },
  'image-gallery': {
    type: 'image-gallery',
    label: 'Galeria Imagens',
    icon: Image,
    category: 'data',
    defaultLayout: { w: 6, h: 5, minW: 3, minH: 3 },
  },
  'stat-list': {
    type: 'stat-list',
    label: 'Lista Estatistica',
    icon: List,
    category: 'data',
    defaultLayout: { w: 4, h: 7, minW: 2, minH: 3 },
  },
};

export const WIDGET_TYPES = Object.keys(WIDGET_REGISTRY) as WidgetType[];

import type { WidgetType } from '@crm-builder/shared';
import type { EntityField } from '@/types';
import { withoutSystemFields } from './system-fields';

type Option = string | { value: string; label: string; color?: string };

/**
 * Configuracao inicial de cada bloco a partir dos campos da tabela: o bloco ja
 * nasce mostrando dados (e a previa do "?" mostra o bloco de verdade).
 */
export function smartWidgetConfig(type: WidgetType, allFields: EntityField[]): Record<string, unknown> {
  const fields = withoutSystemFields(allFields);
  const choice = fields.filter((f) => ['select', 'radio-group'].includes(f.type));
  const colored = choice.filter((f) => ((f.options || []) as Option[]).some((o) => typeof o !== 'string' && !!o.color));
  const status = colored.find((f) => /status|situa|etapa|resultado|estado/i.test(f.slug)) ?? colored[0] ?? choice[0];
  const category = choice.find((f) => f.slug !== status?.slug) ?? status;
  const numbers = fields.filter((f) => ['number', 'currency', 'percentage', 'rating'].includes(f.type));
  const date = fields.find((f) => ['date', 'datetime'].includes(f.type));
  const text = fields.find((f) => f.type === 'text');
  const image = fields.find((f) => f.type === 'image');
  const statusValues = ((status?.options || []) as Option[]).map((o) => (typeof o === 'string' ? o : o.value));
  const simple = fields.filter((f) => !['sub-entity', 'section-title', 'image', 'file', 'signature', 'json', 'map', 'zone-diagram'].includes(f.type));

  switch (type) {
    case 'kpi-card': return { aggregation: 'count' };
    case 'number-card': return numbers[0] ? { aggregation: 'sum', fieldSlug: numbers[0].slug } : { aggregation: 'count' };
    case 'gauge-chart': return { aggregation: 'count', gaugeMin: 0, gaugeMax: 100 };
    case 'area-chart':
    case 'line-chart':
      return { dataSource: 'records-over-time', days: 30, ...(date ? { dateField: date.slug } : {}) };
    case 'bar-chart':
    case 'column-chart':
    case 'pie-chart':
    case 'donut-chart':
    case 'treemap-chart':
      return category ? { dataSource: 'field-distribution', groupByField: category.slug, showLegend: true } : {};
    case 'funnel-chart':
      return status ? { groupByField: status.slug, stages: statusValues } : {};
    case 'stat-list':
      return status ? { groupByField: status.slug, showTotal: true, listStyle: 'colored' } : {};
    case 'stacked-bar-chart':
    case 'grouped-bar-chart':
    case 'heatmap-chart':
      return category && status
        ? { rowField: category.slug, columnField: status.slug, groupByField: category.slug, showLegend: true, showValues: true }
        : {};
    case 'scatter-chart':
      return numbers.length >= 2 ? { rowField: numbers[0].slug, columnField: numbers[1].slug } : {};
    case 'mini-table':
      return { limit: 10, sortBy: 'createdAt', sortOrder: 'desc', displayFields: simple.slice(0, 5).map((f) => f.slug) };
    case 'data-table':
      return {
        displayFields: simple.slice(0, 15).map((f) => f.name),
        showSearch: true, showFilters: true, showExport: true, pageSize: 25,
      };
    case 'kanban-board':
      return status ? { groupByField: status.slug, columnOrder: statusValues, limit: 100, ...(text ? { cardTitleField: text.slug } : {}) } : {};
    case 'filter-slicer':
      return category ? { fieldSlug: category.slug, slicerType: 'tile' } : {};
    case 'image-gallery':
      return image ? { imageField: image.slug, imageFields: [image.slug], limit: 12 } : {};
    case 'activity-feed':
      return { limit: 10 };
    default:
      return {};
  }
}

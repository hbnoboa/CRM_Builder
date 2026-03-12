'use client';

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { useEntityTopRecords, useGroupedData } from '@/hooks/use-dashboard-templates';
import { useDashboardFilters, useWidgetFilters } from './dashboard-filter-context';
import { WidgetWrapper } from './widget-wrapper';
import type { WidgetConfig } from '@crm-builder/shared';

interface MiniTableWidgetProps {
  entitySlug: string;
  config: WidgetConfig['config'];
  title?: string;
  isEditMode?: boolean;
  entityFields?: Array<{ slug: string; name: string; label?: string; type: string }>;
}

export function MiniTableWidget({ entitySlug, config, title, isEditMode, entityFields }: MiniTableWidgetProps) {
  const dashFilters = useWidgetFilters();
  const { crossFilters, toggleCrossFilter, openDrillThrough } = useDashboardFilters();
  const isGrouped = !!config.groupByFields && config.groupByFields.length > 0;
  const [searchTerm, setSearchTerm] = useState('');

  // Normal mode: top records — sem limite
  const topRecords = useEntityTopRecords(!isGrouped ? entitySlug : undefined, {
    limit: 99999,
    sortBy: config.sortBy,
    sortOrder: config.sortOrder,
    fields: config.displayFields,
    ...dashFilters,
  });

  // Grouped mode: aggregated data — sem limite
  const groupedData = useGroupedData(isGrouped ? entitySlug : undefined, config.groupByFields, {
    aggregations: config.aggregations as never,
    crossEntityCount: config.crossEntityCount,
    limit: 99999,
    sortBy: config.sortBy,
    sortOrder: config.sortOrder,
    ...dashFilters,
  });

  const isLoading = isGrouped ? groupedData.isLoading : topRecords.isLoading;
  const error = isGrouped ? groupedData.error : topRecords.error;

  // Build columns
  const computedColumns = config.computedColumns || [];
  let columns: { slug: string; label: string }[];

  if (isGrouped) {
    // Grouped mode: columns from tableColumns config
    // Build alias→label map from aggregations + crossEntityCount
    const aliasLabels = new Map<string, string>();
    for (const agg of config.aggregations || []) {
      // Capitalize alias and replace underscores
      aliasLabels.set(agg.alias, agg.alias.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
    }
    if (config.crossEntityCount) {
      const a = config.crossEntityCount.alias;
      aliasLabels.set(a, a.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
    }

    const tableColumns = config.tableColumns || [...(config.groupByFields || [])];
    columns = tableColumns.map((slug) => {
      const field = entityFields?.find((f) => f.slug === slug);
      return { slug, label: field?.label || field?.name || aliasLabels.get(slug) || slug };
    });
  } else {
    // Normal mode
    const displayFields = config.displayFields || [];
    columns = displayFields.length > 0
      ? displayFields.map((slug) => {
          if (slug.startsWith('parent.')) {
            const name = slug.slice(7);
            return { slug, label: name.charAt(0).toUpperCase() + name.slice(1) };
          }
          const field = entityFields?.find((f) => f.slug === slug);
          return { slug, label: field?.label || field?.name || slug };
        })
      : entityFields?.slice(0, 4).map((f) => ({ slug: f.slug, label: f.label || f.name })) || [];
  }

  const formatCell = (value: unknown): string => {
    if (value == null) return '-';
    if (typeof value === 'object') {
      if (Array.isArray(value)) return value.map((v) => (typeof v === 'object' && v && 'label' in v ? (v as { label: string }).label : String(v))).join(', ');
      if ('label' in (value as Record<string, unknown>)) return String((value as { label: string }).label);
      return JSON.stringify(value);
    }
    if (typeof value === 'boolean') return value ? 'Sim' : 'Nao';
    if (typeof value === 'number') return value.toLocaleString('pt-BR');
    return String(value);
  };

  const computeValue = (record: Record<string, unknown>, col: { type: string; fieldA?: string; fieldB?: string; format?: string }): string => {
    const a = col.fieldA ? record[col.fieldA] : undefined;
    const b = col.fieldB ? record[col.fieldB] : undefined;

    if (col.type === 'duration') {
      const dateA = a ? new Date(String(a)) : null;
      const dateB = b ? new Date(String(b)) : null;
      if (!dateA || !dateB || isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return '-';
      const diffMs = Math.abs(dateA.getTime() - dateB.getTime());
      if (col.format === 'hours') return `${(diffMs / 3600000).toFixed(1)}h`;
      return `${Math.round(diffMs / 86400000)}d`;
    }

    if (col.type === 'percentage') {
      const numA = typeof a === 'number' ? a : parseFloat(String(a));
      const numB = typeof b === 'number' ? b : parseFloat(String(b));
      if (isNaN(numA) || isNaN(numB) || numB === 0) return '-';
      return `${((numA / numB) * 100).toFixed(1)}%`;
    }

    if (col.type === 'difference') {
      const numA = typeof a === 'number' ? a : parseFloat(String(a));
      const numB = typeof b === 'number' ? b : parseFloat(String(b));
      if (isNaN(numA) || isNaN(numB)) return '-';
      return (numA - numB).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    }

    return '-';
  };

  // Normalize rows for rendering
  const allRows: Array<{ id: string; fields: Record<string, unknown> }> = isGrouped
    ? (groupedData.data || []).map((row, i) => ({ id: `group-${i}`, fields: row }))
    : (topRecords.data || []).map((record) => ({ id: record.id, fields: record.data }));

  // Client-side search filter (case insensitive)
  const rows = useMemo(() => {
    if (!searchTerm.trim()) return allRows;
    const term = searchTerm.toLowerCase();
    return allRows.filter((row) => {
      for (const col of columns) {
        const cellText = formatCell(row.fields[col.slug]).toLowerCase();
        if (cellText.includes(term)) return true;
      }
      return false;
    });
  }, [allRows, searchTerm, columns]);

  return (
    <WidgetWrapper
      title={title}
      isEditMode={isEditMode}
      isLoading={isLoading}
      error={error ? 'Erro ao carregar dados' : null}
    >
      <div className="flex flex-col h-full gap-1">
        {/* Search input */}
        <div className="relative flex-shrink-0 px-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-7 pr-2 py-1 text-xs bg-muted/50 border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>

        {/* Table */}
        <div className="overflow-auto flex-1 min-h-0">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background z-10">
              <tr className="border-b">
                {columns.map((col) => (
                  <th key={col.slug} className="text-left px-2 py-1.5 font-medium text-muted-foreground">
                    {col.label}
                  </th>
                ))}
                {computedColumns.map((cc, i) => (
                  <th key={`cc-${i}`} className="text-left px-2 py-1.5 font-medium text-muted-foreground italic">
                    {cc.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b last:border-0 hover:bg-muted/50 cursor-pointer"
                  onDoubleClick={() => {
                    if (!isGrouped && !isEditMode && row.id && !row.id.startsWith('group-')) {
                      openDrillThrough(entitySlug, row.id);
                    }
                  }}
                >
                  {columns.map((col) => {
                    const raw = row.fields[col.slug];
                    const cellValue = typeof raw === 'object' && raw && 'value' in (raw as Record<string, unknown>)
                      ? String((raw as { value: string }).value)
                      : typeof raw === 'string' || typeof raw === 'number' ? String(raw) : null;
                    // In grouped mode, only groupByFields are real entity fields that can be cross-filtered.
                    // Aggregation aliases (total, avariados, etc.) are computed and must NOT create filters.
                    const isFilterable = !isGrouped || (config.groupByFields || []).includes(col.slug);
                    const isActive = isFilterable && crossFilters.some((f) => f.fieldSlug === col.slug && cellValue != null && f.values.includes(cellValue));
                    return (
                      <td
                        key={col.slug}
                        className={`px-2 py-1.5 truncate max-w-[150px] ${isFilterable && cellValue ? 'cursor-pointer hover:underline' : ''} ${isActive ? 'font-bold text-primary' : ''}`}
                        onClick={() => {
                          if (!isEditMode && cellValue && isFilterable) toggleCrossFilter(col.slug, cellValue);
                        }}
                      >
                        {formatCell(raw)}
                      </td>
                    );
                  })}
                  {computedColumns.map((cc, i) => {
                    const computedStr = computeValue(row.fields, cc);
                    const badgeThresholds = (cc as { badgeThresholds?: { value: number; color: string; label?: string }[] }).badgeThresholds;
                    if (badgeThresholds && computedStr !== '-') {
                      const numVal = parseFloat(computedStr);
                      // Find matching threshold (sorted desc: highest first)
                      const sorted = [...badgeThresholds].sort((a, b) => b.value - a.value);
                      const match = sorted.find((t) => numVal >= t.value) || sorted[sorted.length - 1];
                      const badgeColor = match?.color || '#6B7280';
                      return (
                        <td key={`cc-${i}`} className="px-2 py-1.5">
                          <span
                            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold"
                            style={{ backgroundColor: `${badgeColor}22`, color: badgeColor }}
                          >
                            {computedStr}
                          </span>
                        </td>
                      );
                    }
                    return (
                      <td key={`cc-${i}`} className="px-2 py-1.5 truncate max-w-[100px] text-muted-foreground">
                        {computedStr}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length + computedColumns.length} className="text-center py-4 text-muted-foreground">
                    {searchTerm ? 'Nenhum resultado encontrado' : 'Sem dados'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </WidgetWrapper>
  );
}

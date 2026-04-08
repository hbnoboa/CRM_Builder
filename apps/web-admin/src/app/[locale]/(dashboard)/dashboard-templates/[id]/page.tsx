'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Responsive } from 'react-grid-layout/legacy';
import { RequireRole } from '@/components/auth/require-role';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  Settings2,
  Trash2,
  GripVertical,
  Database,
  ChevronDown,
} from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { toast } from 'sonner';
import {
  useDashboardTemplate,
  useUpdateDashboardTemplate,
  useCreateDashboardTemplate,
} from '@/hooks/use-dashboard-templates';
import { useEntities } from '@/hooks/use-entities';
import { useCustomRoles } from '@/hooks/use-custom-roles';
import {
  WIDGET_REGISTRY,
  WIDGET_TYPES,
  WIDGET_CATEGORIES,
  type WidgetCategory,
} from '@/components/dashboard-widgets/widget-registry';
import { DashboardFilterProvider, WidgetProvider } from '@/components/dashboard-widgets/dashboard-filter-context';
import { KpiCardWidget } from '@/components/dashboard-widgets/kpi-card-widget';
import { NumberCardWidget } from '@/components/dashboard-widgets/number-card-widget';
import { AreaChartWidget } from '@/components/dashboard-widgets/area-chart-widget';
import { LineChartWidget } from '@/components/dashboard-widgets/line-chart-widget';
import { BarChartWidget } from '@/components/dashboard-widgets/bar-chart-widget';
import { ColumnChartWidget } from '@/components/dashboard-widgets/column-chart-widget';
import { PieChartWidget } from '@/components/dashboard-widgets/pie-chart-widget';
import { DonutChartWidget } from '@/components/dashboard-widgets/donut-chart-widget';
import { FunnelChartWidget } from '@/components/dashboard-widgets/funnel-chart-widget';
import { GaugeChartWidget } from '@/components/dashboard-widgets/gauge-chart-widget';
import { MiniTableWidget } from '@/components/dashboard-widgets/mini-table-widget';
import { ActivityFeedWidget } from '@/components/dashboard-widgets/activity-feed-widget';
import { FilterSlicerWidget } from '@/components/dashboard-widgets/filter-slicer-widget';
import { StackedBarChartWidget } from '@/components/dashboard-widgets/stacked-bar-chart-widget';
import { HeatmapChartWidget } from '@/components/dashboard-widgets/heatmap-chart-widget';
import { ScatterChartWidget } from '@/components/dashboard-widgets/scatter-chart-widget';
import { TreemapChartWidget } from '@/components/dashboard-widgets/treemap-chart-widget';
import { GroupedBarChartWidget } from '@/components/dashboard-widgets/grouped-bar-chart-widget';
import { ZoneDiagramWidget } from '@/components/dashboard-widgets/zone-diagram-widget';
import { ImageGalleryWidget } from '@/components/dashboard-widgets/image-gallery-widget';
import { StatListWidget } from '@/components/dashboard-widgets/stat-list-widget';
import { DataTableWidget } from '@/components/dashboard-widgets/data-table-widget';
import { KanbanBoardWidget } from '@/components/dashboard-widgets/kanban-board-widget';
import SubEntityListWidget from '@/components/dashboard-widgets/sub-entity-list-widget';
import SubEntityTimelineWidget from '@/components/dashboard-widgets/sub-entity-timeline-widget';
import { WidgetWrapper } from '@/components/dashboard-widgets/widget-wrapper';
import type { WidgetConfig, WidgetType, LayoutItem } from '@crm-builder/shared';
import type { EntityField } from '@/types';
import { cn } from '@/lib/utils';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';

import 'react-grid-layout/css/styles.css';

// Side panels total width: palette w-52 (13rem=208px) + properties w-72 (18rem=288px) = 496px
const SIDE_PANELS_WIDTH = 496;

// ═══════════════════════════════════════════════════════════════════════
// Sortable field list for display field ordering
// ═══════════════════════════════════════════════════════════════════════

function SortableFieldItem({ id, label, onRemove }: { id: string; label: string; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1 text-xs bg-background border rounded px-1.5 py-1">
      <button type="button" className="cursor-grab touch-none text-muted-foreground" {...attributes} {...listeners}>
        <GripVertical className="h-3 w-3" />
      </button>
      <span className="flex-1 truncate">{label}</span>
      <button type="button" className="text-muted-foreground hover:text-destructive" onClick={onRemove}>
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

function SortableFieldList({
  allFields,
  selectedSlugs,
  onChange,
  parentFields,
}: {
  allFields: { slug: string; label?: string; name: string }[];
  selectedSlugs: string[];
  onChange: (slugs: string[]) => void;
  parentFields?: { slug: string; label?: string; name: string }[];
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  const getLabel = (slug: string) => {
    if (slug.startsWith('parent.')) {
      const pSlug = slug.replace('parent.', '');
      const pf = parentFields?.find(f => f.slug === pSlug);
      return pf ? `${pf.label || pf.name} (pai)` : slug;
    }
    const f = allFields.find(f => f.slug === slug);
    return f ? (f.label || f.name) : slug;
  };

  const unselected = allFields.filter(f => !selectedSlugs.includes(f.slug));
  const unselectedParent = parentFields?.filter(f => !selectedSlugs.includes(`parent.${f.slug}`)) || [];

  return (
    <div className="space-y-1.5">
      {/* Selected fields — sortable */}
      {selectedSlugs.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={(event) => {
            const { active, over } = event;
            if (over && active.id !== over.id) {
              const oldIdx = selectedSlugs.indexOf(String(active.id));
              const newIdx = selectedSlugs.indexOf(String(over.id));
              onChange(arrayMove(selectedSlugs, oldIdx, newIdx));
            }
          }}
        >
          <SortableContext items={selectedSlugs} strategy={verticalListSortingStrategy}>
            <div className="space-y-0.5">
              {selectedSlugs.map(slug => (
                <SortableFieldItem
                  key={slug}
                  id={slug}
                  label={getLabel(slug)}
                  onRemove={() => onChange(selectedSlugs.filter(s => s !== slug))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add field buttons */}
      {(unselected.length > 0 || unselectedParent.length > 0) && (
        <div className="border rounded-md p-1.5 max-h-28 overflow-auto space-y-0.5">
          {unselected.map(f => (
            <button
              key={f.slug}
              type="button"
              className="flex items-center gap-1.5 w-full text-xs text-muted-foreground hover:text-foreground px-1 py-0.5 rounded hover:bg-muted/50"
              onClick={() => onChange([...selectedSlugs, f.slug])}
            >
              <Plus className="h-3 w-3" />
              {f.label || f.name}
            </button>
          ))}
          {unselectedParent.length > 0 && (
            <>
              <div className="border-t my-0.5 pt-0.5">
                <span className="text-[10px] font-medium text-muted-foreground uppercase">Registro pai</span>
              </div>
              {unselectedParent.map(f => (
                <button
                  key={`parent.${f.slug}`}
                  type="button"
                  className="flex items-center gap-1.5 w-full text-xs text-muted-foreground hover:text-foreground px-1 py-0.5 rounded hover:bg-muted/50"
                  onClick={() => onChange([...selectedSlugs, `parent.${f.slug}`])}
                >
                  <Plus className="h-3 w-3" />
                  {f.label || f.name}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Helper: normalize entities list from API
// ═══════════════════════════════════════════════════════════════════════

type EntityLike = { id?: string; slug: string; name: string; fields?: EntityField[]; icon?: string | null };

function normalizeEntityList(entities: unknown): EntityLike[] {
  if (!entities) return [];
  if (Array.isArray(entities)) return entities as EntityLike[];
  return ((entities as { data?: unknown[] })?.data || []) as EntityLike[];
}

// ═══════════════════════════════════════════════════════════════════════
// Collapsible Section helper
// ═══════════════════════════════════════════════════════════════════════

function ConfigSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <>
      <Collapsible defaultOpen={defaultOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:bg-accent/50 transition-colors">
          {title}
          <ChevronDown className="h-3 w-3 transition-transform duration-200 [[data-state=closed]>&]:rotate-[-90deg]" />
        </CollapsibleTrigger>
        <CollapsibleContent className="px-3 pb-3 space-y-3">
          {children}
        </CollapsibleContent>
      </Collapsible>
      <Separator />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Reusable Grouped Data Configuration Components
// ═══════════════════════════════════════════════════════════════════════

function GroupByFieldsConfig({ entityFields, selected, onChange }: {
  entityFields: EntityField[];
  selected: string[];
  onChange: (fields: string[]) => void;
}) {
  const groupable = entityFields.filter((f) =>
    !['section-title', 'divider', 'sub-entity', 'file', 'image', 'signature', 'rich-text'].includes(f.type)
  );
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Agrupar por</Label>
      <div className="border rounded-md p-2 max-h-32 overflow-auto space-y-0.5">
        {groupable.map((f) => {
          const isChecked = selected.includes(f.slug);
          return (
            <label key={f.slug} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-accent/50 px-1 py-0.5 rounded">
              <input type="checkbox" checked={isChecked}
                onChange={() => onChange(isChecked ? selected.filter((s) => s !== f.slug) : [...selected, f.slug])} />
              {f.label || f.name}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function AggregationsConfig({ aggregations, entityFields, onChange }: {
  aggregations: Array<{ type: string; fieldSlug?: string; alias: string; distinctFields?: string[] }>;
  entityFields: EntityField[];
  onChange: (aggs: typeof aggregations) => void;
}) {
  const usableFields = entityFields.filter((f) =>
    !['section-title', 'divider', 'sub-entity'].includes(f.type)
  );
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Metricas por grupo</Label>
      {aggregations.map((agg, idx) => (
        <div key={idx} className="border rounded-md p-1.5 space-y-1">
          <div className="flex gap-1 items-center">
            <Select value={agg.type} onValueChange={(v) => {
              const n = [...aggregations]; n[idx] = { ...n[idx], type: v }; onChange(n);
            }}>
              <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="count">Contagem</SelectItem>
                <SelectItem value="sum">Soma</SelectItem>
                <SelectItem value="avg">Media</SelectItem>
                <SelectItem value="min">Minimo</SelectItem>
                <SelectItem value="max">Maximo</SelectItem>
                <SelectItem value="distinctCount">Contagem distinta</SelectItem>
                <SelectItem value="first">Primeiro valor</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0"
              onClick={() => onChange(aggregations.filter((_, i) => i !== idx))}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
          {['sum', 'avg', 'min', 'max', 'first'].includes(agg.type) && (
            <Select value={agg.fieldSlug || ''} onValueChange={(v) => {
              const n = [...aggregations]; n[idx] = { ...n[idx], fieldSlug: v }; onChange(n);
            }}>
              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Campo" /></SelectTrigger>
              <SelectContent>
                {usableFields.map((f) => <SelectItem key={f.slug} value={f.slug}>{f.label || f.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {agg.type === 'distinctCount' && (
            <div className="max-h-20 overflow-auto space-y-0.5 border rounded p-1">
              {usableFields.map((f) => {
                const dfs = agg.distinctFields || [];
                return (
                  <label key={f.slug} className="flex items-center gap-1.5 text-[10px] cursor-pointer px-0.5">
                    <input type="checkbox" checked={dfs.includes(f.slug)}
                      onChange={() => {
                        const n = [...aggregations];
                        n[idx] = { ...n[idx], distinctFields: dfs.includes(f.slug) ? dfs.filter((s) => s !== f.slug) : [...dfs, f.slug] };
                        onChange(n);
                      }} />
                    {f.label || f.name}
                  </label>
                );
              })}
            </div>
          )}
          <Input className="h-7 text-xs" value={agg.alias} placeholder="Alias (ex: total)"
            onChange={(e) => { const n = [...aggregations]; n[idx] = { ...n[idx], alias: e.target.value }; onChange(n); }} />
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-7 text-xs w-full"
        onClick={() => onChange([...aggregations, { type: 'count', alias: '' }])}>
        <Plus className="h-3 w-3 mr-1" /> Metrica
      </Button>
    </div>
  );
}

function CrossEntityCountConfig({ value, allEntities, subEntities, onChange }: {
  value?: { entitySlug: string; matchBy?: string; alias: string };
  allEntities: EntityLike[];
  subEntities: EntityLike[];
  onChange: (v: typeof value | undefined) => void;
}) {
  const enabled = !!value;
  const config = value || { entitySlug: '', matchBy: 'children', alias: '' };
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Switch checked={enabled} onCheckedChange={(v) => {
          onChange(v ? { entitySlug: subEntities[0]?.slug || allEntities[0]?.slug || '', matchBy: 'children', alias: 'count_rel' } : undefined);
        }} />
        <Label className="text-xs">Contagem cruzada</Label>
      </div>
      {enabled && (
        <div className="space-y-1.5 pl-2 border-l-2 border-primary/20">
          <Select value={config.entitySlug} onValueChange={(v) => onChange({ ...config, entitySlug: v })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Entidade" /></SelectTrigger>
            <SelectContent>
              {subEntities.length > 0 && (
                <SelectGroup>
                  <SelectLabel className="text-xs">Sub-entidades</SelectLabel>
                  {subEntities.map((e) => <SelectItem key={e.slug} value={e.slug}>{e.name}</SelectItem>)}
                </SelectGroup>
              )}
              <SelectGroup>
                <SelectLabel className="text-xs">Todas</SelectLabel>
                {allEntities.map((e) => <SelectItem key={e.slug} value={e.slug}>{e.name}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select value={config.matchBy || 'children'} onValueChange={(v) => onChange({ ...config, matchBy: v })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="children">Sub-registros (filhos)</SelectItem>
              <SelectItem value="fields">Campos correspondentes</SelectItem>
            </SelectContent>
          </Select>
          <Input className="h-7 text-xs" value={config.alias} placeholder="Alias (ex: avarias)"
            onChange={(e) => onChange({ ...config, alias: e.target.value })} />
        </div>
      )}
    </div>
  );
}

function GroupedSortConfig({ config, updateField }: {
  config: WidgetConfig['config'];
  updateField: (key: string, value: unknown) => void;
}) {
  const sortOptions: string[] = [];
  for (const f of config.groupByFields || []) sortOptions.push(f);
  for (const a of config.aggregations || []) { if (a.alias) sortOptions.push(a.alias); }
  if (config.crossEntityCount?.alias) sortOptions.push(config.crossEntityCount.alias);

  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs">Ordenar por</Label>
        <Select value={config.sortBy || ''} onValueChange={(v) => updateField('sortBy', v)}>
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt">Data de criacao</SelectItem>
            {sortOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Ordem</Label>
        <Select value={config.sortOrder || 'desc'} onValueChange={(v) => updateField('sortOrder', v)}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Decrescente</SelectItem>
            <SelectItem value="asc">Crescente</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Limite</Label>
        <Input type="number" className="h-8 text-sm" value={config.limit || 10}
          onChange={(e) => updateField('limit', Number(e.target.value))} />
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Properties Panel (right column)
// ═══════════════════════════════════════════════════════════════════════

interface PropertiesPanelProps {
  widgetId: string;
  config: WidgetConfig;
  entityFields: EntityField[];
  parentEntityFields: EntityField[];
  allEntities: EntityLike[];
  subEntities: EntityLike[];
  onUpdate: (config: WidgetConfig) => void;
  onRemove: () => void;
}

function PropertiesPanel({
  widgetId,
  config,
  entityFields,
  parentEntityFields,
  allEntities,
  subEntities,
  onUpdate,
  onRemove,
}: PropertiesPanelProps) {
  const updateField = useCallback((key: string, value: unknown) => {
    onUpdate({
      ...config,
      config: { ...config.config, [key]: value },
    });
  }, [config, onUpdate]);

  const updateTitle = useCallback((title: string) => {
    onUpdate({ ...config, title });
  }, [config, onUpdate]);

  const numericFields = entityFields.filter((f) =>
    ['number', 'currency', 'percentage', 'slider', 'rating', 'timer'].includes(f.type)
  );
  const groupableFields = entityFields.filter((f) =>
    !['section-title', 'divider', 'sub-entity', 'file', 'image', 'signature', 'rich-text'].includes(f.type)
  );
  const allFields = entityFields.filter((f) =>
    !['section-title', 'divider', 'sub-entity'].includes(f.type)
  );

  // Parent entity fields (available when widget uses entitySlugOverride)
  const parentGroupableFields = parentEntityFields.filter((f) =>
    !['section-title', 'divider', 'sub-entity', 'file', 'image', 'signature', 'rich-text'].includes(f.type)
  );
  const parentAllFields = parentEntityFields.filter((f) =>
    !['section-title', 'divider', 'sub-entity'].includes(f.type)
  );
  const hasParentFields = parentAllFields.length > 0;

  const widgetDef = WIDGET_REGISTRY[config.type];

  // Helper: render field options including parent fields in selects
  const renderFieldOptions = (fields: EntityField[], parentFields: EntityField[], showType = true) => (
    <>
      {fields.map((f) => (
        <SelectItem key={f.slug} value={f.slug}>{f.label || f.name}{showType ? ` (${f.type})` : ''}</SelectItem>
      ))}
      {parentFields.length > 0 && (
        <SelectGroup>
          <SelectLabel className="text-[10px]">Registro pai</SelectLabel>
          {parentFields.map((f) => (
            <SelectItem key={`parent.${f.slug}`} value={`parent.${f.slug}`}>{f.label || f.name}{showType ? ` (${f.type})` : ''}</SelectItem>
          ))}
        </SelectGroup>
      )}
    </>
  );

  // ── Render data config based on widget type ──
  function renderDataConfig() {
    if (config.type === 'kpi-card' || config.type === 'number-card' || config.type === 'gauge-chart') {
      const isDistinctMode = config.config.aggregation === 'distinct';
      return (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Modo</Label>
            <Select
              value={isDistinctMode ? '__distinct__' : (config.config.fieldSlug || '__count__')}
              onValueChange={(v) => {
                if (v === '__distinct__') {
                  onUpdate({ ...config, config: { ...config.config, fieldSlug: undefined, aggregation: 'distinct', distinctFields: config.config.distinctFields || [] } });
                } else if (v === '__count__') {
                  onUpdate({ ...config, config: { ...config.config, fieldSlug: undefined, aggregation: undefined, distinctFields: undefined } });
                } else {
                  onUpdate({ ...config, config: { ...config.config, fieldSlug: v, aggregation: config.config.aggregation === 'distinct' ? 'sum' : config.config.aggregation, distinctFields: undefined } });
                }
              }}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__count__">Contagem de registros</SelectItem>
                <SelectItem value="__distinct__">Contagem distinta (campos)</SelectItem>
                {numericFields.map((f) => (
                  <SelectItem key={f.slug} value={f.slug}>{f.label || f.name} ({f.type})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isDistinctMode && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Campos para distinct</Label>
                <p className="text-[10px] text-muted-foreground">Conta combinacoes unicas destes campos</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {groupableFields.map((f) => {
                    const selected = config.config.distinctFields || [];
                    const isChecked = selected.includes(f.slug);
                    return (
                      <label key={f.slug} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-accent/50 px-1 py-0.5 rounded">
                        <input type="checkbox" className="rounded" checked={isChecked}
                          onChange={() => {
                            const newFields = isChecked ? selected.filter((s: string) => s !== f.slug) : [...selected, f.slug];
                            updateField('distinctFields', newFields);
                          }} />
                        {f.label || f.name}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Filtro (para razao distinta)</Label>
                <p className="text-[10px] text-muted-foreground">Filtra o numerador. Ex: concluido = true</p>
                <Select
                  value={config.config.filterField || '__none__'}
                  onValueChange={(v) => updateField('filterField', v === '__none__' ? undefined : v)}
                >
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem filtro</SelectItem>
                    {groupableFields.map((f) => (
                      <SelectItem key={f.slug} value={f.slug}>{f.label || f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {config.config.filterField && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Valor do filtro</Label>
                  <Input className="h-8 text-sm" value={config.config.filterValue || ''}
                    onChange={(e) => updateField('filterValue', e.target.value || undefined)}
                    placeholder="Ex: true, Sim, Ativo" />
                </div>
              )}
            </>
          )}
          {config.config.fieldSlug && !isDistinctMode && (
            <div className="space-y-1.5">
              <Label className="text-xs">Agregacao</Label>
              <Select
                value={config.config.aggregation || 'sum'}
                onValueChange={(v) => updateField('aggregation', v)}
              >
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sum">Soma</SelectItem>
                  <SelectItem value="avg">Media</SelectItem>
                  <SelectItem value="min">Minimo</SelectItem>
                  <SelectItem value="max">Maximo</SelectItem>
                  <SelectItem value="count">Contagem</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {config.type === 'kpi-card' && (
            <>
              <div className="flex items-center gap-2">
                <Switch
                  checked={config.config.showComparison || false}
                  onCheckedChange={(v) => updateField('showComparison', v)}
                />
                <Label className="text-xs">Comparar com periodo anterior</Label>
              </div>
              {config.config.showComparison && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Periodo de comparacao</Label>
                  <Select
                    value={String(config.config.comparisonPeriod || 30)}
                    onValueChange={(v) => updateField('comparisonPeriod', Number(v))}
                  >
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Ultimos 7 dias</SelectItem>
                      <SelectItem value="14">Ultimos 14 dias</SelectItem>
                      <SelectItem value="30">Ultimos 30 dias</SelectItem>
                      <SelectItem value="60">Ultimos 60 dias</SelectItem>
                      <SelectItem value="90">Ultimos 90 dias</SelectItem>
                      <SelectItem value="180">Ultimos 6 meses</SelectItem>
                      <SelectItem value="365">Ultimo ano</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    Compara o periodo selecionado com o periodo anterior equivalente
                  </p>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Limiares de cor</Label>
                <p className="text-[10px] text-muted-foreground">Abaixo = verde, acima de warn = amarelo, acima de danger = vermelho</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Atencao</Label>
                    <Input type="number" className="h-7 text-xs" value={config.config.thresholds?.warn ?? ''}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : undefined;
                        const danger = config.config.thresholds?.danger;
                        if (val == null && danger == null) {
                          updateField('thresholds', undefined);
                        } else {
                          updateField('thresholds', { warn: val ?? 0, danger: danger ?? 0 });
                        }
                      }}
                      placeholder="Ex: 50" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Perigo</Label>
                    <Input type="number" className="h-7 text-xs" value={config.config.thresholds?.danger ?? ''}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : undefined;
                        const warn = config.config.thresholds?.warn;
                        if (val == null && warn == null) {
                          updateField('thresholds', undefined);
                        } else {
                          updateField('thresholds', { warn: warn ?? 0, danger: val ?? 0 });
                        }
                      }}
                      placeholder="Ex: 80" />
                  </div>
                </div>
              </div>
            </>
          )}
          {config.type === 'gauge-chart' && (
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Min</Label>
                <Input type="number" className="h-8 text-sm" value={config.config.gaugeMin ?? 0}
                  onChange={(e) => updateField('gaugeMin', Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max</Label>
                <Input type="number" className="h-8 text-sm" value={config.config.gaugeMax ?? 100}
                  onChange={(e) => updateField('gaugeMax', Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Meta</Label>
                <Input type="number" className="h-8 text-sm" value={config.config.gaugeTarget ?? ''}
                  onChange={(e) => updateField('gaugeTarget', e.target.value ? Number(e.target.value) : undefined)} />
              </div>
            </div>
          )}
        </>
      );
    }

    if (config.type === 'area-chart' || config.type === 'line-chart') {
      const isGroupedRatio = config.config.dataSource === 'grouped-ratio';
      return (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Fonte de dados</Label>
            <Select
              value={config.config.dataSource || 'records-over-time'}
              onValueChange={(v) => {
                if (v === 'grouped-ratio') {
                  onUpdate({ ...config, config: { ...config.config, dataSource: v, groupByFields: config.config.groupByFields || [] } });
                } else {
                  onUpdate({ ...config, config: { ...config.config, dataSource: v, groupByFields: undefined, aggregations: undefined, crossEntityCount: undefined, computedColumns: undefined } });
                }
              }}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="records-over-time">Registros ao longo do tempo</SelectItem>
                <SelectItem value="field-trend">Tendencia de campo</SelectItem>
                {config.type === 'line-chart' && (
                  <SelectItem value="grouped-ratio">% por grupo (agrupado)</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          {config.config.dataSource === 'field-trend' && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Campo</Label>
                <Select
                  value={config.config.fieldSlug || ''}
                  onValueChange={(v) => updateField('fieldSlug', v)}
                >
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {numericFields.map((f) => (
                      <SelectItem key={f.slug} value={f.slug}>{f.label || f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Agregacao</Label>
                <Select
                  value={config.config.aggregation || 'sum'}
                  onValueChange={(v) => updateField('aggregation', v)}
                >
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sum">Soma</SelectItem>
                    <SelectItem value="avg">Media</SelectItem>
                    <SelectItem value="min">Minimo</SelectItem>
                    <SelectItem value="max">Maximo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          {isGroupedRatio && (
            <>
              <GroupByFieldsConfig entityFields={entityFields} selected={config.config.groupByFields || []}
                onChange={(v) => updateField('groupByFields', v)} />
              <AggregationsConfig aggregations={config.config.aggregations || []} entityFields={entityFields}
                onChange={(v) => updateField('aggregations', v)} />
              <CrossEntityCountConfig value={config.config.crossEntityCount} allEntities={allEntities} subEntities={subEntities}
                onChange={(v) => updateField('crossEntityCount', v)} />
              <GroupedSortConfig config={config.config} updateField={updateField} />
              <div className="space-y-1.5">
                <Label className="text-xs">Limiares de severidade</Label>
                <p className="text-[10px] text-muted-foreground">Linhas horizontais coloridas no grafico</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Atencao</Label>
                    <Input type="number" className="h-7 text-xs" value={config.config.thresholds?.warn ?? ''}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : undefined;
                        const danger = config.config.thresholds?.danger;
                        if (val == null && danger == null) updateField('thresholds', undefined);
                        else updateField('thresholds', { warn: val ?? 0, danger: danger ?? 0 });
                      }}
                      placeholder="Ex: 30" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Perigo</Label>
                    <Input type="number" className="h-7 text-xs" value={config.config.thresholds?.danger ?? ''}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : undefined;
                        const warn = config.config.thresholds?.warn;
                        if (val == null && warn == null) updateField('thresholds', undefined);
                        else updateField('thresholds', { warn: warn ?? 0, danger: val ?? 0 });
                      }}
                      placeholder="Ex: 50" />
                  </div>
                </div>
              </div>
            </>
          )}
          {!isGroupedRatio && (
            <div className="space-y-1.5">
              <Label className="text-xs">Periodo (dias)</Label>
              <Input type="number" className="h-8 text-sm" value={config.config.days || 30}
                onChange={(e) => updateField('days', Number(e.target.value))} />
            </div>
          )}
        </>
      );
    }

    if (config.type === 'bar-chart' || config.type === 'column-chart' ||
      config.type === 'pie-chart' || config.type === 'donut-chart') {
      const isDonut = config.type === 'donut-chart';
      const isGroupedDonut = isDonut && !!config.config.groupByFields?.length;

      return (
        <>
          {isDonut && (
            <div className="space-y-1.5">
              <Label className="text-xs">Fonte de dados</Label>
              <Select
                value={isGroupedDonut ? 'grouped' : 'field-distribution'}
                onValueChange={(v) => {
                  if (v === 'grouped') {
                    onUpdate({ ...config, config: { ...config.config, groupByFields: [], dataSource: undefined } });
                  } else {
                    onUpdate({ ...config, config: { ...config.config, groupByFields: undefined, aggregations: undefined, crossEntityCount: undefined } });
                  }
                }}
              >
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="field-distribution">Distribuicao de campo</SelectItem>
                  <SelectItem value="grouped">Dados agrupados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {!isGroupedDonut && (
            <div className="space-y-1.5">
              <Label className="text-xs">Campo (agrupar por)</Label>
              <Select
                value={config.config.groupByField || config.config.fieldSlug || ''}
                onValueChange={(v) => {
                  updateField('groupByField', v);
                  updateField('fieldSlug', v);
                }}
              >
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {renderFieldOptions(groupableFields, parentGroupableFields)}
                </SelectContent>
              </Select>
            </div>
          )}
          {isGroupedDonut && (
            <>
              <GroupByFieldsConfig entityFields={entityFields} selected={config.config.groupByFields || []}
                onChange={(v) => updateField('groupByFields', v)} />
              <AggregationsConfig aggregations={config.config.aggregations || []} entityFields={entityFields}
                onChange={(v) => updateField('aggregations', v)} />
              <CrossEntityCountConfig value={config.config.crossEntityCount} allEntities={allEntities} subEntities={subEntities}
                onChange={(v) => updateField('crossEntityCount', v)} />
              <GroupedSortConfig config={config.config} updateField={updateField} />
            </>
          )}
        </>
      );
    }

    if (config.type === 'pie-chart' || config.type === 'donut-chart') {
      return (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Campo (agrupar por)</Label>
            <Select
              value={config.config.groupByField || config.config.fieldSlug || ''}
              onValueChange={(v) => {
                updateField('groupByField', v);
                updateField('fieldSlug', v);
              }}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {renderFieldOptions(groupableFields, parentGroupableFields)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Limite de segmentos</Label>
            <Input type="number" className="h-8 text-sm" value={config.config.limit || 10}
              onChange={(e) => updateField('limit', Number(e.target.value))}
              placeholder="10" />
            <p className="text-[10px] text-muted-foreground">Quantidade máxima de segmentos no gráfico</p>
          </div>
        </>
      );
    }

    if (config.type === 'funnel-chart' || config.type === 'treemap-chart') {
      return (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Campo (agrupar por)</Label>
            <Select
              value={config.config.groupByField || config.config.fieldSlug || ''}
              onValueChange={(v) => {
                updateField('groupByField', v);
                updateField('fieldSlug', v);
              }}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {renderFieldOptions(groupableFields, parentGroupableFields)}
              </SelectContent>
            </Select>
          </div>
          {config.type === 'funnel-chart' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Etapas do funil (em ordem)</Label>
              <Input className="h-8 text-sm"
                value={(config.config.stages || []).join(', ')}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  updateField('stages', val ? val.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined);
                }}
                placeholder="Ex: Novo, Em Analise, Aprovado, Concluido" />
              <p className="text-[10px] text-muted-foreground">Vazio = ordem natural dos dados</p>
            </div>
          )}
        </>
      );
    }

    if (config.type === 'grouped-bar-chart') {
      return (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Categoria</Label>
            <Select
              value={config.config.groupByField || config.config.rowField || ''}
              onValueChange={(v) => {
                updateField('groupByField', v);
                updateField('rowField', v);
              }}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {groupableFields.map((f) => (
                  <SelectItem key={f.slug} value={f.slug}>{f.label || f.name} ({f.type})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Segmentos</Label>
            <Select
              value={config.config.columnField || ''}
              onValueChange={(v) => updateField('columnField', v)}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {groupableFields.map((f) => (
                  <SelectItem key={f.slug} value={f.slug}>{f.label || f.name} ({f.type})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      );
    }

    if (config.type === 'zone-diagram') {
      const labels = (config.config.zoneLabels || {}) as Record<string, string>;
      const placeholders = [
        ['q1', 'Frente Esq'], ['q2', 'Frente Centro'], ['q3', 'Frente Dir'],
        ['q4', 'Meio Esq'], ['q5', 'Meio Centro'], ['q6', 'Meio Dir'],
        ['q7', 'Tras Esq'], ['q8', 'Tras Centro'], ['q9', 'Tras Dir'],
      ];
      return (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Campo de quadrante</Label>
            <Select
              value={config.config.zoneField || config.config.groupByField || config.config.fieldSlug || ''}
              onValueChange={(v) => {
                updateField('zoneField', v);
                updateField('groupByField', v);
                updateField('fieldSlug', v);
              }}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {groupableFields.map((f) => (
                  <SelectItem key={f.slug} value={f.slug}>{f.label || f.name} ({f.type})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Labels dos quadrantes</Label>
            <div className="grid grid-cols-3 gap-1">
              {placeholders.map(([key, ph]) => (
                <Input key={key} className="h-7 text-[10px] px-1" placeholder={ph}
                  value={labels[key] || ''}
                  onChange={(e) => {
                    const newLabels = { ...labels, [key]: e.target.value || undefined };
                    // Remove empty keys
                    const clean = Object.fromEntries(Object.entries(newLabels).filter(([, v]) => v));
                    updateField('zoneLabels', Object.keys(clean).length > 0 ? clean : undefined);
                  }} />
              ))}
            </div>
          </div>
        </>
      );
    }

    if (config.type === 'image-gallery') {
      const imageTypeFields = entityFields.filter((f) => ['file', 'image', 'video'].includes(f.type));
      const selectedImageFields: string[] = config.config.imageFields || (config.config.imageField ? [config.config.imageField] : []);

      // Resolve child entity fields
      const childEntity = config.config.childEntitySlug
        ? allEntities.find((e) => e.slug === config.config.childEntitySlug)
        : undefined;
      const childImageTypeFields = (childEntity?.fields || []).filter((f: EntityField) =>
        ['file', 'image', 'video'].includes(f.type)
      );

      return (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Campos de imagem</Label>
            <div className="border rounded-md p-2 max-h-32 overflow-auto space-y-0.5">
              {imageTypeFields.map((f) => {
                const isChecked = selectedImageFields.includes(f.slug);
                return (
                  <label key={f.slug} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-accent/50 px-1 py-0.5 rounded">
                    <input type="checkbox" checked={isChecked}
                      onChange={() => {
                        const newFields = isChecked
                          ? selectedImageFields.filter((s) => s !== f.slug)
                          : [...selectedImageFields, f.slug];
                        updateField('imageFields', newFields.length > 0 ? newFields : undefined);
                        updateField('imageField', undefined);
                      }} />
                    {f.label || f.name}
                  </label>
                );
              })}
              {imageTypeFields.length === 0 && (
                <p className="text-[10px] text-muted-foreground">Nenhum campo de imagem nesta entidade</p>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fotos de sub-entidade</Label>
            <Select
              value={config.config.childEntitySlug || '__none__'}
              onValueChange={(v) => {
                updateField('childEntitySlug', v === '__none__' ? undefined : v);
                if (v === '__none__') updateField('childImageFields', undefined);
              }}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Desativado</SelectItem>
                {subEntities.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="text-xs">Sub-entidades</SelectLabel>
                    {subEntities.map((e) => <SelectItem key={e.slug} value={e.slug}>{e.name}</SelectItem>)}
                  </SelectGroup>
                )}
                <SelectGroup>
                  <SelectLabel className="text-xs">Todas</SelectLabel>
                  {allEntities.map((e) => <SelectItem key={e.slug} value={e.slug}>{e.name}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          {childEntity && childImageTypeFields.length > 0 && (
            <div className="space-y-1.5 pl-2 border-l-2 border-primary/20">
              <Label className="text-xs">Campos de imagem ({childEntity.name})</Label>
              <div className="border rounded-md p-2 max-h-24 overflow-auto space-y-0.5">
                {childImageTypeFields.map((f: EntityField) => {
                  const selected = config.config.childImageFields || [];
                  const isChecked = selected.includes(f.slug);
                  return (
                    <label key={f.slug} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-accent/50 px-1 py-0.5 rounded">
                      <input type="checkbox" checked={isChecked}
                        onChange={() => {
                          const newFields = isChecked ? selected.filter((s: string) => s !== f.slug) : [...selected, f.slug];
                          updateField('childImageFields', newFields.length > 0 ? newFields : undefined);
                        }} />
                      {f.label || f.name}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Colunas</Label>
            <Input type="number" className="h-8 text-sm" value={config.config.galleryColumns || 3}
              onChange={(e) => updateField('galleryColumns', Number(e.target.value) || 3)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Limite</Label>
            <Input type="number" className="h-8 text-sm" value={config.config.limit || 12}
              onChange={(e) => updateField('limit', Number(e.target.value))} />
          </div>
        </>
      );
    }

    if (config.type === 'stacked-bar-chart') {
      const isGroupedStacked = !!(config.config.groupByFields && config.config.groupByFields.length > 0);
      return (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Modo</Label>
            <Select
              value={isGroupedStacked ? 'grouped' : 'cross-field'}
              onValueChange={(v) => {
                if (v === 'grouped') {
                  onUpdate({ ...config, config: { ...config.config, groupByFields: [], columnField: undefined, rowField: undefined } });
                } else {
                  onUpdate({ ...config, config: { ...config.config, groupByFields: undefined, aggregations: undefined, crossEntityCount: undefined } });
                }
              }}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cross-field">Cruzamento de campos</SelectItem>
                <SelectItem value="grouped">Dados agrupados</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isGroupedStacked ? (
            <>
              <GroupByFieldsConfig entityFields={effectiveFields} selected={config.config.groupByFields || []} onChange={(f) => updateField('groupByFields', f)} />
              <AggregationsConfig aggregations={config.config.aggregations || []} entityFields={effectiveFields} onChange={(a) => updateField('aggregations', a)} />
              <CrossEntityCountConfig value={config.config.crossEntityCount} allEntities={allEntities} subEntities={subEntities} onChange={(v) => updateField('crossEntityCount', v)} />
              <GroupedSortConfig config={config.config} updateField={updateField} />
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Categoria</Label>
                <Select
                  value={config.config.groupByField || config.config.rowField || ''}
                  onValueChange={(v) => { updateField('groupByField', v); updateField('rowField', v); }}
                >
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {groupableFields.map((f) => (
                      <SelectItem key={f.slug} value={f.slug}>{f.label || f.name} ({f.type})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Segmentos</Label>
                <Select
                  value={config.config.columnField || ''}
                  onValueChange={(v) => updateField('columnField', v)}
                >
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {groupableFields.map((f) => (
                      <SelectItem key={f.slug} value={f.slug}>{f.label || f.name} ({f.type})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </>
      );
    }

    if (config.type === 'heatmap-chart' || config.type === 'scatter-chart') {
      return (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">
              {config.type === 'scatter-chart' ? 'Eixo X' : 'Linhas'}
            </Label>
            <Select
              value={config.config.rowField || ''}
              onValueChange={(v) => updateField('rowField', v)}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {groupableFields.map((f) => (
                  <SelectItem key={f.slug} value={f.slug}>{f.label || f.name} ({f.type})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">
              {config.type === 'scatter-chart' ? 'Eixo Y' : 'Colunas'}
            </Label>
            <Select
              value={config.config.columnField || ''}
              onValueChange={(v) => updateField('columnField', v)}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {groupableFields.map((f) => (
                  <SelectItem key={f.slug} value={f.slug}>{f.label || f.name} ({f.type})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      );
    }

    if (config.type === 'mini-table') {
      const isGroupedTable = !!config.config.groupByFields && config.config.groupByFields.length > 0;
      return (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Modo</Label>
            <Select
              value={isGroupedTable ? 'grouped' : 'records'}
              onValueChange={(v) => {
                if (v === 'grouped') {
                  onUpdate({ ...config, config: { ...config.config, groupByFields: [], displayFields: undefined } });
                } else {
                  onUpdate({ ...config, config: { ...config.config, groupByFields: undefined, aggregations: undefined, crossEntityCount: undefined, tableColumns: undefined } });
                }
              }}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="records">Registros individuais</SelectItem>
                <SelectItem value="grouped">Dados agrupados</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!isGroupedTable && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Campos visiveis (arraste para reordenar)</Label>
                <SortableFieldList
                  allFields={allFields}
                  selectedSlugs={config.config.displayFields || []}
                  onChange={(slugs) => updateField('displayFields', slugs)}
                  parentFields={hasParentFields ? parentAllFields : undefined}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Limite</Label>
                <Input type="number" className="h-8 text-sm" value={config.config.limit || 5}
                  onChange={(e) => updateField('limit', Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ordenar por</Label>
                <Select
                  value={config.config.sortBy || 'createdAt'}
                  onValueChange={(v) => updateField('sortBy', v)}
                >
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="createdAt">Data de criacao</SelectItem>
                    <SelectItem value="updatedAt">Data de atualizacao</SelectItem>
                    {numericFields.map((f) => (
                      <SelectItem key={f.slug} value={f.slug}>{f.label || f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          {isGroupedTable && (
            <>
              <GroupByFieldsConfig entityFields={entityFields} selected={config.config.groupByFields || []}
                onChange={(v) => {
                  updateField('groupByFields', v);
                  // Auto-update tableColumns to include groupBy fields + existing aliases
                  const aliases = (config.config.aggregations || []).map((a: { alias: string }) => a.alias).filter(Boolean);
                  if (config.config.crossEntityCount?.alias) aliases.push(config.config.crossEntityCount.alias);
                  updateField('tableColumns', [...v, ...aliases]);
                }} />
              <AggregationsConfig aggregations={config.config.aggregations || []} entityFields={entityFields}
                onChange={(v) => {
                  updateField('aggregations', v);
                  // Auto-update tableColumns
                  const gf = config.config.groupByFields || [];
                  const aliases = v.map((a) => a.alias).filter(Boolean);
                  if (config.config.crossEntityCount?.alias) aliases.push(config.config.crossEntityCount.alias);
                  updateField('tableColumns', [...gf, ...aliases]);
                }} />
              <CrossEntityCountConfig value={config.config.crossEntityCount} allEntities={allEntities} subEntities={subEntities}
                onChange={(v) => {
                  updateField('crossEntityCount', v);
                  // Auto-update tableColumns
                  const gf = config.config.groupByFields || [];
                  const aliases = (config.config.aggregations || []).map((a: { alias: string }) => a.alias).filter(Boolean);
                  if (v?.alias) aliases.push(v.alias);
                  updateField('tableColumns', [...gf, ...aliases]);
                }} />
              <GroupedSortConfig config={config.config} updateField={updateField} />
            </>
          )}
        </>
      );
    }

    if (config.type === 'data-table') {
      return (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Campos visiveis (arraste para reordenar)</Label>
            <SortableFieldList
              allFields={allFields}
              selectedSlugs={config.config.displayFields || []}
              onChange={(slugs) => updateField('displayFields', slugs)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Switch checked={config.config.enablePagination !== false} onCheckedChange={(v) => updateField('enablePagination', v)} />
              <Label className="text-xs">Paginacao</Label>
            </div>
            {config.config.enablePagination !== false && (
              <div className="space-y-1.5 pl-6">
                <Label className="text-xs">Registros por pagina</Label>
                <Select
                  value={String(config.config.pageSize || 25)}
                  onValueChange={(v) => updateField('pageSize', Number(v))}
                >
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="75">75</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ordenar por</Label>
            <Select
              value={config.config.defaultSortField || 'createdAt'}
              onValueChange={(v) => updateField('defaultSortField', v)}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">Data de criacao</SelectItem>
                <SelectItem value="updatedAt">Data de atualizacao</SelectItem>
                {allFields.map((f) => (
                  <SelectItem key={f.slug} value={f.slug}>{f.label || f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ordem</Label>
            <Select
              value={config.config.defaultSortOrder || 'desc'}
              onValueChange={(v) => updateField('defaultSortOrder', v)}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Crescente</SelectItem>
                <SelectItem value="desc">Decrescente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2">
              <Switch checked={config.config.allowCreate !== false} onCheckedChange={(v) => updateField('allowCreate', v)} />
              <Label className="text-xs">Permitir criar</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={config.config.allowEdit !== false} onCheckedChange={(v) => updateField('allowEdit', v)} />
              <Label className="text-xs">Permitir editar</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={config.config.allowDelete !== false} onCheckedChange={(v) => updateField('allowDelete', v)} />
              <Label className="text-xs">Permitir excluir</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={config.config.allowExport !== false} onCheckedChange={(v) => updateField('allowExport', v)} />
              <Label className="text-xs">Permitir exportar</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={config.config.allowImport !== false} onCheckedChange={(v) => updateField('allowImport', v)} />
              <Label className="text-xs">Permitir importar</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={config.config.allowBatchSelect !== false} onCheckedChange={(v) => updateField('allowBatchSelect', v)} />
              <Label className="text-xs">Selecao em lote</Label>
            </div>
          </div>
          <div className="space-y-2 pt-1">
            <Label className="text-xs font-medium">Colunas extras</Label>
            <div className="flex items-center gap-2">
              <Switch checked={config.config.showCreatedAt !== false} onCheckedChange={(v) => updateField('showCreatedAt', v)} />
              <Label className="text-xs">Data de criacao</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={config.config.showUpdatedAt !== false} onCheckedChange={(v) => updateField('showUpdatedAt', v)} />
              <Label className="text-xs">Data de atualizacao</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={config.config.showGeolocation || false} onCheckedChange={(v) => updateField('showGeolocation', v)} />
              <Label className="text-xs">Geolocalizacao (GPS)</Label>
            </div>
          </div>
        </>
      );
    }

    if (config.type === 'activity-feed') {
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">Limite</Label>
          <Input type="number" className="h-8 text-sm" value={config.config.activityLimit || 10}
            onChange={(e) => updateField('activityLimit', Number(e.target.value))} />
        </div>
      );
    }

    if (config.type === 'kanban-board') {
      const kanbanFields = entityFields.filter((f) =>
        ['select', 'radio', 'checkbox', 'relation'].includes(f.type)
      );

      return (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Campo de agrupamento (colunas)</Label>
            <p className="text-[10px] text-muted-foreground">
              Apenas campos Select, Radio, Checkbox ou Relação
            </p>
            <Select
              value={config.config.groupByField || ''}
              onValueChange={(v) => updateField('groupByField', v)}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {kanbanFields.map((f) => (
                  <SelectItem key={f.slug} value={f.slug}>
                    {f.label || f.name} ({f.type})
                  </SelectItem>
                ))}
                {kanbanFields.length === 0 && (
                  <div className="p-2 text-xs text-muted-foreground">
                    Nenhum campo compatível encontrado
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Campo do título do card</Label>
            <Select
              value={config.config.cardTitleField || ''}
              onValueChange={(v) => updateField('cardTitleField', v)}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {allFields.map((f) => (
                  <SelectItem key={f.slug} value={f.slug}>{f.label || f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Campos dos subtítulos (opcional)</Label>
            <div className="space-y-1 max-h-32 overflow-y-auto border rounded-md p-2">
              {allFields.map((f) => {
                const selected = config.config.cardSubtitleFields || [];
                const isChecked = selected.includes(f.slug);
                return (
                  <label key={f.slug} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-accent/50 px-1 py-0.5 rounded">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={isChecked}
                      onChange={() => {
                        const newFields = isChecked
                          ? selected.filter((s: string) => s !== f.slug)
                          : [...selected, f.slug];
                        updateField('cardSubtitleFields', newFields);
                      }}
                    />
                    {f.label || f.name}
                  </label>
                );
              })}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Campo do badge (opcional)</Label>
            <Select
              value={config.config.cardBadgeField || '__none__'}
              onValueChange={(v) => updateField('cardBadgeField', v === '__none__' ? undefined : v)}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem badge</SelectItem>
                {allFields.map((f) => (
                  <SelectItem key={f.slug} value={f.slug}>{f.label || f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ordenar cards por</Label>
            <Select
              value={config.config.sortBy || '__none__'}
              onValueChange={(v) => updateField('sortBy', v === '__none__' ? undefined : v)}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem ordenação</SelectItem>
                <SelectItem value="createdAt">Data de criação</SelectItem>
                <SelectItem value="updatedAt">Data de atualização</SelectItem>
                {allFields.map((f) => (
                  <SelectItem key={f.slug} value={f.slug}>{f.label || f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {config.config.sortBy && (
            <div className="space-y-1.5">
              <Label className="text-xs">Ordem</Label>
              <Select
                value={config.config.sortOrder || 'desc'}
                onValueChange={(v) => updateField('sortOrder', v)}
              >
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Crescente</SelectItem>
                  <SelectItem value="desc">Decrescente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Limite de cards</Label>
            <Input
              type="number"
              className="h-8 text-sm"
              value={config.config.limit || 100}
              onChange={(e) => updateField('limit', Number(e.target.value))}
            />
          </div>
        </>
      );
    }

    if (config.type === 'stat-list') {
      return (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Campo</Label>
            <Select
              value={config.config.groupByField || config.config.fieldSlug || ''}
              onValueChange={(v) => {
                updateField('groupByField', v);
                updateField('fieldSlug', v);
              }}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {renderFieldOptions(groupableFields, parentGroupableFields, false)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={config.config.showTotal || false}
              onCheckedChange={(v) => updateField('showTotal', v)}
            />
            <Label className="text-xs">Mostrar total destacado</Label>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Estilo</Label>
            <Select
              value={config.config.listStyle || 'simple'}
              onValueChange={(v) => updateField('listStyle', v)}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="simple">Simples</SelectItem>
                <SelectItem value="ranked">Ranking (#1, #2...)</SelectItem>
                <SelectItem value="colored">Colorido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Sufixo do valor</Label>
            <Input className="h-8 text-sm" value={config.config.valueSuffix || ''}
              onChange={(e) => updateField('valueSuffix', e.target.value || undefined)}
              placeholder="Ex: NCs, %" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Limite</Label>
            <Input type="number" className="h-8 text-sm" value={config.config.limit || 10}
              onChange={(e) => updateField('limit', Number(e.target.value))} />
          </div>
        </>
      );
    }

    if (config.type === 'filter-slicer') {
      const RELATIVE_DATE_OPTS = [
        { value: 'Hoje', label: 'Hoje' },
        { value: 'Ontem', label: 'Ontem' },
        { value: 'Ultimos 7 dias', label: 'Ultimos 7 dias' },
        { value: 'Ultimos 30 dias', label: 'Ultimos 30 dias' },
        { value: 'Ultimos 90 dias', label: 'Ultimos 90 dias' },
        { value: 'Este mes', label: 'Este mes' },
        { value: 'Mes passado', label: 'Mes passado' },
        { value: 'Este ano', label: 'Este ano' },
      ];
      return (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Campo</Label>
            <Select
              value={config.config.filterFields?.[0] || config.config.fieldSlug || ''}
              onValueChange={(v) => {
                updateField('filterFields', [v]);
                updateField('fieldSlug', v);
              }}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {allFields.map((f) => (
                  <SelectItem key={f.slug} value={f.slug}>{f.label || f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de slicer</Label>
            <Select
              value={config.config.slicerType || 'dropdown'}
              onValueChange={(v) => updateField('slicerType', v)}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dropdown">Dropdown</SelectItem>
                <SelectItem value="tile">Botoes</SelectItem>
                <SelectItem value="date-range">Intervalo de datas</SelectItem>
                <SelectItem value="numeric-range">Intervalo numerico</SelectItem>
                <SelectItem value="relative-date">Data relativa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {config.config.slicerType === 'relative-date' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Opcoes disponiveis</Label>
              <div className="border rounded-md p-2 max-h-40 overflow-auto space-y-0.5">
                {RELATIVE_DATE_OPTS.map((opt) => {
                  const selected = config.config.relativeDateOptions || [];
                  const isChecked = selected.includes(opt.value);
                  return (
                    <label key={opt.value} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-accent/50 px-1 py-0.5 rounded">
                      <input type="checkbox" checked={isChecked}
                        onChange={() => {
                          const newOpts = isChecked
                            ? selected.filter((s: string) => s !== opt.value)
                            : [...selected, opt.value];
                          updateField('relativeDateOptions', newOpts.length > 0 ? newOpts : undefined);
                        }} />
                      {opt.label}
                    </label>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground">Vazio = todas as opcoes</p>
            </div>
          )}
        </>
      );
    }

    if (config.type === 'sub-entity-list' || config.type === 'sub-entity-timeline') {
      return (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Entidade Principal</Label>
            <Select
              value={config.config.entitySlug || ''}
              onValueChange={(v) => updateField('entitySlug', v)}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {allEntities.map((e) => (
                  <SelectItem key={e.slug} value={e.slug}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Sub-Entidade</Label>
            <Select
              value={config.config.subEntitySlug || ''}
              onValueChange={(v) => {
                updateField('subEntitySlug', v);
                // Auto-set entitySlugOverride para que o WidgetProvider saiba a entidade correta
                updateField('entitySlugOverride', v);
              }}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {subEntities.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="text-xs">Sub-entidades</SelectLabel>
                    {subEntities.map((e) => <SelectItem key={e.slug} value={e.slug}>{e.name}</SelectItem>)}
                  </SelectGroup>
                )}
                <SelectGroup>
                  <SelectLabel className="text-xs">Todas</SelectLabel>
                  {allEntities.map((e) => <SelectItem key={e.slug} value={e.slug}>{e.name}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">Registros a exibir</p>
          </div>
          {config.type === 'sub-entity-list' && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Campos a Exibir</Label>
                <p className="text-[10px] text-muted-foreground">Selecione os campos da sub-entidade</p>
                <Input className="h-8 text-sm"
                  value={(config.config.displayFields || []).join(', ')}
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    updateField('displayFields', val ? val.split(',').map((s: string) => s.trim()).filter(Boolean) : []);
                  }}
                  placeholder="Ex: nome, status, data" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Agrupar Por</Label>
                <Input className="h-8 text-sm" value={config.config.groupBy || ''}
                  onChange={(e) => updateField('groupBy', e.target.value || undefined)}
                  placeholder="Ex: status (opcional)" />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={config.config.showParentInfo || false}
                  onCheckedChange={(v) => updateField('showParentInfo', v)}
                />
                <Label className="text-xs">Mostrar info do pai</Label>
              </div>
            </>
          )}
          {config.type === 'sub-entity-timeline' && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Campo Título</Label>
                <Input className="h-8 text-sm" value={config.config.titleField || ''}
                  onChange={(e) => updateField('titleField', e.target.value || undefined)}
                  placeholder="Campo para título (auto se vazio)" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Campo Descrição</Label>
                <Input className="h-8 text-sm" value={config.config.descriptionField || ''}
                  onChange={(e) => updateField('descriptionField', e.target.value || undefined)}
                  placeholder="Campo para descrição (opcional)" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Campo Status</Label>
                <Input className="h-8 text-sm" value={config.config.statusField || ''}
                  onChange={(e) => updateField('statusField', e.target.value || undefined)}
                  placeholder="Campo de status (cores)" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Campo Data</Label>
                <Input className="h-8 text-sm" value={config.config.dateField || 'createdAt'}
                  onChange={(e) => updateField('dateField', e.target.value || 'createdAt')}
                  placeholder="createdAt" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ordem</Label>
                <Select
                  value={config.config.sortOrder || 'desc'}
                  onValueChange={(v) => updateField('sortOrder', v)}
                >
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Mais recentes primeiro</SelectItem>
                    <SelectItem value="asc">Mais antigos primeiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Limite</Label>
            <Input type="number" className="h-8 text-sm" value={config.config.limit || 10}
              onChange={(e) => updateField('limit', Number(e.target.value))} />
          </div>
        </>
      );
    }

    if (config.type === 'kanban-board') {
      return (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Campo de Agrupamento (Colunas)</Label>
            <Select
              value={config.config.groupByField || ''}
              onValueChange={(v) => updateField('groupByField', v)}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {groupableFields.map((f) => (
                  <SelectItem key={f.slug} value={f.slug}>{f.label || f.name} ({f.type})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">Campo que define as colunas (ex: status)</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Campo Título do Card</Label>
            <Select
              value={config.config.cardTitleField || ''}
              onValueChange={(v) => updateField('cardTitleField', v)}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {allFields.map((f) => (
                  <SelectItem key={f.slug} value={f.slug}>{f.label || f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Campos Subtítulo</Label>
            <Input className="h-8 text-sm"
              value={(config.config.cardSubtitleFields || []).join(', ')}
              onChange={(e) => {
                const val = e.target.value.trim();
                updateField('cardSubtitleFields', val ? val.split(',').map((s: string) => s.trim()).filter(Boolean) : []);
              }}
              placeholder="Ex: cliente, valor, data" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Campo Badge</Label>
            <Select
              value={config.config.cardBadgeField || '__none__'}
              onValueChange={(v) => updateField('cardBadgeField', v === '__none__' ? undefined : v)}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhum</SelectItem>
                {allFields.map((f) => (
                  <SelectItem key={f.slug} value={f.slug}>{f.label || f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ordem das Colunas</Label>
            <Input className="h-8 text-sm"
              value={(config.config.columnOrder || []).join(', ')}
              onChange={(e) => {
                const val = e.target.value.trim();
                updateField('columnOrder', val ? val.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined);
              }}
              placeholder="Ex: Novo, Em Andamento, Concluído" />
            <p className="text-[10px] text-muted-foreground">Vazio = ordem natural dos dados</p>
          </div>
        </>
      );
    }

    return null;
  }

  // ── Render appearance config based on widget type ──
  function renderAppearanceConfig() {
    const items: React.ReactNode[] = [];

    if (config.type === 'area-chart' || config.type === 'line-chart') {
      items.push(
        <div key="color" className="space-y-1.5">
          <Label className="text-xs">Cor</Label>
          <Input type="color" className="h-8 w-16" value={config.config.chartColor || '#3B82F6'}
            onChange={(e) => updateField('chartColor', e.target.value)} />
        </div>
      );
    }

    if (config.type === 'pie-chart' || config.type === 'donut-chart' || config.type === 'stacked-bar-chart' || config.type === 'grouped-bar-chart') {
      items.push(
        <div key="legend" className="flex items-center gap-2">
          <Switch
            checked={config.config.showLegend !== false}
            onCheckedChange={(v) => updateField('showLegend', v)}
          />
          <Label className="text-xs">Mostrar legenda</Label>
        </div>
      );
    }

    if (config.type === 'stacked-bar-chart' || config.type === 'grouped-bar-chart') {
      items.push(
        <div key="orientation" className="space-y-1.5">
          <Label className="text-xs">Orientacao</Label>
          <Select
            value={config.config.orientation || 'vertical'}
            onValueChange={(v) => updateField('orientation', v)}
          >
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="vertical">Vertical</SelectItem>
              <SelectItem value="horizontal">Horizontal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (config.type === 'heatmap-chart') {
      items.push(
        <div key="showValues" className="flex items-center gap-2">
          <Switch
            checked={config.config.showValues !== false}
            onCheckedChange={(v) => updateField('showValues', v)}
          />
          <Label className="text-xs">Mostrar valores</Label>
        </div>
      );
    }

    // Reference lines for charts
    if (['line-chart', 'area-chart', 'bar-chart', 'column-chart', 'grouped-bar-chart'].includes(config.type)) {
      const refs = config.config.referenceLines || [];
      items.push(
        <div key="reflines" className="space-y-1.5">
          <Label className="text-xs">Linhas de referencia</Label>
          {refs.map((ref: { value: number; label?: string; color?: string }, idx: number) => (
            <div key={idx} className="flex gap-1 items-center">
              <Input type="number" className="h-7 text-xs w-16" value={ref.value}
                onChange={(e) => {
                  const newRefs = [...refs];
                  newRefs[idx] = { ...newRefs[idx], value: Number(e.target.value) };
                  updateField('referenceLines', newRefs);
                }} />
              <Input className="h-7 text-xs flex-1" value={ref.label || ''} placeholder="Label"
                onChange={(e) => {
                  const newRefs = [...refs];
                  newRefs[idx] = { ...newRefs[idx], label: e.target.value || undefined };
                  updateField('referenceLines', newRefs);
                }} />
              <Input type="color" className="h-7 w-8 p-0.5" value={ref.color || '#EF4444'}
                onChange={(e) => {
                  const newRefs = [...refs];
                  newRefs[idx] = { ...newRefs[idx], color: e.target.value };
                  updateField('referenceLines', newRefs);
                }} />
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                onClick={() => {
                  const newRefs = refs.filter((_: unknown, i: number) => i !== idx);
                  updateField('referenceLines', newRefs.length > 0 ? newRefs : undefined);
                }}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="h-7 text-xs w-full"
            onClick={() => updateField('referenceLines', [...refs, { value: 0, label: '', color: '#EF4444' }])}>
            <Plus className="h-3 w-3 mr-1" /> Adicionar linha
          </Button>
        </div>
      );
    }

    // KPI ratio mode
    if (config.type === 'kpi-card') {
      items.push(
        <div key="ratio" className="space-y-1.5">
          <Label className="text-xs">Modo ratio (numerador / denominador)</Label>
          <Select
            value={config.config.ratioFieldSlug || '__none__'}
            onValueChange={(v) => {
              if (v === '__none__') {
                onUpdate({ ...config, config: { ...config.config, ratioFieldSlug: undefined, ratioEntitySlug: undefined, ratioMode: undefined } });
              } else {
                onUpdate({ ...config, config: { ...config.config, ratioFieldSlug: v, fieldSlug: config.config.fieldSlug || 'count' } });
              }
            }}
          >
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Desativado</SelectItem>
              <SelectItem value="count">Contagem de registros</SelectItem>
              {numericFields.map((f) => (
                <SelectItem key={f.slug} value={f.slug}>{f.label || f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {config.config.ratioFieldSlug && (
            <>
              {config.config.ratioFieldSlug === 'count' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Entidade do denominador</Label>
                  <Select
                    value={config.config.ratioEntitySlug || '__same__'}
                    onValueChange={(v) => updateField('ratioEntitySlug', v === '__same__' ? undefined : v)}
                  >
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__same__">Mesma entidade</SelectItem>
                      {allEntities.map((e) => (
                        <SelectItem key={e.slug} value={e.slug}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    Ex: NCs / Veiculos = % avaria
                  </p>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Formato</Label>
                <Select
                  value={config.config.ratioMode || 'percentage'}
                  onValueChange={(v) => updateField('ratioMode', v)}
                >
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentual (%)</SelectItem>
                    <SelectItem value="ratio">Ratio (decimal)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!config.config.fieldSlug && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Numerador</Label>
                  <Select
                    value={config.config.fieldSlug || 'count'}
                    onValueChange={(v) => updateField('fieldSlug', v)}
                  >
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="count">Contagem de registros</SelectItem>
                      {numericFields.map((f) => (
                        <SelectItem key={f.slug} value={f.slug}>{f.label || f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
        </div>
      );
    }

    // Mini-table / line-chart computed columns
    if (config.type === 'mini-table' || (config.type === 'line-chart' && config.config.dataSource === 'grouped-ratio')) {
      const computed = config.config.computedColumns || [];
      // Build field options: entity fields + aggregation aliases + crossEntityCount alias
      const isGrouped = !!config.config.groupByFields?.length;
      const aliasOptions: { slug: string; label: string }[] = [];
      if (isGrouped) {
        for (const a of config.config.aggregations || []) {
          if (a.alias) aliasOptions.push({ slug: a.alias, label: `${a.alias} (${a.type})` });
        }
        if (config.config.crossEntityCount?.alias) {
          aliasOptions.push({ slug: config.config.crossEntityCount.alias, label: `${config.config.crossEntityCount.alias} (cruzado)` });
        }
      }
      items.push(
        <div key="computed" className="space-y-1.5">
          <Label className="text-xs">Colunas computadas</Label>
          {computed.map((cc: { label: string; type: string; fieldA?: string; fieldB?: string }, idx: number) => (
            <div key={idx} className="border rounded-md p-2 space-y-1">
              <div className="flex gap-1 items-center">
                <Input className="h-7 text-xs flex-1" value={cc.label} placeholder="Label"
                  onChange={(e) => {
                    const newCc = [...computed];
                    newCc[idx] = { ...newCc[idx], label: e.target.value };
                    updateField('computedColumns', newCc);
                  }} />
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                  onClick={() => {
                    const newCc = computed.filter((_: unknown, i: number) => i !== idx);
                    updateField('computedColumns', newCc.length > 0 ? newCc : undefined);
                  }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <Select value={cc.type || 'percentage'}
                onValueChange={(v) => {
                  const newCc = [...computed];
                  newCc[idx] = { ...newCc[idx], type: v };
                  updateField('computedColumns', newCc);
                }}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentual (A/B)</SelectItem>
                  <SelectItem value="difference">Diferenca (A-B)</SelectItem>
                  <SelectItem value="duration">Duracao (datas)</SelectItem>
                </SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-1">
                <Select value={cc.fieldA || ''} onValueChange={(v) => {
                  const newCc = [...computed];
                  newCc[idx] = { ...newCc[idx], fieldA: v };
                  updateField('computedColumns', newCc);
                }}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Campo A" /></SelectTrigger>
                  <SelectContent>
                    {aliasOptions.length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="text-xs">Metricas</SelectLabel>
                        {aliasOptions.map((a) => <SelectItem key={a.slug} value={a.slug}>{a.label}</SelectItem>)}
                      </SelectGroup>
                    )}
                    <SelectGroup>
                      <SelectLabel className="text-xs">Campos</SelectLabel>
                      {allFields.map((f) => <SelectItem key={f.slug} value={f.slug}>{f.label || f.name}</SelectItem>)}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Select value={cc.fieldB || ''} onValueChange={(v) => {
                  const newCc = [...computed];
                  newCc[idx] = { ...newCc[idx], fieldB: v };
                  updateField('computedColumns', newCc);
                }}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Campo B" /></SelectTrigger>
                  <SelectContent>
                    {aliasOptions.length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="text-xs">Metricas</SelectLabel>
                        {aliasOptions.map((a) => <SelectItem key={a.slug} value={a.slug}>{a.label}</SelectItem>)}
                      </SelectGroup>
                    )}
                    <SelectGroup>
                      <SelectLabel className="text-xs">Campos</SelectLabel>
                      {allFields.map((f) => <SelectItem key={f.slug} value={f.slug}>{f.label || f.name}</SelectItem>)}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              {cc.type === 'percentage' && (() => {
                const badges: Array<{ value: number; color: string; label?: string }> =
                  (cc as { badgeThresholds?: Array<{ value: number; color: string; label?: string }> }).badgeThresholds || [];
                return (
                  <div className="space-y-1 border-t pt-1 mt-1">
                    <Label className="text-[10px]">Badges de cor</Label>
                    {badges.map((bt, btIdx) => (
                      <div key={btIdx} className="flex gap-1 items-center">
                        <Input type="number" className="h-6 text-[10px] w-12" value={bt.value}
                          onChange={(e) => {
                            const newBadges = [...badges];
                            newBadges[btIdx] = { ...newBadges[btIdx], value: Number(e.target.value) };
                            const newCc = [...computed];
                            newCc[idx] = { ...newCc[idx], badgeThresholds: newBadges };
                            updateField('computedColumns', newCc);
                          }} />
                        <Input type="color" className="h-6 w-7 p-0.5" value={bt.color}
                          onChange={(e) => {
                            const newBadges = [...badges];
                            newBadges[btIdx] = { ...newBadges[btIdx], color: e.target.value };
                            const newCc = [...computed];
                            newCc[idx] = { ...newCc[idx], badgeThresholds: newBadges };
                            updateField('computedColumns', newCc);
                          }} />
                        <Input className="h-6 text-[10px] flex-1" value={bt.label || ''} placeholder="Label"
                          onChange={(e) => {
                            const newBadges = [...badges];
                            newBadges[btIdx] = { ...newBadges[btIdx], label: e.target.value || undefined };
                            const newCc = [...computed];
                            newCc[idx] = { ...newCc[idx], badgeThresholds: newBadges };
                            updateField('computedColumns', newCc);
                          }} />
                        <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0"
                          onClick={() => {
                            const newBadges = badges.filter((_: unknown, i: number) => i !== btIdx);
                            const newCc = [...computed];
                            newCc[idx] = { ...newCc[idx], badgeThresholds: newBadges.length > 0 ? newBadges : undefined };
                            updateField('computedColumns', newCc);
                          }}>
                          <Trash2 className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="h-6 text-[10px] w-full"
                      onClick={() => {
                        const newCc = [...computed];
                        newCc[idx] = { ...newCc[idx], badgeThresholds: [...badges, { value: 0, color: '#10B981' }] };
                        updateField('computedColumns', newCc);
                      }}>
                      <Plus className="h-2.5 w-2.5 mr-0.5" /> Threshold
                    </Button>
                  </div>
                );
              })()}
            </div>
          ))}
          <Button variant="outline" size="sm" className="h-7 text-xs w-full"
            onClick={() => updateField('computedColumns', [...computed, { label: '', type: 'percentage', fieldA: '', fieldB: '' }])}>
            <Plus className="h-3 w-3 mr-1" /> Adicionar coluna
          </Button>
        </div>
      );
    }

    // Chart colors palette for multi-color types
    if (['pie-chart', 'donut-chart', 'bar-chart', 'column-chart', 'stacked-bar-chart', 'grouped-bar-chart', 'stat-list', 'funnel-chart', 'treemap-chart'].includes(config.type)) {
      const colors: string[] = config.config.chartColors || [];
      items.push(
        <div key="chartColors" className="space-y-1.5">
          <Label className="text-xs">Paleta de cores</Label>
          <p className="text-[10px] text-muted-foreground">Vazio = paleta padrao</p>
          <div className="flex flex-wrap gap-1">
            {colors.map((c: string, idx: number) => (
              <div key={idx} className="flex items-center gap-0.5">
                <Input type="color" className="h-7 w-8 p-0.5" value={c}
                  onChange={(e) => {
                    const newColors = [...colors];
                    newColors[idx] = e.target.value;
                    updateField('chartColors', newColors);
                  }} />
                <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0"
                  onClick={() => {
                    const newColors = colors.filter((_: string, i: number) => i !== idx);
                    updateField('chartColors', newColors.length > 0 ? newColors : undefined);
                  }}>
                  <Trash2 className="h-2.5 w-2.5" />
                </Button>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs"
            onClick={() => updateField('chartColors', [...colors, '#3B82F6'])}>
            <Plus className="h-3 w-3 mr-1" /> Cor
          </Button>
        </div>
      );
    }

    // Bar/Column show ratio labels
    if (config.type === 'bar-chart' || config.type === 'column-chart') {
      items.push(
        <div key="showRatio" className="flex items-center gap-2">
          <Switch
            checked={config.config.showRatio || false}
            onCheckedChange={(v) => updateField('showRatio', v)}
          />
          <Label className="text-xs">Mostrar ratio (X/total)</Label>
        </div>
      );
    }

    // Heatmap color scale
    if (config.type === 'heatmap-chart') {
      const scale: string[] = config.config.colorScale || ['#f0f0f0', '#3B82F6'];
      items.push(
        <div key="colorScale" className="space-y-1.5">
          <Label className="text-xs">Escala de cores</Label>
          <div className="flex gap-2 items-center">
            <div className="space-y-0.5">
              <span className="text-[10px] text-muted-foreground">Min</span>
              <Input type="color" className="h-8 w-12 p-0.5" value={scale[0] || '#f0f0f0'}
                onChange={(e) => updateField('colorScale', [e.target.value, scale[1] || '#3B82F6'])} />
            </div>
            <div className="flex-1 h-4 rounded" style={{ background: `linear-gradient(to right, ${scale[0] || '#f0f0f0'}, ${scale[1] || '#3B82F6'})` }} />
            <div className="space-y-0.5">
              <span className="text-[10px] text-muted-foreground">Max</span>
              <Input type="color" className="h-8 w-12 p-0.5" value={scale[1] || '#3B82F6'}
                onChange={(e) => updateField('colorScale', [scale[0] || '#f0f0f0', e.target.value])} />
            </div>
          </div>
        </div>
      );
    }

    // Zone diagram color field
    if (config.type === 'zone-diagram') {
      items.push(
        <div key="zoneColorField" className="space-y-1.5">
          <Label className="text-xs">Campo para cor dinamica</Label>
          <Select
            value={config.config.zoneColorField || '__none__'}
            onValueChange={(v) => updateField('zoneColorField', v === '__none__' ? undefined : v)}
          >
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Padrao</SelectItem>
              {groupableFields.map((f) => (
                <SelectItem key={f.slug} value={f.slug}>{f.label || f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    return items.length > 0 ? items : null;
  }

  const appearanceContent = renderAppearanceConfig();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-2.5 flex items-center justify-between border-b">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {widgetDef && <widgetDef.icon className="h-4 w-4 text-muted-foreground shrink-0" />}
            <span className="text-xs font-medium uppercase tracking-wider truncate">
              {widgetDef?.label || 'Widget'}
            </span>
          </div>
          <Badge variant="outline" className="text-[9px] font-mono w-fit px-1.5 py-0 h-4">
            {config.type}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {/* Geral */}
        <ConfigSection title="Geral">
          <div className="space-y-1.5">
            <Label className="text-xs">Titulo</Label>
            <Input
              value={config.title || ''}
              onChange={(e) => updateTitle(e.target.value)}
              placeholder="Titulo do widget"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <Database className="h-3 w-3" />
              Entidade
            </Label>
            <Select
              value={config.config.entitySlugOverride || '__parent__'}
              onValueChange={(v) => updateField('entitySlugOverride', v === '__parent__' ? undefined : v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__parent__">Entidade do template</SelectItem>
                <SelectGroup>
                  <SelectLabel className="text-xs">Entidades</SelectLabel>
                  {allEntities.map((e) => (
                    <SelectItem key={e.slug} value={e.slug}>{e.name}</SelectItem>
                  ))}
                </SelectGroup>
                {subEntities.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="text-xs">Sub-entidades</SelectLabel>
                    {subEntities.map((se) => (
                      <SelectItem key={se.slug} value={se.slug}>
                        {se.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
            {config.config.entitySlugOverride && (
              <Badge variant="outline" className="text-[10px]">
                {config.config.entitySlugOverride}
              </Badge>
            )}
          </div>
        </ConfigSection>

        {/* Dados */}
        <ConfigSection title="Dados">
          {renderDataConfig()}
        </ConfigSection>

        {/* Aparencia (only if there's content) */}
        {appearanceContent && (
          <ConfigSection title="Aparencia" defaultOpen={false}>
            {appearanceContent}
          </ConfigSection>
        )}
      </ScrollArea>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Widget Render Helper - always renders live data when entity is selected
// ═══════════════════════════════════════════════════════════════════════

function renderLiveWidget(
  widgetConfig: WidgetConfig,
  entitySlug: string | undefined,
  entityFields: EntityField[],
  allEntities?: EntityLike[],
) {
  const effectiveSlug = widgetConfig.config.entitySlugOverride || entitySlug;

  if (!effectiveSlug) {
    const def = WIDGET_REGISTRY[widgetConfig.type];
    return (
      <WidgetWrapper title={widgetConfig.title || def?.label}>
        <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
          Selecione uma entidade
        </div>
      </WidgetWrapper>
    );
  }

  // Resolve entity fields for override entities
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
    case 'kpi-card': return <KpiCardWidget {...commonProps} />;
    case 'number-card': return <NumberCardWidget {...commonProps} />;
    case 'area-chart': return <AreaChartWidget {...commonProps} />;
    case 'line-chart': return <LineChartWidget {...commonProps} />;
    case 'bar-chart': return <BarChartWidget {...commonProps} />;
    case 'column-chart': return <ColumnChartWidget {...commonProps} />;
    case 'pie-chart': return <PieChartWidget {...commonProps} />;
    case 'donut-chart': return <DonutChartWidget {...commonProps} />;
    case 'funnel-chart': return <FunnelChartWidget {...commonProps} />;
    case 'gauge-chart': return <GaugeChartWidget {...commonProps} />;
    case 'mini-table': return <MiniTableWidget {...commonProps} entityFields={effectiveFields} />;
    case 'activity-feed': return <ActivityFeedWidget {...commonProps} />;
    case 'filter-slicer': return <FilterSlicerWidget {...commonProps} />;
    case 'stacked-bar-chart': return <StackedBarChartWidget {...commonProps} />;
    case 'heatmap-chart': return <HeatmapChartWidget {...commonProps} />;
    case 'scatter-chart': return <ScatterChartWidget {...commonProps} />;
    case 'treemap-chart': return <TreemapChartWidget {...commonProps} />;
    case 'grouped-bar-chart': return <GroupedBarChartWidget {...commonProps} />;
    case 'zone-diagram': return <ZoneDiagramWidget {...commonProps} />;
    case 'image-gallery': return <ImageGalleryWidget {...commonProps} />;
    case 'stat-list': return <StatListWidget {...commonProps} />;
    case 'data-table': return <DataTableWidget {...commonProps} />;
    case 'kanban-board': return <KanbanBoardWidget {...commonProps} />;
    case 'sub-entity-list': return <SubEntityListWidget config={widgetConfig.config} />;
    case 'sub-entity-timeline': return <SubEntityTimelineWidget config={widgetConfig.config} />;
    default: return <WidgetWrapper title={widgetConfig.title}><div /></WidgetWrapper>;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Main Builder
// ═══════════════════════════════════════════════════════════════════════

function TemplateBuilderContent() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.id as string;
  const isCreateMode = templateId === 'new';

  const { data: template, isLoading } = useDashboardTemplate(isCreateMode ? undefined : templateId);
  const updateTemplate = useUpdateDashboardTemplate();
  const createTemplate = useCreateDashboardTemplate();
  // Filter entities by template's tenant to avoid showing entities from other tenants
  const { data: entities } = useEntities({ tenantId: template?.tenantId });
  const { data: roles } = useCustomRoles();

  const [layout, setLayout] = useState<LayoutItem[]>([]);
  const [widgets, setWidgets] = useState<Record<string, WidgetConfig>>({});
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [entitySlug, setEntitySlug] = useState('');
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [priority, setPriority] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [tabs, setTabs] = useState<{ id: string; label: string; icon?: string; widgetIds: string[] }[]>([]);
  const [activeEditorTabId, setActiveEditorTabId] = useState<string | null>(null);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(isCreateMode);
  const [initialized, setInitialized] = useState(isCreateMode);
  const [mounted, setMounted] = useState(false);
  const isDraggingRef = useRef(false);
  const draggingWidgetIdRef = useRef<string | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverTabIdRef = useRef<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const activeEditorTabIdRef = useRef<string | null>(null);
  const dragMoveCleanupRef = useRef<(() => void) | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(0);

  useEffect(() => { activeEditorTabIdRef.current = activeEditorTabId; }, [activeEditorTabId]);
  useEffect(() => { setMounted(true); }, []);

  // Measure canvas container width for WYSIWYG scaling
  // Deps: [initialized] — re-run when canvas div appears after loading
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      if (w > 0) setCanvasWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [initialized]);

  // The real dashboard (in /data) has no side panels, so it gets
  // the extra ~496px of width. We render the grid at that real width
  // and scale it down to fit the canvas area — true WYSIWYG.
  const realGridWidth = canvasWidth + SIDE_PANELS_WIDTH;
  const scaleFactor = canvasWidth > 0 ? canvasWidth / realGridWidth : 1;

  // Initialize from loaded template (edit mode only)
  if (!isCreateMode && template && !initialized) {
    setLayout(template.layout || []);
    setWidgets(template.widgets || {});
    setName(template.name || '');
    setDescription(template.description || '');
    setEntitySlug(template.entitySlug || '');
    setRoleIds(template.roleIds || []);
    setPriority(template.priority || 0);
    setIsActive(template.isActive !== false);
    const loadedTabs = (template as { tabs?: typeof tabs }).tabs || [];
    setTabs(loadedTabs);
    if (loadedTabs.length > 0) setActiveEditorTabId(loadedTabs[0].id);
    setInitialized(true);
  }

  // Normalized entity list
  const allEntityList = useMemo(() => normalizeEntityList(entities), [entities]);

  const selectedEntity = useMemo(() => {
    if (!entitySlug) return null;
    return allEntityList.find((e) => e.slug === entitySlug) || null;
  }, [entitySlug, allEntityList]);

  const entityFields = useMemo(() => {
    return (selectedEntity?.fields || []) as EntityField[];
  }, [selectedEntity]);

  // Sub-entities: entities referenced by sub-entity fields in the selected entity
  const subEntities = useMemo(() => {
    if (!selectedEntity?.fields) return [];
    const fields = selectedEntity.fields as EntityField[];
    const subSlugs = fields
      .filter((f) => f.type === 'sub-entity' && (f as EntityField & { subEntitySlug?: string }).subEntitySlug)
      .map((f) => (f as EntityField & { subEntitySlug?: string }).subEntitySlug!);
    if (subSlugs.length === 0) return [];
    return allEntityList.filter((e) => subSlugs.includes(e.slug));
  }, [selectedEntity, allEntityList]);

  // Fields for the currently selected widget (respects entitySlugOverride)
  const effectiveWidgetFields = useMemo(() => {
    if (!selectedWidgetId || !widgets[selectedWidgetId]) return entityFields;
    const override = widgets[selectedWidgetId].config.entitySlugOverride;
    if (!override) return entityFields;
    const overrideEntity = allEntityList.find((e) => e.slug === override);
    return (overrideEntity?.fields || []) as EntityField[];
  }, [selectedWidgetId, widgets, entityFields, allEntityList]);

  const handleAddWidget = useCallback((type: WidgetType) => {
    const def = WIDGET_REGISTRY[type];
    const id = `widget-${Date.now()}`;

    // Calculate maxY only for the active tab's visible widgets
    const activeTab = activeEditorTabId ? tabs.find((t) => t.id === activeEditorTabId) : null;
    const visibleIds = activeTab ? new Set(activeTab.widgetIds) : null;
    const maxY = layout
      .filter((item) => !visibleIds || visibleIds.has(item.i))
      .reduce((max, item) => Math.max(max, item.y + item.h), 0);

    setLayout((prev) => [
      ...prev,
      {
        i: id,
        x: 0,
        y: maxY,
        w: def.defaultLayout.w,
        h: def.defaultLayout.h,
        minW: def.defaultLayout.minW,
        minH: def.defaultLayout.minH,
      },
    ]);

    // Auto-populate config based on widget type
    let defaultConfig: Record<string, unknown> = {};
    if (type === 'data-table' && entityFields.length > 0) {
      // Auto-populate displayFields with entity fields (limit to first 15)
      defaultConfig = {
        displayFields: entityFields.slice(0, 15).map(f => f.name),
        showSearch: true,
        showFilters: true,
        showExport: true,
        pageSize: 25,
      };
    }

    setWidgets((prev) => ({
      ...prev,
      [id]: {
        type,
        title: def.label,
        config: defaultConfig,
      },
    }));

    // Auto-assign to active tab
    if (activeEditorTabId) {
      setTabs((prev) => prev.map((t) =>
        t.id === activeEditorTabId
          ? { ...t, widgetIds: [...t.widgetIds, id] }
          : t
      ));
    }

    setSelectedWidgetId(id);
  }, [layout, activeEditorTabId, tabs, entityFields]);

  const handleRemoveWidget = useCallback((widgetId: string) => {
    setLayout((prev) => prev.filter((item) => item.i !== widgetId));
    setWidgets((prev) => {
      const next = { ...prev };
      delete next[widgetId];
      return next;
    });
    setTabs((prev) => prev.map((t) => ({
      ...t,
      widgetIds: t.widgetIds.filter((id) => id !== widgetId),
    })));
    if (selectedWidgetId === widgetId) setSelectedWidgetId(null);
  }, [selectedWidgetId]);

  const handleUpdateWidgetConfig = useCallback((widgetId: string, config: WidgetConfig) => {
    setWidgets((prev) => ({ ...prev, [widgetId]: config }));
  }, []);

  const handleLayoutChange = useCallback((_currentLayout: LayoutItem[], allLayouts: Record<string, LayoutItem[]>) => {
    const lgLayout = allLayouts.lg;
    if (!lgLayout) return;

    const updatedItems = lgLayout.map((item) => ({
      i: item.i,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      minW: item.minW,
      minH: item.minH,
    }));

    setLayout((prev) => {
      // If no tab filtering active, replace entirely
      if (!activeEditorTabId) return updatedItems;

      // Merge: keep items from other tabs, update items from active tab
      const activeTab = tabs.find((t) => t.id === activeEditorTabId);
      if (!activeTab) return updatedItems;

      const activeWidgetIds = new Set(activeTab.widgetIds);
      const otherItems = prev.filter((item) => !activeWidgetIds.has(item.i));
      return [...otherItems, ...updatedItems];
    });
  }, [activeEditorTabId, tabs]);

  const isSaving = updateTemplate.isPending || createTemplate.isPending;

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Informe o nome do template');
      return;
    }
    try {
      const payload = {
        name: name.trim(),
        description: description || undefined,
        entitySlug: entitySlug || undefined,
        layout,
        widgets,
        roleIds,
        priority,
        isActive,
        tabs: tabs.length > 0 ? tabs : undefined,
      };
      if (isCreateMode) {
        const result = await createTemplate.mutateAsync(payload);
        if (result?.id) {
          router.replace(`/dashboard-templates/${result.id}`);
        }
      } else {
        await updateTemplate.mutateAsync({ id: templateId, data: payload });
      }
    } catch {
      // Error handled by mutation
    }
  };

  const handleToggleRole = (roleId: string) => {
    setRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId]
    );
  };

  if ((!isCreateMode && isLoading) || !initialized) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <DashboardFilterProvider mainEntitySlug={entitySlug}>
      <div className="flex flex-col h-[calc(100vh-100px)]">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 flex-wrap px-1 pb-3 border-b">
          <div className="flex items-center gap-3">
            <Link href="/dashboard-templates">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 text-sm font-medium w-48"
              placeholder="Nome do template"
            />
            <Select value={entitySlug || '__global__'} onValueChange={(v) => setEntitySlug(v === '__global__' ? '' : v)}>
              <SelectTrigger className="h-8 text-sm w-48">
                <SelectValue placeholder="Selecione a entidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__global__">Global</SelectItem>
                {allEntityList.map((e) => (
                  <SelectItem key={e.slug} value={e.slug}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="h-4 w-4 mr-1" />
              Config
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Salvar
            </Button>
          </div>
        </div>

        {/* 3-column layout */}
        <div className="flex flex-1 min-h-0">
          {/* ── Left: Widget Palette ── */}
          <div className="w-52 border-r bg-card flex-shrink-0 overflow-y-auto">
            <div className="px-3 py-2.5 border-b">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Widgets
              </span>
            </div>
            {(Object.entries(WIDGET_CATEGORIES) as [WidgetCategory, string][]).map(([catKey, catLabel]) => {
              const catWidgets = WIDGET_TYPES.filter((t) => WIDGET_REGISTRY[t].category === catKey);
              if (catWidgets.length === 0) return null;
              return (
                <Collapsible key={catKey} defaultOpen>
                  <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent/50 transition-colors">
                    {catLabel}
                    <ChevronDown className="h-3 w-3 transition-transform duration-200 [[data-state=closed]>&]:rotate-[-90deg]" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-1 pb-1 space-y-0.5">
                      {catWidgets.map((type) => {
                        const def = WIDGET_REGISTRY[type];
                        const Icon = def.icon;
                        return (
                          <button
                            key={type}
                            className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs hover:bg-accent transition-colors text-left"
                            onClick={() => handleAddWidget(type)}
                          >
                            <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            {def.label}
                          </button>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>

          {/* ── Center: Canvas (WYSIWYG scaled) ── */}
          <div
            ref={canvasRef}
            className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-muted/30 flex flex-col"
            onClick={() => setSelectedWidgetId(null)}
          >
            {/* Tab bar for canvas preview */}
            {tabs.length > 0 && (
              <div className="flex gap-0.5 px-2 pt-2 border-b bg-background/50 shrink-0">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    data-tab-id={tab.id}
                    onClick={() => setActiveEditorTabId(tab.id)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium border-b-2 transition-colors',
                      activeEditorTabId === tab.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                      dragOverTabId === tab.id && 'bg-primary/10 border-primary/50 text-primary',
                    )}
                  >
                    {tab.label}
                    {dragOverTabId === tab.id && (
                      <span className="ml-1 text-[10px] opacity-60">&#x2190;</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {(() => {
              // Filter layout by active editor tab
              const activeEditorTab = activeEditorTabId ? tabs.find((t) => t.id === activeEditorTabId) : null;
              const visibleLayout = activeEditorTab
                ? layout.filter((item) => activeEditorTab.widgetIds.includes(item.i))
                : layout;

              if (visibleLayout.length === 0 && layout.length === 0) return (
                <div className="flex flex-col items-center justify-center flex-1 text-center">
                  <Plus className="h-8 w-8 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {!entitySlug
                      ? 'Selecione uma entidade na toolbar acima e adicione widgets'
                      : 'Clique em um widget na paleta para adicionar'}
                  </p>
                </div>
              );
              if (visibleLayout.length === 0 && activeEditorTab) return (
                <div className="flex flex-col items-center justify-center flex-1 text-center">
                  <p className="text-sm text-muted-foreground">
                    Nenhum widget nesta aba. Adicione da paleta ou arraste de outra aba.
                  </p>
                </div>
              );
              if (!mounted || canvasWidth === 0) return (
                <div className="flex items-center justify-center flex-1">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              );
              return (
              <div
                style={{
                  transform: `scale(${scaleFactor})`,
                  transformOrigin: 'top left',
                  width: `${100 / scaleFactor}%`,
                }}
              >
                <Responsive
                  key={activeEditorTabId || '__all__'}
                  className="layout"
                  width={realGridWidth}
                  layouts={{ lg: visibleLayout }}
                  breakpoints={{ lg: 1200, md: 996, sm: 768 }}
                  cols={{ lg: 12, md: 10, sm: 6 }}
                  rowHeight={30}
                  margin={[12, 12]}
                  isDraggable
                  isResizable
                  compactType="vertical"
                  onLayoutChange={handleLayoutChange}
                  onDragStart={(_layout: LayoutItem[], oldItem: LayoutItem) => {
                    isDraggingRef.current = true;
                    draggingWidgetIdRef.current = oldItem.i;

                    // Register mousemove for hover-to-switch tabs
                    const handleMouseMove = (ev: MouseEvent) => {
                      const target = document.elementFromPoint(ev.clientX, ev.clientY);
                      const tabBtn = target?.closest('[data-tab-id]') as HTMLElement | null;
                      const hoveredTabId = tabBtn?.getAttribute('data-tab-id') || null;

                      if (hoveredTabId && hoveredTabId !== activeEditorTabIdRef.current) {
                        // Hovering over a different tab
                        if (hoverTabIdRef.current !== hoveredTabId) {
                          // New tab — reset timer
                          if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
                          hoverTabIdRef.current = hoveredTabId;
                          setDragOverTabId(hoveredTabId);
                          hoverTimerRef.current = setTimeout(() => {
                            const draggedId = draggingWidgetIdRef.current;
                            if (draggedId && hoveredTabId) {
                              // Move widget from current tab to hovered tab
                              setTabs((prev) => prev.map((t) => {
                                const without = t.widgetIds.filter((id) => id !== draggedId);
                                if (t.id === hoveredTabId) return { ...t, widgetIds: [...without, draggedId] };
                                return { ...t, widgetIds: without };
                              }));
                              setActiveEditorTabId(hoveredTabId);
                            }
                            hoverTabIdRef.current = null;
                            setDragOverTabId(null);
                          }, 1000);
                        }
                      } else {
                        // Not hovering a different tab — clear
                        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
                        hoverTabIdRef.current = null;
                        setDragOverTabId(null);
                      }
                    };

                    window.addEventListener('mousemove', handleMouseMove);
                    dragMoveCleanupRef.current = () => window.removeEventListener('mousemove', handleMouseMove);
                  }}
                  onDragStop={() => {
                    setTimeout(() => { isDraggingRef.current = false; }, 100);
                    draggingWidgetIdRef.current = null;
                    if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
                    hoverTabIdRef.current = null;
                    setDragOverTabId(null);
                    if (dragMoveCleanupRef.current) { dragMoveCleanupRef.current(); dragMoveCleanupRef.current = null; }
                  }}
                  onResizeStart={() => { isDraggingRef.current = true; }}
                  onResizeStop={() => { setTimeout(() => { isDraggingRef.current = false; }, 100); }}
                  containerPadding={[0, 0]}
                  draggableHandle=".drag-handle"
                >
                  {visibleLayout.map((item) => {
                    const widgetConfig = widgets[item.i];
                    if (!widgetConfig) return <div key={item.i} />;

                    return (
                      <div
                        key={item.i}
                        className={cn(
                          'relative group',
                          selectedWidgetId === item.i && 'ring-2 ring-primary rounded-lg shadow-md',
                        )}
                        onClick={(e) => {
                          if (!isDraggingRef.current) {
                            e.stopPropagation();
                            setSelectedWidgetId(item.i);
                          }
                        }}
                      >
                        {/* Live widget rendering */}
                        <div className="h-full">
                          <WidgetProvider entitySlug={widgetConfig.config.entitySlugOverride || entitySlug || ''} widgetId={item.i}>
                            {renderLiveWidget(widgetConfig, entitySlug, entityFields, allEntityList)}
                          </WidgetProvider>
                        </div>

                        {/* Overlay controls: drag handle + delete */}
                        <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          <div className="drag-handle cursor-grab active:cursor-grabbing bg-background/80 rounded p-0.5">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 bg-background/80 text-destructive"
                            onClick={(e) => { e.stopPropagation(); handleRemoveWidget(item.i); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        {/* Entity override indicator */}
                        {widgetConfig.config.entitySlugOverride && (
                          <div className="absolute bottom-1 left-1 z-10">
                            <Badge variant="secondary" className="text-[10px] py-0 h-4 bg-background/80">
                              <Database className="h-2.5 w-2.5 mr-0.5" />
                              {widgetConfig.config.entitySlugOverride}
                            </Badge>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </Responsive>
              </div>
              );
            })()}
          </div>

          {/* ── Right: Properties Panel ── */}
          <div className="w-72 border-l bg-card flex-shrink-0 overflow-hidden">
            {selectedWidgetId && widgets[selectedWidgetId] ? (
              <PropertiesPanel
                widgetId={selectedWidgetId}
                config={widgets[selectedWidgetId]}
                entityFields={effectiveWidgetFields}
                parentEntityFields={widgets[selectedWidgetId]?.config.entitySlugOverride ? entityFields : []}
                allEntities={allEntityList}
                subEntities={subEntities}
                onUpdate={(config) => handleUpdateWidgetConfig(selectedWidgetId, config)}
                onRemove={() => handleRemoveWidget(selectedWidgetId)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-4 text-muted-foreground">
                <Settings2 className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm font-medium">Propriedades</p>
                <p className="text-xs mt-1">Clique em um widget para editar</p>
              </div>
            )}
          </div>
        </div>

        {/* Template Settings Dialog */}
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Configuracoes do Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Descricao</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Entidade</Label>
                <Select value={entitySlug || '__global__'} onValueChange={(v) => setEntitySlug(v === '__global__' ? '' : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__global__">Global (todas as entidades)</SelectItem>
                    {allEntityList.map((e) => (
                      <SelectItem key={e.slug} value={e.slug}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Cargos atribuidos</Label>
                <div className="border rounded-md p-2 max-h-40 overflow-auto space-y-1">
                  {(() => {
                    const list = Array.isArray(roles) ? roles : (roles as { data?: unknown[] })?.data || [];
                    return (list as Array<{ id: string; name: string }>).map((role) => (
                      <label key={role.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={roleIds.includes(role.id)} onChange={() => handleToggleRole(role.id)} />
                        {role.name}
                      </label>
                    ));
                  })()}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Prioridade</Label>
                <Input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
                <p className="text-xs text-muted-foreground">Maior prioridade = usado quando ha multiplos templates</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <Label className="text-sm">Ativo</Label>
              </div>

              <Separator />

              <div className="space-y-1.5">
                <Label className="text-sm">Abas do Dashboard</Label>
                <p className="text-xs text-muted-foreground">Organize widgets em abas para navegacao</p>
                {tabs.map((tab, idx) => (
                  <div key={tab.id} className="flex gap-1 items-center">
                    <Input className="h-8 text-sm flex-1" value={tab.label}
                      onChange={(e) => {
                        const newTabs = [...tabs];
                        newTabs[idx] = { ...newTabs[idx], label: e.target.value };
                        setTabs(newTabs);
                      }} />
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive"
                      onClick={() => setTabs(tabs.filter((_, i) => i !== idx))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full"
                  onClick={() => setTabs([...tabs, { id: `tab-${Date.now()}`, label: `Aba ${tabs.length + 1}`, widgetIds: [] }])}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar aba
                </Button>
                {tabs.length > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Arraste widgets sobre as abas no canvas para organiza-los.
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setSettingsOpen(false)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardFilterProvider>
  );
}

export default function DashboardTemplateBuilderPage() {
  return (
    <RequireRole roles={['PLATFORM_ADMIN', 'ADMIN']}>
      <TemplateBuilderContent />
    </RequireRole>
  );
}

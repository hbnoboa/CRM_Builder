'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import { RequireRole } from '@/components/auth/require-role';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
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
import { ArrowLeft, Save, Loader2, Plus, Settings2, Trash2, GripVertical } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { toast } from 'sonner';
import {
  useDashboardTemplate,
  useUpdateDashboardTemplate,
  useCreateDashboardTemplate,
} from '@/hooks/use-dashboard-templates';
import { useEntities } from '@/hooks/use-entities';
import { useCustomRoles } from '@/hooks/use-custom-roles';
import { WIDGET_REGISTRY, WIDGET_TYPES } from '@/components/dashboard-widgets/widget-registry';
import { DashboardFilterProvider } from '@/components/dashboard-widgets/dashboard-filter-context';
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
import { WidgetWrapper } from '@/components/dashboard-widgets/widget-wrapper';
import type { WidgetConfig, WidgetType, LayoutItem } from '@crm-builder/shared';
import type { EntityField } from '@/types';
import { cn } from '@/lib/utils';

import 'react-grid-layout/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

// ═══════════════════════════════════════════════════════════════════════
// Widget Config Panel
// ═══════════════════════════════════════════════════════════════════════

interface WidgetConfigPanelProps {
  widgetId: string;
  config: WidgetConfig;
  entityFields: EntityField[];
  onUpdate: (config: WidgetConfig) => void;
  onClose: () => void;
  open: boolean;
}

function WidgetConfigPanel({ widgetId, config, entityFields, onUpdate, onClose, open }: WidgetConfigPanelProps) {
  const [localConfig, setLocalConfig] = useState<WidgetConfig>(config);

  const updateField = (key: string, value: unknown) => {
    setLocalConfig((prev) => ({
      ...prev,
      config: { ...prev.config, [key]: value },
    }));
  };

  const numericFields = entityFields.filter((f) =>
    ['number', 'currency', 'percentage', 'slider', 'rating', 'timer'].includes(f.type)
  );
  // All non-structural fields can be used for grouping (distribution charts)
  const groupableFields = entityFields.filter((f) =>
    !['section-title', 'divider', 'sub-entity', 'file', 'image', 'signature', 'rich-text'].includes(f.type)
  );
  const allFields = entityFields.filter((f) =>
    !['section-title', 'divider', 'sub-entity'].includes(f.type)
  );

  const handleSave = () => {
    onUpdate(localConfig);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Configurar Widget</DialogTitle>
        </DialogHeader>
      <div className="space-y-4">
        {/* Title */}
        <div className="space-y-1.5">
          <Label className="text-xs">Titulo</Label>
          <Input
            value={localConfig.title || ''}
            onChange={(e) => setLocalConfig((p) => ({ ...p, title: e.target.value }))}
            placeholder="Titulo do widget"
            className="h-8 text-sm"
          />
        </div>

        {/* Type-specific config */}
        {(localConfig.type === 'kpi-card' || localConfig.type === 'number-card' || localConfig.type === 'gauge-chart') && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Campo</Label>
              <Select
                value={localConfig.config.fieldSlug || '__count__'}
                onValueChange={(v) => updateField('fieldSlug', v === '__count__' ? undefined : v)}
              >
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__count__">Contagem de registros</SelectItem>
                  {numericFields.map((f) => (
                    <SelectItem key={f.slug} value={f.slug}>{f.label || f.name} ({f.type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {localConfig.config.fieldSlug && (
              <div className="space-y-1.5">
                <Label className="text-xs">Agregacao</Label>
                <Select
                  value={localConfig.config.aggregation || 'sum'}
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
            {localConfig.type === 'kpi-card' && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={localConfig.config.showComparison || false}
                  onCheckedChange={(v) => updateField('showComparison', v)}
                />
                <Label className="text-xs">Comparar com periodo anterior</Label>
              </div>
            )}
            {localConfig.type === 'gauge-chart' && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Min</Label>
                    <Input type="number" className="h-8 text-sm" value={localConfig.config.gaugeMin ?? 0}
                      onChange={(e) => updateField('gaugeMin', Number(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Max</Label>
                    <Input type="number" className="h-8 text-sm" value={localConfig.config.gaugeMax ?? 100}
                      onChange={(e) => updateField('gaugeMax', Number(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Meta</Label>
                    <Input type="number" className="h-8 text-sm" value={localConfig.config.gaugeTarget ?? ''}
                      onChange={(e) => updateField('gaugeTarget', e.target.value ? Number(e.target.value) : undefined)} />
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {(localConfig.type === 'area-chart' || localConfig.type === 'line-chart') && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Fonte de dados</Label>
              <Select
                value={localConfig.config.dataSource || 'records-over-time'}
                onValueChange={(v) => updateField('dataSource', v)}
              >
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="records-over-time">Registros ao longo do tempo</SelectItem>
                  <SelectItem value="field-trend">Tendencia de campo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {localConfig.config.dataSource === 'field-trend' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Campo</Label>
                  <Select
                    value={localConfig.config.fieldSlug || ''}
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
                    value={localConfig.config.aggregation || 'sum'}
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
            <div className="space-y-1.5">
              <Label className="text-xs">Periodo (dias)</Label>
              <Input type="number" className="h-8 text-sm" value={localConfig.config.days || 30}
                onChange={(e) => updateField('days', Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cor</Label>
              <Input type="color" className="h-8 w-16" value={localConfig.config.chartColor || '#3B82F6'}
                onChange={(e) => updateField('chartColor', e.target.value)} />
            </div>
          </>
        )}

        {(localConfig.type === 'bar-chart' || localConfig.type === 'column-chart' ||
          localConfig.type === 'pie-chart' || localConfig.type === 'donut-chart') && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Campo (agrupar por)</Label>
              <Select
                value={localConfig.config.groupByField || localConfig.config.fieldSlug || ''}
                onValueChange={(v) => {
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
            {(localConfig.type === 'pie-chart' || localConfig.type === 'donut-chart') && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={localConfig.config.showLegend !== false}
                  onCheckedChange={(v) => updateField('showLegend', v)}
                />
                <Label className="text-xs">Mostrar legenda</Label>
              </div>
            )}
          </>
        )}

        {localConfig.type === 'funnel-chart' && (
          <div className="space-y-1.5">
            <Label className="text-xs">Campo (etapas)</Label>
            <Select
              value={localConfig.config.groupByField || localConfig.config.fieldSlug || ''}
              onValueChange={(v) => {
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
        )}

        {localConfig.type === 'mini-table' && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Campos visiveis</Label>
              <div className="border rounded-md p-2 max-h-40 overflow-auto space-y-1">
                {allFields.map((f) => {
                  const selected = localConfig.config.displayFields || [];
                  const isSelected = selected.includes(f.slug);
                  return (
                    <label key={f.slug} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input type="checkbox" checked={isSelected} onChange={() => {
                        const newFields = isSelected
                          ? selected.filter((s) => s !== f.slug)
                          : [...selected, f.slug];
                        updateField('displayFields', newFields);
                      }} />
                      {f.label || f.name}
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Limite</Label>
              <Input type="number" className="h-8 text-sm" value={localConfig.config.limit || 5}
                onChange={(e) => updateField('limit', Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ordenar por</Label>
              <Select
                value={localConfig.config.sortBy || 'createdAt'}
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

        {localConfig.type === 'activity-feed' && (
          <div className="space-y-1.5">
            <Label className="text-xs">Limite</Label>
            <Input type="number" className="h-8 text-sm" value={localConfig.config.activityLimit || 10}
              onChange={(e) => updateField('activityLimit', Number(e.target.value))} />
          </div>
        )}

        {localConfig.type === 'filter-slicer' && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Campo</Label>
              <Select
                value={localConfig.config.filterFields?.[0] || localConfig.config.fieldSlug || ''}
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
                value={localConfig.config.slicerType || 'dropdown'}
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
          </>
        )}

        <div className="pt-4 flex gap-2">
          <Button onClick={handleSave} size="sm" className="flex-1">Aplicar</Button>
          <Button onClick={onClose} variant="outline" size="sm">Cancelar</Button>
        </div>
      </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Widget Render Helper - always renders live data when entity is selected
// ═══════════════════════════════════════════════════════════════════════

function renderLiveWidget(
  widgetConfig: WidgetConfig,
  entitySlug: string | undefined,
  entityFields: EntityField[],
) {
  if (!entitySlug) {
    const def = WIDGET_REGISTRY[widgetConfig.type];
    return (
      <WidgetWrapper title={widgetConfig.title || def?.label}>
        <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
          Selecione uma entidade
        </div>
      </WidgetWrapper>
    );
  }

  const commonProps = {
    entitySlug,
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
    case 'mini-table': return <MiniTableWidget {...commonProps} entityFields={entityFields} />;
    case 'activity-feed': return <ActivityFeedWidget {...commonProps} />;
    case 'filter-slicer': return <FilterSlicerWidget {...commonProps} />;
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
  const { data: entities } = useEntities();
  const { data: roles } = useCustomRoles();

  const [layout, setLayout] = useState<LayoutItem[]>([]);
  const [widgets, setWidgets] = useState<Record<string, WidgetConfig>>({});
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [entitySlug, setEntitySlug] = useState('');
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [priority, setPriority] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(isCreateMode);
  const [initialized, setInitialized] = useState(isCreateMode);
  const [mounted, setMounted] = useState(false);
  const isDraggingRef = useRef(false);

  useEffect(() => { setMounted(true); }, []);

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
    setInitialized(true);
  }

  const selectedEntity = useMemo(() => {
    if (!entitySlug || !entities) return null;
    const list = Array.isArray(entities) ? entities : (entities as { data?: unknown[] })?.data || [];
    return (list as Array<{ slug: string; fields?: EntityField[] }>).find((e) => e.slug === entitySlug) || null;
  }, [entitySlug, entities]);

  const entityFields = useMemo(() => {
    return (selectedEntity?.fields || []) as EntityField[];
  }, [selectedEntity]);

  const handleAddWidget = useCallback((type: WidgetType) => {
    const def = WIDGET_REGISTRY[type];
    const id = `widget-${Date.now()}`;
    const maxY = layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);

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

    setWidgets((prev) => ({
      ...prev,
      [id]: {
        type,
        title: def.label,
        config: {},
      },
    }));

    setSelectedWidgetId(id);
  }, [layout]);

  const handleRemoveWidget = useCallback((widgetId: string) => {
    setLayout((prev) => prev.filter((item) => item.i !== widgetId));
    setWidgets((prev) => {
      const next = { ...prev };
      delete next[widgetId];
      return next;
    });
    if (selectedWidgetId === widgetId) setSelectedWidgetId(null);
  }, [selectedWidgetId]);

  const handleUpdateWidgetConfig = useCallback((widgetId: string, config: WidgetConfig) => {
    setWidgets((prev) => ({ ...prev, [widgetId]: config }));
  }, []);

  const handleLayoutChange = useCallback((_currentLayout: LayoutItem[], allLayouts: Record<string, LayoutItem[]>) => {
    const lgLayout = allLayouts.lg;
    if (lgLayout) {
      setLayout(lgLayout.map((item) => ({
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        minW: item.minW,
        minH: item.minH,
      })));
    }
  }, []);

  const isSaving = updateTemplate.isPending || createTemplate.isPending;

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Informe o nome do template');
      return;
    }
    try {
      if (isCreateMode) {
        const result = await createTemplate.mutateAsync({
          name: name.trim(),
          description: description || undefined,
          entitySlug: entitySlug || undefined,
          layout,
          widgets,
          roleIds,
          priority,
          isActive,
        });
        if (result?.id) {
          router.replace(`/settings/dashboard-templates/${result.id}`);
        }
      } else {
        await updateTemplate.mutateAsync({
          id: templateId,
          data: {
            name: name.trim(),
            description: description || undefined,
            entitySlug: entitySlug || undefined,
            layout,
            widgets,
            roleIds,
            priority,
            isActive,
          },
        });
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
    <DashboardFilterProvider>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/settings/dashboard-templates">
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
                {(() => {
                  const list = Array.isArray(entities) ? entities : (entities as { data?: unknown[] })?.data || [];
                  return (list as Array<{ slug: string; name: string }>).map((e) => (
                    <SelectItem key={e.slug} value={e.slug}>{e.name}</SelectItem>
                  ));
                })()}
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

        <div className="flex gap-4">
          {/* Widget Palette (left) */}
          <div className="w-48 shrink-0">
            <Card>
              <CardHeader className="py-3 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Widgets
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 pt-0 space-y-1">
                {WIDGET_TYPES.map((type) => {
                  const def = WIDGET_REGISTRY[type];
                  const Icon = def.icon;
                  return (
                    <button
                      key={type}
                      className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs hover:bg-accent transition-colors text-left"
                      onClick={() => handleAddWidget(type)}
                    >
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      {def.label}
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Canvas - always live data */}
          <div className="flex-1 min-w-0">
            {layout.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-16 text-center">
                  <Plus className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {!entitySlug
                      ? 'Selecione uma entidade na toolbar acima e adicione widgets'
                      : 'Clique em um widget na paleta para adicionar'}
                  </p>
                </CardContent>
              </Card>
            ) : !mounted ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ResponsiveGridLayout
                className="layout"
                layouts={{ lg: layout }}
                breakpoints={{ lg: 1200, md: 996, sm: 768 }}
                cols={{ lg: 12, md: 10, sm: 6 }}
                rowHeight={30}
                margin={[12, 12]}
                isDraggable
                isResizable
                onLayoutChange={handleLayoutChange}
                onDragStart={() => { isDraggingRef.current = true; }}
                onDragStop={() => { setTimeout(() => { isDraggingRef.current = false; }, 100); }}
                onResizeStart={() => { isDraggingRef.current = true; }}
                onResizeStop={() => { setTimeout(() => { isDraggingRef.current = false; }, 100); }}
                containerPadding={[0, 0]}
                draggableHandle=".drag-handle"
              >
                {layout.map((item) => {
                  const widgetConfig = widgets[item.i];
                  if (!widgetConfig) return <div key={item.i} />;

                  return (
                    <div
                      key={item.i}
                      className={cn(
                        'relative group',
                        selectedWidgetId === item.i && 'ring-2 ring-primary rounded-lg',
                      )}
                    >
                      {/* Live widget rendering */}
                      <div className="h-full">
                        {renderLiveWidget(widgetConfig, entitySlug, entityFields)}
                      </div>

                      {/* Overlay controls: drag handle + config + delete */}
                      <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <div className="drag-handle cursor-grab active:cursor-grabbing bg-background/80 rounded p-0.5">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 bg-background/80"
                          onClick={(e) => { e.stopPropagation(); setSelectedWidgetId(item.i); }}
                        >
                          <Settings2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 bg-background/80 text-destructive"
                          onClick={(e) => { e.stopPropagation(); handleRemoveWidget(item.i); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </ResponsiveGridLayout>
            )}
          </div>
        </div>

        {/* Widget Config Dialog */}
        {selectedWidgetId && widgets[selectedWidgetId] && (
          <WidgetConfigPanel
            open={!!selectedWidgetId}
            widgetId={selectedWidgetId}
            config={widgets[selectedWidgetId]}
            entityFields={entityFields}
            onUpdate={(config) => handleUpdateWidgetConfig(selectedWidgetId, config)}
            onClose={() => setSelectedWidgetId(null)}
          />
        )}

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
                    {(() => {
                      const list = Array.isArray(entities) ? entities : (entities as { data?: unknown[] })?.data || [];
                      return (list as Array<{ slug: string; name: string }>).map((e) => (
                        <SelectItem key={e.slug} value={e.slug}>{e.name}</SelectItem>
                      ));
                    })()}
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

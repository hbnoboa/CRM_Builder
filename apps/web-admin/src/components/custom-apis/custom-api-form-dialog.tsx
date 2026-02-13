'use client';

import { useEffect, useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus, Trash2, Clock,
  Filter, SortAsc, ListChecks, Zap, Info,
} from 'lucide-react';
import { useCreateCustomApi, useUpdateCustomApi } from '@/hooks/use-custom-apis';
import type { CustomApi, CreateCustomApiData } from '@/services/custom-apis.service';
import { entitiesService } from '@/services/entities.service';
import { useTenant } from '@/stores/tenant-context';
import type { Entity, EntityField } from '@/types';

// ─── Types ──────────────────────────────────────────────────────────────────
type ValueMode = 'manual' | 'auto';
type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith' | 'endsWith' | 'in' | 'isNull' | 'isNotNull';
type SortDirection = 'asc' | 'desc';

interface FieldConfig {
  fieldSlug: string;
  enabled: boolean;
  valueMode?: ValueMode;
  manualValue?: string;  // Valor digitado pelo usuario (texto, numero, data, etc)
  dynamicValue?: string; // Placeholder do sistema ({{user.email}}, {{now}}, etc)
}

interface FilterConfig {
  fieldSlug: string;
  operator: FilterOperator;
  valueMode: ValueMode;
  manualValue?: string;
  dynamicValue?: string;
}

interface SortConfig {
  fieldSlug: string;
  direction: SortDirection;
}

interface ScheduleConfig {
  enabled: boolean;
  cron?: string;
  timezone?: string;
}

interface ApiConfig {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  sourceEntityId: string;
  description: string;
  mode: 'visual' | 'code';
  code: string;
  selectedFields: FieldConfig[];
  filters: FilterConfig[];
  orderBy: SortConfig[];
  groupBy: string[];
  limitRecords: number | null;
  offset: number | null;
  distinct: boolean;
  schedule: ScheduleConfig;
}

// ─── Constants ──────────────────────────────────────────────────────────────
const FILTER_OPERATORS: { value: FilterOperator; label: string; descKey: string }[] = [
  { value: 'eq', label: '=', descKey: 'equals' },
  { value: 'neq', label: '≠', descKey: 'notEquals' },
  { value: 'gt', label: '>', descKey: 'gt' },
  { value: 'gte', label: '≥', descKey: 'gte' },
  { value: 'lt', label: '<', descKey: 'lt' },
  { value: 'lte', label: '≤', descKey: 'lte' },
  { value: 'contains', label: '∈', descKey: 'contains' },
  { value: 'startsWith', label: 'A…', descKey: 'startsWith' },
  { value: 'endsWith', label: '…Z', descKey: 'endsWith' },
  { value: 'in', label: 'IN', descKey: 'in' },
  { value: 'isNull', label: 'NULL', descKey: 'isNull' },
  { value: 'isNotNull', label: '!NULL', descKey: 'isNotNull' },
];

// Valores dinamicos com tipos compativeis
const DYNAMIC_VALUES: { value: string; labelKey: string; icon: string; types: string[] }[] = [
  { value: '{{user.email}}', labelKey: 'userEmail', icon: '📧', types: ['text', 'email', 'hidden'] },
  { value: '{{user.name}}', labelKey: 'userName', icon: '👤', types: ['text', 'textarea', 'hidden'] },
  { value: '{{user.id}}', labelKey: 'userId', icon: '🆔', types: ['text', 'hidden', 'relation'] },
  { value: '{{user.roleType}}', labelKey: 'userRole', icon: '👔', types: ['text', 'select', 'hidden'] },
  { value: '{{now}}', labelKey: 'now', icon: '🕐', types: ['datetime', 'text', 'hidden'] },
  { value: '{{today}}', labelKey: 'today', icon: '📅', types: ['date', 'text', 'hidden'] },
  { value: '{{true}}', labelKey: 'true', icon: '✅', types: ['boolean'] },
  { value: '{{false}}', labelKey: 'false', icon: '❌', types: ['boolean'] },
  { value: '{{startOfDay}}', labelKey: 'startOfDay', icon: '🌅', types: ['datetime', 'text', 'hidden'] },
  { value: '{{endOfDay}}', labelKey: 'endOfDay', icon: '🌆', types: ['datetime', 'text', 'hidden'] },
  { value: '{{startOfMonth}}', labelKey: 'startOfMonth', icon: '📆', types: ['date', 'datetime', 'text', 'hidden'] },
  { value: '{{endOfMonth}}', labelKey: 'endOfMonth', icon: '📆', types: ['date', 'datetime', 'text', 'hidden'] },
  { value: '{{tenant.id}}', labelKey: 'tenantId', icon: '🏢', types: ['text', 'hidden', 'relation'] },
  { value: '{{timestamp}}', labelKey: 'timestamp', icon: '⏱️', types: ['number', 'text', 'hidden'] },
];

// Retorna valores dinamicos compativeis com o tipo do campo
function getDynamicValuesForType(fieldType: string): typeof DYNAMIC_VALUES {
  return DYNAMIC_VALUES.filter(dv => dv.types.includes(fieldType));
}

// Verifica se um tipo de campo suporta modo Auto
function fieldSupportsAuto(fieldType: string): boolean {
  return DYNAMIC_VALUES.some(dv => dv.types.includes(fieldType));
}

// Verifica se um tipo de campo suporta modo Manual
function fieldSupportsManual(fieldType: string): boolean {
  // Tipos que NAO suportam valor manual (precisam de upload, selecao especial, etc)
  const noManualTypes = ['file', 'image', 'map', 'json', 'richtext', 'api-select'];
  return !noManualTypes.includes(fieldType);
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-emerald-500',
  POST: 'bg-blue-500',
  PUT: 'bg-amber-500',
  PATCH: 'bg-orange-500',
  DELETE: 'bg-red-500',
};

const FIELD_TYPE_ICONS: Record<string, string> = {
  text: 'Aa', textarea: '¶', richtext: '📝', number: '#', currency: 'R$', percentage: '%',
  email: '@', phone: '📞', url: '🔗', cpf: '🪪', cnpj: '🏢', cep: '📮',
  date: '📅', datetime: '🕐', time: '⏰', boolean: '☑', select: '▼',
  multiselect: '☰', relation: '🔗', 'api-select': '⚡', file: '📎',
  image: '🖼', color: '🎨', rating: '⭐', slider: '🎚', password: '🔒',
  hidden: '👁', json: '{}',
};

function defaultConfig(customApi?: CustomApi | null): ApiConfig {
  if (customApi) {
    // Try to load full frontend config from requestSchema (saved by handleSubmit)
    const saved = customApi.requestSchema as Record<string, unknown> | null;

    if (saved && saved._v) {
      // Rich config saved — reload directly
      return {
        name: customApi.name,
        method: customApi.method,
        sourceEntityId: customApi.sourceEntityId || '',
        description: customApi.description || '',
        mode: (customApi.mode as 'visual' | 'code') || 'visual',
        code: (customApi.logic as string) || customApi.code || '',
        selectedFields: (saved.selectedFields as FieldConfig[]) || [],
        filters: (saved.filters as FilterConfig[]) || [],
        orderBy: (saved.orderBy as SortConfig[]) || [],
        groupBy: [],
        limitRecords: customApi.limitRecords ?? null,
        offset: null,
        distinct: false,
        schedule: { enabled: false },
      };
    }

    // Fallback: reconstruct from flat backend format
    const rawFields = Array.isArray(customApi.selectedFields) ? customApi.selectedFields : [];
    const selectedFields: FieldConfig[] = rawFields.map((f: unknown) =>
      typeof f === 'string'
        ? { fieldSlug: f, enabled: true }
        : (f as FieldConfig)
    );

    // Reconstruct filters from backend FixedFilterDto + QueryParamDto
    const reverseOp = (op: string): FilterOperator => {
      const m: Record<string, FilterOperator> = {
        equals: 'eq', not_equals: 'neq',
        gt: 'gt', gte: 'gte', lt: 'lt', lte: 'lte',
        contains: 'contains', starts_with: 'startsWith', ends_with: 'endsWith',
        in: 'in', is_null: 'isNull', is_not_null: 'isNotNull',
      };
      return m[op] || (op as FilterOperator);
    };

    const rawFilters = Array.isArray(customApi.filters) ? customApi.filters : [];
    const rawParams = Array.isArray(customApi.queryParams) ? customApi.queryParams : [];

    const filters: FilterConfig[] = [
      ...rawFilters.map((f: any) => ({
        fieldSlug: f.field || f.fieldSlug || '',
        operator: reverseOp(f.operator),
        valueMode: 'manual' as ValueMode,
        manualValue: f.value != null ? String(f.value) : '',
      })),
    ];

    // Reconstruct orderBy
    const rawOrder = customApi.orderBy as any;
    const orderBy: SortConfig[] = rawOrder
      ? Array.isArray(rawOrder)
        ? rawOrder.map((o: any) => ({ fieldSlug: o.field || o.fieldSlug, direction: o.direction || 'asc' }))
        : rawOrder.field
          ? [{ fieldSlug: rawOrder.field, direction: rawOrder.direction || 'asc' }]
          : []
      : [];

    return {
      name: customApi.name,
      method: customApi.method,
      sourceEntityId: customApi.sourceEntityId || '',
      description: customApi.description || '',
      mode: (customApi.mode as 'visual' | 'code') || 'visual',
      code: (customApi.logic as string) || customApi.code || '',
      selectedFields,
      filters,
      orderBy,
      groupBy: [],
      limitRecords: customApi.limitRecords ?? null,
      offset: null,
      distinct: false,
      schedule: { enabled: false },
    };
  }
  return {
    name: '', method: 'GET', sourceEntityId: '', description: '', mode: 'visual', code: '',
    selectedFields: [], filters: [], orderBy: [], groupBy: [],
    limitRecords: null, offset: null, distinct: false,
    schedule: { enabled: false },
  };
}

// ─── Props ──────────────────────────────────────────────────────────────────
interface CustomApiFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customApi?: CustomApi | null;
  onSuccess?: () => void;
  defaultEntityId?: string;
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export function CustomApiFormDialog({ open, onOpenChange, customApi, onSuccess, defaultEntityId }: CustomApiFormDialogProps) {
  const t = useTranslations('apis');
  const tCommon = useTranslations('common');
  const tDynamic = useTranslations('apis.dynamicValues');
  const tOperators = useTranslations('apis.filterOperators');
  const tLabels = useTranslations('apis.labels');
  const tTabs = useTranslations('apis.tabs');
  const tSchedule = useTranslations('apis.schedulePresets');
  const tTimezones = useTranslations('apis.timezones');
  const tHttp = useTranslations('apis.httpMethod');
  const tPlaceholders = useTranslations('placeholders');
  const { effectiveTenantId } = useTenant();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [config, setConfig] = useState<ApiConfig>(() => {
    const cfg = defaultConfig(customApi);
    if (defaultEntityId && !cfg.sourceEntityId) cfg.sourceEntityId = defaultEntityId;
    return cfg;
  });
  const [activeTab, setActiveTab] = useState('basic');
  const entityLocked = !!defaultEntityId;

  const isEditing = !!customApi;
  const createCustomApi = useCreateCustomApi({ success: t('toast.created') });
  const updateCustomApi = useUpdateCustomApi({ success: t('toast.updated') });
  const isLoading = createCustomApi.isPending || updateCustomApi.isPending;

  const isWriteMethod = ['POST', 'PUT', 'PATCH'].includes(config.method);

  const selectedEntity = useMemo(
    () => entities.find(e => e.id === config.sourceEntityId),
    [entities, config.sourceEntityId]
  );
  const entityFields: EntityField[] = selectedEntity?.fields || [];

  useEffect(() => {
    (async () => {
      try {
        const params = effectiveTenantId ? { tenantId: effectiveTenantId } : undefined;
        const res = await entitiesService.getAll(params);
        setEntities(res.data || []);
      } catch { setEntities([]); }
    })();
  }, [effectiveTenantId]);

  useEffect(() => {
    const cfg = defaultConfig(customApi);
    if (defaultEntityId && !cfg.sourceEntityId) cfg.sourceEntityId = defaultEntityId;
    setConfig(cfg);
    setActiveTab('basic');
  }, [customApi, open, defaultEntityId]);

  useEffect(() => {
    if (config.sourceEntityId && entityFields.length > 0 && config.selectedFields.length === 0) {
      setConfig(prev => ({
        ...prev,
        selectedFields: entityFields.map(f => ({
          fieldSlug: f.slug || f.name,
          enabled: !isWriteMethod, // GET: enabled por padrao, POST: desabilitado (usuario escolhe o modo)
        })),
      }));
    }
  }, [config.sourceEntityId, entityFields.length]);

  const update = (patch: Partial<ApiConfig>) => setConfig(prev => ({ ...prev, ...patch }));

  // ─── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!config.name.trim() || !config.sourceEntityId) return;

    const entity = entities.find(e => e.id === config.sourceEntityId);
    const slug = entity?.slug || 'api';
    const path = `/${slug}-${config.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')}`;

    // Map frontend operator names to backend FilterOperator enum values
    const mapOp = (op: FilterOperator): string => {
      const m: Record<string, string> = {
        eq: 'equals', neq: 'not_equals',
        gt: 'gt', gte: 'gte', lt: 'lt', lte: 'lte',
        contains: 'contains', startsWith: 'starts_with', endsWith: 'ends_with',
        in: 'in', isNull: 'is_null', isNotNull: 'is_not_null',
      };
      return m[op] || op;
    };

    // Enabled fields → string[] (just slugs for the backend)
    const enabledFields = config.selectedFields.filter(f => isFieldEnabled(f.fieldSlug));
    const fieldSlugs = enabledFields.map(f => f.fieldSlug);

    // Filters (manual/auto → { field, operator, value })
    const fixedFilters = config.filters.map(f => ({
      field: f.fieldSlug,
      operator: mapOp(f.operator),
      value: f.valueMode === 'auto' ? f.dynamicValue : f.manualValue,
    }));

    // No more queryParams - all values are resolved server-side
    const queryParams: never[] = [];

    // OrderBy → single { field, direction } object (backend expects one, not array)
    const orderBy = config.orderBy.length > 0
      ? { field: config.orderBy[0].fieldSlug, direction: config.orderBy[0].direction }
      : undefined;

    // Store full frontend config in inputSchema for reload when editing
    const inputSchema: Record<string, unknown> = {
      _v: 1,
      selectedFields: enabledFields,
      filters: config.filters,
      orderBy: config.orderBy,
    };

    const payload: CreateCustomApiData = {
      name: config.name,
      path,
      method: config.method,
      description: config.description || undefined,
      mode: config.mode,
      sourceEntityId: config.sourceEntityId,
      selectedFields: fieldSlugs,
      filters: fixedFilters,
      queryParams,
      orderBy,
      limitRecords: config.limitRecords ?? undefined,
      logic: config.mode === 'code' ? config.code : undefined,
      inputSchema,
      ...(effectiveTenantId ? { tenantId: effectiveTenantId } : {}),
    };

    try {
      if (isEditing && customApi) {
        await updateCustomApi.mutateAsync({ id: customApi.id, data: payload });
      } else {
        await createCustomApi.mutateAsync(payload);
      }
      onOpenChange(false);
      onSuccess?.();
    } catch { /* handled by hook */ }
  };

  // ─── Field helpers ──────────────────────────────────────────────────────

  // Set valueMode for a field, which enables it; clearing disables it
  const setFieldValueMode = (slug: string, valueMode: ValueMode | undefined) => {
    setConfig(prev => {
      const existing = prev.selectedFields.find(f => f.fieldSlug === slug);
      if (existing) {
        // If valueMode is undefined, remove the field from selectedFields
        if (!valueMode) {
          return { ...prev, selectedFields: prev.selectedFields.filter(f => f.fieldSlug !== slug) };
        }
        // Otherwise, update valueMode
        return {
          ...prev,
          selectedFields: prev.selectedFields.map(f =>
            f.fieldSlug === slug ? { ...f, valueMode, enabled: true } : f
          ),
        };
      }
      // If not present and valueMode is set, add it
      if (valueMode) {
        return {
          ...prev,
          selectedFields: [
            ...prev.selectedFields,
            {
              fieldSlug: slug,
              enabled: true,
              valueMode,
            },
          ],
        };
      }
      // If not present and valueMode is undefined, do nothing
      return prev;
    });
  };

  const updateFieldConfig = (slug: string, patch: Partial<FieldConfig>) => {
    setConfig(prev => ({
      ...prev,
      selectedFields: prev.selectedFields.map(f =>
        f.fieldSlug === slug ? { ...f, ...patch } : f
      ),
    }));
  };


  const isFieldEnabled = (slug: string) => {
    const fc = config.selectedFields.find(f => f.fieldSlug === slug);
    if (!fc) return false;
    return isWriteMethod ? !!fc.valueMode : fc.enabled;
  };

  const toggleField = (slug: string) => {
    setConfig(prev => {
      const existing = prev.selectedFields.find(f => f.fieldSlug === slug);
      if (existing) {
        return { ...prev, selectedFields: prev.selectedFields.map(f =>
          f.fieldSlug === slug ? { ...f, enabled: !f.enabled } : f
        )};
      }
      return { ...prev, selectedFields: [...prev.selectedFields, { fieldSlug: slug, enabled: true }] };
    });
  };

  const getFieldConfig = (slug: string) =>
    config.selectedFields.find(f => f.fieldSlug === slug);


  // Select all = set valueMode to 'manual' for all fields; deselect all = remove all from selectedFields
  const selectAllFields = () => {
    setConfig(prev => ({
      ...prev,
      selectedFields: entityFields.map(f => ({
        fieldSlug: f.slug || f.name,
        enabled: true,
        valueMode: isWriteMethod ? 'manual' : undefined,
      })),
    }));
  };

  const deselectAllFields = () => {
    if (isWriteMethod) {
      setConfig(prev => ({ ...prev, selectedFields: [] }));
    } else {
      setConfig(prev => ({
        ...prev,
        selectedFields: prev.selectedFields.map(f => ({ ...f, enabled: false })),
      }));
    }
  };

  // ─── Filter helpers ─────────────────────────────────────────────────────
  const addFilter = () => {
    const first = entityFields[0];
    if (!first) return;
    setConfig(prev => ({
      ...prev,
      filters: [...prev.filters, {
        fieldSlug: first.slug || first.name,
        operator: 'eq',
        valueMode: 'manual',
        manualValue: '',
      }],
    }));
  };

  const updateFilter = (idx: number, patch: Partial<FilterConfig>) => {
    setConfig(prev => ({
      ...prev,
      filters: prev.filters.map((f, i) => i === idx ? { ...f, ...patch } : f),
    }));
  };

  const removeFilter = (idx: number) => {
    setConfig(prev => ({ ...prev, filters: prev.filters.filter((_, i) => i !== idx) }));
  };

  // ─── Sort helpers ───────────────────────────────────────────────────────
  const addSort = () => {
    const first = entityFields[0];
    if (!first) return;
    setConfig(prev => ({
      ...prev,
      orderBy: [...prev.orderBy, { fieldSlug: first.slug || first.name, direction: 'asc' }],
    }));
  };

  const updateSort = (idx: number, patch: Partial<SortConfig>) => {
    setConfig(prev => ({
      ...prev,
      orderBy: prev.orderBy.map((s, i) => i === idx ? { ...s, ...patch } : s),
    }));
  };

  const removeSort = (idx: number) => {
    setConfig(prev => ({ ...prev, orderBy: prev.orderBy.filter((_, i) => i !== idx) }));
  };

  const generatedPath = useMemo(() => {
    if (!selectedEntity || !config.name) return '';
    const slug = selectedEntity.slug;
    const namePart = config.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
    return `/api/x/[org]/${slug}-${namePart}`;
  }, [selectedEntity, config.name]);

  const enabledFieldsCount = config.selectedFields.filter(f => f.enabled).length;

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? t('editApi') : t('newApi')}
            {config.method && (
              <Badge className={`${METHOD_COLORS[config.method]} text-white text-xs`}>
                {config.method}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {t('subtitle')}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">{tTabs('basic')}</TabsTrigger>
            <TabsTrigger value="fields" disabled={!config.sourceEntityId}>
              {tTabs('fields')} {enabledFieldsCount > 0 && <Badge variant="secondary" className="ml-1 h-5 text-[10px]">{enabledFieldsCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="advanced" disabled={!config.sourceEntityId}>{tTabs('advanced')}</TabsTrigger>
          </TabsList>

          {/* ═══ TAB: BASIC ═══ */}
          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{tLabels('apiName')}</Label>
                <Input
                  placeholder={t('form.namePlaceholder')}
                  value={config.name}
                  onChange={e => update({ name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{tLabels('httpMethod')}</Label>
                <Select value={config.method} onValueChange={v => update({ method: v as ApiConfig['method'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const).map(m => (
                      <SelectItem key={m} value={m}>
                        <div className="flex items-center gap-2">
                          <span className={`inline-block w-2 h-2 rounded-full ${METHOD_COLORS[m]}`} />
                          {m}
                          <span className="text-xs text-muted-foreground ml-1">
                            ({tHttp(m.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete')})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{tLabels('entity')}</Label>
              <Select value={config.sourceEntityId} onValueChange={v => update({ sourceEntityId: v, selectedFields: [], filters: [], orderBy: [], groupBy: [] })} disabled={entityLocked}>
                <SelectTrigger><SelectValue placeholder={tLabels('selectEntity')} /></SelectTrigger>
                <SelectContent>
                  {entities.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      <div className="flex items-center gap-2">
                        <span>{e.icon || '📋'}</span>
                        <span>{e.name}</span>
                        <span className="text-xs text-muted-foreground">/{e.slug}</span>
                        {e._count?.data !== undefined && (
                          <Badge variant="outline" className="text-[10px] h-4">{e._count.data} {t('form.records')}</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {generatedPath && (
              <div className="p-3 bg-muted/50 rounded-lg border">
                <Label className="text-xs text-muted-foreground">{tLabels('generatedEndpoint')}</Label>
                <p className="font-mono text-sm mt-1">{generatedPath}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>{tLabels('descriptionOptional')}</Label>
              <Textarea
                placeholder={t('form.descriptionPlaceholder')}
                rows={2}
                value={config.description}
                onChange={e => update({ description: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <Switch
                checked={config.mode === 'code'}
                onCheckedChange={v => update({ mode: v ? 'code' : 'visual' })}
              />
              <div>
                <Label className="text-sm">{config.mode === 'code' ? tLabels('modeCode') : tLabels('modeVisual')}</Label>
                <p className="text-xs text-muted-foreground">
                  {config.mode === 'code'
                    ? tLabels('modeCodeDesc')
                    : tLabels('modeVisualDesc')}
                </p>
              </div>
            </div>

            {config.mode === 'code' && (
              <div className="space-y-2">
                <Label>{tLabels('code')}</Label>
                <Textarea
                  placeholder={t('form.codePlaceholder')}
                  rows={10}
                  className="font-mono text-sm"
                  value={config.code}
                  onChange={e => update({ code: e.target.value })}
                />
              </div>
            )}
          </TabsContent>

          {/* ═══ TAB: FIELDS (unified — fields + filters + query) ═══ */}
          <TabsContent value="fields" className="space-y-5 mt-4">
            {entityFields.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>{tLabels('noFieldsFound')}</p>
              </div>
            ) : isWriteMethod ? (
              /* ── WRITE: campo + modo (toggle buttons) + valor inline ── */
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">{tLabels('fieldsAndValues')}</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {tLabels('fieldsAndValuesDesc')}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={selectAllFields}>{tLabels('selectAll')}</Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={deselectAllFields}>{tLabels('clear')}</Button>
                  </div>
                </div>

                <div className="space-y-1 max-h-[320px] overflow-y-auto pr-1">
                  {entityFields.map(field => {
                    const slug = field.slug || field.name;
                    const fc = getFieldConfig(slug);
                    const enabled = isFieldEnabled(slug);
                    return (
                      <div
                        key={slug}
                        className={`flex items-center gap-2 p-2 border rounded-lg transition-all ${
                          enabled ? 'border-primary/30 bg-primary/5' : 'border-transparent bg-muted/20'
                        }`}
                      >
                        {/* Field info */}
                        <span className="text-sm w-5 text-center flex-shrink-0">{FIELD_TYPE_ICONS[field.type] || '?'}</span>
                        <div className="w-[110px] flex-shrink-0 min-w-0">
                          <span className="font-medium text-xs truncate block">{field.label || field.name}</span>
                          {field.required && <span className="text-[9px] text-destructive">{tCommon('required')}</span>}
                        </div>

                        {/* Mode toggle buttons - desabilitado se tipo nao suporta */}
                        <div className="flex gap-0.5 rounded-md border p-0.5 bg-background flex-shrink-0">
                          {([
                            { mode: 'manual' as ValueMode, label: t('fieldConfig.manual'), icon: <ListChecks className="h-3 w-3" />, supported: fieldSupportsManual(field.type) },
                            { mode: 'auto' as ValueMode, label: t('fieldConfig.auto'), icon: <Zap className="h-3 w-3" />, supported: fieldSupportsAuto(field.type) },
                          ]).map(({ mode, label, icon, supported }) => (
                            <button
                              key={mode}
                              type="button"
                              disabled={!supported}
                              title={!supported ? tLabels('typeNotSupportsMode', { type: field.type, mode: label }) : undefined}
                              className={`px-2 py-1 text-[11px] rounded flex items-center gap-1 transition-colors ${
                                fc?.valueMode === mode
                                  ? 'bg-primary text-primary-foreground shadow-sm'
                                  : supported
                                    ? 'hover:bg-muted text-muted-foreground'
                                    : 'opacity-30 cursor-not-allowed text-muted-foreground'
                              }`}
                              onClick={() => {
                                if (!supported) return;
                                if (fc?.valueMode === mode) setFieldValueMode(slug, undefined);
                                else setFieldValueMode(slug, mode);
                              }}
                            >
                              {icon} {label}
                            </button>
                          ))}
                        </div>

                        {/* Inline value input */}
                        <div className="flex-1 min-w-0">
                          {fc?.valueMode === 'manual' && (
                            <ValueInput
                              fieldType={field.type}
                              fieldOptions={field.options}
                              value={fc.manualValue || ''}
                              onChange={v => updateFieldConfig(slug, { manualValue: v })}
                            />
                          )}
                          {fc?.valueMode === 'auto' && (
                            <Select
                              value={fc.dynamicValue || ''}
                              onValueChange={v => updateFieldConfig(slug, { dynamicValue: v })}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue placeholder={t('fieldConfig.autoValue')} />
                              </SelectTrigger>
                              <SelectContent>
                                {getDynamicValuesForType(field.type).length > 0 ? (
                                  getDynamicValuesForType(field.type).map(dv => (
                                    <SelectItem key={dv.value} value={dv.value}>
                                      <span className="mr-1">{dv.icon}</span> {tDynamic(dv.labelKey as keyof typeof tDynamic)}
                                    </SelectItem>
                                  ))
                                ) : (
                                  <div className="px-2 py-1 text-xs text-muted-foreground">
                                    {tLabels('noValueAvailable')}
                                  </div>
                                )}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              /* ── GET: seleção compacta de campos (badges clicáveis) ── */
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">{tLabels('fieldsToReturn')}</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {tLabels('fieldsToReturnDesc')}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={selectAllFields}>{tLabels('selectAll')}</Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={deselectAllFields}>{tLabels('selectNone')}</Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {entityFields.map(field => {
                    const slug = field.slug || field.name;
                    const enabled = isFieldEnabled(slug);
                    return (
                      <Badge
                        key={slug}
                        variant={enabled ? 'default' : 'outline'}
                        className={`cursor-pointer transition-all text-xs py-1 px-2.5 ${
                          enabled ? '' : 'opacity-50 hover:opacity-100 hover:bg-muted'
                        }`}
                        onClick={() => toggleField(slug)}
                      >
                        <span className="mr-1">{FIELD_TYPE_ICONS[field.type] || '?'}</span>
                        {field.label || field.name}
                      </Badge>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── FILTERS (both GET and write) ── */}
            {entityFields.length > 0 && (
              <>
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">{tLabels('filters')}</Label>
                      <span className="text-[10px] text-muted-foreground">
                        — {isWriteMethod ? tLabels('filtersWriteCondition') : tLabels('filtersReadCondition')}
                      </span>
                    </div>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addFilter}>
                      <Plus className="h-3 w-3 mr-1" /> {tLabels('addFilter')}
                    </Button>
                  </div>
                  {config.filters.length === 0 && (
                    <p className="text-xs text-muted-foreground py-1">
                      {isWriteMethod ? tLabels('noFiltersWrite') : tLabels('noFiltersRead')}
                    </p>
                  )}
                  {config.filters.map((filter, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-2 bg-muted/30 rounded-lg border mb-2">
                      <div className="flex-1 grid gap-2 sm:grid-cols-4">
                        <Select value={filter.fieldSlug} onValueChange={v => updateFilter(idx, { fieldSlug: v })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {entityFields.map(f => (
                              <SelectItem key={f.slug || f.name} value={f.slug || f.name}>
                                <span className="mr-1">{FIELD_TYPE_ICONS[f.type] || '?'}</span> {f.label || f.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={filter.operator} onValueChange={v => updateFilter(idx, { operator: v as FilterOperator })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {FILTER_OPERATORS.map(op => (
                              <SelectItem key={op.value} value={op.value}>
                                <span className="font-mono mr-1">{op.label}</span> {tOperators(op.descKey as keyof typeof tOperators)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={filter.valueMode} onValueChange={v => updateFilter(idx, { valueMode: v as ValueMode })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manual">{t('fieldConfig.manual')}</SelectItem>
                            <SelectItem value="auto">{t('fieldConfig.auto')}</SelectItem>
                          </SelectContent>
                        </Select>
                        {filter.valueMode === 'manual' && !['isNull', 'isNotNull'].includes(filter.operator) && (
                          <Input className="h-8 text-xs" placeholder={tLabels('value')} value={filter.manualValue || ''} onChange={e => updateFilter(idx, { manualValue: e.target.value })} />
                        )}
                        {filter.valueMode === 'auto' && (
                          <Select value={filter.dynamicValue || ''} onValueChange={v => updateFilter(idx, { dynamicValue: v })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t('fieldConfig.autoValue')} /></SelectTrigger>
                            <SelectContent>
                              {DYNAMIC_VALUES.map(dv => (
                                <SelectItem key={dv.value} value={dv.value}>
                                  <span className="mr-1">{dv.icon}</span> {tDynamic(dv.labelKey as keyof typeof tDynamic)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive flex-shrink-0" onClick={() => removeFilter(idx)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* ── ORDER BY + LIMIT (GET only) ── */}
                {!isWriteMethod && (
                  <>
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <SortAsc className="h-4 w-4 text-muted-foreground" />
                          <Label className="text-sm font-medium">{tLabels('ordering')}</Label>
                        </div>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addSort}>
                          <Plus className="h-3 w-3 mr-1" /> {tLabels('addOrder')}
                        </Button>
                      </div>
                      {config.orderBy.length === 0 && (
                        <p className="text-xs text-muted-foreground py-1">{tLabels('defaultOrder')}</p>
                      )}
                      {config.orderBy.map((sort, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg border mb-2">
                          <Select value={sort.fieldSlug} onValueChange={v => updateSort(idx, { fieldSlug: v })}>
                            <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {entityFields.map(f => (
                                <SelectItem key={f.slug || f.name} value={f.slug || f.name}>
                                  <span className="mr-1">{FIELD_TYPE_ICONS[f.type] || '?'}</span> {f.label || f.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={sort.direction} onValueChange={v => updateSort(idx, { direction: v as SortDirection })}>
                            <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="asc">↑ {tLabels('ascending')}</SelectItem>
                              <SelectItem value="desc">↓ {tLabels('descending')}</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeSort(idx)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <div className="border-t pt-4 grid gap-4 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">{tLabels('limit')}</Label>
                        <Input
                          type="number"
                          className="h-8 text-sm"
                          placeholder={tLabels('noLimit')}
                          value={config.limitRecords ?? ''}
                          onChange={e => update({ limitRecords: e.target.value ? Number(e.target.value) : null })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">{tLabels('offset')}</Label>
                        <Input
                          type="number"
                          className="h-8 text-sm"
                          placeholder="0"
                          value={config.offset ?? ''}
                          onChange={e => update({ offset: e.target.value ? Number(e.target.value) : null })}
                        />
                      </div>
                      <div className="flex items-end">
                        <div className="flex items-center gap-2 pb-1">
                          <Switch checked={config.distinct} onCheckedChange={v => update({ distinct: v })} />
                          <Label className="text-xs">{tLabels('distinctOnly')}</Label>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </TabsContent>

          {/* ═══ TAB: ADVANCED ═══ */}
          <TabsContent value="advanced" className="space-y-5 mt-4">
            {/* Schedule */}
            <div className="space-y-3 p-4 rounded-lg border bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">{tLabels('schedule')}</Label>
                </div>
                <Switch
                  checked={config.schedule.enabled}
                  onCheckedChange={v => update({ schedule: { ...config.schedule, enabled: v } })}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {tLabels('scheduleDesc')}
              </p>
              {config.schedule.enabled && (
                <div className="grid gap-3 sm:grid-cols-2 pt-2">
                  <div className="space-y-2">
                    <Label className="text-xs">{tLabels('cronExpression')}</Label>
                    <Input
                      className="h-8 text-sm font-mono"
                      placeholder="0 8 * * *"
                      value={config.schedule.cron || ''}
                      onChange={e => update({ schedule: { ...config.schedule, cron: e.target.value } })}
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: tSchedule('everyDay8am'), value: '0 8 * * *' },
                        { label: tSchedule('everyHour'), value: '0 * * * *' },
                        { label: tSchedule('monFri9am'), value: '0 9 * * 1-5' },
                        { label: tSchedule('every30min'), value: '*/30 * * * *' },
                        { label: tSchedule('midnight'), value: '0 0 * * *' },
                        { label: tSchedule('firstOfMonth'), value: '0 0 1 * *' },
                      ].map(preset => (
                        <Badge
                          key={preset.value}
                          variant="outline"
                          className="cursor-pointer text-[10px] hover:bg-muted"
                          onClick={() => update({ schedule: { ...config.schedule, cron: preset.value } })}
                        >
                          {preset.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{tLabels('timezone')}</Label>
                    <Select
                      value={config.schedule.timezone || 'America/Sao_Paulo'}
                      onValueChange={v => update({ schedule: { ...config.schedule, timezone: v } })}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/Sao_Paulo">{tTimezones('saoPaulo')}</SelectItem>
                        <SelectItem value="America/Manaus">{tTimezones('manaus')}</SelectItem>
                        <SelectItem value="America/New_York">{tTimezones('newYork')}</SelectItem>
                        <SelectItem value="Europe/London">{tTimezones('london')}</SelectItem>
                        <SelectItem value="UTC">{tTimezones('utc')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* Examples */}
            <div className="space-y-3 p-4 rounded-lg border bg-blue-50 dark:bg-blue-950/20">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-500" />
                <Label className="text-sm font-medium text-blue-700 dark:text-blue-300">{tLabels('usageExamples')}</Label>
              </div>
              <div className="space-y-2 text-xs text-blue-600 dark:text-blue-400">
                {isWriteMethod ? (
                  <>
                    <p>• <strong>PATCH + <code>completed</code> = Manual <code>true</code></strong></p>
                    <p>• <strong><code>responsible_email</code> = Auto <code>{'{{user.email}}'}</code></strong></p>
                    <p>• <strong><code>completed_at</code> = Auto <code>{'{{now}}'}</code></strong></p>
                    <p>• <strong><code>status</code> = Manual <code>open</code></strong></p>
                  </>
                ) : (
                  <>
                    <p>• <strong><code>type = VIP</code> + Order by <code>name ASC</code></strong></p>
                    <p>• <strong>Order by <code>createdAt DESC</code> + Limit <code>10</code></strong></p>
                    <p>• <strong><code>email = {'{{user.email}}'}</code></strong></p>
                    <p>• <strong><code>createdAt {'>='} {'{{startOfDay}}'}</code></strong></p>
                  </>
                )}
              </div>
            </div>

            {/* Summary */}
            <div className="space-y-2 p-4 rounded-lg border bg-muted/30">
              <Label className="text-sm font-medium">{tLabels('apiSummary')}</Label>
              <div className="text-xs space-y-1 text-muted-foreground">
                <p><strong>{tLabels('method')}:</strong> <Badge className={`${METHOD_COLORS[config.method]} text-white text-[10px]`}>{config.method}</Badge></p>
                <p><strong>{tLabels('entity')}:</strong> {selectedEntity?.name || '—'}</p>
                <p><strong>{tLabels('fields')}:</strong> {enabledFieldsCount} {tCommon('of')} {entityFields.length}</p>
                <p><strong>{tLabels('filters')}:</strong> {config.filters.length}</p>
                {!isWriteMethod && <p><strong>{tLabels('ordering')}:</strong> {config.orderBy.length || tLabels('default')}</p>}
                {!isWriteMethod && <p><strong>{tLabels('grouping')}:</strong> {config.groupBy.length || tLabels('noneValue')}</p>}
                {config.limitRecords && <p><strong>{tLabels('limit')}:</strong> {config.limitRecords}</p>}
                {config.schedule.enabled && <p><strong>{tLabels('schedule')}:</strong> {config.schedule.cron}</p>}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon('cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !config.name.trim() || !config.sourceEntityId}
          >
            {isLoading ? tCommon('saving') : isEditing ? tCommon('save') : tCommon('create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Mascaras (mesmo do record-form-dialog)
// ═════════════════════════════════════════════════════════════════════════════
function applyCpfMask(value: string) {
  return value.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2').replace(/(-\d{2})\d+?$/, '$1');
}

function applyCnpjMask(value: string) {
  return value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})/, '$1-$2').replace(/(-\d{2})\d+?$/, '$1');
}

function applyCepMask(value: string) {
  return value.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').replace(/(-\d{3})\d+?$/, '$1');
}

function applyPhoneMask(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 10) return digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  return digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').replace(/(-\d{4})\d+?$/, '$1');
}

// ═════════════════════════════════════════════════════════════════════════════
// ValueInput — Input baseado no tipo do campo (mesmo padrao do formulario de entidade)
// ═════════════════════════════════════════════════════════════════════════════
function ValueInput({
  fieldType,
  fieldOptions,
  value,
  onChange,
}: {
  fieldType: string;
  fieldOptions?: EntityField['options'];
  value: string;
  onChange: (v: string) => void;
}) {
  const tLabels = useTranslations('apis.labels');
  const tPlaceholders = useTranslations('placeholders');
  const inputClass = "h-7 flex-1 text-xs";

  switch (fieldType) {
    case 'boolean':
      return (
        <Select value={value || ''} onValueChange={onChange}>
          <SelectTrigger className="h-7 flex-1 text-xs"><SelectValue placeholder={tLabels('chooseOption')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="true">{tLabels('trueValue')}</SelectItem>
            <SelectItem value="false">{tLabels('falseValue')}</SelectItem>
          </SelectContent>
        </Select>
      );

    case 'select':
    case 'multiselect':
      if (fieldOptions && fieldOptions.length > 0) {
        return (
          <Select value={value || ''} onValueChange={onChange}>
            <SelectTrigger className="h-7 flex-1 text-xs"><SelectValue placeholder={tLabels('chooseOption')} /></SelectTrigger>
            <SelectContent>
              {fieldOptions.map((opt, i) => {
                const optValue = typeof opt === 'object' ? opt.value : opt;
                const optLabel = typeof opt === 'object' ? opt.label : opt;
                const optColor = typeof opt === 'object' ? opt.color : undefined;
                return (
                  <SelectItem key={i} value={optValue}>
                    <span className="flex items-center gap-2">
                      {optColor && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: optColor }} />}
                      {optLabel}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        );
      }
      return <Input className={inputClass} placeholder={tLabels('value')} value={value} onChange={e => onChange(e.target.value)} />;

    case 'date':
      return <Input type="date" className={inputClass} value={value} onChange={e => onChange(e.target.value)} />;

    case 'datetime':
      return <Input type="datetime-local" className={inputClass} value={value} onChange={e => onChange(e.target.value)} />;

    case 'time':
      return <Input type="time" className={inputClass} value={value} onChange={e => onChange(e.target.value)} />;

    case 'number':
    case 'rating':
    case 'slider':
      return <Input type="number" className={inputClass} placeholder="0" value={value} onChange={e => onChange(e.target.value)} />;

    case 'currency':
      return (
        <div className="flex items-center gap-1 flex-1">
          <span className="text-xs text-muted-foreground">R$</span>
          <Input type="number" step="0.01" className={inputClass} placeholder="0,00" value={value} onChange={e => onChange(e.target.value)} />
        </div>
      );

    case 'percentage':
      return (
        <div className="flex items-center gap-1 flex-1">
          <Input type="number" step="0.1" min={0} max={100} className={inputClass} placeholder="0" value={value} onChange={e => onChange(e.target.value)} />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
      );

    case 'email':
      return <Input type="email" className={inputClass} placeholder={tPlaceholders('email')} value={value} onChange={e => onChange(e.target.value)} />;

    case 'url':
      return <Input type="url" className={inputClass} placeholder={tPlaceholders('url')} value={value} onChange={e => onChange(e.target.value)} />;

    case 'phone':
      return <Input type="tel" className={inputClass} placeholder={tPlaceholders('phone')} value={value} onChange={e => onChange(applyPhoneMask(e.target.value))} maxLength={15} />;

    case 'cpf':
      return <Input className={inputClass} placeholder={tPlaceholders('cpf')} value={value} onChange={e => onChange(applyCpfMask(e.target.value))} maxLength={14} />;

    case 'cnpj':
      return <Input className={inputClass} placeholder={tPlaceholders('cnpj')} value={value} onChange={e => onChange(applyCnpjMask(e.target.value))} maxLength={18} />;

    case 'cep':
      return <Input className={inputClass} placeholder={tPlaceholders('cep')} value={value} onChange={e => onChange(applyCepMask(e.target.value))} maxLength={9} />;

    case 'color':
      return (
        <div className="flex gap-1 flex-1 items-center">
          <input type="color" className="h-7 w-8 rounded cursor-pointer border p-0.5" value={value || '#000000'} onChange={e => onChange(e.target.value)} />
          <Input className={inputClass} value={value} onChange={e => onChange(e.target.value)} placeholder={tPlaceholders('color')} />
        </div>
      );

    case 'textarea':
    case 'richtext':
      return <Textarea className="h-16 flex-1 text-xs resize-none" placeholder={tLabels('value')} value={value} onChange={e => onChange(e.target.value)} />;

    case 'text':
    case 'hidden':
    default:
      return <Input className={inputClass} placeholder={tLabels('value')} value={value} onChange={e => onChange(e.target.value)} />;
  }
}

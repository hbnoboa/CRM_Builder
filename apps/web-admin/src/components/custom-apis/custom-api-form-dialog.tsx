'use client';

import { useEffect, useState, useMemo } from 'react';
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
import type { Entity, EntityField } from '@/types';

// ─── Types ──────────────────────────────────────────────────────────────────
type ValueMode = 'static' | 'dynamic' | 'param';
type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith' | 'endsWith' | 'in' | 'isNull' | 'isNotNull';
type SortDirection = 'asc' | 'desc';

interface FieldConfig {
  fieldSlug: string;
  enabled: boolean;
  valueMode?: ValueMode;
  staticValue?: string;
  dynamicValue?: string;
  paramKey?: string;
}

interface FilterConfig {
  fieldSlug: string;
  operator: FilterOperator;
  valueMode: ValueMode;
  staticValue?: string;
  dynamicValue?: string;
  paramKey?: string;
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
const FILTER_OPERATORS: { value: FilterOperator; label: string; desc: string }[] = [
  { value: 'eq', label: '=', desc: 'Igual a' },
  { value: 'neq', label: '≠', desc: 'Diferente de' },
  { value: 'gt', label: '>', desc: 'Maior que' },
  { value: 'gte', label: '≥', desc: 'Maior ou igual' },
  { value: 'lt', label: '<', desc: 'Menor que' },
  { value: 'lte', label: '≤', desc: 'Menor ou igual' },
  { value: 'contains', label: '∈', desc: 'Contém' },
  { value: 'startsWith', label: 'A…', desc: 'Começa com' },
  { value: 'endsWith', label: '…Z', desc: 'Termina com' },
  { value: 'in', label: 'IN', desc: 'Está na lista' },
  { value: 'isNull', label: 'NULL', desc: 'É nulo' },
  { value: 'isNotNull', label: '!NULL', desc: 'Não é nulo' },
];

const DYNAMIC_VALUES = [
  { value: '{{user.email}}', label: 'Email do usuário logado', icon: '📧' },
  { value: '{{user.name}}', label: 'Nome do usuário logado', icon: '👤' },
  { value: '{{user.id}}', label: 'ID do usuário logado', icon: '🆔' },
  { value: '{{now}}', label: 'Data/Hora atual', icon: '🕐' },
  { value: '{{today}}', label: 'Data de hoje', icon: '📅' },
  { value: '{{true}}', label: 'Verdadeiro (true)', icon: '✅' },
  { value: '{{false}}', label: 'Falso (false)', icon: '❌' },
  { value: '{{startOfDay}}', label: 'Início do dia', icon: '🌅' },
  { value: '{{endOfDay}}', label: 'Fim do dia', icon: '🌆' },
  { value: '{{startOfMonth}}', label: 'Início do mês', icon: '📆' },
  { value: '{{endOfMonth}}', label: 'Fim do mês', icon: '📆' },
  { value: '{{tenant.id}}', label: 'ID do tenant', icon: '🏢' },
];

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
        valueMode: 'static' as ValueMode,
        staticValue: f.value != null ? String(f.value) : '',
      })),
      ...rawParams.map((p: any) => ({
        fieldSlug: p.field || p.fieldSlug || '',
        operator: reverseOp(p.operator),
        valueMode: 'param' as ValueMode,
        paramKey: p.paramName || p.paramKey || '',
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
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export function CustomApiFormDialog({ open, onOpenChange, customApi, onSuccess }: CustomApiFormDialogProps) {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [config, setConfig] = useState<ApiConfig>(defaultConfig(customApi));
  const [activeTab, setActiveTab] = useState('basic');

  const isEditing = !!customApi;
  const createCustomApi = useCreateCustomApi();
  const updateCustomApi = useUpdateCustomApi();
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
        const res = await entitiesService.getAll();
        setEntities(res.data || []);
      } catch { setEntities([]); }
    })();
  }, []);

  useEffect(() => {
    setConfig(defaultConfig(customApi));
    setActiveTab('basic');
  }, [customApi, open]);

  useEffect(() => {
    if (config.sourceEntityId && entityFields.length > 0 && config.selectedFields.length === 0) {
      setConfig(prev => ({
        ...prev,
        selectedFields: entityFields.map(f => ({
          fieldSlug: f.slug || f.name,
          enabled: true,
          valueMode: isWriteMethod ? 'param' : undefined,
          paramKey: isWriteMethod ? (f.slug || f.name) : undefined,
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

    // Fixed filters (static/dynamic → { field, operator, value })
    const fixedFilters = config.filters
      .filter(f => f.valueMode !== 'param')
      .map(f => ({
        field: f.fieldSlug,
        operator: mapOp(f.operator),
        value: f.valueMode === 'dynamic' ? f.dynamicValue : f.staticValue,
      }));

    // Dynamic query params (param → { field, operator, paramName, required })
    const queryParams = config.filters
      .filter(f => f.valueMode === 'param')
      .map(f => ({
        field: f.fieldSlug,
        operator: mapOp(f.operator),
        paramName: f.paramKey || f.fieldSlug,
        required: true,
      }));

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

  // New: Set valueMode for a field, which enables it; clearing disables it
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
            f.fieldSlug === slug ? { ...f, valueMode, enabled: true, paramKey: valueMode === 'param' ? (f.paramKey || slug) : f.paramKey } : f
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
              paramKey: valueMode === 'param' ? slug : undefined,
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


  // New: select all = set valueMode to 'param' for all fields; deselect all = remove all from selectedFields
  const selectAllFields = () => {
    setConfig(prev => ({
      ...prev,
      selectedFields: entityFields.map(f => ({
        fieldSlug: f.slug || f.name,
        enabled: true,
        valueMode: isWriteMethod ? 'param' : undefined,
        paramKey: isWriteMethod ? (f.slug || f.name) : undefined,
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
        valueMode: 'static',
        staticValue: '',
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
            {isEditing ? 'Editar API' : 'Nova API'}
            {config.method && (
              <Badge className={`${METHOD_COLORS[config.method]} text-white text-xs`}>
                {config.method}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Configure visualmente sua API personalizada — campos, filtros, ordenação e valores.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Básico</TabsTrigger>
            <TabsTrigger value="fields" disabled={!config.sourceEntityId}>
              Campos {enabledFieldsCount > 0 && <Badge variant="secondary" className="ml-1 h-5 text-[10px]">{enabledFieldsCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="advanced" disabled={!config.sourceEntityId}>Avançado</TabsTrigger>
          </TabsList>

          {/* ═══ TAB: BASIC ═══ */}
          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome da API</Label>
                <Input
                  placeholder="Listar Clientes VIP"
                  value={config.name}
                  onChange={e => update({ name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Método HTTP</Label>
                <Select value={config.method} onValueChange={v => update({ method: v as ApiConfig['method'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const).map(m => (
                      <SelectItem key={m} value={m}>
                        <div className="flex items-center gap-2">
                          <span className={`inline-block w-2 h-2 rounded-full ${METHOD_COLORS[m]}`} />
                          {m}
                          <span className="text-xs text-muted-foreground ml-1">
                            {m === 'GET' ? '(Buscar)' : m === 'POST' ? '(Criar)' : m === 'PUT' ? '(Substituir)' : m === 'PATCH' ? '(Atualizar)' : '(Deletar)'}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Entidade (fonte dos dados)</Label>
              <Select value={config.sourceEntityId} onValueChange={v => update({ sourceEntityId: v, selectedFields: [], filters: [], orderBy: [], groupBy: [] })}>
                <SelectTrigger><SelectValue placeholder="Selecione a entidade..." /></SelectTrigger>
                <SelectContent>
                  {entities.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      <div className="flex items-center gap-2">
                        <span>{e.icon || '📋'}</span>
                        <span>{e.name}</span>
                        <span className="text-xs text-muted-foreground">/{e.slug}</span>
                        {e._count?.data !== undefined && (
                          <Badge variant="outline" className="text-[10px] h-4">{e._count.data} reg.</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {generatedPath && (
              <div className="p-3 bg-muted/50 rounded-lg border">
                <Label className="text-xs text-muted-foreground">Endpoint gerado</Label>
                <p className="font-mono text-sm mt-1">{generatedPath}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea
                placeholder="Descreva o que esta API faz..."
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
                <Label className="text-sm">{config.mode === 'code' ? 'Modo Código' : 'Modo Visual'}</Label>
                <p className="text-xs text-muted-foreground">
                  {config.mode === 'code'
                    ? 'Escreva código personalizado para processar a requisição.'
                    : 'Configure visualmente os campos, filtros e valores.'}
                </p>
              </div>
            </div>

            {config.mode === 'code' && (
              <div className="space-y-2">
                <Label>Código</Label>
                <Textarea
                  placeholder="// Seu código JavaScript aqui..."
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
                <p>Nenhum campo encontrado na entidade.</p>
              </div>
            ) : isWriteMethod ? (
              /* ── WRITE: campo + modo (toggle buttons) + valor inline ── */
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Campos e valores</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Clique no modo desejado para incluir o campo. Clique novamente para remover.
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={selectAllFields}>Todos</Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={deselectAllFields}>Limpar</Button>
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
                          {field.required && <span className="text-[9px] text-destructive">obrigatório</span>}
                        </div>

                        {/* Mode toggle buttons (1 click instead of dropdown) */}
                        <div className="flex gap-0.5 rounded-md border p-0.5 bg-background flex-shrink-0">
                          {([
                            { mode: 'param' as ValueMode, label: 'Param', icon: <Zap className="h-3 w-3" /> },
                            { mode: 'static' as ValueMode, label: 'Fixo', icon: <ListChecks className="h-3 w-3" /> },
                            { mode: 'dynamic' as ValueMode, label: 'Auto', icon: <Clock className="h-3 w-3" /> },
                          ]).map(({ mode, label, icon }) => (
                            <button
                              key={mode}
                              type="button"
                              className={`px-2 py-1 text-[11px] rounded flex items-center gap-1 transition-colors ${
                                fc?.valueMode === mode
                                  ? 'bg-primary text-primary-foreground shadow-sm'
                                  : 'hover:bg-muted text-muted-foreground'
                              }`}
                              onClick={() => {
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
                          {fc?.valueMode === 'param' && (
                            <Input
                              className="h-7 text-xs"
                              placeholder={slug}
                              value={fc.paramKey || slug}
                              onChange={e => updateFieldConfig(slug, { paramKey: e.target.value })}
                            />
                          )}
                          {fc?.valueMode === 'static' && (
                            <ValueInput
                              fieldType={field.type}
                              fieldOptions={field.options}
                              value={fc.staticValue || ''}
                              onChange={v => updateFieldConfig(slug, { staticValue: v })}
                            />
                          )}
                          {fc?.valueMode === 'dynamic' && (
                            <Select
                              value={fc.dynamicValue || ''}
                              onValueChange={v => updateFieldConfig(slug, { dynamicValue: v })}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue placeholder="Valor automático..." />
                              </SelectTrigger>
                              <SelectContent>
                                {DYNAMIC_VALUES.map(dv => (
                                  <SelectItem key={dv.value} value={dv.value}>
                                    <span className="mr-1">{dv.icon}</span> {dv.label}
                                  </SelectItem>
                                ))}
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
                    <Label className="text-sm font-medium">Campos para retornar</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Clique nos campos que deseja incluir na resposta.
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={selectAllFields}>Todos</Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={deselectAllFields}>Nenhum</Button>
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
                      <Label className="text-sm font-medium">Filtros</Label>
                      <span className="text-[10px] text-muted-foreground">
                        {isWriteMethod ? '— quais registros afetar' : '— condições da busca'}
                      </span>
                    </div>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addFilter}>
                      <Plus className="h-3 w-3 mr-1" /> Filtro
                    </Button>
                  </div>
                  {config.filters.length === 0 && (
                    <p className="text-xs text-muted-foreground py-1">
                      {isWriteMethod ? 'Sem filtros — afetará todos os registros.' : 'Sem filtros — retornará todos os registros.'}
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
                                <span className="font-mono mr-1">{op.label}</span> {op.desc}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={filter.valueMode} onValueChange={v => updateFilter(idx, { valueMode: v as ValueMode })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="static">Valor fixo</SelectItem>
                            <SelectItem value="dynamic">Dinâmico</SelectItem>
                            <SelectItem value="param">Parâmetro</SelectItem>
                          </SelectContent>
                        </Select>
                        {filter.valueMode === 'static' && !['isNull', 'isNotNull'].includes(filter.operator) && (
                          <Input className="h-8 text-xs" placeholder="Valor..." value={filter.staticValue || ''} onChange={e => updateFilter(idx, { staticValue: e.target.value })} />
                        )}
                        {filter.valueMode === 'dynamic' && (
                          <Select value={filter.dynamicValue || ''} onValueChange={v => updateFilter(idx, { dynamicValue: v })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Dinâmico..." /></SelectTrigger>
                            <SelectContent>
                              {DYNAMIC_VALUES.map(dv => (
                                <SelectItem key={dv.value} value={dv.value}>
                                  <span className="mr-1">{dv.icon}</span> {dv.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {filter.valueMode === 'param' && (
                          <Input className="h-8 text-xs" placeholder="Nome do param" value={filter.paramKey || ''} onChange={e => updateFilter(idx, { paramKey: e.target.value })} />
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
                          <Label className="text-sm font-medium">Ordenação</Label>
                        </div>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addSort}>
                          <Plus className="h-3 w-3 mr-1" /> Ordem
                        </Button>
                      </div>
                      {config.orderBy.length === 0 && (
                        <p className="text-xs text-muted-foreground py-1">Ordem padrão (mais recente primeiro).</p>
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
                              <SelectItem value="asc">↑ Crescente</SelectItem>
                              <SelectItem value="desc">↓ Decrescente</SelectItem>
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
                        <Label className="text-xs">Limite</Label>
                        <Input
                          type="number"
                          className="h-8 text-sm"
                          placeholder="Sem limite"
                          value={config.limitRecords ?? ''}
                          onChange={e => update({ limitRecords: e.target.value ? Number(e.target.value) : null })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Offset</Label>
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
                          <Label className="text-xs">Apenas únicos</Label>
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
                  <Label className="text-sm font-medium">Agendamento</Label>
                </div>
                <Switch
                  checked={config.schedule.enabled}
                  onCheckedChange={v => update({ schedule: { ...config.schedule, enabled: v } })}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Execute esta API automaticamente em intervalos programados.
              </p>
              {config.schedule.enabled && (
                <div className="grid gap-3 sm:grid-cols-2 pt-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Expressão Cron</Label>
                    <Input
                      className="h-8 text-sm font-mono"
                      placeholder="0 8 * * *"
                      value={config.schedule.cron || ''}
                      onChange={e => update({ schedule: { ...config.schedule, cron: e.target.value } })}
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: 'Todo dia 8h', value: '0 8 * * *' },
                        { label: 'A cada hora', value: '0 * * * *' },
                        { label: 'Seg-Sex 9h', value: '0 9 * * 1-5' },
                        { label: 'A cada 30min', value: '*/30 * * * *' },
                        { label: 'Meia-noite', value: '0 0 * * *' },
                        { label: '1º do mês', value: '0 0 1 * *' },
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
                    <Label className="text-xs">Fuso horário</Label>
                    <Select
                      value={config.schedule.timezone || 'America/Sao_Paulo'}
                      onValueChange={v => update({ schedule: { ...config.schedule, timezone: v } })}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/Sao_Paulo">São Paulo (BRT -3)</SelectItem>
                        <SelectItem value="America/Manaus">Manaus (AMT -4)</SelectItem>
                        <SelectItem value="America/New_York">New York (EST -5)</SelectItem>
                        <SelectItem value="Europe/London">London (GMT 0)</SelectItem>
                        <SelectItem value="UTC">UTC</SelectItem>
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
                <Label className="text-sm font-medium text-blue-700 dark:text-blue-300">Exemplos de uso</Label>
              </div>
              <div className="space-y-2 text-xs text-blue-600 dark:text-blue-400">
                {isWriteMethod ? (
                  <>
                    <p>• <strong>Marcar como concluído:</strong> PATCH + campo <code>concluido</code> = Fixo <code>true</code></p>
                    <p>• <strong>Atribuir ao usuário:</strong> campo <code>responsavel_email</code> = Dinâmico <code>{'{{user.email}}'}</code></p>
                    <p>• <strong>Registrar data:</strong> campo <code>concluido_em</code> = Dinâmico <code>{'{{now}}'}</code></p>
                    <p>• <strong>Criar registro:</strong> POST com campos em modo Parâmetro</p>
                  </>
                ) : (
                  <>
                    <p>• <strong>Clientes VIP:</strong> Filtro <code>tipo = VIP</code> + Ordenar por <code>nome ASC</code></p>
                    <p>• <strong>Últimos 10:</strong> Ordenar por <code>createdAt DESC</code> + Limite <code>10</code></p>
                    <p>• <strong>Meus registros:</strong> Filtro <code>email = {'{{user.email}}'}</code></p>
                    <p>• <strong>Criados hoje:</strong> Filtro <code>createdAt ≥ {'{{startOfDay}}'}</code></p>
                  </>
                )}
              </div>
            </div>

            {/* Summary */}
            <div className="space-y-2 p-4 rounded-lg border bg-muted/30">
              <Label className="text-sm font-medium">Resumo da API</Label>
              <div className="text-xs space-y-1 text-muted-foreground">
                <p><strong>Método:</strong> <Badge className={`${METHOD_COLORS[config.method]} text-white text-[10px]`}>{config.method}</Badge></p>
                <p><strong>Entidade:</strong> {selectedEntity?.name || '—'}</p>
                <p><strong>Campos:</strong> {enabledFieldsCount} de {entityFields.length}</p>
                <p><strong>Filtros:</strong> {config.filters.length}</p>
                {!isWriteMethod && <p><strong>Ordenação:</strong> {config.orderBy.length || 'padrão'}</p>}
                {!isWriteMethod && <p><strong>Agrupamento:</strong> {config.groupBy.length || 'nenhum'}</p>}
                {config.limitRecords && <p><strong>Limite:</strong> {config.limitRecords}</p>}
                {config.schedule.enabled && <p><strong>Agendamento:</strong> {config.schedule.cron}</p>}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !config.name.trim() || !config.sourceEntityId}
          >
            {isLoading ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Criar API'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ValueInput — Smart input based on field type
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
  if (fieldType === 'boolean') {
    return (
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue placeholder="Valor..." /></SelectTrigger>
        <SelectContent>
          <SelectItem value="true">✅ Verdadeiro (true)</SelectItem>
          <SelectItem value="false">❌ Falso (false)</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if ((fieldType === 'select' || fieldType === 'multiselect') && fieldOptions && fieldOptions.length > 0) {
    return (
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue placeholder="Escolha..." /></SelectTrigger>
        <SelectContent>
          {fieldOptions.map((opt, i) => {
            const optValue = typeof opt === 'object' ? opt.value : opt;
            const optLabel = typeof opt === 'object' ? opt.label : opt;
            return <SelectItem key={i} value={optValue}>{optLabel}</SelectItem>;
          })}
        </SelectContent>
      </Select>
    );
  }

  if (fieldType === 'date') return <Input type="date" className="h-8 flex-1 text-xs" value={value} onChange={e => onChange(e.target.value)} />;
  if (fieldType === 'datetime') return <Input type="datetime-local" className="h-8 flex-1 text-xs" value={value} onChange={e => onChange(e.target.value)} />;
  if (fieldType === 'time') return <Input type="time" className="h-8 flex-1 text-xs" value={value} onChange={e => onChange(e.target.value)} />;

  if (['number', 'currency', 'percentage', 'rating', 'slider'].includes(fieldType)) {
    return <Input type="number" className="h-8 flex-1 text-xs" placeholder="Valor numérico" value={value} onChange={e => onChange(e.target.value)} />;
  }

  if (fieldType === 'color') {
    return (
      <div className="flex gap-1 flex-1">
        <Input type="color" className="h-8 w-10 p-0.5" value={value || '#000000'} onChange={e => onChange(e.target.value)} />
        <Input className="h-8 flex-1 text-xs" value={value} onChange={e => onChange(e.target.value)} placeholder="#000000" />
      </div>
    );
  }

  return <Input className="h-8 flex-1 text-xs" placeholder="Valor..." value={value} onChange={e => onChange(e.target.value)} />;
}

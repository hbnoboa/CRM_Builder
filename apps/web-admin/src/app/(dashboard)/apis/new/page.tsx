'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Code,
  Wand2,
  Play,
  Loader2,
  Database,
  Filter,
  SortAsc,
  Settings,
  Eye,
  Table,
  Layers,
  Hash,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Copy,
  Check,
  AlertCircle,
  X,
  Braces,
  FileJson,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/lib/api';
import { useTenant } from '@/stores/tenant-context';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES E TIPOS
// ═══════════════════════════════════════════════════════════════════════════

const HTTP_METHODS = [
  { value: 'GET', label: 'GET', color: 'bg-green-500', description: 'Buscar dados' },
  { value: 'POST', label: 'POST', color: 'bg-blue-500', description: 'Criar registro' },
  { value: 'PUT', label: 'PUT', color: 'bg-yellow-500', description: 'Substituir registro' },
  { value: 'PATCH', label: 'PATCH', color: 'bg-orange-500', description: 'Atualizar parcial' },
  { value: 'DELETE', label: 'DELETE', color: 'bg-red-500', description: 'Excluir registro' },
];

const FILTER_OPERATORS = [
  { value: 'equals', label: '= Igual', sql: '=' },
  { value: 'not_equals', label: '≠ Diferente', sql: '!=' },
  { value: 'contains', label: '∋ Contém', sql: 'LIKE' },
  { value: 'not_contains', label: '∌ Não contém', sql: 'NOT LIKE' },
  { value: 'starts_with', label: '⊳ Começa com', sql: 'LIKE' },
  { value: 'ends_with', label: '⊲ Termina com', sql: 'LIKE' },
  { value: 'gt', label: '> Maior que', sql: '>' },
  { value: 'gte', label: '≥ Maior ou igual', sql: '>=' },
  { value: 'lt', label: '< Menor que', sql: '<' },
  { value: 'lte', label: '≤ Menor ou igual', sql: '<=' },
  { value: 'in', label: '∈ Está em', sql: 'IN' },
  { value: 'not_in', label: '∉ Não está em', sql: 'NOT IN' },
  { value: 'is_null', label: '∅ É nulo', sql: 'IS NULL' },
  { value: 'is_not_null', label: '≠∅ Não é nulo', sql: 'IS NOT NULL' },
  { value: 'between', label: '↔ Entre', sql: 'BETWEEN' },
];

const AGGREGATE_FUNCTIONS = [
  { value: '', label: 'Nenhum' },
  { value: 'count', label: 'COUNT - Contar' },
  { value: 'sum', label: 'SUM - Somar' },
  { value: 'avg', label: 'AVG - Média' },
  { value: 'min', label: 'MIN - Mínimo' },
  { value: 'max', label: 'MAX - Máximo' },
];

const FIELD_TYPE_ICONS: Record<string, string> = {
  text: '📝',
  textarea: '📄',
  number: '🔢',
  email: '📧',
  phone: '📱',
  url: '🔗',
  date: '📅',
  datetime: '🕐',
  boolean: '✓',
  select: '📋',
  multiselect: '☑️',
  file: '📎',
  image: '🖼️',
  relation: '🔗',
  json: '{}',
};

// Schema de validação
const apiSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  path: z.string().min(1, 'Path obrigatório').regex(/^[a-z0-9-/]+$/, 'Path inválido'),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  description: z.string().optional(),
  mode: z.enum(['visual', 'code']),
  sourceEntityId: z.string().optional(),
  selectedFields: z.array(z.object({
    name: z.string(),
    alias: z.string().optional(),
    aggregate: z.string().optional(),
  })).optional(),
  filters: z.array(z.object({
    field: z.string(),
    operator: z.string(),
    value: z.any().optional(),
    valueType: z.enum(['static', 'param']).optional(),
    paramName: z.string().optional(),
  })).optional(),
  orderBy: z.array(z.object({
    field: z.string(),
    direction: z.enum(['asc', 'desc']),
  })).optional(),
  groupBy: z.array(z.string()).optional(),
  limitRecords: z.number().optional().nullable(),
  offsetRecords: z.number().optional().nullable(),
  distinct: z.boolean().optional(),
  auth: z.enum(['NONE', 'API_KEY', 'JWT']).optional(),
  logic: z.string().optional(),
});

type ApiForm = z.infer<typeof apiSchema>;

interface Entity {
  id: string;
  name: string;
  slug: string;
  fields: EntityField[];
}

interface EntityField {
  name: string;
  label: string;
  type: string;
  required?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function NewApiPage() {
  const router = useRouter();
  const { organizationId } = useTenant();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(true);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    select: true,
    where: true,
    orderBy: false,
    groupBy: false,
    options: false,
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<ApiForm>({
    resolver: zodResolver(apiSchema),
    defaultValues: {
      method: 'GET',
      mode: 'visual',
      selectedFields: [],
      filters: [],
      orderBy: [],
      groupBy: [],
      limitRecords: null,
      offsetRecords: null,
      distinct: false,
      auth: 'JWT',
    },
  });

  const {
    fields: filterFields,
    append: appendFilter,
    remove: removeFilter,
  } = useFieldArray({ control, name: 'filters' });

  const {
    fields: orderByFields,
    append: appendOrderBy,
    remove: removeOrderBy,
  } = useFieldArray({ control, name: 'orderBy' });

  const mode = watch('mode');
  const method = watch('method');
  const sourceEntityId = watch('sourceEntityId');
  const selectedFields = watch('selectedFields') || [];
  const filters = watch('filters') || [];
  const orderBy = watch('orderBy') || [];
  const groupBy = watch('groupBy') || [];
  const distinct = watch('distinct');
  const limitRecords = watch('limitRecords');

  // Carregar entidades
  useEffect(() => {
    const fetchEntities = async () => {
      try {
        const response = await api.get('/entities');
        const entitiesData = Array.isArray(response.data) ? response.data : response.data?.data || [];
        setEntities(entitiesData);
      } catch (err) {
        console.error('Error loading entities:', err);
      } finally {
        setLoadingEntities(false);
      }
    };
    fetchEntities();
  }, []);

  // Quando a entidade muda
  useEffect(() => {
    if (sourceEntityId) {
      const entity = entities.find((e) => e.id === sourceEntityId);
      setSelectedEntity(entity || null);
      setValue('selectedFields', []);
      setValue('filters', []);
      setValue('orderBy', []);
      setValue('groupBy', []);
    } else {
      setSelectedEntity(null);
    }
  }, [sourceEntityId, entities, setValue]);

  const entityFields = selectedEntity?.fields || [];

  // Toggle seção expandida
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Adicionar/remover campo selecionado
  const toggleField = (fieldName: string) => {
    const current = selectedFields || [];
    const exists = current.find((f) => f.name === fieldName);
    if (exists) {
      setValue('selectedFields', current.filter((f) => f.name !== fieldName));
    } else {
      setValue('selectedFields', [...current, { name: fieldName, alias: '', aggregate: '' }]);
    }
  };

  // Selecionar todos os campos
  const selectAllFields = () => {
    setValue('selectedFields', entityFields.map((f) => ({ name: f.name, alias: '', aggregate: '' })));
  };

  // Limpar campos
  const clearFields = () => {
    setValue('selectedFields', []);
  };

  // Atualizar alias/aggregate de campo
  const updateFieldConfig = (index: number, key: 'alias' | 'aggregate', value: string) => {
    const current = [...selectedFields];
    current[index] = { ...current[index], [key]: value };
    setValue('selectedFields', current);
  };

  // Toggle group by
  const toggleGroupBy = (fieldName: string) => {
    const current = groupBy || [];
    if (current.includes(fieldName)) {
      setValue('groupBy', current.filter((f) => f !== fieldName));
    } else {
      setValue('groupBy', [...current, fieldName]);
    }
  };

  // Gerar SQL Preview
  const sqlPreview = useMemo(() => {
    if (!selectedEntity) return '';

    const parts: string[] = [];
    
    // SELECT
    const selectPart = selectedFields.length > 0
      ? selectedFields.map((f) => {
          let col = f.aggregate ? `${f.aggregate.toUpperCase()}(${f.name})` : f.name;
          if (f.alias) col += ` AS ${f.alias}`;
          return col;
        }).join(', ')
      : '*';
    parts.push(`SELECT ${distinct ? 'DISTINCT ' : ''}${selectPart}`);
    
    // FROM
    parts.push(`FROM ${selectedEntity.slug}`);
    
    // WHERE
    if (filters.length > 0) {
      const whereClauses = filters.map((f) => {
        const op = FILTER_OPERATORS.find((o) => o.value === f.operator);
        const val = f.valueType === 'param' ? `:${f.paramName}` : `'${f.value || ''}'`;
        if (f.operator === 'is_null' || f.operator === 'is_not_null') {
          return `${f.field} ${op?.sql}`;
        }
        return `${f.field} ${op?.sql || '='} ${val}`;
      });
      parts.push(`WHERE ${whereClauses.join(' AND ')}`);
    }
    
    // GROUP BY
    if (groupBy.length > 0) {
      parts.push(`GROUP BY ${groupBy.join(', ')}`);
    }
    
    // ORDER BY
    if (orderBy.length > 0) {
      const orderClauses = orderBy.map((o) => `${o.field} ${o.direction.toUpperCase()}`);
      parts.push(`ORDER BY ${orderClauses.join(', ')}`);
    }
    
    // LIMIT
    if (limitRecords) {
      parts.push(`LIMIT ${limitRecords}`);
    }

    return parts.join('\n');
  }, [selectedEntity, selectedFields, filters, orderBy, groupBy, distinct, limitRecords]);

  // Submit
  const onSubmit = async (data: ApiForm) => {
    setIsLoading(true);
    setError(null);
    try {
      const payload = {
        ...data,
        selectedFields: data.selectedFields?.map((f) => f.name) || [],
        orderBy: data.orderBy && data.orderBy.length > 0 ? data.orderBy[0] : null,
        filters: data.filters?.map((f) => ({
          field: f.field,
          operator: f.operator,
          value: f.valueType === 'static' ? f.value : undefined,
        })),
        queryParams: data.filters?.filter((f) => f.valueType === 'param').map((f) => ({
          field: f.field,
          operator: f.operator,
          paramName: f.paramName,
          required: true,
        })),
      };
      await api.post('/custom-apis', payload);
      router.push('/apis');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Erro ao criar API');
    } finally {
      setIsLoading(false);
    }
  };

  // Testar API
  const testApi = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      if (!sourceEntityId) {
        setTestResult({ error: 'Selecione uma entidade' });
        return;
      }
      const entity = entities.find((e) => e.id === sourceEntityId);
      if (!entity) {
        setTestResult({ error: 'Entidade não encontrada' });
        return;
      }

      const response = await api.get(`/data/${organizationId}/${entity.slug}`);
      const data = Array.isArray(response.data) ? response.data : response.data?.data || [];
      
      // Aplicar campos selecionados
      const fields = selectedFields.map((f) => f.name);
      const filtered = fields.length > 0
        ? data.map((record: any) => {
            const result: any = { id: record.id };
            for (const field of fields) {
              if (record.data && field in record.data) {
                result[field] = record.data[field];
              }
            }
            return result;
          })
        : data.map((record: any) => ({ id: record.id, ...record.data }));

      const limited = limitRecords ? filtered.slice(0, limitRecords) : filtered;

      setTestResult({
        success: true,
        count: limited.length,
        data: limited.slice(0, 5),
      });
    } catch (err: any) {
      setTestResult({ error: err?.response?.data?.message || 'Erro ao testar' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/apis')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Nova API Customizada</h1>
            <p className="text-muted-foreground">Construa sua API visualmente como um SELECT SQL</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-6 xl:grid-cols-3">
          {/* Coluna Principal - Query Builder */}
          <div className="xl:col-span-2 space-y-4">
            {/* Informações Básicas */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings className="h-5 w-5" />
                  Configuração da API
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input placeholder="Listar Clientes" {...register('name')} />
                    {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Método HTTP *</Label>
                    <Select value={method} onValueChange={(v) => setValue('method', v as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HTTP_METHODS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${m.color}`} />
                              <span className="font-mono font-bold">{m.label}</span>
                              <span className="text-muted-foreground text-xs">- {m.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Path *</Label>
                    <div className="flex">
                      <span className="flex items-center px-3 bg-muted border border-r-0 rounded-l-md text-sm text-muted-foreground">
                        /api/v1/x/
                      </span>
                      <Input
                        placeholder="clientes-ativos"
                        className="rounded-l-none"
                        {...register('path')}
                      />
                    </div>
                    {errors.path && <p className="text-xs text-destructive">{errors.path.message}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea placeholder="O que esta API faz..." rows={2} {...register('description')} />
                </div>
              </CardContent>
            </Card>

            {/* Modo de Configuração */}
            <Card>
              <CardContent className="pt-6">
                <Tabs value={mode} onValueChange={(v) => setValue('mode', v as any)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="visual" className="flex items-center gap-2">
                      <Wand2 className="h-4 w-4" />
                      Query Builder Visual
                    </TabsTrigger>
                    <TabsTrigger value="code" className="flex items-center gap-2">
                      <Code className="h-4 w-4" />
                      Código (Avançado)
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardContent>
            </Card>

            {/* Query Builder Visual */}
            {mode === 'visual' && (
              <Card className="border-2 border-dashed border-primary/30">
                <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-transparent">
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-primary" />
                    Query Builder
                  </CardTitle>
                  <CardDescription>
                    Construa sua consulta como um SELECT SQL
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  {/* FROM - Seleção de Entidade */}
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-3 mb-3">
                      <Badge variant="outline" className="bg-blue-100 text-blue-700 font-mono text-sm px-3 py-1">
                        FROM
                      </Badge>
                      <span className="text-sm text-muted-foreground">Selecione a entidade fonte dos dados</span>
                    </div>
                    <Select
                      value={sourceEntityId || ''}
                      onValueChange={(v) => setValue('sourceEntityId', v)}
                      disabled={loadingEntities}
                    >
                      <SelectTrigger className="w-full bg-white dark:bg-background">
                        <SelectValue placeholder={loadingEntities ? 'Carregando...' : '📦 Selecione uma entidade'} />
                      </SelectTrigger>
                      <SelectContent>
                        {entities.map((entity) => (
                          <SelectItem key={entity.id} value={entity.id}>
                            <div className="flex items-center gap-2">
                              <Database className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{entity.name}</span>
                              <span className="text-muted-foreground font-mono text-xs">({entity.slug})</span>
                              <Badge variant="secondary" className="ml-2 text-xs">
                                {entity.fields?.length || 0} campos
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedEntity && (
                    <>
                      {/* SELECT - Campos */}
                      <Collapsible open={expandedSections.select} onOpenChange={() => toggleSection('select')}>
                        <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                          <CollapsibleTrigger className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="bg-green-100 text-green-700 font-mono text-sm px-3 py-1">
                                SELECT
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {selectedFields.length === 0 ? 'Todos os campos (*)' : `${selectedFields.length} campo(s)`}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-2 mr-4" onClick={(e) => e.stopPropagation()}>
                                <Switch
                                  checked={distinct}
                                  onCheckedChange={(v) => setValue('distinct', v)}
                                />
                                <span className="text-xs text-muted-foreground font-mono">DISTINCT</span>
                              </div>
                              {expandedSections.select ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-4">
                            <div className="flex justify-end gap-2 mb-3">
                              <Button type="button" variant="outline" size="sm" onClick={selectAllFields}>
                                Selecionar Todos
                              </Button>
                              <Button type="button" variant="outline" size="sm" onClick={clearFields}>
                                Limpar
                              </Button>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {entityFields.map((field) => {
                                const isSelected = selectedFields.some((f) => f.name === field.name);
                                const fieldIndex = selectedFields.findIndex((f) => f.name === field.name);
                                return (
                                  <div
                                    key={field.name}
                                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                      isSelected
                                        ? 'border-green-500 bg-green-100/50 dark:bg-green-900/30'
                                        : 'border-transparent bg-white dark:bg-background hover:border-green-300'
                                    }`}
                                    onClick={() => toggleField(field.name)}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg">{FIELD_TYPE_ICONS[field.type] || '📌'}</span>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">{field.label || field.name}</p>
                                        <p className="text-xs text-muted-foreground font-mono">{field.name}</p>
                                      </div>
                                      {isSelected && <Check className="h-4 w-4 text-green-600" />}
                                    </div>
                                    {isSelected && fieldIndex >= 0 && (
                                      <div className="mt-2 pt-2 border-t space-y-2" onClick={(e) => e.stopPropagation()}>
                                        <Input
                                          placeholder="Alias (opcional)"
                                          className="h-7 text-xs"
                                          value={selectedFields[fieldIndex]?.alias || ''}
                                          onChange={(e) => updateFieldConfig(fieldIndex, 'alias', e.target.value)}
                                        />
                                        <Select
                                          value={selectedFields[fieldIndex]?.aggregate || ''}
                                          onValueChange={(v) => updateFieldConfig(fieldIndex, 'aggregate', v)}
                                        >
                                          <SelectTrigger className="h-7 text-xs">
                                            <SelectValue placeholder="Função agregadora" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {AGGREGATE_FUNCTIONS.map((fn) => (
                                              <SelectItem key={fn.value} value={fn.value}>
                                                {fn.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>

                      {/* WHERE - Filtros */}
                      <Collapsible open={expandedSections.where} onOpenChange={() => toggleSection('where')}>
                        <div className="p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800">
                          <CollapsibleTrigger className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="bg-orange-100 text-orange-700 font-mono text-sm px-3 py-1">
                                WHERE
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {filterFields.length === 0 ? 'Sem filtros' : `${filterFields.length} filtro(s)`}
                              </span>
                            </div>
                            {expandedSections.where ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-4 space-y-3">
                            {filterFields.map((filterField, index) => (
                              <div key={filterField.id} className="flex flex-wrap items-end gap-2 p-3 bg-white dark:bg-background rounded-lg border">
                                <div className="flex-1 min-w-[120px] space-y-1">
                                  <Label className="text-xs">Campo</Label>
                                  <Select
                                    value={watch(`filters.${index}.field`)}
                                    onValueChange={(v) => setValue(`filters.${index}.field`, v)}
                                  >
                                    <SelectTrigger className="h-9">
                                      <SelectValue placeholder="Campo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {entityFields.map((f) => (
                                        <SelectItem key={f.name} value={f.name}>
                                          {f.label || f.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex-1 min-w-[140px] space-y-1">
                                  <Label className="text-xs">Operador</Label>
                                  <Select
                                    value={watch(`filters.${index}.operator`)}
                                    onValueChange={(v) => setValue(`filters.${index}.operator`, v)}
                                  >
                                    <SelectTrigger className="h-9">
                                      <SelectValue placeholder="Operador" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {FILTER_OPERATORS.map((op) => (
                                        <SelectItem key={op.value} value={op.value}>
                                          <span className="font-mono">{op.label}</span>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex-1 min-w-[100px] space-y-1">
                                  <Label className="text-xs">Tipo</Label>
                                  <Select
                                    value={watch(`filters.${index}.valueType`) || 'static'}
                                    onValueChange={(v) => setValue(`filters.${index}.valueType`, v as any)}
                                  >
                                    <SelectTrigger className="h-9">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="static">📌 Valor Fixo</SelectItem>
                                      <SelectItem value="param">🔗 Parâmetro URL</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex-1 min-w-[120px] space-y-1">
                                  <Label className="text-xs">
                                    {watch(`filters.${index}.valueType`) === 'param' ? 'Nome Parâmetro' : 'Valor'}
                                  </Label>
                                  {watch(`filters.${index}.valueType`) === 'param' ? (
                                    <div className="flex">
                                      <span className="flex items-center px-2 bg-muted border border-r-0 rounded-l text-sm">?</span>
                                      <Input
                                        className="h-9 rounded-l-none"
                                        placeholder="nome_param"
                                        {...register(`filters.${index}.paramName`)}
                                      />
                                    </div>
                                  ) : (
                                    <Input
                                      className="h-9"
                                      placeholder="Valor"
                                      {...register(`filters.${index}.value`)}
                                    />
                                  )}
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9"
                                  onClick={() => removeFilter(index)}
                                >
                                  <X className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            ))}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => appendFilter({ field: '', operator: 'equals', value: '', valueType: 'static' })}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Adicionar Filtro
                            </Button>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>

                      {/* ORDER BY */}
                      <Collapsible open={expandedSections.orderBy} onOpenChange={() => toggleSection('orderBy')}>
                        <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                          <CollapsibleTrigger className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="bg-purple-100 text-purple-700 font-mono text-sm px-3 py-1">
                                ORDER BY
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {orderByFields.length === 0 ? 'Sem ordenação' : `${orderByFields.length} campo(s)`}
                              </span>
                            </div>
                            {expandedSections.orderBy ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-4 space-y-3">
                            {orderByFields.map((orderField, index) => (
                              <div key={orderField.id} className="flex items-end gap-2 p-3 bg-white dark:bg-background rounded-lg border">
                                <div className="flex-1 space-y-1">
                                  <Label className="text-xs">Campo</Label>
                                  <Select
                                    value={watch(`orderBy.${index}.field`)}
                                    onValueChange={(v) => setValue(`orderBy.${index}.field`, v)}
                                  >
                                    <SelectTrigger className="h-9">
                                      <SelectValue placeholder="Campo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {entityFields.map((f) => (
                                        <SelectItem key={f.name} value={f.name}>{f.label || f.name}</SelectItem>
                                      ))}
                                      <SelectItem value="createdAt">📅 Data de Criação</SelectItem>
                                      <SelectItem value="updatedAt">📅 Data de Atualização</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="w-40 space-y-1">
                                  <Label className="text-xs">Direção</Label>
                                  <Select
                                    value={watch(`orderBy.${index}.direction`)}
                                    onValueChange={(v) => setValue(`orderBy.${index}.direction`, v as any)}
                                  >
                                    <SelectTrigger className="h-9">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="asc">↑ Crescente (ASC)</SelectItem>
                                      <SelectItem value="desc">↓ Decrescente (DESC)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeOrderBy(index)}>
                                  <X className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            ))}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => appendOrderBy({ field: '', direction: 'asc' })}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Adicionar Ordenação
                            </Button>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>

                      {/* GROUP BY */}
                      <Collapsible open={expandedSections.groupBy} onOpenChange={() => toggleSection('groupBy')}>
                        <div className="p-4 bg-pink-50 dark:bg-pink-950/30 rounded-lg border border-pink-200 dark:border-pink-800">
                          <CollapsibleTrigger className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="bg-pink-100 text-pink-700 font-mono text-sm px-3 py-1">
                                GROUP BY
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {groupBy.length === 0 ? 'Sem agrupamento' : `${groupBy.length} campo(s)`}
                              </span>
                            </div>
                            {expandedSections.groupBy ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-4">
                            <p className="text-sm text-muted-foreground mb-3">Clique nos campos para agrupar:</p>
                            <div className="flex flex-wrap gap-2">
                              {entityFields.map((field) => {
                                const isGrouped = groupBy.includes(field.name);
                                return (
                                  <Badge
                                    key={field.name}
                                    variant={isGrouped ? 'default' : 'outline'}
                                    className={`cursor-pointer transition-all ${isGrouped ? 'bg-pink-500 hover:bg-pink-600' : 'hover:bg-pink-100'}`}
                                    onClick={() => toggleGroupBy(field.name)}
                                  >
                                    {field.label || field.name}
                                    {isGrouped && <X className="h-3 w-3 ml-1" />}
                                  </Badge>
                                );
                              })}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>

                      {/* LIMIT e Opções */}
                      <Collapsible open={expandedSections.options} onOpenChange={() => toggleSection('options')}>
                        <div className="p-4 bg-gray-50 dark:bg-gray-900/30 rounded-lg border">
                          <CollapsibleTrigger className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="font-mono text-sm px-3 py-1">
                                LIMIT / OPTIONS
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {limitRecords ? `Limite: ${limitRecords}` : 'Sem limite'}
                              </span>
                            </div>
                            {expandedSections.options ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Limite de Registros</Label>
                                <Input
                                  type="number"
                                  placeholder="Sem limite"
                                  {...register('limitRecords', { valueAsNumber: true })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Autenticação</Label>
                                <Select
                                  value={watch('auth') || 'JWT'}
                                  onValueChange={(v) => setValue('auth', v as any)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="JWT">🔐 JWT (Token)</SelectItem>
                                    <SelectItem value="API_KEY">🔑 API Key</SelectItem>
                                    <SelectItem value="NONE">🌍 Pública</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Modo Código */}
            {mode === 'code' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    Código JavaScript
                  </CardTitle>
                  <CardDescription>
                    Modo avançado: escreva código para lógica customizada
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder={`// Variáveis disponíveis:
// - body: corpo da requisição
// - query: parâmetros da URL
// - headers: cabeçalhos
// - user: usuário autenticado
// - db.entityData: acesso aos dados

const dados = await db.entityData.findMany({
  where: {
    entity: { slug: 'cliente' }
  }
});

return dados;`}
                    rows={18}
                    className="font-mono text-sm"
                    {...register('logic')}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Coluna Lateral - Preview */}
          <div className="space-y-4">
            {/* SQL Preview */}
            {mode === 'visual' && selectedEntity && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileJson className="h-5 w-5" />
                    Preview SQL
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-48">
                    <pre className="text-xs font-mono p-3 bg-slate-900 text-green-400 rounded-lg overflow-x-auto whitespace-pre-wrap">
                      {sqlPreview || '-- Selecione uma entidade para ver o preview'}
                    </pre>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* Endpoint Preview */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Endpoint</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-muted rounded-lg font-mono text-sm break-all">
                  <Badge className={HTTP_METHODS.find((m) => m.value === method)?.color}>{method}</Badge>
                  <span className="ml-2 text-muted-foreground">/api/v1/x/</span>
                  <span className="text-primary">{watch('path') || 'endpoint'}</span>
                </div>

                {filters.filter((f) => f.valueType === 'param').length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs">Parâmetros URL:</Label>
                    <div className="flex flex-wrap gap-1">
                      {filters.filter((f) => f.valueType === 'param').map((f, i) => (
                        <Badge key={i} variant="outline" className="font-mono">?{f.paramName}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={testApi}
                  disabled={testing || !sourceEntityId}
                >
                  {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                  Testar API
                </Button>

                {testResult && (
                  <div className={`p-3 rounded-lg text-sm ${testResult.error ? 'bg-destructive/10 text-destructive' : 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'}`}>
                    {testResult.error ? (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        {testResult.error}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="font-medium flex items-center gap-2">
                          <Check className="h-4 w-4" />
                          {testResult.count} registro(s)
                        </p>
                        {testResult.data?.length > 0 && (
                          <ScrollArea className="h-32">
                            <pre className="text-xs bg-white/50 dark:bg-black/20 p-2 rounded overflow-x-auto">
                              {JSON.stringify(testResult.data, null, 2)}
                            </pre>
                          </ScrollArea>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Erros */}
            {error && (
              <Card className="border-destructive">
                <CardContent className="pt-6">
                  <p className="text-sm text-destructive flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Botões */}
            <div className="flex flex-col gap-2">
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                Criar API
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={() => router.push('/apis')}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

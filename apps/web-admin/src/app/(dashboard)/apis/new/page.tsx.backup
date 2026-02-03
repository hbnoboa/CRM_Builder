'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
import { api } from '@/lib/api';
import { useTenant } from '@/stores/tenant-context';

// Operadores de filtro
const FILTER_OPERATORS = [
  { value: 'equals', label: 'Igual a' },
  { value: 'not_equals', label: 'Diferente de' },
  { value: 'contains', label: 'Contem' },
  { value: 'not_contains', label: 'Nao contem' },
  { value: 'starts_with', label: 'Comeca com' },
  { value: 'ends_with', label: 'Termina com' },
  { value: 'gt', label: 'Maior que' },
  { value: 'gte', label: 'Maior ou igual' },
  { value: 'lt', label: 'Menor que' },
  { value: 'lte', label: 'Menor ou igual' },
  { value: 'is_null', label: 'E nulo' },
  { value: 'is_not_null', label: 'Nao e nulo' },
];

// Schema de validacao
const fixedFilterSchema = z.object({
  field: z.string().min(1, 'Campo obrigatorio'),
  operator: z.string().min(1, 'Operador obrigatorio'),
  value: z.any().optional(),
});

const queryParamSchema = z.object({
  field: z.string().min(1, 'Campo obrigatorio'),
  operator: z.string().min(1, 'Operador obrigatorio'),
  paramName: z.string().min(1, 'Nome do parametro obrigatorio'),
  defaultValue: z.any().optional(),
  required: z.boolean().optional(),
});

const apiSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  path: z
    .string()
    .min(1, 'Path obrigatorio')
    .regex(/^[a-z0-9-/]+$/, 'Path deve conter apenas letras minusculas, numeros, hifens e barras'),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  description: z.string().optional(),
  mode: z.enum(['visual', 'code']),
  // Visual mode
  sourceEntityId: z.string().optional(),
  selectedFields: z.array(z.string()).optional(),
  filters: z.array(fixedFilterSchema).optional(),
  queryParams: z.array(queryParamSchema).optional(),
  orderBy: z
    .object({
      field: z.string(),
      direction: z.enum(['asc', 'desc']),
    })
    .optional()
    .nullable(),
  limitRecords: z.number().optional().nullable(),
  // Code mode
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

export default function NewApiPage() {
  const router = useRouter();
  const { workspace } = useTenant();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(true);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

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
      queryParams: [],
      orderBy: null,
      limitRecords: null,
    },
  });

  const {
    fields: filterFields,
    append: appendFilter,
    remove: removeFilter,
  } = useFieldArray({
    control,
    name: 'filters',
  });

  const {
    fields: paramFields,
    append: appendParam,
    remove: removeParam,
  } = useFieldArray({
    control,
    name: 'queryParams',
  });

  const mode = watch('mode');
  const sourceEntityId = watch('sourceEntityId');
  const selectedFields = watch('selectedFields') || [];
  const orderBy = watch('orderBy');

  // Carregar entidades
  useEffect(() => {
    const fetchEntities = async () => {
      try {
        const response = await api.get('/entities');
        const entitiesData = Array.isArray(response.data)
          ? response.data
          : response.data?.data || [];
        setEntities(entitiesData);
      } catch (err) {
        console.error('Error loading entities:', err);
      } finally {
        setLoadingEntities(false);
      }
    };

    fetchEntities();
  }, []);

  // Quando a entidade fonte muda
  useEffect(() => {
    if (sourceEntityId) {
      const entity = entities.find((e) => e.id === sourceEntityId);
      setSelectedEntity(entity || null);
      // Limpar campos selecionados
      setValue('selectedFields', []);
      setValue('filters', []);
      setValue('queryParams', []);
      setValue('orderBy', null);
    } else {
      setSelectedEntity(null);
    }
  }, [sourceEntityId, entities, setValue]);

  const onSubmit = async (data: ApiForm) => {
    setIsLoading(true);
    setError(null);
    try {
      // Preparar dados para envio
      const payload = {
        ...data,
        // Converter para null se vazio
        orderBy: data.orderBy?.field ? data.orderBy : null,
        limitRecords: data.limitRecords || null,
      };

      await api.post('/custom-apis', payload);
      router.push('/apis');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Erro ao criar API');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFieldToggle = (fieldName: string, checked: boolean) => {
    const current = selectedFields || [];
    if (checked) {
      setValue('selectedFields', [...current, fieldName]);
    } else {
      setValue(
        'selectedFields',
        current.filter((f) => f !== fieldName)
      );
    }
  };

  const handleSelectAllFields = () => {
    if (selectedEntity?.fields) {
      setValue(
        'selectedFields',
        selectedEntity.fields.map((f) => f.name)
      );
    }
  };

  const handleDeselectAllFields = () => {
    setValue('selectedFields', []);
  };

  const testApi = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // Simular execucao da API
      const formData = watch();
      if (!formData.sourceEntityId) {
        setTestResult({ error: 'Selecione uma entidade fonte' });
        return;
      }

      // Buscar dados da entidade para preview
      const entity = entities.find((e) => e.id === formData.sourceEntityId);
      if (!entity) {
        setTestResult({ error: 'Entidade nao encontrada' });
        return;
      }

      const response = await api.get(`/entities/${entity.slug}/data`);
      const data = Array.isArray(response.data)
        ? response.data
        : response.data?.data || [];

      // Aplicar filtros de campos selecionados
      const fields = formData.selectedFields || [];
      const filtered =
        fields.length > 0
          ? data.map((record: any) => {
              const result: any = { id: record.id };
              for (const field of fields) {
                if (record.data && field in record.data) {
                  result[field] = record.data[field];
                }
              }
              return result;
            })
          : data.map((record: any) => ({
              id: record.id,
              ...record.data,
            }));

      // Aplicar limite
      const limited = formData.limitRecords
        ? filtered.slice(0, formData.limitRecords)
        : filtered;

      setTestResult({
        success: true,
        count: limited.length,
        data: limited.slice(0, 5), // Mostrar apenas 5 primeiros
      });
    } catch (err: any) {
      setTestResult({
        error: err?.response?.data?.message || 'Erro ao testar API',
      });
    } finally {
      setTesting(false);
    }
  };

  const entityFields = selectedEntity?.fields || [];

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/apis')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nova API</h1>
          <p className="text-muted-foreground">Crie uma API customizada para seus dados</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Coluna Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Informacoes Basicas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Informacoes Basicas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome da API *</Label>
                    <Input
                      id="name"
                      placeholder="Ex: Listar Clientes Ativos"
                      {...register('name')}
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive">{errors.name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="method">Metodo HTTP *</Label>
                    <Select
                      value={watch('method')}
                      onValueChange={(v) => setValue('method', v as any)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GET">
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            GET
                          </Badge>
                        </SelectItem>
                        <SelectItem value="POST">
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            POST
                          </Badge>
                        </SelectItem>
                        <SelectItem value="PUT">
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                            PUT
                          </Badge>
                        </SelectItem>
                        <SelectItem value="PATCH">
                          <Badge variant="outline" className="bg-orange-50 text-orange-700">
                            PATCH
                          </Badge>
                        </SelectItem>
                        <SelectItem value="DELETE">
                          <Badge variant="outline" className="bg-red-50 text-red-700">
                            DELETE
                          </Badge>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="path">Path da API *</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">/api/v1/x/{'{workspace}'}/ </span>
                    <Input
                      id="path"
                      placeholder="meu-endpoint"
                      className="flex-1"
                      {...register('path')}
                    />
                  </div>
                  {errors.path && (
                    <p className="text-sm text-destructive">{errors.path.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descricao</Label>
                  <Textarea
                    id="description"
                    placeholder="Descreva o que esta API faz..."
                    rows={2}
                    {...register('description')}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Modo da API */}
            <Card>
              <CardHeader>
                <CardTitle>Modo de Configuracao</CardTitle>
                <CardDescription>
                  Escolha como deseja configurar sua API
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={mode} onValueChange={(v) => setValue('mode', v as any)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="visual" className="flex items-center gap-2">
                      <Wand2 className="h-4 w-4" />
                      Visual (Recomendado)
                    </TabsTrigger>
                    <TabsTrigger value="code" className="flex items-center gap-2">
                      <Code className="h-4 w-4" />
                      Codigo (Avancado)
                    </TabsTrigger>
                  </TabsList>

                  {/* MODO VISUAL */}
                  <TabsContent value="visual" className="space-y-6 mt-6">
                    {/* Selecao de Entidade */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        Entidade Fonte *
                      </Label>
                      <Select
                        value={sourceEntityId || ''}
                        onValueChange={(v) => setValue('sourceEntityId', v)}
                        disabled={loadingEntities}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              loadingEntities ? 'Carregando...' : 'Selecione uma entidade'
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {entities.map((entity) => (
                            <SelectItem key={entity.id} value={entity.id}>
                              <span className="flex items-center gap-2">
                                <Database className="h-4 w-4 text-muted-foreground" />
                                {entity.name}
                                <span className="text-muted-foreground">({entity.slug})</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        Selecione de qual entidade os dados serao buscados
                      </p>
                    </div>

                    {selectedEntity && (
                      <>
                        <Separator />

                        {/* Campos a Retornar */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-2">
                              <Eye className="h-4 w-4" />
                              Campos a Retornar
                            </Label>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleSelectAllFields}
                              >
                                Todos
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleDeselectAllFields}
                              >
                                Nenhum
                              </Button>
                            </div>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {entityFields.map((field) => (
                              <div
                                key={field.name}
                                className="flex items-center space-x-2 p-2 border rounded-md hover:bg-muted/50"
                              >
                                <Checkbox
                                  id={`field-${field.name}`}
                                  checked={selectedFields.includes(field.name)}
                                  onCheckedChange={(checked) =>
                                    handleFieldToggle(field.name, !!checked)
                                  }
                                />
                                <Label
                                  htmlFor={`field-${field.name}`}
                                  className="flex-1 cursor-pointer"
                                >
                                  <span className="font-medium">{field.label || field.name}</span>
                                  <span className="text-xs text-muted-foreground ml-2">
                                    ({field.type})
                                  </span>
                                </Label>
                              </div>
                            ))}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {selectedFields.length === 0
                              ? 'Todos os campos serao retornados'
                              : `${selectedFields.length} campo(s) selecionado(s)`}
                          </p>
                        </div>

                        <Separator />

                        {/* Filtros Fixos */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-2">
                              <Filter className="h-4 w-4" />
                              Filtros Fixos
                            </Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                appendFilter({ field: '', operator: 'equals', value: '' })
                              }
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Adicionar Filtro
                            </Button>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Filtros que serao sempre aplicados
                          </p>

                          {filterFields.map((filterField, index) => (
                            <div
                              key={filterField.id}
                              className="flex items-end gap-2 p-3 border rounded-md bg-muted/30"
                            >
                              <div className="flex-1 space-y-1">
                                <Label className="text-xs">Campo</Label>
                                <Select
                                  value={watch(`filters.${index}.field`)}
                                  onValueChange={(v) => setValue(`filters.${index}.field`, v)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
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
                              <div className="flex-1 space-y-1">
                                <Label className="text-xs">Operador</Label>
                                <Select
                                  value={watch(`filters.${index}.operator`)}
                                  onValueChange={(v) => setValue(`filters.${index}.operator`, v)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {FILTER_OPERATORS.map((op) => (
                                      <SelectItem key={op.value} value={op.value}>
                                        {op.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex-1 space-y-1">
                                <Label className="text-xs">Valor</Label>
                                <Input
                                  placeholder="Valor fixo"
                                  {...register(`filters.${index}.value`)}
                                />
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeFilter(index)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>

                        <Separator />

                        {/* Parametros Dinamicos */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-2">
                              <Settings className="h-4 w-4" />
                              Parametros da URL
                            </Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                appendParam({
                                  field: '',
                                  operator: 'equals',
                                  paramName: '',
                                  defaultValue: '',
                                  required: false,
                                })
                              }
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Adicionar Parametro
                            </Button>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Filtros dinamicos passados via ?param=valor
                          </p>

                          {paramFields.map((paramField, index) => (
                            <div
                              key={paramField.id}
                              className="p-3 border rounded-md bg-muted/30 space-y-3"
                            >
                              <div className="flex items-end gap-2">
                                <div className="flex-1 space-y-1">
                                  <Label className="text-xs">Campo</Label>
                                  <Select
                                    value={watch(`queryParams.${index}.field`)}
                                    onValueChange={(v) => setValue(`queryParams.${index}.field`, v)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecione" />
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
                                <div className="flex-1 space-y-1">
                                  <Label className="text-xs">Operador</Label>
                                  <Select
                                    value={watch(`queryParams.${index}.operator`)}
                                    onValueChange={(v) =>
                                      setValue(`queryParams.${index}.operator`, v)
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {FILTER_OPERATORS.map((op) => (
                                        <SelectItem key={op.value} value={op.value}>
                                          {op.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex-1 space-y-1">
                                  <Label className="text-xs">Nome do Parametro</Label>
                                  <Input
                                    placeholder="Ex: cidade"
                                    {...register(`queryParams.${index}.paramName`)}
                                  />
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeParam(index)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="flex-1 space-y-1">
                                  <Label className="text-xs">Valor Padrao (opcional)</Label>
                                  <Input
                                    placeholder="Valor se nao informado"
                                    {...register(`queryParams.${index}.defaultValue`)}
                                  />
                                </div>
                                <div className="flex items-center space-x-2 pt-5">
                                  <Checkbox
                                    id={`required-${index}`}
                                    checked={watch(`queryParams.${index}.required`)}
                                    onCheckedChange={(checked) =>
                                      setValue(`queryParams.${index}.required`, !!checked)
                                    }
                                  />
                                  <Label htmlFor={`required-${index}`} className="text-xs">
                                    Obrigatorio
                                  </Label>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <Separator />

                        {/* Ordenacao e Limite */}
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              <SortAsc className="h-4 w-4" />
                              Ordenar por
                            </Label>
                            <div className="flex gap-2">
                              <Select
                                value={orderBy?.field || ''}
                                onValueChange={(v) =>
                                  setValue('orderBy', v ? { field: v, direction: orderBy?.direction || 'asc' } : null)
                                }
                              >
                                <SelectTrigger className="flex-1">
                                  <SelectValue placeholder="Nenhum" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="">Nenhum</SelectItem>
                                  {entityFields.map((f) => (
                                    <SelectItem key={f.name} value={f.name}>
                                      {f.label || f.name}
                                    </SelectItem>
                                  ))}
                                  <SelectItem value="createdAt">Data de Criacao</SelectItem>
                                  <SelectItem value="updatedAt">Data de Atualizacao</SelectItem>
                                </SelectContent>
                              </Select>
                              <Select
                                value={orderBy?.direction || 'asc'}
                                onValueChange={(v) =>
                                  orderBy?.field &&
                                  setValue('orderBy', { field: orderBy.field, direction: v as any })
                                }
                                disabled={!orderBy?.field}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="asc">Crescente</SelectItem>
                                  <SelectItem value="desc">Decrescente</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>Limite de Registros</Label>
                            <Input
                              type="number"
                              placeholder="Sem limite"
                              {...register('limitRecords', { valueAsNumber: true })}
                            />
                            <p className="text-xs text-muted-foreground">
                              Deixe vazio para retornar todos
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </TabsContent>

                  {/* MODO CODIGO */}
                  <TabsContent value="code" className="space-y-4 mt-6">
                    <div className="space-y-2">
                      <Label>Codigo JavaScript</Label>
                      <Textarea
                        placeholder={`// Variaveis disponiveis:
// - body: corpo da requisicao
// - query: parametros da URL
// - headers: cabecalhos
// - user: usuario autenticado
// - db.entityData: acesso aos dados

const dados = await db.entityData.findMany({
  where: {
    entity: { slug: 'cliente' }
  }
});

return dados;`}
                        rows={15}
                        className="font-mono text-sm"
                        {...register('logic')}
                      />
                      <p className="text-sm text-muted-foreground">
                        Modo avancado: escreva codigo JavaScript para logica customizada
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Coluna Lateral - Preview */}
          <div className="space-y-6">
            {/* Preview do Endpoint */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-muted rounded-md font-mono text-sm break-all">
                  <span className="text-green-600 font-bold">{watch('method')}</span>{' '}
                  <span className="text-muted-foreground">/api/v1/x/{workspace?.id?.slice(0, 8) || '{workspace}'}/ </span>
                  <span className="text-primary">{watch('path') || 'seu-endpoint'}</span>
                </div>

                {mode === 'visual' && selectedEntity && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Entidade:</span>
                      <span className="font-medium">{selectedEntity.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Campos:</span>
                      <span className="font-medium">
                        {selectedFields.length || 'Todos'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Filtros fixos:</span>
                      <span className="font-medium">{filterFields.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Parametros URL:</span>
                      <span className="font-medium">{paramFields.length}</span>
                    </div>
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={testApi}
                  disabled={testing || (mode === 'visual' && !sourceEntityId)}
                >
                  {testing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Testar API
                </Button>

                {testResult && (
                  <div
                    className={`p-3 rounded-md text-sm ${
                      testResult.error
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-green-50 text-green-800'
                    }`}
                  >
                    {testResult.error ? (
                      <p>{testResult.error}</p>
                    ) : (
                      <div className="space-y-2">
                        <p className="font-medium">
                          {testResult.count} registro(s) encontrado(s)
                        </p>
                        {testResult.data?.length > 0 && (
                          <pre className="text-xs overflow-auto max-h-40 bg-white/50 p-2 rounded">
                            {JSON.stringify(testResult.data, null, 2)}
                          </pre>
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
                  <p className="text-sm text-destructive">{error}</p>
                </CardContent>
              </Card>
            )}

            {/* Botoes */}
            <div className="flex flex-col gap-2">
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar API'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => router.push('/apis')}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

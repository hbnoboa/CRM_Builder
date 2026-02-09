'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  Database,
  Plus,
  Search,
  Edit,
  Trash2,
  RefreshCw,
  Loader2,
  Filter,
  Columns3,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useTenant } from '@/stores/tenant-context';
import { useAuthStore } from '@/stores/auth-store';
import { RecordFormDialog } from '@/components/data/record-form-dialog';
import { useDeleteEntityData } from '@/hooks/use-data';
import type { EntityField } from '@/types';

// Tipos de filtro
type FilterOperator = 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'isEmpty' | 'isNotEmpty';

interface ActiveFilter {
  fieldSlug: string;
  fieldName: string;
  fieldType: string;
  operator: FilterOperator;
  value: unknown;
  value2?: unknown; // Para operador 'between'
}

// Operadores disponiveis por tipo de campo (keys para traducao)
const OPERATORS_BY_TYPE: Record<string, { value: FilterOperator; labelKey: string }[]> = {
  text: [
    { value: 'contains', labelKey: 'contains' },
    { value: 'equals', labelKey: 'equals' },
    { value: 'startsWith', labelKey: 'startsWith' },
    { value: 'endsWith', labelKey: 'endsWith' },
    { value: 'isEmpty', labelKey: 'isEmpty' },
    { value: 'isNotEmpty', labelKey: 'isNotEmpty' },
  ],
  number: [
    { value: 'equals', labelKey: 'equals' },
    { value: 'gt', labelKey: 'gt' },
    { value: 'gte', labelKey: 'gte' },
    { value: 'lt', labelKey: 'lt' },
    { value: 'lte', labelKey: 'lte' },
    { value: 'between', labelKey: 'between' },
    { value: 'isEmpty', labelKey: 'isEmpty' },
  ],
  date: [
    { value: 'equals', labelKey: 'equals' },
    { value: 'gt', labelKey: 'after' },
    { value: 'gte', labelKey: 'afterOrOn' },
    { value: 'lt', labelKey: 'before' },
    { value: 'lte', labelKey: 'beforeOrOn' },
    { value: 'between', labelKey: 'between' },
    { value: 'isEmpty', labelKey: 'isEmpty' },
  ],
  boolean: [
    { value: 'equals', labelKey: 'equals' },
  ],
  select: [
    { value: 'equals', labelKey: 'equals' },
    { value: 'isEmpty', labelKey: 'isEmpty' },
    { value: 'isNotEmpty', labelKey: 'isNotEmpty' },
  ],
};

// Mapear tipos de campo para categoria de operadores
function getOperatorCategory(fieldType: string): string {
  const textTypes = ['text', 'textarea', 'richtext', 'email', 'phone', 'url', 'cpf', 'cnpj', 'cep', 'password'];
  const numberTypes = ['number', 'currency', 'percentage', 'rating', 'slider'];
  const dateTypes = ['date', 'datetime', 'time'];
  const booleanTypes = ['boolean'];
  const selectTypes = ['select', 'multiselect', 'api-select', 'relation'];

  if (textTypes.includes(fieldType)) return 'text';
  if (numberTypes.includes(fieldType)) return 'number';
  if (dateTypes.includes(fieldType)) return 'date';
  if (booleanTypes.includes(fieldType)) return 'boolean';
  if (selectTypes.includes(fieldType)) return 'select';
  return 'text';
}

// Obter operadores para um tipo de campo
function getOperatorsForField(fieldType: string): { value: FilterOperator; labelKey: string }[] {
  const category = getOperatorCategory(fieldType);
  return OPERATORS_BY_TYPE[category] || OPERATORS_BY_TYPE.text;
}

interface Entity {
  id: string;
  name: string;
  slug: string;
  description?: string;
  fields?: EntityField[];
  _count?: {
    data: number;
  };
}

interface DataRecord {
  id: string;
  tenantId?: string;
  tenant?: {
    id: string;
    name: string;
    slug: string;
  };
  data: { [key: string]: unknown };
  createdAt: string;
  updatedAt: string;
}

// Helper para formatar valores de select/multiselect
function formatCellValue(val: unknown): string {
  if (val === null || val === undefined) return '-';
  if (typeof val === 'object' && val !== null) {
    if ('label' in (val as Record<string, unknown>)) {
      return String((val as Record<string, unknown>).label);
    }
    if ('value' in (val as Record<string, unknown>)) {
      return String((val as Record<string, unknown>).value);
    }
    if (Array.isArray(val)) {
      return val.map(v => formatCellValue(v)).join(', ');
    }
    return JSON.stringify(val);
  }
  return String(val);
}

// Avalia se um valor satisfaz um filtro
function evaluateFilter(value: unknown, filter: ActiveFilter): boolean {
  const { operator, value: filterValue, value2 } = filter;

  // Operadores que nao precisam de valor
  if (operator === 'isEmpty') {
    return value === null || value === undefined || value === '' ||
           (Array.isArray(value) && value.length === 0);
  }
  if (operator === 'isNotEmpty') {
    return value !== null && value !== undefined && value !== '' &&
           !(Array.isArray(value) && value.length === 0);
  }

  // Normalizar valor para comparacao
  const normalizedValue = formatCellValue(value).toLowerCase();
  const normalizedFilterValue = String(filterValue || '').toLowerCase();

  switch (operator) {
    case 'equals':
      if (filter.fieldType === 'boolean') {
        return value === filterValue;
      }
      return normalizedValue === normalizedFilterValue;

    case 'contains':
      return normalizedValue.includes(normalizedFilterValue);

    case 'startsWith':
      return normalizedValue.startsWith(normalizedFilterValue);

    case 'endsWith':
      return normalizedValue.endsWith(normalizedFilterValue);

    case 'gt': {
      const numValue = parseFloat(String(value));
      const numFilter = parseFloat(String(filterValue));
      if (filter.fieldType === 'date' || filter.fieldType === 'datetime') {
        return new Date(String(value)) > new Date(String(filterValue));
      }
      return !isNaN(numValue) && !isNaN(numFilter) && numValue > numFilter;
    }

    case 'gte': {
      const numValue = parseFloat(String(value));
      const numFilter = parseFloat(String(filterValue));
      if (filter.fieldType === 'date' || filter.fieldType === 'datetime') {
        return new Date(String(value)) >= new Date(String(filterValue));
      }
      return !isNaN(numValue) && !isNaN(numFilter) && numValue >= numFilter;
    }

    case 'lt': {
      const numValue = parseFloat(String(value));
      const numFilter = parseFloat(String(filterValue));
      if (filter.fieldType === 'date' || filter.fieldType === 'datetime') {
        return new Date(String(value)) < new Date(String(filterValue));
      }
      return !isNaN(numValue) && !isNaN(numFilter) && numValue < numFilter;
    }

    case 'lte': {
      const numValue = parseFloat(String(value));
      const numFilter = parseFloat(String(filterValue));
      if (filter.fieldType === 'date' || filter.fieldType === 'datetime') {
        return new Date(String(value)) <= new Date(String(filterValue));
      }
      return !isNaN(numValue) && !isNaN(numFilter) && numValue <= numFilter;
    }

    case 'between': {
      if (filter.fieldType === 'date' || filter.fieldType === 'datetime') {
        const dateValue = new Date(String(value));
        return dateValue >= new Date(String(filterValue)) && dateValue <= new Date(String(value2));
      }
      const numValue = parseFloat(String(value));
      const numMin = parseFloat(String(filterValue));
      const numMax = parseFloat(String(value2));
      return !isNaN(numValue) && !isNaN(numMin) && !isNaN(numMax) &&
             numValue >= numMin && numValue <= numMax;
    }

    default:
      return true;
  }
}

// Formatar label do filtro para exibicao (requer funcao de traducao)
function formatFilterLabel(
  filter: ActiveFilter,
  t: (key: string) => string,
  tCommon: (key: string) => string
): string {
  const operators: Record<FilterOperator, string> = {
    equals: '=',
    contains: t('filter.operators.contains').toLowerCase(),
    startsWith: t('filter.operators.startsWith').toLowerCase(),
    endsWith: t('filter.operators.endsWith').toLowerCase(),
    gt: '>',
    gte: '>=',
    lt: '<',
    lte: '<=',
    between: t('filter.operators.between').toLowerCase(),
    isEmpty: t('filter.labels.empty'),
    isNotEmpty: t('filter.labels.filled'),
  };

  if (filter.operator === 'isEmpty' || filter.operator === 'isNotEmpty') {
    return `${filter.fieldName}: ${operators[filter.operator]}`;
  }

  if (filter.operator === 'between') {
    return `${filter.fieldName}: ${filter.value} - ${filter.value2}`;
  }

  if (filter.fieldType === 'boolean') {
    return `${filter.fieldName}: ${filter.value ? tCommon('yes') : tCommon('no')}`;
  }

  return `${filter.fieldName} ${operators[filter.operator]} ${filter.value}`;
}

export default function DataPage() {
  const t = useTranslations('data');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');
  const { user: currentUser } = useAuthStore();
  const { tenantId, loading: tenantLoading } = useTenant();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [records, setRecords] = useState<DataRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<DataRecord | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<DataRecord | null>(null);

  // Estados de filtro e colunas
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [newFilter, setNewFilter] = useState<Partial<ActiveFilter>>({});

  const deleteRecord = useDeleteEntityData();

  useEffect(() => {
    fetchEntities();
  }, []);

  const fetchEntities = async () => {
    try {
      const response = await api.get('/entities');
      const list = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setEntities(list);
      if (list.length > 0 && !selectedEntity) {
        setSelectedEntity(list[0]);
        fetchRecords(list[0].slug);
      }
    } catch (error) {
      console.error('Erro ao carregar entidades:', error);
      setEntities([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecords = async (entitySlug: string): Promise<DataRecord[]> => {
    if (!tenantId) return [];
    setLoadingRecords(true);
    try {
      const response = await api.get(`/data/${entitySlug}`);
      const list = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setRecords(list);
      return list;
    } catch (error) {
      console.error('Erro ao carregar registros:', error);
      setRecords([]);
      return [];
    } finally {
      setLoadingRecords(false);
    }
  };

  const handleEntitySelect = async (entity: Entity) => {
    if (!entity.fields) {
      try {
        const res = await api.get(`/entities/${entity.id}`);
        entity = { ...entity, ...res.data };
        setEntities(prev => prev.map(e => (e.id === entity.id ? entity : e)));
      } catch {}
    }
    setSelectedEntity(entity);
    resetFilters(); // Limpar filtros ao trocar de entidade
    const data = await fetchRecords(entity.slug);
    if (data.length === 0 && tenantId) {
      setSelectedRecord(null);
      setFormDialogOpen(true);
    }
  };

  const handleNewRecord = () => {
    setSelectedRecord(null);
    setFormDialogOpen(true);
  };

  const handleEditRecord = (record: DataRecord) => {
    setSelectedRecord(record);
    setFormDialogOpen(true);
  };

  const handleDeleteClick = (record: DataRecord) => {
    setRecordToDelete(record);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete || !selectedEntity || !tenantId) return;
    try {
      await deleteRecord.mutateAsync({
        entitySlug: selectedEntity.slug,
        id: recordToDelete.id,
      });
      setRecords(prev => prev.filter(r => r.id !== recordToDelete.id));
    } catch {
      // Erro tratado pelo hook
    } finally {
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    }
  };

  const handleFormSuccess = () => {
    if (selectedEntity) fetchRecords(selectedEntity.slug);
  };

  // Resetar filtros ao trocar de entidade
  const resetFilters = useCallback(() => {
    setActiveFilters([]);
    setHiddenColumns(new Set());
    setSearchTerm('');
    setNewFilter({});
  }, []);

  // Handler para adicionar filtro
  const handleAddFilter = useCallback(() => {
    if (!newFilter.fieldSlug || !newFilter.operator) return;

    // Para operadores que nao precisam de valor
    if (newFilter.operator === 'isEmpty' || newFilter.operator === 'isNotEmpty') {
      setActiveFilters(prev => [...prev, newFilter as ActiveFilter]);
      setNewFilter({});
      setFilterPopoverOpen(false);
      return;
    }

    // Para outros operadores, precisa de valor
    if (newFilter.value === undefined || newFilter.value === '') return;

    // Para between, precisa de value2
    if (newFilter.operator === 'between' && (newFilter.value2 === undefined || newFilter.value2 === '')) return;

    setActiveFilters(prev => [...prev, newFilter as ActiveFilter]);
    setNewFilter({});
    setFilterPopoverOpen(false);
  }, [newFilter]);

  // Handler para remover filtro
  const handleRemoveFilter = useCallback((index: number) => {
    setActiveFilters(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Handler para limpar todos os filtros
  const handleClearFilters = useCallback(() => {
    setActiveFilters([]);
    setSearchTerm('');
  }, []);

  // Toggle visibilidade de coluna
  const toggleColumnVisibility = useCallback((column: string) => {
    setHiddenColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(column)) {
        newSet.delete(column);
      } else {
        newSet.add(column);
      }
      return newSet;
    });
  }, []);

  // Todas as colunas disponiveis (baseado nos campos da entidade)
  const allColumns = useMemo(() => {
    if (!selectedEntity?.fields) {
      // Fallback: usar chaves do primeiro registro
      if (records.length === 0) return [];
      return Object.keys(records[0].data || {});
    }
    return selectedEntity.fields.map(f => f.slug);
  }, [selectedEntity?.fields, records]);

  // Colunas visiveis (excluindo as ocultas)
  const visibleColumns = useMemo(() => {
    return allColumns.filter(col => !hiddenColumns.has(col));
  }, [allColumns, hiddenColumns]);

  // Obter campo por slug
  const getFieldBySlug = useCallback((slug: string): EntityField | undefined => {
    return selectedEntity?.fields?.find(f => f.slug === slug);
  }, [selectedEntity?.fields]);

  // Campos disponiveis para filtro (permite multiplos filtros por campo)
  const availableFieldsForFilter = useMemo(() => {
    if (!selectedEntity?.fields) return [];
    return selectedEntity.fields.filter(f =>
      !['hidden', 'file', 'image', 'map', 'json', 'richtext', 'sub-entity', 'zone-diagram'].includes(f.type)
    );
  }, [selectedEntity?.fields]);

  // Filtro de busca e filtros ativos
  const filteredRecords = useMemo(() => {
    let result = records;

    // Aplicar busca textual
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(r =>
        allColumns.some(col => formatCellValue(r.data[col]).toLowerCase().includes(term))
      );
    }

    // Aplicar filtros ativos
    if (activeFilters.length > 0) {
      result = result.filter(record => {
        return activeFilters.every(filter => {
          const value = record.data[filter.fieldSlug];
          return evaluateFilter(value, filter);
        });
      });
    }

    return result;
  }, [records, searchTerm, allColumns, activeFilters]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumbs */}
      <nav className="mb-2 flex items-center gap-2 text-sm text-muted-foreground" aria-label="breadcrumb" data-testid="breadcrumb">
        <Link href="/dashboard" className="hover:underline">{tNav('dashboard')}</Link>
        <span>/</span>
        <span className="font-semibold text-foreground">{t('title')}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold" data-testid="page-title">{t('title')}</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            {t('subtitle')}
          </p>
        </div>
        {selectedEntity && (
          <Button
            onClick={handleNewRecord}
            disabled={tenantLoading || !tenantId}
            data-testid="new-record-btn"
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('newRecord')}
          </Button>
        )}
      </div>

      {/* Mobile: Select de Entidades */}
      <div className="lg:hidden">
        {loading ? (
          <div className="animate-pulse h-10 bg-muted rounded-lg" />
        ) : entities.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center">
              <Database className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">{t('noEntitiesCreated')}</p>
              <Link href="/entities">
                <Button variant="link" size="sm" data-testid="create-entity-btn-mobile">
                  {t('createEntity')}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Select
            value={selectedEntity?.id || ''}
            onValueChange={(value) => {
              const entity = entities.find(e => e.id === value);
              if (entity) handleEntitySelect(entity);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('selectEntity')}>
                {selectedEntity && (
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    <span>{selectedEntity.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      ({selectedEntity._count?.data || 0})
                    </span>
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {entities.map(entity => (
                <SelectItem key={entity.id} value={entity.id}>
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    <span>{entity.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      ({entity._count?.data || 0})
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* Sidebar de Entidades - Desktop */}
        <div className="hidden lg:block w-64 space-y-2 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              {tNav('entities')}
            </h3>
            <span className="text-xs text-muted-foreground">{entities.length}</span>
          </div>
          {loading ? (
            <div className="animate-pulse space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-muted rounded-lg" />
              ))}
            </div>
          ) : entities.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Database className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {t('noEntitiesCreated')}
                </p>
                <Link href="/entities">
                  <Button variant="link" size="sm" data-testid="create-entity-btn">
                    {t('createEntity')}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1">
              {entities.map(entity => (
                <button
                  key={entity.id}
                  onClick={() => handleEntitySelect(entity)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${
                    selectedEntity?.id === entity.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Database className="h-4 w-4" />
                    <span className="font-medium">{entity.name}</span>
                  </div>
                  <span className="text-xs opacity-70">
                    {entity._count?.data || 0}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tabela de Registros */}
        <div className="flex-1 min-w-0">
          {selectedEntity ? (
            <Card className="overflow-hidden">
              <CardHeader className="border-b p-4 sm:p-6 space-y-4">
                {/* Linha 1: Titulo e botoes principais */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg sm:text-xl">{selectedEntity.name}</CardTitle>
                    <CardDescription>
                      {t('recordsCount', { filtered: filteredRecords.length, total: records.length })}
                      {activeFilters.length > 0 && ` (${t('filtersActive', { count: activeFilters.length })})`}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Busca */}
                    <div className="relative flex-1 sm:flex-none">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder={tCommon('search')}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-9 w-full sm:w-40 md:w-52"
                      />
                    </div>

                    {/* Botao + Filtrar */}
                    <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1">
                          <Filter className="h-4 w-4" />
                          <span className="hidden sm:inline">{t('filter.title')}</span>
                          {activeFilters.length > 0 && (
                            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                              {activeFilters.length}
                            </Badge>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-4" align="end">
                        <div className="space-y-4">
                          <div className="font-medium">{t('filter.addFilter')}</div>

                          {/* Selecionar campo */}
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">{t('filter.field')}</Label>
                            <Select
                              value={newFilter.fieldSlug || ''}
                              onValueChange={(value) => {
                                const field = getFieldBySlug(value);
                                if (field) {
                                  const operators = getOperatorsForField(field.type);
                                  setNewFilter({
                                    fieldSlug: field.slug,
                                    fieldName: field.name,
                                    fieldType: field.type,
                                    operator: operators[0]?.value,
                                    value: field.type === 'boolean' ? true : undefined,
                                  });
                                }
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={tCommon('selectOption')} />
                              </SelectTrigger>
                              <SelectContent>
                                {availableFieldsForFilter.map(field => (
                                  <SelectItem key={field.slug} value={field.slug}>
                                    {field.name}
                                  </SelectItem>
                                ))}
                                {availableFieldsForFilter.length === 0 && (
                                  <div className="px-2 py-1 text-sm text-muted-foreground">
                                    {t('filter.noFieldsAvailable')}
                                  </div>
                                )}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Selecionar operador */}
                          {newFilter.fieldSlug && (
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">{t('filter.condition')}</Label>
                              <Select
                                value={newFilter.operator || ''}
                                onValueChange={(value) => setNewFilter(prev => ({
                                  ...prev,
                                  operator: value as FilterOperator,
                                  value: prev.fieldType === 'boolean' ? true : undefined,
                                  value2: undefined,
                                }))}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {getOperatorsForField(newFilter.fieldType || 'text').map(op => (
                                    <SelectItem key={op.value} value={op.value}>
                                      {t(`filter.operators.${op.labelKey}`)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {/* Input de valor (baseado no tipo) */}
                          {newFilter.operator &&
                           newFilter.operator !== 'isEmpty' &&
                           newFilter.operator !== 'isNotEmpty' && (
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">{t('filter.value')}</Label>

                              {/* Boolean */}
                              {newFilter.fieldType === 'boolean' && (
                                <div className="flex items-center gap-3">
                                  <Switch
                                    checked={newFilter.value === true}
                                    onCheckedChange={(checked) => setNewFilter(prev => ({
                                      ...prev,
                                      value: checked,
                                    }))}
                                  />
                                  <span className="text-sm">
                                    {newFilter.value ? tCommon('yes') : tCommon('no')}
                                  </span>
                                </div>
                              )}

                              {/* Number/Currency/Percentage */}
                              {['number', 'currency', 'percentage', 'rating', 'slider'].includes(newFilter.fieldType || '') && (
                                <div className="flex gap-2">
                                  <Input
                                    type="number"
                                    placeholder={tCommon('value')}
                                    value={String(newFilter.value || '')}
                                    onChange={(e) => setNewFilter(prev => ({
                                      ...prev,
                                      value: e.target.value ? parseFloat(e.target.value) : undefined,
                                    }))}
                                  />
                                  {newFilter.operator === 'between' && (
                                    <>
                                      <span className="text-muted-foreground self-center">{tCommon('and')}</span>
                                      <Input
                                        type="number"
                                        placeholder={tCommon('value')}
                                        value={String(newFilter.value2 || '')}
                                        onChange={(e) => setNewFilter(prev => ({
                                          ...prev,
                                          value2: e.target.value ? parseFloat(e.target.value) : undefined,
                                        }))}
                                      />
                                    </>
                                  )}
                                </div>
                              )}

                              {/* Date/Datetime */}
                              {['date', 'datetime'].includes(newFilter.fieldType || '') && (
                                <div className="flex gap-2">
                                  <Input
                                    type={newFilter.fieldType === 'datetime' ? 'datetime-local' : 'date'}
                                    value={String(newFilter.value || '')}
                                    onChange={(e) => setNewFilter(prev => ({
                                      ...prev,
                                      value: e.target.value,
                                    }))}
                                  />
                                  {newFilter.operator === 'between' && (
                                    <>
                                      <span className="text-muted-foreground self-center">{tCommon('and')}</span>
                                      <Input
                                        type={newFilter.fieldType === 'datetime' ? 'datetime-local' : 'date'}
                                        value={String(newFilter.value2 || '')}
                                        onChange={(e) => setNewFilter(prev => ({
                                          ...prev,
                                          value2: e.target.value,
                                        }))}
                                      />
                                    </>
                                  )}
                                </div>
                              )}

                              {/* Select/Multiselect - Mostrar opcoes */}
                              {['select', 'multiselect'].includes(newFilter.fieldType || '') && (
                                <Select
                                  value={String(newFilter.value || '')}
                                  onValueChange={(value) => setNewFilter(prev => ({
                                    ...prev,
                                    value,
                                  }))}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder={tCommon('select')} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(getFieldBySlug(newFilter.fieldSlug || '')?.options || []).map(opt => {
                                      const optValue = typeof opt === 'string' ? opt : opt.value;
                                      const optLabel = typeof opt === 'string' ? opt : opt.label;
                                      return (
                                        <SelectItem key={optValue} value={optValue}>
                                          {optLabel}
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                              )}

                              {/* Text (default) */}
                              {['text', 'textarea', 'email', 'phone', 'url', 'cpf', 'cnpj', 'cep', 'password', 'api-select', 'relation'].includes(newFilter.fieldType || '') && (
                                <Input
                                  placeholder={tCommon('value')}
                                  value={String(newFilter.value || '')}
                                  onChange={(e) => setNewFilter(prev => ({
                                    ...prev,
                                    value: e.target.value,
                                  }))}
                                />
                              )}
                            </div>
                          )}

                          {/* Botao adicionar */}
                          <Button
                            onClick={handleAddFilter}
                            className="w-full"
                            disabled={!newFilter.fieldSlug || !newFilter.operator}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            {t('filter.addFilter')}
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>

                    {/* Botao Colunas */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1">
                          <Columns3 className="h-4 w-4" />
                          <span className="hidden sm:inline">{t('filter.columns')}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>{t('filter.visibleColumns')}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {allColumns.map(col => {
                          const field = getFieldBySlug(col);
                          return (
                            <DropdownMenuCheckboxItem
                              key={col}
                              checked={!hiddenColumns.has(col)}
                              onCheckedChange={() => toggleColumnVisibility(col)}
                            >
                              {field?.name || col}
                            </DropdownMenuCheckboxItem>
                          );
                        })}
                        {allColumns.length === 0 && (
                          <div className="px-2 py-1 text-sm text-muted-foreground">
                            {t('filter.noColumns')}
                          </div>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Botao Refresh */}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => fetchRecords(selectedEntity.slug)}
                      className="flex-shrink-0 h-8 w-8"
                    >
                      <RefreshCw className={`h-4 w-4 ${loadingRecords ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>

                {/* Linha 2: Filtros ativos (pills) */}
                {activeFilters.length > 0 && (
                  <div className="flex flex-wrap gap-2 items-center">
                    {activeFilters.map((filter, index) => (
                      <Badge
                        key={`${filter.fieldSlug}-${index}`}
                        variant="secondary"
                        className="gap-1 pl-2 pr-1 py-1"
                      >
                        <span className="text-xs">{formatFilterLabel(filter, t, tCommon)}</span>
                        <button
                          onClick={() => handleRemoveFilter(index)}
                          className="ml-1 rounded-full hover:bg-muted p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearFilters}
                      className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {t('filter.clearAll')}
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {loadingRecords ? (
                  <div className="flex items-center justify-center h-48 sm:h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : filteredRecords.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 sm:h-64 text-center p-4">
                    <Database className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-4" />
                    <h3 className="font-medium mb-1 text-sm sm:text-base">{t('noRecords')}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                      {searchTerm ? t('noSearchResults') : t('startAddingData')}
                    </p>
                    {!searchTerm && (
                      <Button
                        onClick={handleNewRecord}
                        disabled={tenantLoading || !tenantId}
                        data-testid="add-record-btn"
                        size="sm"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {t('addRecord')}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="w-full overflow-hidden">
                    {/* Desktop: Tabela tradicional */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full table-auto">
                        <thead className="bg-muted/50">
                          <tr>
                            {visibleColumns.map(col => {
                              const field = getFieldBySlug(col);
                              return (
                                <th
                                  key={col}
                                  className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                                >
                                  {field?.name || col}
                                </th>
                              );
                            })}
                            {currentUser?.role === 'PLATFORM_ADMIN' && (
                              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                                {tCommon('tenant')}
                              </th>
                            )}
                            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                              {tCommon('createdAt')}
                            </th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-20">
                              {tCommon('actions')}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {filteredRecords.map(record => (
                            <tr key={record.id} className="hover:bg-muted/30">
                              {visibleColumns.map(col => (
                                <td key={col} className="px-3 py-2 text-sm max-w-[200px] truncate">
                                  {formatCellValue(record.data[col])}
                                </td>
                              ))}
                              {currentUser?.role === 'PLATFORM_ADMIN' && (
                                <td className="px-3 py-2 text-sm">
                                  <span className="px-2 py-0.5 text-xs rounded bg-gray-200 text-gray-700" title={record.tenantId}>
                                    {record.tenant?.name || record.tenantId || '-'}
                                  </span>
                                </td>
                              )}
                              <td className="px-3 py-2 text-sm text-muted-foreground whitespace-nowrap">
                                {new Date(record.createdAt).toLocaleDateString('pt-BR')}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleEditRecord(record)}
                                    data-testid={`edit-record-btn-${record.id}`}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => handleDeleteClick(record)}
                                    data-testid={`delete-record-btn-${record.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile: Cards */}
                    <div className="md:hidden divide-y">
                      {filteredRecords.map(record => (
                        <div key={record.id} className="p-3 hover:bg-muted/30">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0 space-y-1">
                              {/* Mostrar primeiras 3 colunas visiveis */}
                              {visibleColumns.slice(0, 3).map((col, idx) => {
                                const field = getFieldBySlug(col);
                                const value = formatCellValue(record.data[col]);
                                return (
                                  <div key={col} className={idx === 0 ? 'font-medium text-sm' : 'text-xs text-muted-foreground'}>
                                    {idx === 0 ? value : `${field?.name || col}: ${value}`}
                                  </div>
                                );
                              })}
                              {visibleColumns.length > 3 && (
                                <div className="text-xs text-muted-foreground">
                                  {t('moreFields', { count: visibleColumns.length - 3 })}
                                </div>
                              )}
                              <div className="text-xs text-muted-foreground pt-1">
                                {new Date(record.createdAt).toLocaleDateString('pt-BR')}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleEditRecord(record)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => handleDeleteClick(record)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64 sm:h-96 p-4">
                <Database className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg sm:text-xl font-medium mb-2 text-center">{t('selectEntity')}</h3>
                <p className="text-muted-foreground text-center text-sm sm:text-base max-w-md">
                  {t('selectEntityHint')}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialog de formulario para criar/editar registro */}
      {selectedEntity && tenantId && (
        <RecordFormDialog
          open={formDialogOpen}
          onOpenChange={setFormDialogOpen}
          entity={{
            id: selectedEntity.id,
            name: selectedEntity.name,
            slug: selectedEntity.slug,
            fields: selectedEntity.fields || [],
          }}
          record={selectedRecord}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* Dialog de confirmacao de exclusao */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteConfirm.message')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRecord.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

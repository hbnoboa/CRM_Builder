'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Check,
  RotateCcw,
  Globe,
  ListFilter,
} from 'lucide-react';
import { RequireRole } from '@/components/auth/require-role';
import { usePermissions } from '@/hooks/use-permissions';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { entitiesService } from '@/services/entities.service';
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
  subField?: string; // Para campos map: 'address' | 'city' | 'uf' | 'lat' | 'lng'
}

// Sub-campos de mapa para filtro
const MAP_SUB_FIELDS = [
  { value: 'address', labelKey: 'mapAddress', category: 'text' },
  { value: 'city', labelKey: 'mapCity', category: 'text' },
  { value: 'uf', labelKey: 'mapState', category: 'text' },
  { value: 'lat', labelKey: 'mapLatitude', category: 'number' },
  { value: 'lng', labelKey: 'mapLongitude', category: 'number' },
] as const;

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
  const numberTypes = ['number', 'currency', 'percentage', 'rating', 'slider', 'sub-entity'];
  const dateTypes = ['date', 'datetime', 'time'];
  const booleanTypes = ['boolean'];
  const selectTypes = ['select', 'multiselect', 'api-select', 'relation', 'zone-diagram'];

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
  settings?: Record<string, unknown>;
  _count?: {
    data: number;
  };
  _parentEntity?: {
    name: string;
    slug: string;
  };
}

interface DataRecord {
  id: string;
  tenantId?: string;
  parentRecordId?: string | null;
  tenant?: {
    id: string;
    name: string;
    slug: string;
  };
  data: { [key: string]: unknown };
  _childCounts?: Record<string, number>;
  _parentDisplay?: string | null;
  _parentEntityName?: string | null;
  _parentEntitySlug?: string | null;
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

  // Para campos map, extrair o sub-campo
  if (filter.fieldType === 'map' && filter.subField) {
    const mapData = (value && typeof value === 'object') ? value as Record<string, unknown> : {};
    const subValue = mapData[filter.subField] ?? null;
    const sub = MAP_SUB_FIELDS.find(s => s.value === filter.subField);
    // Re-avaliar com o sub-valor usando um filtro virtual
    return evaluateFilter(subValue, {
      ...filter,
      fieldType: sub?.category === 'number' ? 'number' : 'text',
      subField: undefined, // Evitar recursao
    });
  }

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
        // Normalizar ambos para boolean antes de comparar
        const boolValue = value === true || value === 'true' || value === 1 || value === '1';
        const boolFilter = filterValue === true || filterValue === 'true' || filterValue === 1 || filterValue === '1';
        return boolValue === boolFilter;
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
      if (['date', 'datetime', 'time'].includes(filter.fieldType)) {
        return String(value) > String(filterValue);
      }
      return !isNaN(numValue) && !isNaN(numFilter) && numValue > numFilter;
    }

    case 'gte': {
      const numValue = parseFloat(String(value));
      const numFilter = parseFloat(String(filterValue));
      if (['date', 'datetime', 'time'].includes(filter.fieldType)) {
        return String(value) >= String(filterValue);
      }
      return !isNaN(numValue) && !isNaN(numFilter) && numValue >= numFilter;
    }

    case 'lt': {
      const numValue = parseFloat(String(value));
      const numFilter = parseFloat(String(filterValue));
      if (['date', 'datetime', 'time'].includes(filter.fieldType)) {
        return String(value) < String(filterValue);
      }
      return !isNaN(numValue) && !isNaN(numFilter) && numValue < numFilter;
    }

    case 'lte': {
      const numValue = parseFloat(String(value));
      const numFilter = parseFloat(String(filterValue));
      if (['date', 'datetime', 'time'].includes(filter.fieldType)) {
        return String(value) <= String(filterValue);
      }
      return !isNaN(numValue) && !isNaN(numFilter) && numValue <= numFilter;
    }

    case 'between': {
      if (['date', 'datetime', 'time'].includes(filter.fieldType)) {
        const strValue = String(value);
        return strValue >= String(filterValue) && strValue <= String(value2);
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

  // Para map, incluir sub-campo no label
  const fieldLabel = filter.fieldType === 'map' && filter.subField
    ? `${filter.fieldName} (${t(`filter.mapFields.${MAP_SUB_FIELDS.find(s => s.value === filter.subField)?.labelKey || 'mapAddress'}`)})`
    : filter.fieldName;

  if (filter.operator === 'isEmpty' || filter.operator === 'isNotEmpty') {
    return `${fieldLabel}: ${operators[filter.operator]}`;
  }

  if (filter.operator === 'between') {
    return `${fieldLabel}: ${filter.value} - ${filter.value2}`;
  }

  if (filter.fieldType === 'boolean') {
    return `${fieldLabel}: ${filter.value ? tCommon('yes') : tCommon('no')}`;
  }

  return `${fieldLabel} ${operators[filter.operator]} ${filter.value}`;
}

function DataPageContent() {
  const t = useTranslations('data');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');
  const searchParams = useSearchParams();
  const entityParam = searchParams.get('entity');
  const { user: currentUser } = useAuthStore();
  const { hasEntityPermission, hasEntityAction } = usePermissions();
  const { tenantId, effectiveTenantId, isPlatformAdmin, loading: tenantLoading } = useTenant();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [records, setRecords] = useState<DataRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Paginacao
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [paginationMeta, setPaginationMeta] = useState<{
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  } | null>(null);

  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<DataRecord | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<DataRecord | null>(null);

  // Field-level permissions (retornadas pelo backend)
  const [serverVisibleFields, setServerVisibleFields] = useState<string[] | null>(null);
  const [serverEditableFields, setServerEditableFields] = useState<string[] | null>(null);

  // Estados de filtro e colunas
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [globalFilters, setGlobalFilters] = useState<ActiveFilter[]>([]);
  const [savingGlobalFilter, setSavingGlobalFilter] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnConfigOpen, setColumnConfigOpen] = useState(false);
  const [columnConfigDraft, setColumnConfigDraft] = useState<{slug: string; visible: boolean}[]>([]);
  const [savingColumnConfig, setSavingColumnConfig] = useState(false);
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [newFilter, setNewFilter] = useState<Partial<ActiveFilter>>({});
  const [saveAsGlobal, setSaveAsGlobal] = useState(false);

  // Filtro por entidade pai (quando clica no badge de sub-entidade)
  const [parentFilter, setParentFilter] = useState<{ parentRecordId: string; parentDisplay: string; parentEntityName: string } | null>(null);

  // Metadados da entidade pai (retornado pela API)
  const [parentEntityMeta, setParentEntityMeta] = useState<{ name: string; slug: string } | null>(null);

  // Busca de registro pai (para filtrar sub-entidade)
  const [parentSearchOpen, setParentSearchOpen] = useState(false);
  const [parentSearchTerm, setParentSearchTerm] = useState('');
  const [parentSearchResults, setParentSearchResults] = useState<Array<{ id: string; display: string }>>([]);
  const [parentSearchLoading, setParentSearchLoading] = useState(false);
  const parentSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filtro: apenas registros com filhos (sub-entidade)
  const [hasChildrenFilter, setHasChildrenFilter] = useState<string | null>(null);

  // Ordenacao por coluna
  const [sortConfig, setSortConfig] = useState<{ field: string; order: 'asc' | 'desc' } | null>(null);

  const deleteRecord = useDeleteEntityData();

  // Counter para evitar race conditions entre requests concorrentes
  const fetchCounterRef = useRef(0);

  // Debounced toast for burst creates via WebSocket
  const newRecordCountRef = useRef(0);
  const newRecordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSelectedEntity(null);
    setRecords([]);
    fetchEntities();
  }, [effectiveTenantId]);

  const fetchEntities = async () => {
    try {
      const params: Record<string, string> = {};
      if (effectiveTenantId) params.tenantId = effectiveTenantId;
      const response = await api.get('/entities', { params });
      const allEntities: Entity[] = Array.isArray(response.data) ? response.data : response.data?.data || [];

      // Identify sub-entity slugs (entities referenced via SUB_ENTITY fields)
      const subEntitySlugs = new Set<string>();
      for (const entity of allEntities) {
        if (entity.fields) {
          for (const field of entity.fields) {
            if (field.type === 'sub-entity' && field.subEntitySlug) {
              subEntitySlugs.add(field.subEntitySlug);
            }
          }
        }
      }

      // Filter out sub-entities - show only parent entities
      const list = allEntities.filter(e => !subEntitySlugs.has(e.slug));

      setEntities(list);
      if (list.length > 0 && !selectedEntity) {
        const target = entityParam
          ? list.find((e: Entity) => e.slug === entityParam) || list[0]
          : list[0];
        setSelectedEntity(target);
        // Extrair globalFilters antes de buscar (mesmo padrao do handleEntityClick)
        const settings = target.settings as Record<string, unknown> | null;
        const entityGlobalFilters = (settings?.globalFilters as ActiveFilter[]) || [];
        setGlobalFilters(entityGlobalFilters);
        fetchRecords(target.slug, 1, '');
      }
    } catch (error) {
      console.error('Erro ao carregar entidades:', error);
      setEntities([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecords = async (entitySlug: string, page = 1, search = '', parentRecordIdOverride?: string | null, sortOverride?: { field: string; order: 'asc' | 'desc' } | null, filtersOverride?: ActiveFilter[]): Promise<DataRecord[]> => {
    if (!tenantId && !isPlatformAdmin) return [];
    const requestId = ++fetchCounterRef.current;
    setLoadingRecords(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(pageSize),
      };
      // null = explicitamente sem filtro de pai; undefined = usar state
      const effectiveParentId = parentRecordIdOverride === null
        ? undefined
        : (parentRecordIdOverride ?? parentFilter?.parentRecordId);
      if (effectiveParentId) {
        params.parentRecordId = effectiveParentId;
      } else {
        params.includeChildren = 'true';
      }
      if (effectiveTenantId) params.tenantId = effectiveTenantId;
      if (search.trim()) params.search = search.trim();
      if (hasChildrenFilter) params.hasChildrenIn = hasChildrenFilter;
      // Ordenacao: null = explicitamente sem sort; undefined = usar state
      const effectiveSort = sortOverride === null ? null : (sortOverride ?? sortConfig);
      if (effectiveSort) {
        params.sortBy = effectiveSort.field;
        params.sortOrder = effectiveSort.order;
      }
      // Filtros: apenas activeFilters do usuario (globalFilters sao aplicados automaticamente no backend)
      const effectiveFilters = filtersOverride ?? [...activeFilters];
      if (effectiveFilters.length > 0) {
        params.filters = JSON.stringify(effectiveFilters);
      }
      const response = await api.get(`/data/${entitySlug}`, { params });
      const list = Array.isArray(response.data) ? response.data : response.data?.data || [];
      const meta = response.data?.meta || null;
      const entityMeta = response.data?.entity;
      // Ignorar resposta se outra request mais recente ja foi disparada
      if (requestId !== fetchCounterRef.current) return [];
      setRecords(list);
      setPaginationMeta(meta);
      if (meta?.page) setCurrentPage(meta.page);
      // Field-level permissions do backend
      setServerVisibleFields(response.data?.visibleFields || null);
      setServerEditableFields(response.data?.editableFields || null);
      // Capturar metadados da entidade pai
      if (entityMeta?._parentEntity) {
        setParentEntityMeta(entityMeta._parentEntity);
      } else {
        setParentEntityMeta(null);
      }
      return list;
    } catch (error) {
      if (requestId !== fetchCounterRef.current) return [];
      console.error('Erro ao carregar registros:', error);
      setRecords([]);
      setPaginationMeta(null);
      return [];
    } finally {
      if (requestId === fetchCounterRef.current) {
        setLoadingRecords(false);
      }
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
    resetFilters();
    setCurrentPage(1);
    setDebouncedSearch('');

    // Extrair globalFilters ANTES de buscar (evita busca dupla)
    const settings = entity.settings as Record<string, unknown> | null;
    const entityGlobalFilters = (settings?.globalFilters as ActiveFilter[]) || [];
    setGlobalFilters(entityGlobalFilters);

    // Buscar ja com os filtros aplicados
    await fetchRecords(entity.slug, 1, '');
  };

  // Navegar para sub-entidade filtrada por pai (ao clicar no badge de sub-entity)
  const handleEntitySelectWithParentFilter = async (
    subEntity: Entity,
    parentRecordId: string,
    parentData: Record<string, unknown>,
    parentField?: EntityField,
  ) => {
    if (!subEntity.fields) {
      try {
        const res = await api.get(`/entities/${subEntity.id}`);
        subEntity = { ...subEntity, ...res.data };
        setEntities(prev => prev.map(e => (e.id === subEntity.id ? subEntity : e)));
      } catch {}
    }
    const displayField = parentField?.parentDisplayField;
    const displayValue = displayField
      ? String(parentData[displayField] || parentRecordId)
      : Object.values(parentData).find(v => typeof v === 'string' && v.length > 0) as string || parentRecordId;
    const parentEntityName = selectedEntity?.name || '';

    setSelectedEntity(subEntity);
    setActiveFilters([]);
    setHiddenColumns(new Set());
    setSearchTerm('');
    setDebouncedSearch('');
    setNewFilter({});
    setCurrentPage(1);
    setParentFilter({ parentRecordId, parentDisplay: displayValue, parentEntityName });
    await fetchRecords(subEntity.slug, 1, '', parentRecordId);
  };

  // Limpar filtro de pai (null = sem filtro de pai)
  const clearParentFilter = async () => {
    setParentFilter(null);
    if (selectedEntity) {
      setCurrentPage(1);
      await fetchRecords(selectedEntity.slug, 1, debouncedSearch, null);
    }
  };

  // Buscar registros pai para seletor (so os que tem filhos na entidade atual)
  const searchParentRecords = useCallback(async (term: string) => {
    if (!parentEntityMeta?.slug || !selectedEntity) return;
    setParentSearchLoading(true);
    try {
      const params: Record<string, string> = {
        limit: '20',
        page: '1',
        hasChildrenIn: selectedEntity.id, // Filtrar apenas pais com filhos
      };
      if (effectiveTenantId) params.tenantId = effectiveTenantId;
      if (term.trim()) params.search = term.trim();
      const response = await api.get(`/data/${parentEntityMeta.slug}`, { params });
      const list = Array.isArray(response.data) ? response.data : response.data?.data || [];
      const entityMeta = response.data?.entity;
      const fields = entityMeta?.fields as EntityField[] || [];

      // Descobrir qual campo usar para display (parentDisplayField ou titleField)
      const settings = entityMeta?.settings as Record<string, unknown> | undefined;
      const titleField = settings?.titleField as string | undefined;

      // Encontrar o sub-entity field que aponta para a entidade atual
      const subField = fields.find((f: EntityField) => f.type === 'sub-entity' && selectedEntity && f.subEntityId === selectedEntity.id);
      const displayField = subField?.parentDisplayField || titleField || fields[0]?.slug;

      const results = list.map((r: DataRecord) => ({
        id: r.id,
        display: displayField ? String((r.data as Record<string, unknown>)[displayField] || r.id) : r.id,
      }));
      setParentSearchResults(results);
    } catch {
      setParentSearchResults([]);
    } finally {
      setParentSearchLoading(false);
    }
  }, [parentEntityMeta?.slug, effectiveTenantId, selectedEntity]);

  // Debounce da busca de pai
  const handleParentSearchChange = useCallback((value: string) => {
    setParentSearchTerm(value);
    if (parentSearchTimerRef.current) clearTimeout(parentSearchTimerRef.current);
    parentSearchTimerRef.current = setTimeout(() => {
      searchParentRecords(value);
    }, 300);
  }, [searchParentRecords]);

  // Selecionar registro pai
  const handleSelectParentRecord = async (record: { id: string; display: string }) => {
    const parentEntityName = parentEntityMeta?.name || parentEntityDisplayName;
    setParentFilter({ parentRecordId: record.id, parentDisplay: record.display, parentEntityName });
    setParentSearchOpen(false);
    setParentSearchTerm('');
    setParentSearchResults([]);
    if (selectedEntity) {
      setCurrentPage(1);
      await fetchRecords(selectedEntity.slug, 1, debouncedSearch, record.id);
    }
  };

  // Ordenar por coluna: 1o clique = asc, 2o = desc, 3o = limpa
  const handleSort = async (fieldSlug: string) => {
    let newSort: { field: string; order: 'asc' | 'desc' } | null;
    if (!sortConfig || sortConfig.field !== fieldSlug) {
      newSort = { field: fieldSlug, order: 'asc' };
    } else if (sortConfig.order === 'asc') {
      newSort = { field: fieldSlug, order: 'desc' };
    } else {
      newSort = null;
    }
    setSortConfig(newSort);
    if (selectedEntity) {
      setCurrentPage(1);
      await fetchRecords(selectedEntity.slug, 1, debouncedSearch, undefined, newSort === null ? null : newSort);
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
    if (!recordToDelete || !selectedEntity || (!tenantId && !isPlatformAdmin)) return;
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

  const handleFormSuccess = async () => {
    if (!selectedEntity) return;
    await fetchRecords(selectedEntity.slug, currentPage, debouncedSearch);
  };

  // Resetar filtros ao trocar de entidade
  const resetFilters = useCallback(() => {
    setActiveFilters([]);
    setGlobalFilters([]);
    setSaveAsGlobal(false);
    setHiddenColumns(new Set());
    setColumnOrder([]);
    setSearchTerm('');
    setDebouncedSearch('');
    setNewFilter({});
    setParentFilter(null);
    setParentEntityMeta(null);
    setSortConfig(null);
    setHasChildrenFilter(null);
  }, []);

  // Carregar config de colunas e filtros globais quando entidade muda
  useEffect(() => {
    if (!selectedEntity) return;
    const settings = selectedEntity.settings as Record<string, unknown> | null;
    const columnConfig = settings?.columnConfig as { visibleColumns?: string[] } | undefined;
    if (columnConfig?.visibleColumns && columnConfig.visibleColumns.length > 0) {
      const savedOrder = columnConfig.visibleColumns;
      setColumnOrder(savedOrder);
      // Campos que NAO estao na lista savedOrder sao ocultos
      const allFieldSlugs = selectedEntity.fields?.map(f => f.slug) || [];
      const savedSet = new Set(savedOrder);
      setHiddenColumns(new Set(allFieldSlugs.filter(s => !savedSet.has(s))));
    } else {
      setColumnOrder([]);
      setHiddenColumns(new Set());
    }

    // Carregar filtros globais de entity.settings
    const savedGlobalFilters = settings?.globalFilters as ActiveFilter[] | undefined;
    setGlobalFilters(Array.isArray(savedGlobalFilters) ? savedGlobalFilters : []);
  }, [selectedEntity?.id, selectedEntity?.settings]);

  // Debounce de busca - envia pro backend apos 400ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Quando busca muda, resetar pagina e buscar
  useEffect(() => {
    if (!selectedEntity) return;
    setCurrentPage(1);
    fetchRecords(selectedEntity.slug, 1, debouncedSearch);
  }, [debouncedSearch]);

  // Quando filtro de filhos muda, resetar pagina e buscar
  useEffect(() => {
    if (!selectedEntity) return;
    setCurrentPage(1);
    fetchRecords(selectedEntity.slug, 1, debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasChildrenFilter]);

  // Quando filtros ativos mudam, resetar pagina e buscar no backend
  useEffect(() => {
    if (!selectedEntity) return;
    setCurrentPage(1);
    fetchRecords(selectedEntity.slug, 1, debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilters]);

  // Real-time: granular updates via WebSocket (update/delete/create without full refetch)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!selectedEntity || detail.entitySlug !== selectedEntity.slug) return;

      switch (detail.operation) {
        case 'updated':
          setRecords(prev => prev.map(r =>
            r.id === detail.record.id
              ? { ...r, data: detail.record.data, updatedAt: detail.record.updatedAt }
              : r
          ));
          break;

        case 'deleted':
          setRecords(prev => prev.filter(r => r.id !== detail.recordId));
          setPaginationMeta(prev => prev ? {
            ...prev,
            total: Math.max(0, prev.total - 1),
            totalPages: Math.max(1, Math.ceil((prev.total - 1) / prev.limit)),
          } : prev);
          break;

        case 'created':
          setPaginationMeta(prev => prev ? {
            ...prev,
            total: prev.total + 1,
            totalPages: Math.ceil((prev.total + 1) / prev.limit),
          } : prev);
          // Debounced toast — groups burst creates into one message
          newRecordCountRef.current++;
          if (newRecordTimerRef.current) clearTimeout(newRecordTimerRef.current);
          newRecordTimerRef.current = setTimeout(() => {
            const count = newRecordCountRef.current;
            newRecordCountRef.current = 0;
            toast.info(count === 1 ? 'Novo registro adicionado' : `${count} novos registros adicionados`);
          }, 1500);
          break;

        default: // 'refresh' or legacy payload
          fetchRecords(selectedEntity.slug, currentPage, debouncedSearch);
          break;
      }
    };
    window.addEventListener('entity-data-changed', handler);
    return () => window.removeEventListener('entity-data-changed', handler);
  }, [selectedEntity, currentPage, debouncedSearch]);

  // Handlers de paginacao
  const goToPage = useCallback((page: number) => {
    if (!selectedEntity || !paginationMeta) return;
    const target = Math.max(1, Math.min(page, paginationMeta.totalPages));
    setCurrentPage(target);
    fetchRecords(selectedEntity.slug, target, debouncedSearch);
  }, [selectedEntity, paginationMeta, debouncedSearch]);

  // Handler para adicionar filtro (local ou global)
  const handleAddFilter = useCallback(async () => {
    if (!newFilter.fieldSlug || !newFilter.operator) return;

    // Para operadores que nao precisam de valor
    if (newFilter.operator !== 'isEmpty' && newFilter.operator !== 'isNotEmpty') {
      if (newFilter.value === undefined || newFilter.value === '') return;
      if (newFilter.operator === 'between' && (newFilter.value2 === undefined || newFilter.value2 === '')) return;
    }

    const filter = newFilter as ActiveFilter;

    if (saveAsGlobal && selectedEntity) {
      // Salvar como filtro global via API
      setSavingGlobalFilter(true);
      try {
        const updatedFilters = [...globalFilters, filter];
        await entitiesService.updateGlobalFilters(selectedEntity.id, updatedFilters);
        setGlobalFilters(updatedFilters);
        // Atualizar entity settings localmente
        setSelectedEntity(prev => prev ? {
          ...prev,
          settings: { ...((prev.settings as Record<string, unknown>) || {}), globalFilters: updatedFilters },
        } as Entity : null);
        toast.success('Filtro global salvo');
        // Re-buscar dados com os novos filtros aplicados no backend
        setCurrentPage(1);
        await fetchRecords(selectedEntity.slug, 1, debouncedSearch);
      } catch {
        toast.error('Erro ao salvar filtro global');
      } finally {
        setSavingGlobalFilter(false);
      }
    } else {
      // Filtro local (sessao)
      setActiveFilters(prev => [...prev, filter]);
    }

    setNewFilter({});
    setSaveAsGlobal(false);
    setFilterPopoverOpen(false);
  }, [newFilter, saveAsGlobal, selectedEntity, globalFilters]);

  // Handler para remover filtro
  const handleRemoveFilter = useCallback((index: number) => {
    setActiveFilters(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Handler para limpar todos os filtros
  const handleClearFilters = useCallback(() => {
    setActiveFilters([]);
    setSearchTerm('');
  }, []);

  // Detectar se e sub-entidade (tem registros com parentRecordId)
  const isSubEntity = useMemo(() => {
    return records.some(r => r.parentRecordId) || parentFilter !== null;
  }, [records, parentFilter]);

  // Detectar campos sub-entity da entidade selecionada (para filtro "apenas com filhos")
  const subEntityFields = useMemo(() => {
    if (!selectedEntity?.fields) return [];
    return selectedEntity.fields.filter(f => f.type === 'sub-entity' && f.subEntityId);
  }, [selectedEntity?.fields]);

  // Nome da entidade pai para exibir na coluna
  const parentEntityDisplayName = useMemo(() => {
    if (parentEntityMeta?.name) return parentEntityMeta.name;
    if (parentFilter?.parentEntityName) return parentFilter.parentEntityName;
    // Fallback: verificar nos registros
    const withParent = records.find(r => r._parentEntityName);
    return withParent?._parentEntityName || t('filter.parentRecord');
  }, [parentEntityMeta, parentFilter, records, t]);

  // Todas as colunas disponiveis (baseado nos campos da entidade + field-level permissions + column order)
  const allColumns = useMemo(() => {
    if (!selectedEntity?.fields) {
      // Fallback: usar chaves do primeiro registro
      if (records.length === 0) return [];
      return Object.keys(records[0].data || {});
    }
    let fieldSlugs = selectedEntity.fields.filter(f => f && f.slug).map(f => f.slug);
    // Se o backend retornou visibleFields, filtrar apenas esses
    if (serverVisibleFields) {
      const visibleSet = new Set(serverVisibleFields);
      fieldSlugs = fieldSlugs.filter(slug => visibleSet.has(slug));
    }
    // Aplicar ordem salva (columnOrder define a ordenacao)
    if (columnOrder.length > 0) {
      const slugSet = new Set(fieldSlugs);
      // Manter campos na ordem do columnOrder, depois adicionar novos campos que nao estao na config
      const ordered = columnOrder.filter(s => slugSet.has(s));
      const remaining = fieldSlugs.filter(s => !columnOrder.includes(s));
      fieldSlugs = [...ordered, ...remaining];
    }
    // Adicionar coluna de pai no inicio se e sub-entidade
    if (isSubEntity) {
      return ['_parent', ...fieldSlugs];
    }
    return fieldSlugs;
  }, [selectedEntity?.fields, records, isSubEntity, serverVisibleFields, columnOrder]);

  // Colunas visiveis (excluindo as ocultas)
  const visibleColumns = useMemo(() => {
    return allColumns.filter(col => !hiddenColumns.has(col));
  }, [allColumns, hiddenColumns]);

  // Obter campo por slug
  const getFieldBySlug = useCallback((slug: string): EntityField | undefined => {
    if (slug === '_parent') {
      return { slug: '_parent', name: parentEntityDisplayName, type: 'text' as EntityField['type'] } as EntityField;
    }
    return selectedEntity?.fields?.find(f => f.slug === slug);
  }, [selectedEntity?.fields, parentEntityDisplayName]);

  // Campos disponiveis para filtro (permite multiplos filtros por campo)
  const availableFieldsForFilter = useMemo(() => {
    if (!selectedEntity?.fields) return [];
    return selectedEntity.fields.filter(f =>
      !['hidden', 'file', 'image', 'json', 'richtext'].includes(f.type)
    );
  }, [selectedEntity?.fields]);

  // Helper: obter valor de celula considerando _childCounts para sub-entity e _parentDisplay
  const getCellValue = useCallback((record: DataRecord, col: string): unknown => {
    if (col === '_parent') {
      return record._parentDisplay || '-';
    }
    const field = getFieldBySlug(col);
    if (field?.type === 'sub-entity') {
      return record._childCounts?.[col] ?? 0;
    }
    return record.data[col];
  }, [getFieldBySlug]);

  // Filtro de busca local (feedback visual enquanto digita)
  // Nota: globalFilters e activeFilters sao aplicados no backend, nao aqui
  const filteredRecords = useMemo(() => {
    let result = records;

    // Aplicar busca textual local (feedback enquanto digita, antes do debounce)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(r =>
        allColumns.some(col => formatCellValue(getCellValue(r, col)).toLowerCase().includes(term))
      );
    }

    return result;
  }, [records, searchTerm, allColumns, getCellValue]);

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
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {selectedEntity && hasEntityPermission(selectedEntity.slug, 'canCreate') && (
            <Button
              onClick={handleNewRecord}
              disabled={tenantLoading || (!tenantId && !isPlatformAdmin)}
              data-testid="new-record-btn"
              className="w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('newRecord')}
            </Button>
          )}
        </div>
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
                  <div className="flex items-center gap-3 min-w-0">
                    <Database className="h-4 w-4 flex-shrink-0" />
                    <span className="font-medium truncate">{entity.name}</span>
                  </div>
                  <span className="text-xs opacity-70 flex-shrink-0">
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
                      {(activeFilters.length + globalFilters.length) > 0
                        ? t('recordsFiltered', { count: filteredRecords.length, filters: activeFilters.length + globalFilters.length })
                        : paginationMeta
                          ? t('recordsCount', { filtered: filteredRecords.length, total: paginationMeta.total })
                          : t('recordsCount', { filtered: filteredRecords.length, total: records.length })
                      }
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
                          {(activeFilters.length + globalFilters.length) > 0 && (
                            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                              {activeFilters.length + globalFilters.length}
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
                                  if (field.type === 'map') {
                                    // Map: nao definir operadores ainda, esperar sub-field
                                    setNewFilter({
                                      fieldSlug: field.slug,
                                      fieldName: field.name,
                                      fieldType: field.type,
                                    });
                                  } else {
                                    const operators = getOperatorsForField(field.type);
                                    setNewFilter({
                                      fieldSlug: field.slug,
                                      fieldName: field.name,
                                      fieldType: field.type,
                                      operator: operators[0]?.value,
                                      value: field.type === 'boolean' ? true : undefined,
                                    });
                                  }
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

                          {/* Selecionar sub-campo (apenas para map) */}
                          {newFilter.fieldSlug && newFilter.fieldType === 'map' && (
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">{t('filter.mapSubField')}</Label>
                              <Select
                                value={newFilter.subField || ''}
                                onValueChange={(value) => {
                                  const sub = MAP_SUB_FIELDS.find(s => s.value === value);
                                  if (sub) {
                                    const operators = OPERATORS_BY_TYPE[sub.category] || OPERATORS_BY_TYPE.text;
                                    setNewFilter(prev => ({
                                      ...prev,
                                      subField: value,
                                      operator: operators[0]?.value,
                                      value: undefined,
                                      value2: undefined,
                                    }));
                                  }
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={tCommon('selectOption')} />
                                </SelectTrigger>
                                <SelectContent>
                                  {MAP_SUB_FIELDS.map(sub => (
                                    <SelectItem key={sub.value} value={sub.value}>
                                      {t(`filter.mapFields.${sub.labelKey}`)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {/* Selecionar operador */}
                          {newFilter.fieldSlug && (newFilter.fieldType !== 'map' || newFilter.subField) && (
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
                                  {(() => {
                                    if (newFilter.fieldType === 'map' && newFilter.subField) {
                                      const sub = MAP_SUB_FIELDS.find(s => s.value === newFilter.subField);
                                      return (OPERATORS_BY_TYPE[sub?.category || 'text'] || OPERATORS_BY_TYPE.text).map(op => (
                                        <SelectItem key={op.value} value={op.value}>
                                          {t(`filter.operators.${op.labelKey}`)}
                                        </SelectItem>
                                      ));
                                    }
                                    return getOperatorsForField(newFilter.fieldType || 'text').map(op => (
                                      <SelectItem key={op.value} value={op.value}>
                                        {t(`filter.operators.${op.labelKey}`)}
                                      </SelectItem>
                                    ));
                                  })()}
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

                              {/* Number/Currency/Percentage/Sub-entity */}
                              {['number', 'currency', 'percentage', 'rating', 'slider', 'sub-entity'].includes(newFilter.fieldType || '') && (
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

                              {/* Date/Datetime/Time */}
                              {['date', 'datetime', 'time'].includes(newFilter.fieldType || '') && (
                                <div className="flex gap-2">
                                  <Input
                                    type={newFilter.fieldType === 'datetime' ? 'datetime-local' : newFilter.fieldType === 'time' ? 'time' : 'date'}
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
                                        type={newFilter.fieldType === 'datetime' ? 'datetime-local' : newFilter.fieldType === 'time' ? 'time' : 'date'}
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

                              {/* Select/Multiselect/Zone-diagram - Mostrar opcoes */}
                              {['select', 'multiselect', 'zone-diagram'].includes(newFilter.fieldType || '') && (() => {
                                const field = getFieldBySlug(newFilter.fieldSlug || '');
                                // Para zone-diagram: flatten opcoes de todas as zonas
                                const opts = newFilter.fieldType === 'zone-diagram'
                                  ? (field?.diagramZones?.flatMap(z => z.options || []) || []).map(o => ({ value: o, label: o }))
                                  : (field?.options || []).map(opt =>
                                      typeof opt === 'string' ? { value: opt, label: opt } : opt
                                    );
                                return (
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
                                      {opts.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                          {opt.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                );
                              })()}

                              {/* Map - input baseado no sub-campo */}
                              {newFilter.fieldType === 'map' && newFilter.subField && (() => {
                                const sub = MAP_SUB_FIELDS.find(s => s.value === newFilter.subField);
                                if (sub?.category === 'number') {
                                  return (
                                    <div className="flex gap-2">
                                      <Input
                                        type="number"
                                        step="any"
                                        placeholder={t(`filter.mapFields.${sub.labelKey}`)}
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
                                            step="any"
                                            placeholder={t(`filter.mapFields.${sub.labelKey}`)}
                                            value={String(newFilter.value2 || '')}
                                            onChange={(e) => setNewFilter(prev => ({
                                              ...prev,
                                              value2: e.target.value ? parseFloat(e.target.value) : undefined,
                                            }))}
                                          />
                                        </>
                                      )}
                                    </div>
                                  );
                                }
                                return (
                                  <Input
                                    placeholder={t(`filter.mapFields.${sub?.labelKey || 'mapAddress'}`)}
                                    value={String(newFilter.value || '')}
                                    onChange={(e) => setNewFilter(prev => ({
                                      ...prev,
                                      value: e.target.value,
                                    }))}
                                  />
                                );
                              })()}

                              {/* Color - picker + hex input */}
                              {newFilter.fieldType === 'color' && (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="color"
                                    value={String(newFilter.value || '#000000')}
                                    onChange={(e) => setNewFilter(prev => ({
                                      ...prev,
                                      value: e.target.value,
                                    }))}
                                    className="h-9 w-12 rounded border cursor-pointer"
                                  />
                                  <Input
                                    placeholder="#000000"
                                    value={String(newFilter.value || '')}
                                    onChange={(e) => setNewFilter(prev => ({
                                      ...prev,
                                      value: e.target.value,
                                    }))}
                                    className="flex-1"
                                  />
                                </div>
                              )}

                              {/* Text (default) - text, textarea, email, phone, url, cpf, cnpj, cep, password, api-select, relation, array */}
                              {['text', 'textarea', 'email', 'phone', 'url', 'cpf', 'cnpj', 'cep', 'password', 'api-select', 'relation', 'array'].includes(newFilter.fieldType || '') && (
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

                          {/* Switch salvar como global */}
                          {selectedEntity && hasEntityPermission(selectedEntity.slug, 'canUpdate') && (
                            <div className="flex items-center gap-3 pt-1 border-t">
                              <Switch
                                id="save-global"
                                checked={saveAsGlobal}
                                onCheckedChange={setSaveAsGlobal}
                              />
                              <Label htmlFor="save-global" className="text-xs flex items-center gap-1.5 cursor-pointer">
                                <Globe className="h-3.5 w-3.5" />
                                Salvar como filtro global
                              </Label>
                            </div>
                          )}

                          {/* Botao adicionar */}
                          <Button
                            onClick={handleAddFilter}
                            className="w-full"
                            disabled={!newFilter.fieldSlug || !newFilter.operator || savingGlobalFilter}
                          >
                            {savingGlobalFilter ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Plus className="h-4 w-4 mr-2" />
                            )}
                            {saveAsGlobal ? 'Salvar filtro global' : t('filter.addFilter')}
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>

                    {/* Botao Colunas */}
                    {selectedEntity && hasEntityAction(selectedEntity.slug, 'canConfigureColumns') && (
                    <Popover open={columnConfigOpen} onOpenChange={(open) => {
                      setColumnConfigOpen(open);
                      if (open) {
                        // Inicializar draft com estado atual
                        const entityFields = selectedEntity?.fields || [];
                        const fieldSlugs = entityFields.map(f => f.slug);
                        // Usar columnOrder se disponivel, senao ordem original
                        const orderedSlugs = columnOrder.length > 0
                          ? [...columnOrder.filter(s => fieldSlugs.includes(s)), ...fieldSlugs.filter(s => !columnOrder.includes(s))]
                          : fieldSlugs;
                        setColumnConfigDraft(orderedSlugs.map(slug => ({
                          slug,
                          visible: !hiddenColumns.has(slug),
                        })));
                      }
                    }}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1">
                          <Columns3 className="h-4 w-4" />
                          <span className="hidden sm:inline">{t('filter.columns')}</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-72 p-3">
                        <div className="space-y-3">
                          <p className="text-sm font-medium">{t('filter.visibleColumns')}</p>
                          <div className="max-h-[280px] overflow-y-auto space-y-1">
                            {columnConfigDraft.map((item, idx) => {
                              const field = selectedEntity?.fields?.find(f => f.slug === item.slug);
                              return (
                                <div key={item.slug} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/50">
                                  <Checkbox
                                    id={`col-${item.slug}`}
                                    checked={item.visible}
                                    onCheckedChange={(checked) => {
                                      setColumnConfigDraft(prev => prev.map((d, i) =>
                                        i === idx ? { ...d, visible: !!checked } : d
                                      ));
                                    }}
                                  />
                                  <label htmlFor={`col-${item.slug}`} className="flex-1 text-sm cursor-pointer select-none truncate">
                                    {field?.name || item.slug}
                                  </label>
                                  <div className="flex gap-0.5">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      disabled={idx === 0}
                                      onClick={() => {
                                        setColumnConfigDraft(prev => {
                                          const next = [...prev];
                                          [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                                          return next;
                                        });
                                      }}
                                    >
                                      <ArrowUp className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      disabled={idx === columnConfigDraft.length - 1}
                                      onClick={() => {
                                        setColumnConfigDraft(prev => {
                                          const next = [...prev];
                                          [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                                          return next;
                                        });
                                      }}
                                    >
                                      <ArrowDown className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                            {columnConfigDraft.length === 0 && (
                              <div className="px-2 py-1 text-sm text-muted-foreground">
                                {t('filter.noColumns')}
                              </div>
                            )}
                          </div>
                          <Separator />
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 gap-1"
                              onClick={async () => {
                                // Restaurar padrao: todos visiveis na ordem original
                                const entityFields = selectedEntity?.fields || [];
                                setColumnConfigDraft(entityFields.map(f => ({ slug: f.slug, visible: true })));
                                // Salvar no backend como array vazio (indica padrao)
                                if (selectedEntity) {
                                  try {
                                    await entitiesService.updateColumnConfig(selectedEntity.id, []);
                                    setColumnOrder([]);
                                    setHiddenColumns(new Set());
                                    // Atualizar settings localmente
                                    setSelectedEntity(prev => prev ? {
                                      ...prev,
                                      settings: { ...((prev.settings as Record<string, unknown>) || {}), columnConfig: undefined },
                                    } as Entity : null);
                                    toast.success(t('filter.columnsRestored'));
                                  } catch {
                                    toast.error(tCommon('error'));
                                  }
                                }
                              }}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              {t('filter.restoreDefault')}
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1 gap-1"
                              disabled={savingColumnConfig}
                              onClick={async () => {
                                if (!selectedEntity) return;
                                setSavingColumnConfig(true);
                                try {
                                  const visibleSlugs = columnConfigDraft.filter(d => d.visible).map(d => d.slug);
                                  await entitiesService.updateColumnConfig(selectedEntity.id, visibleSlugs);
                                  // Aplicar localmente
                                  setColumnOrder(visibleSlugs);
                                  const allSlugs = columnConfigDraft.map(d => d.slug);
                                  setHiddenColumns(new Set(allSlugs.filter(s => !visibleSlugs.includes(s))));
                                  // Atualizar settings localmente
                                  setSelectedEntity(prev => prev ? {
                                    ...prev,
                                    settings: { ...((prev.settings as Record<string, unknown>) || {}), columnConfig: { visibleColumns: visibleSlugs } },
                                  } as Entity : null);
                                  toast.success(t('filter.columnsSaved'));
                                  setColumnConfigOpen(false);
                                } catch {
                                  toast.error(tCommon('error'));
                                } finally {
                                  setSavingColumnConfig(false);
                                }
                              }}
                            >
                              <Check className="h-3.5 w-3.5" />
                              {t('filter.saveForAll')}
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                    )}

                    {/* Botao Filtrar por Pai (so para sub-entidades) */}
                    {isSubEntity && parentEntityMeta && (
                      <Popover open={parentSearchOpen} onOpenChange={(open) => {
                        setParentSearchOpen(open);
                        if (open && parentSearchResults.length === 0) {
                          searchParentRecords('');
                        }
                      }}>
                        <PopoverTrigger asChild>
                          <Button variant={parentFilter ? 'default' : 'outline'} size="sm" className="gap-1">
                            <Database className="h-4 w-4" />
                            <span className="hidden sm:inline">{parentEntityMeta.name}</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-3" align="end">
                          <div className="space-y-3">
                            <Label className="text-xs font-medium">
                              {t('filter.searchParent', { entity: parentEntityMeta.name })}
                            </Label>
                            <div className="relative">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                              <Input
                                placeholder={tCommon('search')}
                                value={parentSearchTerm}
                                onChange={(e) => handleParentSearchChange(e.target.value)}
                                className="pl-8 h-8 text-sm"
                                autoFocus
                              />
                            </div>
                            <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
                              {parentSearchLoading ? (
                                <div className="flex items-center justify-center py-4">
                                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                </div>
                              ) : parentSearchResults.length === 0 ? (
                                <div className="py-3 text-center text-xs text-muted-foreground">
                                  {t('noRecords')}
                                </div>
                              ) : (
                                parentSearchResults.map(r => (
                                  <button
                                    key={r.id}
                                    onClick={() => handleSelectParentRecord(r)}
                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${
                                      parentFilter?.parentRecordId === r.id ? 'bg-primary/10 font-medium' : ''
                                    }`}
                                  >
                                    {r.display}
                                  </button>
                                ))
                              )}
                            </div>
                            {parentFilter && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  clearParentFilter();
                                  setParentSearchOpen(false);
                                }}
                                className="w-full text-xs h-7"
                              >
                                {t('filter.clearParentFilter')}
                              </Button>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}

                    {/* Filtro: apenas com sub-entidades */}
                    {subEntityFields.length > 0 && (
                      <Button
                        variant={hasChildrenFilter ? 'default' : 'outline'}
                        size="sm"
                        className="gap-1"
                        onClick={() => {
                          if (hasChildrenFilter) {
                            setHasChildrenFilter(null);
                          } else {
                            setHasChildrenFilter(subEntityFields[0].subEntityId!);
                          }
                        }}
                        title={hasChildrenFilter ? t('filter.showAll') : t('filter.onlyWithChildren')}
                      >
                        <ListFilter className="h-4 w-4" />
                        <span className="hidden sm:inline">
                          {hasChildrenFilter ? t('filter.withChildren') : t('filter.onlyWithChildren')}
                        </span>
                      </Button>
                    )}

                    {/* Botao Refresh */}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => selectedEntity && fetchRecords(selectedEntity.slug, currentPage, debouncedSearch)}
                      className="flex-shrink-0 h-8 w-8"
                    >
                      <RefreshCw className={`h-4 w-4 ${loadingRecords ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>

                {/* Linha 2: Filtros ativos (pills) */}
                {/* Filtro por pai ativo */}
                {parentFilter && (
                  <div className="flex flex-wrap gap-2 items-center">
                    <Badge
                      variant="default"
                      className="gap-1 pl-2 pr-1 py-1"
                    >
                      <span className="text-xs">
                        {t('filter.filteredByParentLabel', { entity: parentFilter.parentEntityName, display: parentFilter.parentDisplay })}
                      </span>
                      <button
                        onClick={clearParentFilter}
                        className="ml-1 rounded-full hover:bg-primary/80 p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  </div>
                )}

                {/* Filtros globais (pills com icone globe) */}
                {globalFilters.length > 0 && (
                  <div className="flex flex-wrap gap-2 items-center">
                    {globalFilters.map((filter, index) => (
                      <Badge
                        key={`global-${filter.fieldSlug}-${index}`}
                        variant="outline"
                        className="gap-1 pl-2 pr-1 py-1 border-primary/30 bg-primary/5"
                      >
                        <Globe className="h-3 w-3 text-primary/70" />
                        <span className="text-xs">{formatFilterLabel(filter, t, tCommon)}</span>
                        {selectedEntity && hasEntityPermission(selectedEntity.slug, 'canUpdate') && (
                          <button
                            onClick={async () => {
                              const updated = globalFilters.filter((_, i) => i !== index);
                              try {
                                await entitiesService.updateGlobalFilters(selectedEntity.id, updated);
                                setGlobalFilters(updated);
                                setSelectedEntity(prev => prev ? {
                                  ...prev,
                                  settings: { ...((prev.settings as Record<string, unknown>) || {}), globalFilters: updated },
                                } as Entity : null);
                                toast.success('Filtro global removido');
                                // Re-buscar dados com os filtros atualizados no backend
                                setCurrentPage(1);
                                await fetchRecords(selectedEntity.slug, 1, debouncedSearch);
                              } catch {
                                toast.error('Erro ao remover filtro global');
                              }
                            }}
                            className="ml-1 rounded-full hover:bg-muted p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Filtros locais ativos (pills) */}
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
                    {!searchTerm && selectedEntity && (
                      <Button
                        onClick={handleNewRecord}
                        disabled={tenantLoading || (!tenantId && !isPlatformAdmin)}
                        data-testid="add-record-btn"
                        size="sm"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {t('newRecord')}
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
                              const sortKey = col === '_parent' ? '_parentDisplay' : col;
                              const isSortActive = sortConfig != null && sortConfig.field === sortKey;
                              return (
                                <th
                                  key={col}
                                  className="px-3 py-2 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                                  onClick={() => handleSort(sortKey)}
                                >
                                  <span className="inline-flex items-center gap-1">
                                    {field?.name || col}
                                    {isSortActive
                                      ? sortConfig.order === 'asc'
                                        ? <ArrowUp className="h-3 w-3" />
                                        : <ArrowDown className="h-3 w-3" />
                                      : <ArrowUpDown className="h-3 w-3 opacity-30" />
                                    }
                                  </span>
                                </th>
                              );
                            })}
                            {currentUser?.customRole?.roleType === 'PLATFORM_ADMIN' && (
                              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                                {tCommon('tenant')}
                              </th>
                            )}
                            <th
                              className="px-3 py-2 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                              onClick={() => handleSort('createdAt')}
                            >
                              <span className="inline-flex items-center gap-1">
                                {tCommon('createdAt')}
                                {sortConfig?.field === 'createdAt'
                                  ? sortConfig.order === 'asc'
                                    ? <ArrowUp className="h-3 w-3" />
                                    : <ArrowDown className="h-3 w-3" />
                                  : <ArrowUpDown className="h-3 w-3 opacity-30" />
                                }
                              </span>
                            </th>
                            <th
                              className="px-3 py-2 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                              onClick={() => handleSort('updatedAt')}
                            >
                              <span className="inline-flex items-center gap-1">
                                {tCommon('updatedAt')}
                                {sortConfig?.field === 'updatedAt'
                                  ? sortConfig.order === 'asc'
                                    ? <ArrowUp className="h-3 w-3" />
                                    : <ArrowDown className="h-3 w-3" />
                                  : <ArrowUpDown className="h-3 w-3 opacity-30" />
                                }
                              </span>
                            </th>
                            {selectedEntity && (hasEntityPermission(selectedEntity.slug, 'canUpdate') || hasEntityPermission(selectedEntity.slug, 'canDelete')) && (
                            <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-20">
                              {tCommon('actions')}
                            </th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {filteredRecords.map(record => (
                            <tr key={record.id} className="hover:bg-muted/30">
                              {visibleColumns.map(col => {
                                const field = getFieldBySlug(col);
                                const isSubEntity = field?.type === 'sub-entity';
                                const isParentCol = col === '_parent';
                                const value = isParentCol
                                  ? record._parentDisplay || '-'
                                  : isSubEntity
                                    ? record._childCounts?.[col] ?? 0
                                    : record.data[col];
                                return (
                                  <td key={col} className="px-3 py-2 text-sm max-w-[200px] truncate">
                                    {isParentCol ? (
                                      <span className="font-medium text-primary" title={String(value)}>
                                        {String(value)}
                                      </span>
                                    ) : isSubEntity ? (
                                      <button
                                        onClick={() => {
                                          if (Number(value) > 0 && field?.subEntityId) {
                                            const subEntity = entities.find(e => e.id === field.subEntityId);
                                            if (subEntity) {
                                              handleEntitySelectWithParentFilter(subEntity, record.id, record.data as Record<string, unknown>, field);
                                            }
                                          }
                                        }}
                                        className={Number(value) > 0 ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'}
                                        title={Number(value) > 0 ? t('filter.viewSubRecords') : undefined}
                                      >
                                        <Badge variant={Number(value) > 0 ? 'default' : 'secondary'} className="text-xs">
                                          {String(value)}
                                        </Badge>
                                      </button>
                                    ) : (
                                      formatCellValue(value)
                                    )}
                                  </td>
                                );
                              })}
                              {currentUser?.customRole?.roleType === 'PLATFORM_ADMIN' && (
                                <td className="px-3 py-2 text-sm">
                                  <span className="px-2 py-0.5 text-xs rounded bg-gray-200 text-gray-700" title={record.tenantId}>
                                    {record.tenant?.name || record.tenantId || '-'}
                                  </span>
                                </td>
                              )}
                              <td className="px-3 py-2 text-sm text-muted-foreground whitespace-nowrap">
                                {new Date(record.createdAt).toLocaleString('pt-BR')}
                              </td>
                              <td className="px-3 py-2 text-sm text-muted-foreground whitespace-nowrap">
                                {new Date(record.updatedAt).toLocaleString('pt-BR')}
                              </td>
                              {selectedEntity && (hasEntityPermission(selectedEntity.slug, 'canUpdate') || hasEntityPermission(selectedEntity.slug, 'canDelete')) && (
                              <td className="px-3 py-2 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {hasEntityPermission(selectedEntity.slug, 'canUpdate') && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleEditRecord(record)}
                                    data-testid={`edit-record-btn-${record.id}`}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  )}
                                  {hasEntityPermission(selectedEntity.slug, 'canDelete') && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => handleDeleteClick(record)}
                                    data-testid={`delete-record-btn-${record.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                  )}
                                </div>
                              </td>
                              )}
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
                                const isParentCol = col === '_parent';
                                const isSubEntity = field?.type === 'sub-entity';
                                const cellValue = isParentCol
                                  ? record._parentDisplay || '-'
                                  : isSubEntity
                                    ? record._childCounts?.[col] ?? 0
                                    : record.data[col];
                                const value = formatCellValue(cellValue);
                                return (
                                  <div key={col} className={idx === 0 ? 'font-medium text-sm' : 'text-xs text-muted-foreground'}>
                                    {isParentCol
                                      ? <span className="text-primary">{parentEntityDisplayName}: {value}</span>
                                      : idx === 0 ? value : `${field?.name || col}: ${value}`}
                                  </div>
                                );
                              })}
                              {visibleColumns.length > 3 && (
                                <div className="text-xs text-muted-foreground">
                                  {t('moreFields', { count: visibleColumns.length - 3 })}
                                </div>
                              )}
                              <div className="text-xs text-muted-foreground pt-1">
                                {tCommon('createdAt')}: {new Date(record.createdAt).toLocaleString('pt-BR')} · {tCommon('updatedAt')}: {new Date(record.updatedAt).toLocaleString('pt-BR')}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {selectedEntity && hasEntityPermission(selectedEntity.slug, 'canUpdate') && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleEditRecord(record)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              )}
                              {selectedEntity && hasEntityPermission(selectedEntity.slug, 'canDelete') && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => handleDeleteClick(record)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Paginacao */}
                {paginationMeta && paginationMeta.totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t">
                    <p className="text-xs text-muted-foreground">
                      {t('pagination.showing', {
                        from: ((paginationMeta.page - 1) * paginationMeta.limit) + 1,
                        to: Math.min(paginationMeta.page * paginationMeta.limit, paginationMeta.total),
                        total: paginationMeta.total,
                      })}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => goToPage(1)}
                        disabled={!paginationMeta.hasPreviousPage || loadingRecords}
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={!paginationMeta.hasPreviousPage || loadingRecords}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="px-3 text-sm font-medium tabular-nums">
                        {paginationMeta.page} / {paginationMeta.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={!paginationMeta.hasNextPage || loadingRecords}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => goToPage(paginationMeta.totalPages)}
                        disabled={!paginationMeta.hasNextPage || loadingRecords}
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
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
      {selectedEntity && (tenantId || isPlatformAdmin) && (
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
          editableFields={serverEditableFields ?? undefined}
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

export default function DataPage() {
  return (
    <RequireRole module="data">
      <DataPageContent />
    </RequireRole>
  );
}

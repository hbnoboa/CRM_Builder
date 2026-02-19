'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Check,
  Link2,
  TableProperties,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RequireRole } from '@/components/auth/require-role';
import { Link } from '@/i18n/navigation';
import { useDataSource, useUpdateDataSource, usePreviewDataSource, useRelatedEntities } from '@/hooks/use-data-sources';
import { useEntities } from '@/hooks/use-entities';
import { useDebounce } from '@/hooks/use-debounce';
import type { DataSourceDefinition, DataSourceFilter, DataSourceResult, DataSourceSource } from '@crm-builder/shared';
import type { Entity, EntityField } from '@/types';

const OPERATORS = [
  'equals', 'contains', 'startsWith', 'endsWith',
  'gt', 'gte', 'lt', 'lte', 'between',
  'isEmpty', 'isNotEmpty',
] as const;

const NO_VALUE_OPERATORS = ['isEmpty', 'isNotEmpty'];

function DataSourceBuilderContent() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const t = useTranslations('dataSources');
  const tBuilder = useTranslations('dataSources.builder');
  const tOps = useTranslations('dataSources.operators');
  const tCommon = useTranslations('common');

  // Data
  const { data: dataSource, isLoading } = useDataSource(id);
  const { data: entitiesData } = useEntities();
  const entities = useMemo(() => {
    const raw = entitiesData?.data ?? (Array.isArray(entitiesData) ? entitiesData : []);
    return raw as Entity[];
  }, [entitiesData]);

  const updateMutation = useUpdateDataSource({ success: t('toast.updated') });
  const previewMutation = usePreviewDataSource();

  // Local state for definition
  const [definition, setDefinition] = useState<DataSourceDefinition>({ sources: [] });
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [organizeOpen, setOrganizeOpen] = useState(false);
  const [previewResult, setPreviewResult] = useState<DataSourceResult | null>(null);

  // Initialize from server data
  useEffect(() => {
    if (dataSource) {
      const def = dataSource.definition as DataSourceDefinition;
      setDefinition(def || { sources: [] });
      setName(dataSource.name);
    }
  }, [dataSource]);

  // Related entities for first selected entity
  const firstEntitySlug = definition.sources?.[0]?.entitySlug;
  const { data: relatedEntities } = useRelatedEntities(firstEntitySlug || '');

  // Debounced preview
  const debouncedDefinition = useDebounce(definition, 500);

  useEffect(() => {
    if (debouncedDefinition.sources?.length > 0 && debouncedDefinition.sources[0]?.entitySlug) {
      previewMutation.mutate(
        { definition: debouncedDefinition, limit: 10 },
        { onSuccess: (result) => setPreviewResult(result) },
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedDefinition]);

  // Entity field maps
  const entityFieldsMap = useMemo(() => {
    const map = new Map<string, EntityField[]>();
    for (const entity of entities) {
      map.set(entity.slug, entity.fields || []);
    }
    return map;
  }, [entities]);

  const getEntityBySlug = useCallback((slug: string) => {
    return entities.find(e => e.slug === slug);
  }, [entities]);

  // All selected fields for filter/sort dropdowns
  const allSelectedFields = useMemo(() => {
    const fields: Array<{ key: string; label: string; type: string; entitySlug: string }> = [];
    for (const source of definition.sources || []) {
      const entityFields = entityFieldsMap.get(source.entitySlug) || [];
      const entity = getEntityBySlug(source.entitySlug);
      const selectedSlugs = source.fields?.length > 0 ? source.fields.map(f => f.slug) : entityFields.map(f => f.slug);
      for (const slug of selectedSlugs) {
        const field = entityFields.find(f => f.slug === slug);
        if (field) {
          fields.push({
            key: `${source.entitySlug}.${slug}`,
            label: `${entity?.name || source.entitySlug} - ${field.label || field.name || slug}`,
            type: field.type,
            entitySlug: source.entitySlug,
          });
        }
      }
    }
    return fields;
  }, [definition.sources, entityFieldsMap, getEntityBySlug]);

  // Handlers
  const updateDefinition = (updates: Partial<DataSourceDefinition>) => {
    setDefinition(prev => ({ ...prev, ...updates }));
  };

  const addSource = (entitySlug: string) => {
    const entityFields = entityFieldsMap.get(entitySlug) || [];
    const defaultFields = entityFields.filter(f =>
      f.type !== 'sub-entity' && f.type !== 'password'
    ).slice(0, 10).map(f => ({ slug: f.slug }));
    updateDefinition({
      sources: [...(definition.sources || []), { entitySlug, fields: defaultFields }],
    });
  };

  const removeSource = (index: number) => {
    const newSources = [...(definition.sources || [])];
    newSources.splice(index, 1);
    updateDefinition({ sources: newSources });
  };

  const toggleField = (sourceIndex: number, fieldSlug: string) => {
    const newSources = [...(definition.sources || [])];
    const source = { ...newSources[sourceIndex] };
    const fields = [...(source.fields || [])];
    const idx = fields.findIndex(f => f.slug === fieldSlug);
    if (idx >= 0) {
      fields.splice(idx, 1);
    } else {
      fields.push({ slug: fieldSlug });
    }
    source.fields = fields;
    newSources[sourceIndex] = source;
    updateDefinition({ sources: newSources });
  };

  const selectAllFields = (sourceIndex: number) => {
    const newSources = [...(definition.sources || [])];
    const source = { ...newSources[sourceIndex] };
    const entityFields = entityFieldsMap.get(source.entitySlug) || [];
    source.fields = entityFields
      .filter(f => f.type !== 'sub-entity' && f.type !== 'password')
      .map(f => ({ slug: f.slug }));
    newSources[sourceIndex] = source;
    updateDefinition({ sources: newSources });
  };

  const clearAllFields = (sourceIndex: number) => {
    const newSources = [...(definition.sources || [])];
    const source = { ...newSources[sourceIndex] };
    source.fields = [];
    newSources[sourceIndex] = source;
    updateDefinition({ sources: newSources });
  };

  const addFilter = () => {
    const newFilters = [...(definition.filters || [])];
    newFilters.push({ field: '', operator: 'equals' });
    updateDefinition({ filters: newFilters });
    setFiltersOpen(true);
  };

  const updateFilter = (index: number, updates: Partial<DataSourceFilter>) => {
    const newFilters = [...(definition.filters || [])];
    newFilters[index] = { ...newFilters[index], ...updates };
    updateDefinition({ filters: newFilters });
  };

  const removeFilter = (index: number) => {
    const newFilters = [...(definition.filters || [])];
    newFilters.splice(index, 1);
    updateDefinition({ filters: newFilters });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateMutation.mutateAsync({ id, data: { name, definition } });
    } finally {
      setIsSaving(false);
    }
  };

  // Available entities for second/third source (only related ones)
  const availableEntities = useMemo(() => {
    if (!firstEntitySlug || !relatedEntities) return [];
    const selectedSlugs = new Set(definition.sources?.map(s => s.entitySlug) || []);
    return relatedEntities.filter(r => !selectedSlugs.has(r.entitySlug));
  }, [firstEntitySlug, relatedEntities, definition.sources]);

  // Connection descriptions between entities
  const connectionDescriptions = useMemo(() => {
    const descriptions: string[] = [];
    if (!relatedEntities || !definition.sources || definition.sources.length < 2) return descriptions;
    for (let i = 1; i < definition.sources.length; i++) {
      const slug = definition.sources[i].entitySlug;
      const relation = relatedEntities.find(r => r.entitySlug === slug);
      if (relation) {
        const fromEntity = getEntityBySlug(firstEntitySlug || '');
        const toEntity = getEntityBySlug(slug);
        descriptions.push(
          tBuilder('connectedVia', {
            from: fromEntity?.name || firstEntitySlug,
            to: toEntity?.name || slug,
            field: relation.fieldLabel,
          })
        );
      }
    }
    return descriptions;
  }, [definition.sources, relatedEntities, firstEntitySlug, getEntityBySlug, tBuilder]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/data-sources">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-lg font-bold border-none shadow-none focus-visible:ring-0 h-auto py-1 px-2 max-w-md"
          />
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {isSaving ? tBuilder('saving') : tBuilder('save')}
        </Button>
      </div>

      {/* Main layout: config (left) + preview (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Configuration cards */}
        <div className="space-y-4">
          {/* Card 1: Sources */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{tBuilder('step1Title')}</CardTitle>
              <CardDescription>{tBuilder('step1Desc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Selected sources */}
              {(definition.sources || []).map((source, index) => {
                const entity = getEntityBySlug(source.entitySlug);
                return (
                  <div key={index} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                    <TableProperties className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm font-medium flex-1">{entity?.name || source.entitySlug}</span>
                    {index > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeSource(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                );
              })}

              {/* Connection descriptions */}
              {connectionDescriptions.map((desc, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground px-2">
                  <Link2 className="h-3.5 w-3.5 shrink-0" />
                  <span>{desc}</span>
                </div>
              ))}

              {/* Add entity */}
              {(definition.sources || []).length === 0 ? (
                <Select onValueChange={(slug) => addSource(slug)}>
                  <SelectTrigger>
                    <SelectValue placeholder={tBuilder('selectEntity')} />
                  </SelectTrigger>
                  <SelectContent>
                    {entities.map(entity => (
                      <SelectItem key={entity.id} value={entity.slug}>
                        {entity.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (definition.sources || []).length < 3 && availableEntities.length > 0 ? (
                <Select onValueChange={(slug) => addSource(slug)}>
                  <SelectTrigger className="border-dashed">
                    <SelectValue placeholder={tBuilder('addEntity')} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableEntities.map(rel => {
                      const entity = getEntityBySlug(rel.entitySlug);
                      return (
                        <SelectItem key={rel.entitySlug} value={rel.entitySlug}>
                          {entity?.name || rel.entitySlug}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              ) : (definition.sources || []).length >= 3 ? (
                <p className="text-xs text-muted-foreground px-2">{tBuilder('maxEntities')}</p>
              ) : null}
            </CardContent>
          </Card>

          {/* Card 2: Fields */}
          {(definition.sources || []).length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{tBuilder('step2Title')}</CardTitle>
                <CardDescription>{tBuilder('step2Desc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(definition.sources || []).map((source, sourceIndex) => {
                  const entity = getEntityBySlug(source.entitySlug);
                  const entityFields = entityFieldsMap.get(source.entitySlug) || [];
                  const visibleFields = entityFields.filter(f =>
                    f.type !== 'sub-entity' && f.type !== 'password'
                  );
                  const selectedSlugs = new Set(source.fields?.map(f => f.slug) || []);

                  return (
                    <div key={sourceIndex}>
                      {(definition.sources || []).length > 1 && (
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium">{entity?.name || source.entitySlug}</h4>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => selectAllFields(sourceIndex)}>
                              {tBuilder('selectAll')}
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => clearAllFields(sourceIndex)}>
                              {tBuilder('clearAll')}
                            </Button>
                          </div>
                        </div>
                      )}
                      {(definition.sources || []).length === 1 && (
                        <div className="flex justify-end mb-2 gap-2">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => selectAllFields(sourceIndex)}>
                            {tBuilder('selectAll')}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => clearAllFields(sourceIndex)}>
                            {tBuilder('clearAll')}
                          </Button>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-1">
                        {visibleFields.map(field => (
                          <label
                            key={field.slug}
                            className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer text-sm"
                          >
                            <Checkbox
                              checked={selectedSlugs.has(field.slug)}
                              onCheckedChange={() => toggleField(sourceIndex, field.slug)}
                            />
                            <span className="truncate">{field.label || field.name || field.slug}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Card 3: Filters (collapsible) */}
          {(definition.sources || []).length > 0 && (
            <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 rounded-t-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">{tBuilder('step3Title')}</CardTitle>
                        <CardDescription>{tBuilder('step3Desc')}</CardDescription>
                      </div>
                      {filtersOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-3">
                    {(definition.filters || []).map((filter, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <div className="grid grid-cols-3 gap-2 flex-1">
                          <Select
                            value={filter.field || 'none'}
                            onValueChange={(v) => {
                              const selectedField = allSelectedFields.find(f => f.key === v);
                              updateFilter(index, {
                                field: v === 'none' ? '' : v,
                                fieldType: selectedField?.type,
                              });
                            }}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Campo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">-</SelectItem>
                              {allSelectedFields.map(f => (
                                <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Select
                            value={filter.operator || 'equals'}
                            onValueChange={(v) => updateFilter(index, { operator: v as DataSourceFilter['operator'] })}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {OPERATORS.map(op => (
                                <SelectItem key={op} value={op}>{tOps(op)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {!NO_VALUE_OPERATORS.includes(filter.operator) && (
                            <Input
                              value={String(filter.value ?? '')}
                              onChange={(e) => updateFilter(index, { value: e.target.value })}
                              className="h-9"
                              placeholder="Valor"
                            />
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-destructive shrink-0"
                          onClick={() => removeFilter(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addFilter} className="w-full">
                      <Plus className="mr-2 h-4 w-4" />
                      {tBuilder('addCondition')}
                    </Button>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* Card 4: Organize (collapsible) */}
          {(definition.sources || []).length > 0 && (
            <Collapsible open={organizeOpen} onOpenChange={setOrganizeOpen}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 rounded-t-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">{tBuilder('step4Title')}</CardTitle>
                        <CardDescription>{tBuilder('step4Desc')}</CardDescription>
                      </div>
                      {organizeOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm">{tBuilder('sortBy')}</Label>
                        <Select
                          value={definition.orderBy?.field || 'none'}
                          onValueChange={(v) => updateDefinition({
                            orderBy: v === 'none' ? undefined : { field: v, order: definition.orderBy?.order || 'asc' },
                          })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">-</SelectItem>
                            {allSelectedFields.map(f => (
                              <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {definition.orderBy && (
                        <div>
                          <Label className="text-sm">&nbsp;</Label>
                          <Select
                            value={definition.orderBy.order}
                            onValueChange={(v) => updateDefinition({
                              orderBy: { ...definition.orderBy!, order: v as 'asc' | 'desc' },
                            })}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="asc">{tBuilder('ascending')}</SelectItem>
                              <SelectItem value="desc">{tBuilder('descending')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    <div>
                      <Label className="text-sm">{tBuilder('recordLimit')}</Label>
                      <Input
                        type="number"
                        value={definition.limit || ''}
                        onChange={(e) => updateDefinition({ limit: parseInt(e.target.value) || undefined })}
                        placeholder={tBuilder('allRecords')}
                        className="h-9 max-w-[200px]"
                        min={1}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={definition.aggregations?.some(a => a.function === 'count') || false}
                          onCheckedChange={(checked) => {
                            const aggs = [...(definition.aggregations || [])].filter(a => a.function !== 'count');
                            if (checked) aggs.push({ function: 'count', alias: 'total' });
                            updateDefinition({ aggregations: aggs });
                          }}
                        />
                        {tBuilder('showCount')}
                      </label>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}
        </div>

        {/* Right: Preview */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{tBuilder('preview')}</CardTitle>
            </CardHeader>
            <CardContent>
              {!firstEntitySlug ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <TableProperties className="h-10 w-10 mb-3 opacity-40" />
                  <p className="text-sm">{tBuilder('previewEmpty')}</p>
                </div>
              ) : previewMutation.isPending ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : previewResult ? (
                <div>
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {previewResult.columns.map(col => (
                            <TableHead key={col.key} className="text-xs whitespace-nowrap">
                              {col.label}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewResult.rows.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={previewResult.columns.length || 1}
                              className="text-center text-muted-foreground py-8"
                            >
                              {tCommon('noResults')}
                            </TableCell>
                          </TableRow>
                        ) : (
                          previewResult.rows.map((row, rowIdx) => (
                            <TableRow key={rowIdx}>
                              {previewResult.columns.map(col => (
                                <TableCell key={col.key} className="text-xs max-w-[200px] truncate">
                                  {formatCellValue(row[col.key])}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {tBuilder('showingRecords', {
                      count: previewResult.rows.length,
                      total: previewResult.meta.total,
                    })}
                  </p>
                  {previewResult.aggregations && Object.keys(previewResult.aggregations).length > 0 && (
                    <div className="mt-2 flex gap-3">
                      {Object.entries(previewResult.aggregations).map(([key, value]) => (
                        <div key={key} className="bg-muted/50 rounded-md px-3 py-1.5">
                          <span className="text-xs text-muted-foreground">{key}: </span>
                          <span className="text-sm font-medium">{value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Nao';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default function DataSourceBuilderPage() {
  return (
    <RequireRole module="data-sources" action="canRead">
      <DataSourceBuilderContent />
    </RequireRole>
  );
}

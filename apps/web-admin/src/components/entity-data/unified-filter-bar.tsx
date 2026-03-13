'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Filter,
  X,
  Plus,
  Search,
} from 'lucide-react';
import { useEntityData } from './entity-data-context';
import {
  getFilterCategory,
  getOperatorsForField,
  isFilterableField,
  RELATIVE_DATE_OPTIONS,
} from './unified-filter-types';
import type {
  FieldFilter,
  FilterOperator,
  EntityField,
  FilterCategory,
} from './unified-filter-types';
import { groupByField } from './aggregation-engine';

// ─── Filter bar component ───────────────────────────────────────────

export function UnifiedFilterBar() {
  const t = useTranslations('filter');
  const {
    entity,
    allRecords,
    filters,
    addFieldFilter,
    removeFieldFilter,
    updateFieldFilter,
    clearAllFilters,
    removeCrossFilter,
  } = useEntityData();

  const [addFilterOpen, setAddFilterOpen] = useState(false);
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);

  // Group entity fields by category
  const filterableFields = useMemo(() => {
    if (!entity?.fields) return [];
    return entity.fields.filter(f => isFilterableField(f.type));
  }, [entity?.fields]);

  const groupedFields = useMemo(() => {
    const groups: Record<string, EntityField[]> = {};
    for (const f of filterableFields) {
      const cat = getFilterCategory(f.type) || 'text';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(f);
    }
    return groups;
  }, [filterableFields]);

  const handleAddFilter = useCallback((field: EntityField) => {
    const category = getFilterCategory(field.type);
    const operators = getOperatorsForField(field.type);
    const defaultOp = operators[0]?.value || 'contains';

    const newFilter: FieldFilter = {
      id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      fieldSlug: field.slug,
      fieldType: field.type,
      operator: defaultOp,
    };

    addFieldFilter(newFilter);
    setAddFilterOpen(false);
    setActiveFilterId(newFilter.id);
  }, [addFieldFilter]);

  const totalActiveFilters =
    filters.fieldFilters.length +
    filters.crossFilters.length +
    (filters.dateRange ? 1 : 0);

  const categoryLabels: Record<string, string> = {
    text: 'Texto',
    number: 'Numerico',
    date: 'Data',
    boolean: 'Sim/Nao',
    select: 'Selecao',
    multiselect: 'Multi-selecao',
    map: 'Mapa',
    'sub-entity': 'Sub-entidade',
    color: 'Cor',
    file: 'Arquivo',
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Add Filter */}
      <Popover open={addFilterOpen} onOpenChange={setAddFilterOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1">
            <Plus className="h-3.5 w-3.5" />
            <Filter className="h-3.5 w-3.5" />
            {t('addFilter')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-2" align="start">
          <FieldSearchList
            groupedFields={groupedFields}
            categoryLabels={categoryLabels}
            onSelect={handleAddFilter}
            searchPlaceholder={t('searchField')}
            emptyLabel={t('noFields')}
          />
        </PopoverContent>
      </Popover>

      {/* Active field filters */}
      {filters.fieldFilters.map(filter => (
        <FilterBadge
          key={filter.id}
          filter={filter}
          field={entity?.fields.find(f => f.slug === filter.fieldSlug)}
          allRecords={allRecords}
          isActive={activeFilterId === filter.id}
          onActivate={() => setActiveFilterId(activeFilterId === filter.id ? null : filter.id)}
          onUpdate={(updates) => updateFieldFilter(filter.id, updates)}
          onRemove={() => {
            removeFieldFilter(filter.id);
            if (activeFilterId === filter.id) setActiveFilterId(null);
          }}
        />
      ))}

      {/* Active cross filters */}
      {filters.crossFilters.map(cf => (
        <Badge key={cf.fieldSlug} variant="secondary" className="gap-1 pl-2 pr-1 h-7">
          <span className="text-xs">
            {entity?.fields.find(f => f.slug === cf.fieldSlug)?.label ||
             entity?.fields.find(f => f.slug === cf.fieldSlug)?.name ||
             cf.fieldSlug}
            : {cf.values.join(', ')}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 rounded-full hover:bg-destructive/20"
            onClick={() => removeCrossFilter(cf.fieldSlug)}
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      ))}

      {/* Clear all */}
      {totalActiveFilters > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-muted-foreground"
          onClick={clearAllFilters}
        >
          <X className="h-3.5 w-3.5 mr-1" />
          {t('clearAll')}
        </Button>
      )}
    </div>
  );
}

// ─── Filter Badge with popover editor ───────────────────────────────

interface FilterBadgeProps {
  filter: FieldFilter;
  field?: EntityField;
  allRecords: import('./unified-filter-types').DataRecord[];
  isActive: boolean;
  onActivate: () => void;
  onUpdate: (updates: Partial<FieldFilter>) => void;
  onRemove: () => void;
}

function FilterBadge({
  filter,
  field,
  allRecords,
  isActive,
  onActivate,
  onUpdate,
  onRemove,
}: FilterBadgeProps) {
  const t = useTranslations('filter');
  const category = getFilterCategory(filter.fieldType);
  const operators = getOperatorsForField(filter.fieldType);
  const fieldLabel = field?.label || field?.name || filter.fieldSlug;

  // Get operator display label
  const opLabel = operators.find(o => o.value === filter.operator)?.labelKey || filter.operator;
  const displayLabel = t.has(opLabel.replace('filter.', ''))
    ? t(opLabel.replace('filter.', ''))
    : opLabel.replace('filter.', '');

  // Format value for display
  const displayValue = formatFilterValue(filter, field);

  return (
    <Popover open={isActive} onOpenChange={(open) => { if (!open) onActivate(); else onActivate(); }}>
      <PopoverTrigger asChild>
        <Badge
          variant={isActive ? 'default' : 'secondary'}
          className="gap-1 pl-2 pr-1 h-7 cursor-pointer hover:bg-accent transition-colors"
        >
          <span className="text-xs font-medium">{fieldLabel}</span>
          <span className="text-xs opacity-70">{displayLabel}</span>
          {displayValue && (
            <span className="text-xs font-normal">{displayValue}</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 rounded-full hover:bg-destructive/20 ml-0.5"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-3" align="start">
        <div className="space-y-3">
          {/* Operator selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              {t('operator')}
            </label>
            <Select
              value={filter.operator}
              onValueChange={(v) => onUpdate({ operator: v as FilterOperator })}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {operators.map(op => (
                  <SelectItem key={op.value} value={op.value}>
                    {t.has(op.labelKey.replace('filter.', ''))
                      ? t(op.labelKey.replace('filter.', ''))
                      : op.labelKey.replace('filter.', '')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Value editor - type-aware */}
          {!['isEmpty', 'isNotEmpty', 'hasChildren', 'hasNoChildren'].includes(filter.operator) && (
            <FilterValueEditor
              filter={filter}
              field={field}
              category={category}
              allRecords={allRecords}
              onUpdate={onUpdate}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Filter Value Editor ────────────────────────────────────────────

interface FilterValueEditorProps {
  filter: FieldFilter;
  field?: EntityField;
  category: FilterCategory | null;
  allRecords: import('./unified-filter-types').DataRecord[];
  onUpdate: (updates: Partial<FieldFilter>) => void;
}

function FilterValueEditor({
  filter,
  field,
  category,
  allRecords,
  onUpdate,
}: FilterValueEditorProps) {
  const t = useTranslations('filter');

  // Relative date preset
  if (filter.operator === 'relative') {
    return (
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          {t('period')}
        </label>
        <Select
          value={filter.relativePreset || 'last7days'}
          onValueChange={(v) => onUpdate({ relativePreset: v as FieldFilter['relativePreset'] })}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RELATIVE_DATE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {t.has(opt.labelKey.replace('filter.', ''))
                  ? t(opt.labelKey.replace('filter.', ''))
                  : opt.labelKey.replace('filter.', '')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // Select: show checkboxes for options
  if ((category === 'select' || category === 'multiselect') &&
      (filter.operator === 'in' || filter.operator === 'notIn' ||
       filter.operator === 'containsAny' || filter.operator === 'containsAll' ||
       filter.operator === 'notContainsAny')) {
    return (
      <SelectFilterValue
        filter={filter}
        field={field}
        allRecords={allRecords}
        onUpdate={onUpdate}
      />
    );
  }

  // Boolean
  if (category === 'boolean') {
    return (
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          {t('value')}
        </label>
        <Select
          value={String(filter.value ?? '')}
          onValueChange={(v) => onUpdate({ value: v === 'true' })}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">{t('yes')}</SelectItem>
            <SelectItem value="false">{t('no')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }

  // Number
  if (category === 'number') {
    return (
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground block">
          {t('value')}
        </label>
        <Input
          type="number"
          value={filter.value !== undefined ? String(filter.value) : ''}
          onChange={(e) => onUpdate({ value: e.target.value ? Number(e.target.value) : undefined })}
          className="h-8"
          placeholder="0"
        />
        {filter.operator === 'between' && (
          <>
            <label className="text-xs font-medium text-muted-foreground block">
              {t('and')}
            </label>
            <Input
              type="number"
              value={filter.value2 !== undefined ? String(filter.value2) : ''}
              onChange={(e) => onUpdate({ value2: e.target.value ? Number(e.target.value) : undefined })}
              className="h-8"
              placeholder="0"
            />
          </>
        )}
      </div>
    );
  }

  // Date
  if (category === 'date') {
    return (
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground block">
          {t('value')}
        </label>
        <Input
          type="date"
          value={filter.value ? String(filter.value).substring(0, 10) : ''}
          onChange={(e) => onUpdate({ value: e.target.value ? `${e.target.value}T00:00:00.000Z` : undefined })}
          className="h-8"
        />
        {filter.operator === 'between' && (
          <>
            <label className="text-xs font-medium text-muted-foreground block">
              {t('and')}
            </label>
            <Input
              type="date"
              value={filter.value2 ? String(filter.value2).substring(0, 10) : ''}
              onChange={(e) => onUpdate({ value2: e.target.value ? `${e.target.value}T23:59:59.999Z` : undefined })}
              className="h-8"
            />
          </>
        )}
      </div>
    );
  }

  // Default: text input
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">
        {t('value')}
      </label>
      <Input
        value={filter.value !== undefined ? String(filter.value) : ''}
        onChange={(e) => onUpdate({ value: e.target.value || undefined })}
        className="h-8"
        placeholder={t('typeValue')}
      />
    </div>
  );
}

// ─── Select filter with checkboxes ──────────────────────────────────

function SelectFilterValue({
  filter,
  field,
  allRecords,
  onUpdate,
}: {
  filter: FieldFilter;
  field?: EntityField;
  allRecords: import('./unified-filter-types').DataRecord[];
  onUpdate: (updates: Partial<FieldFilter>) => void;
}) {
  const [search, setSearch] = useState('');

  // Get all unique values with counts from data
  const options = useMemo(() => {
    if (!field) return [];

    // Prefer field.options if available
    if (field.options && field.options.length > 0) {
      const distribution = groupByField(allRecords, filter.fieldSlug, field);
      const countMap = new Map(distribution.map(d => [d.value, d.count]));
      return field.options.map(opt => ({
        value: opt.value,
        label: opt.label,
        count: countMap.get(opt.value) ?? 0,
      }));
    }

    // Fallback: derive from data
    const distribution = groupByField(allRecords, filter.fieldSlug, field, 50);
    return distribution.map(d => ({
      value: d.value,
      label: d.label,
      count: d.count,
    }));
  }, [field, allRecords, filter.fieldSlug]);

  const selectedValues = useMemo(() => {
    if (!filter.value) return new Set<string>();
    if (Array.isArray(filter.value)) return new Set(filter.value.map(String));
    return new Set([String(filter.value)]);
  }, [filter.value]);

  const toggleValue = useCallback((value: string) => {
    const next = new Set(selectedValues);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    const arr = Array.from(next);
    onUpdate({ value: arr.length > 0 ? arr : undefined });
  }, [selectedValues, onUpdate]);

  const filteredOptions = search
    ? options.filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        o.value.toLowerCase().includes(search.toLowerCase()),
      )
    : options;

  return (
    <div>
      {options.length > 5 && (
        <div className="relative mb-2">
          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="h-7 pl-7 text-xs"
          />
        </div>
      )}
      <div className="max-h-[200px] overflow-y-auto space-y-1">
        {filteredOptions.map(opt => (
          <label
            key={opt.value}
            className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-muted/50 cursor-pointer text-sm"
          >
            <Checkbox
              checked={selectedValues.has(opt.value)}
              onCheckedChange={() => toggleValue(opt.value)}
              className="h-3.5 w-3.5"
            />
            <span className="flex-1 truncate">{opt.label}</span>
            <span className="text-xs text-muted-foreground">{opt.count}</span>
          </label>
        ))}
        {filteredOptions.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Nenhuma opcao encontrada
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

// ─── Field search list ──────────────────────────────────────────────

function FieldSearchList({
  groupedFields,
  categoryLabels,
  onSelect,
  searchPlaceholder,
  emptyLabel,
}: {
  groupedFields: Record<string, EntityField[]>;
  categoryLabels: Record<string, string>;
  onSelect: (field: EntityField) => void;
  searchPlaceholder: string;
  emptyLabel: string;
}) {
  const [search, setSearch] = useState('');

  const filteredGroups = useMemo(() => {
    if (!search) return groupedFields;
    const term = search.toLowerCase();
    const result: Record<string, EntityField[]> = {};
    for (const [cat, fields] of Object.entries(groupedFields)) {
      const filtered = fields.filter(f =>
        (f.label || f.name).toLowerCase().includes(term) ||
        f.slug.toLowerCase().includes(term),
      );
      if (filtered.length > 0) result[cat] = filtered;
    }
    return result;
  }, [groupedFields, search]);

  const hasResults = Object.keys(filteredGroups).length > 0;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-8 pl-7 text-sm"
        />
      </div>
      <div className="max-h-[300px] overflow-y-auto">
        {!hasResults && (
          <p className="text-xs text-muted-foreground text-center py-4">{emptyLabel}</p>
        )}
        {Object.entries(filteredGroups).map(([category, fields]) => (
          <div key={category} className="mb-2">
            <p className="text-xs font-semibold text-muted-foreground px-1 py-1">
              {categoryLabels[category] || category}
            </p>
            {fields.map(field => (
              <button
                key={field.slug}
                onClick={() => onSelect(field)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-accent transition-colors text-left"
              >
                <span className="flex-1 truncate">{field.label || field.name}</span>
                <span className="text-xs text-muted-foreground">{field.type}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function formatFilterValue(filter: FieldFilter, field?: EntityField): string {
  if (['isEmpty', 'isNotEmpty', 'hasChildren', 'hasNoChildren'].includes(filter.operator)) {
    return '';
  }

  if (filter.operator === 'relative' && filter.relativePreset) {
    return filter.relativePreset;
  }

  if (filter.value === undefined || filter.value === null) return '';

  if (Array.isArray(filter.value)) {
    if (filter.value.length <= 2) {
      return filter.value.map(v => {
        if (field?.options) {
          const opt = field.options.find(o => o.value === String(v));
          return opt?.label || String(v);
        }
        return String(v);
      }).join(', ');
    }
    return `${filter.value.length} selecionados`;
  }

  if (filter.operator === 'between' && filter.value2 !== undefined) {
    return `${filter.value} - ${filter.value2}`;
  }

  if (typeof filter.value === 'boolean') {
    return filter.value ? 'Sim' : 'Nao';
  }

  const strValue = String(filter.value);
  return strValue.length > 20 ? strValue.slice(0, 20) + '...' : strValue;
}

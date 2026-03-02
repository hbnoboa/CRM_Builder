'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Loader2, Star, Eye, EyeOff, Play, Pause, Square, Clock, AlertTriangle, CheckCircle, XCircle, X, Plus } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider as SliderUI } from '@/components/ui/slider';
import { SearchableSelect } from '@/components/ui/searchable-select';
import type { SelectOption } from '@/components/ui/searchable-select';
import { useCreateEntityData, useUpdateEntityData } from '@/hooks/use-data';
import { useTenant } from '@/stores/tenant-context';
import { api } from '@/lib/api';
import dynamic from 'next/dynamic';
import type { EntityField, FieldType } from '@/types';
import type { MapFieldValue } from '@/components/form/map-field';

const MapField = dynamic(() => import('@/components/form/map-field'), { ssr: false });
const ZoneDiagramField = dynamic(
  () => import('@/components/form/zone-diagram-field'),
  { ssr: false, loading: () => <div className="h-32 flex items-center justify-center text-muted-foreground">Carregando...</div> },
);

// Sprint 4: Componentes de campos avancados
import { SignatureField } from '@/components/fields/signature-field';
import { ActionButtonField } from '@/components/fields/action-button-field';
import { LookupField } from '@/components/fields/lookup-field';

interface ApiOption {
  value: string;
  label: string;
  data: Record<string, unknown>;
}

interface Entity {
  id: string;
  name: string;
  slug: string;
  fields: EntityField[];
  settings?: {
    allowCreate?: boolean;
    allowEdit?: boolean;
    allowDelete?: boolean;
    enableAudit?: boolean;
    softDelete?: boolean;
    captureLocation?: boolean;
  };
}

interface RecordData {
  id: string;
  data: Record<string, unknown>;
}

interface RecordFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: Entity;
  record?: RecordData | null;
  onSuccess?: () => void;
  parentRecordId?: string;
  editableFields?: string[];
}

// ─── Masks ──────────────────────────────────────────────────────────────────
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

function parseCurrencyInput(input: string): number {
  const cleaned = String(input).trim();
  if (!cleaned) return NaN;
  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  if (lastDot > -1 && lastComma > -1) {
    if (lastComma > lastDot) {
      // "1.234,56" → pt-BR format
      return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
    } else {
      // "1,234.56" → en-US format
      return parseFloat(cleaned.replace(/,/g, ''));
    }
  } else if (lastComma > -1) {
    // "1234,56" → comma as decimal
    return parseFloat(cleaned.replace(',', '.'));
  }
  return parseFloat(cleaned);
}

function formatCurrencyDisplay(value: string | number): string {
  const num = typeof value === 'number' ? value : parseCurrencyInput(String(value));
  if (isNaN(num)) return '';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Component ──────────────────────────────────────────────────────────────
export function RecordFormDialog({
  open,
  onOpenChange,
  entity,
  record,
  onSuccess,
  parentRecordId,
  editableFields,
}: RecordFormDialogProps) {
  const t = useTranslations('data');
  const tCommon = useTranslations('common');
  const tPlaceholders = useTranslations('placeholders');
  const tValidation = useTranslations('validation');
  const isEditing = !!record;
  const createRecord = useCreateEntityData({ success: isEditing ? t('toast.updated') : t('toast.created') });
  const updateRecord = useUpdateEntityData({ success: t('toast.updated') });
  const { tenantId, effectiveTenantId } = useTenant();

  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiOptions, setApiOptions] = useState<Record<string, ApiOption[]>>({});
  const [loadingApiOptions, setLoadingApiOptions] = useState<Record<string, boolean>>({});
  const [relationOptions, setRelationOptions] = useState<Record<string, ApiOption[]>>({});
  const [loadingRelations, setLoadingRelations] = useState<Record<string, boolean>>({});
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});

  const normalizeSelectValue = (val: unknown): unknown => {
    if (val && typeof val === 'object' && 'value' in (val as Record<string, unknown>)) {
      return (val as Record<string, unknown>).value;
    }
    return val;
  };

  const normalizeFormData = (data: Record<string, unknown>, fields: EntityField[]): Record<string, unknown> => {
    const normalized: Record<string, unknown> = {};
    for (const key in data) {
      const field = fields.find(f => f.slug === key);
      const value = data[key];
      if (field?.type === 'select' || field?.type === 'api-select' || field?.type === 'relation') {
        normalized[key] = normalizeSelectValue(value);
      } else if (field?.type === 'multiselect' && Array.isArray(value)) {
        normalized[key] = value.map(v => normalizeSelectValue(v));
      } else {
        normalized[key] = value;
      }
    }
    return normalized;
  };

  // ─── Fetch API options ──────────────────────────────────────────────────
  const fetchApiOptions = useCallback(async (field: EntityField) => {
    const tid = effectiveTenantId || tenantId;
    if (!field.apiEndpoint || !tid) return;
    setLoadingApiOptions(prev => ({ ...prev, [field.slug]: true }));
    try {
      const response = await api.get(`/x/${tid}${field.apiEndpoint}`);
      const data = Array.isArray(response.data) ? response.data : response.data.data || [];
      const options: ApiOption[] = data.map((item: Record<string, unknown>) => {
        const valueField = field.valueField || 'id';
        const labelField = field.labelField || 'name';
        let label = item[labelField];
        if (!label) {
          for (const key of Object.keys(item)) {
            if (typeof item[key] === 'string' && key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') {
              label = item[key]; break;
            }
          }
        }
        return { value: String(item[valueField] || item.id || ''), label: String(label || item[valueField] || t('noName')), data: item };
      });
      setApiOptions(prev => ({ ...prev, [field.slug]: options }));
    } catch (error) {
      console.error(`Error loading API options ${field.apiEndpoint}:`, error);
      setApiOptions(prev => ({ ...prev, [field.slug]: [] }));
    } finally {
      setLoadingApiOptions(prev => ({ ...prev, [field.slug]: false }));
    }
  }, [effectiveTenantId, tenantId, t]);

  // ─── Fetch relation options ─────────────────────────────────────────────
  const fetchRelationOptions = useCallback(async (field: EntityField) => {
    const tid = effectiveTenantId || tenantId;
    if (!field.relatedEntitySlug || !tid) return;
    setLoadingRelations(prev => ({ ...prev, [field.slug]: true }));
    try {
      const params: Record<string, string> = {};
      if (effectiveTenantId) params.tenantId = effectiveTenantId;
      const response = await api.get(`/data/${field.relatedEntitySlug}`, { params });
      const data = Array.isArray(response.data) ? response.data : response.data?.data || [];
      const displayField = field.relatedDisplayField || '';
      const options: ApiOption[] = data.map((item: Record<string, unknown>) => {
        const itemData = (item.data || item) as Record<string, unknown>;
        let label: unknown = displayField ? itemData[displayField] : undefined;
        // Handle {value, label} objects from backend enrichment
        if (label && typeof label === 'object' && 'label' in (label as Record<string, unknown>)) {
          label = (label as Record<string, unknown>).label;
        }
        if (!label) {
          for (const key of Object.keys(itemData)) {
            const v = itemData[key];
            if (typeof v === 'string' && key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') {
              label = v; break;
            }
          }
        }
        return {
          value: String((item as any).id || ''),
          label: String(label || (item as any).id || t('noName')),
          data: itemData,
        };
      });
      setRelationOptions(prev => ({ ...prev, [field.slug]: options }));
    } catch (error) {
      console.error(`Error loading relation ${field.relatedEntitySlug}:`, error);
      setRelationOptions(prev => ({ ...prev, [field.slug]: [] }));
    } finally {
      setLoadingRelations(prev => ({ ...prev, [field.slug]: false }));
    }
  }, [effectiveTenantId, tenantId, t]);

  // Load options when dialog opens
  useEffect(() => {
    if (open && entity.fields) {
      entity.fields.filter(f => f.type === 'api-select' && f.apiEndpoint).forEach(fetchApiOptions);
      entity.fields.filter(f => f.type === 'relation' && f.relatedEntitySlug).forEach(fetchRelationOptions);
    }
  }, [open, entity.fields, fetchApiOptions, fetchRelationOptions]);

  const handleApiSelectChange = (field: EntityField, value: string) => {
    handleFieldChange(field.slug, value);
    const options = apiOptions[field.slug] || [];
    const selectedOption = options.find(opt => opt.value === value);
    if (selectedOption && field.autoFillFields) {
      const updates: Record<string, unknown> = {};
      // Build a lookup: name -> slug, slug -> slug for resilient matching
      const allFields = entity.fields || [];
      const slugLookup: Record<string, string> = {};
      for (const f of allFields) {
        if (f.slug) slugLookup[f.slug] = f.slug;
        if (f.name) slugLookup[f.name] = f.slug || f.name;
      }
      for (const autoFill of field.autoFillFields) {
        const sourceValue = selectedOption.data[autoFill.sourceField];
        // Resolve targetField to actual slug used in formData
        const resolvedTarget = slugLookup[autoFill.targetField] || autoFill.targetField;
        if (sourceValue !== undefined) updates[resolvedTarget] = sourceValue;
      }
      if (Object.keys(updates).length > 0) setFormData(prev => ({ ...prev, ...updates }));
    }
  };

  useEffect(() => {
    if (open) {
      if (record) {
        const normalized = normalizeFormData(record.data || {}, entity.fields || []);
        entity.fields?.forEach((field) => {
          if (field.type === 'currency' && normalized[field.slug] != null && normalized[field.slug] !== '') {
            const num = Number(normalized[field.slug]);
            if (!isNaN(num)) normalized[field.slug] = formatCurrencyDisplay(num);
          }
        });
        setFormData(normalized);
      } else {
        const initialData: Record<string, unknown> = {};
        entity.fields?.forEach((field) => {
          if (field.default !== undefined) initialData[field.slug] = field.default;
          else if (field.type === 'boolean') initialData[field.slug] = false;
          else if (field.type === 'number' || field.type === 'currency' || field.type === 'percentage') initialData[field.slug] = '';
          else if (field.type === 'multiselect') initialData[field.slug] = [];
          else if (field.type === 'rating') initialData[field.slug] = 0;
          else if (field.type === 'slider') initialData[field.slug] = field.min || 0;
          else if (field.type === 'color') initialData[field.slug] = '#000000';
          else initialData[field.slug] = '';
        });
        setFormData(initialData);
      }
      setErrors({});
    }
  }, [open, record, entity.fields]);

  // Resolve template values like {{now}}, {{today}}, {{allFilled:...}}, {{anyEmpty:...}}
  const resolveValueTemplate = (template: string, currentFormData?: Record<string, unknown>): unknown => {
    const data = currentFormData || formData;

    const hasValue = (val: unknown) =>
      val !== undefined && val !== null && val !== '' &&
      !(Array.isArray(val) && val.length === 0);

    // {{allFilled:field1,field2,...}} — true if ALL listed fields have a value
    const allFilledMatch = template.match(/^\{\{allFilled:(.+?)\}\}$/);
    if (allFilledMatch) {
      const fields = allFilledMatch[1].split(',').map(f => f.trim());
      return fields.every(f => hasValue(data[f]));
    }

    // {{anyEmpty:field1,field2,...}} — true if ANY listed field is empty
    const anyEmptyMatch = template.match(/^\{\{anyEmpty:(.+?)\}\}$/);
    if (anyEmptyMatch) {
      const fields = anyEmptyMatch[1].split(',').map(f => f.trim());
      return fields.some(f => !hasValue(data[f]));
    }

    const now = new Date();
    // Format as yyyy-MM-ddTHH:mm (compatible with datetime-local input)
    const pad = (n: number) => String(n).padStart(2, '0');
    const localDatetime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const values: Record<string, unknown> = {
      'now': localDatetime,
      'today': localDatetime.split('T')[0],
      'timestamp': now.getTime(),
    };
    const match = template.match(/^\{\{(.+?)\}\}$/);
    if (match) {
      const key = match[1].trim();
      return values[key] ?? template;
    }
    return template;
  };

  // Process onChangeAutoFill when a field changes
  const processOnChangeAutoFill = async (field: EntityField, newValue: unknown) => {
    if (!field.onChangeAutoFill || field.onChangeAutoFill.length === 0) return;

    // Only trigger if the field actually has a value (not clearing)
    const hasValue = newValue !== undefined && newValue !== null && newValue !== '' &&
      !(Array.isArray(newValue) && newValue.length === 0);
    if (!hasValue) return;

    // Build updated formData snapshot (current formData + the new value)
    const updatedFormData = { ...formData, [field.slug]: newValue };

    const updates: Record<string, unknown> = {};
    const tid = effectiveTenantId || tenantId;

    for (const autoFill of field.onChangeAutoFill) {
      if (autoFill.valueTemplate) {
        // Use template directly (e.g., {{now}}, {{allFilled:...}})
        updates[autoFill.targetField] = resolveValueTemplate(autoFill.valueTemplate, updatedFormData);
      } else if (autoFill.apiEndpoint && tid) {
        // Call custom API to get computed value
        try {
          const response = await api.get(`/x/${tid}${autoFill.apiEndpoint}`);
          const data = Array.isArray(response.data) ? response.data[0] : response.data;
          if (data) {
            // Get the first non-id field value or use the whole object
            const valueField = Object.keys(data).find(k => k !== 'id' && k !== 'createdAt' && k !== 'updatedAt');
            updates[autoFill.targetField] = valueField ? data[valueField] : data;
          }
        } catch (error) {
          console.error(`Error calling auto-fill API ${autoFill.apiEndpoint}:`, error);
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      setFormData(prev => ({ ...prev, ...updates }));
    }
  };

  const handleFieldChange = (fieldSlug: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [fieldSlug]: value }));
    if (errors[fieldSlug]) {
      setErrors((prev) => { const newErrors = { ...prev }; delete newErrors[fieldSlug]; return newErrors; });
    }

    // Check for onChangeAutoFill on the changed field
    const field = entity.fields?.find(f => f.slug === fieldSlug);
    if (field?.onChangeAutoFill) {
      processOnChangeAutoFill(field, value);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    entity.fields?.forEach((field) => {
      // Sub-entity fields are not validated (they manage their own data)
      if (field.type === 'sub-entity') return;
      const value = formData[field.slug];
      if (field.required && (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0))) {
        newErrors[field.slug] = tValidation('fieldRequired', { field: field.label || field.name });
        return;
      }
      if (value !== undefined && value !== null && value !== '') {
        switch (field.type) {
          case 'email':
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) newErrors[field.slug] = tValidation('emailInvalid');
            break;
          case 'url':
            try { new URL(String(value)); } catch { newErrors[field.slug] = tValidation('urlInvalid'); }
            break;
          case 'number': case 'currency': case 'percentage':
            if (isNaN(parseCurrencyInput(String(value)))) newErrors[field.slug] = tValidation('numberInvalid');
            break;
          case 'cpf': {
            const digits = String(value).replace(/\D/g, '');
            if (digits.length !== 11) newErrors[field.slug] = tValidation('cpfDigits');
            break;
          }
          case 'cnpj': {
            const digits = String(value).replace(/\D/g, '');
            if (digits.length !== 14) newErrors[field.slug] = tValidation('cnpjDigits');
            break;
          }
          case 'cep': {
            const digits = String(value).replace(/\D/g, '');
            if (digits.length !== 8) newErrors[field.slug] = tValidation('cepDigits');
            break;
          }
        }
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const processedData: Record<string, unknown> = {};

    // Auto-capture geolocation if entity has captureLocation enabled
    if (entity.settings?.captureLocation && typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          });
        });
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        const geoData: Record<string, unknown> = { lat, lng, uf: '', city: '', address: '', number: '' };
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
            { headers: { 'Accept-Language': 'pt-BR,pt,en', 'User-Agent': 'CRM-Builder/1.0' } }
          );
          const data = await res.json();
          if (data?.address) {
            geoData.uf = data.address.state || '';
            geoData.city = data.address.city || data.address.town || data.address.village || '';
            geoData.address = data.address.road || '';
            geoData.number = data.address.house_number || '';
          }
        } catch { /* best-effort reverse geocode */ }
        processedData._geolocation = geoData;
      } catch (e) {
        console.warn('Geolocation capture failed:', e);
      }
    }
    entity.fields?.forEach((field) => {
      // Sub-entity fields store data separately, skip them
      if (field.type === 'sub-entity') return;
      // Skip fields the user cannot edit (field-level permissions)
      if (editableFields && !editableFields.includes(field.slug)) return;
      const value = formData[field.slug];
      if (value !== undefined && value !== '') {
        if (field.type === 'number' || field.type === 'rating' || field.type === 'slider') {
          processedData[field.slug] = Number(value);
        } else if (field.type === 'currency' || field.type === 'percentage') {
          processedData[field.slug] = parseCurrencyInput(String(value));
        } else if (field.type === 'relation') {
          // Save as {value, label} so the data list shows the display name
          const id = String(value);
          const options = relationOptions[field.slug] || [];
          const option = options.find(o => o.value === id);
          processedData[field.slug] = option ? { value: id, label: option.label } : id;
        } else if (field.type === 'api-select') {
          // Same as relation: save as {value, label} so display shows the name
          const id = String(value);
          const options = apiOptions[field.slug] || [];
          const option = options.find(o => o.value === id);
          processedData[field.slug] = option ? { value: id, label: option.label } : id;
        } else {
          processedData[field.slug] = value;
        }
      }
    });

    try {
      if (isEditing && record) {
        await updateRecord.mutateAsync({ entitySlug: entity.slug, id: record.id, data: processedData, tenantId: effectiveTenantId || undefined });
      } else {
        await createRecord.mutateAsync({ entitySlug: entity.slug, data: processedData, parentRecordId, tenantId: effectiveTenantId || undefined });
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (error) { /* handled by hook */ }
  };

  const isLoading = createRecord.isPending || updateRecord.isPending;

  // ─── Group fields into grid rows ──────────────────────────────────────────
  const fieldRows = useMemo(() => {
    // Filtra campos ocultos (type === 'hidden' OU hidden === true)
    const visibleFields = (entity.fields || []).filter(f => f.type !== 'hidden' && !f.hidden);

    // Agrupa campos por gridRow (mesmo approach do FieldGridEditor)
    const fieldsByRow: Record<number, EntityField[]> = {};
    for (const field of visibleFields) {
      const row = field.gridRow || 0;
      if (!fieldsByRow[row]) fieldsByRow[row] = [];
      fieldsByRow[row].push(field);
    }

    // Ordena por gridRow (row 0 = sem row definido, vai pro final)
    const rowKeys = Object.keys(fieldsByRow).map(Number).sort((a, b) => {
      if (a === 0) return 1;
      if (b === 0) return -1;
      return a - b;
    });

    // Monta rows respeitando colSpan (quebra se exceder 12 colunas)
    const rows: EntityField[][] = [];
    for (const rowKey of rowKeys) {
      const fieldsInRow = fieldsByRow[rowKey];
      let currentRow: EntityField[] = [];
      let currentSpan = 0;

      for (const field of fieldsInRow) {
        const colSpan = field.gridColSpan || 12;
        const colStart = field.gridColStart ? field.gridColStart - 1 : currentSpan;

        if (colStart + colSpan > 12 && currentRow.length > 0) {
          rows.push(currentRow);
          currentRow = [field];
          currentSpan = Math.min(colSpan, 12);
        } else {
          currentRow.push(field);
          currentSpan = colStart + colSpan;
        }
      }
      if (currentRow.length > 0) rows.push(currentRow);
    }

    return rows;
  }, [entity.fields]);

  // ─── Render field ─────────────────────────────────────────────────────────
  const renderField = (field: EntityField) => {
    const value = formData[field.slug];
    const error = errors[field.slug];
    const helpText = field.helpText;
    const isFieldDisabled = field.disabled || (editableFields ? !editableFields.includes(field.slug) : false);

    const fieldLabel = (
      <Label htmlFor={field.slug} className={isFieldDisabled ? 'opacity-60' : ''}>
        {field.label || field.name}
        {field.required && <span className="text-destructive ml-1">*</span>}
        {isFieldDisabled && <span className="text-muted-foreground ml-1 text-xs">(readonly)</span>}
      </Label>
    );
    const errorEl = error ? <p className="text-sm text-destructive">{error}</p> : null;
    const helpEl = helpText ? <p className="text-xs text-muted-foreground">{helpText}</p> : null;

    switch (field.type) {
      case 'textarea':
      case 'richtext':
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <Textarea id={field.slug} placeholder={field.placeholder || tPlaceholders('enterField', { field: (field.label || field.name).toLowerCase() })} value={String(value || '')} onChange={(e) => handleFieldChange(field.slug, e.target.value)} rows={3} disabled={isFieldDisabled} />
            {helpEl}{errorEl}
          </div>
        );

      case 'boolean':
        return (
          <div key={field.slug} className="flex items-center space-x-2 pt-6">
            <Checkbox id={field.slug} checked={Boolean(value)} onCheckedChange={(checked) => handleFieldChange(field.slug, checked)} disabled={isFieldDisabled} />
            <Label htmlFor={field.slug} className="cursor-pointer">{field.label || field.name}{field.required && <span className="text-destructive ml-1">*</span>}</Label>
            {errorEl}
          </div>
        );

      case 'select': {
        const selectOpts: SelectOption[] = (field.options || []).map((option) => {
          const optVal = typeof option === 'object' ? option.value : option;
          const optLabel = typeof option === 'object' ? option.label : option;
          const optColor = typeof option === 'object' ? option.color : undefined;
          return { value: optVal, label: optLabel, ...(optColor ? { color: optColor } : {}) };
        }).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <SearchableSelect
              options={selectOpts}
              value={String(value || '')}
              onChange={(val) => handleFieldChange(field.slug, val)}
              placeholder={field.placeholder || tCommon('select')}
              disabled={isFieldDisabled}
              allowCustom
            />
            {helpEl}{errorEl}
          </div>
        );
      }

      case 'multiselect': {
        const multiOpts: SelectOption[] = (field.options || []).map((option) => {
          const optVal = typeof option === 'object' ? option.value : option;
          const optLabel = typeof option === 'object' ? option.label : option;
          const optColor = typeof option === 'object' ? option.color : undefined;
          return { value: optVal, label: optLabel, ...(optColor ? { color: optColor } : {}) };
        }).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <SearchableSelect
              options={multiOpts}
              value={Array.isArray(value) ? value : []}
              onChange={(val) => handleFieldChange(field.slug, val)}
              multiple
              placeholder={field.placeholder || tCommon('select')}
              disabled={isFieldDisabled}
              allowCustom
            />
            {helpEl}{errorEl}
          </div>
        );
      }

      case 'api-select': {
        const apiOpts: SelectOption[] = (apiOptions[field.slug] || []).filter(o => o.value).map(o => ({ value: o.value, label: o.label })).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
        const isLoadingOpts = loadingApiOptions[field.slug];
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <SearchableSelect
              options={apiOpts}
              value={String(value || '')}
              onChange={(val) => handleApiSelectChange(field, String(val))}
              placeholder={field.placeholder || tCommon('select')}
              disabled={isFieldDisabled}
              loading={isLoadingOpts}
              allowCustom={false}
              emptyMessage={t('noOptionsAvailable')}
            />
            {field.apiEndpoint && <p className="text-xs text-muted-foreground">API: {field.apiEndpoint}</p>}
            {helpEl}{errorEl}
          </div>
        );
      }

      case 'relation': {
        const relOpts: SelectOption[] = (relationOptions[field.slug] || []).filter(o => o.value).map(o => ({ value: o.value, label: o.label })).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
        const isLoadingRel = loadingRelations[field.slug];
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <SearchableSelect
              options={relOpts}
              value={String(value || '')}
              onChange={(val) => handleFieldChange(field.slug, String(val))}
              placeholder={field.placeholder || tCommon('select')}
              disabled={isFieldDisabled}
              loading={isLoadingRel}
              allowCustom={false}
              emptyMessage={t('noRecordFound')}
            />
            {field.relatedEntitySlug && <p className="text-xs text-muted-foreground">{tCommon('type')}: {field.relatedEntitySlug}</p>}
            {helpEl}{errorEl}
          </div>
        );
      }

      case 'date':
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <Input id={field.slug} type="date" value={String(value || '')} onChange={(e) => handleFieldChange(field.slug, e.target.value)} disabled={isFieldDisabled} />
            {helpEl}{errorEl}
          </div>
        );

      case 'datetime': {
        // Normalizar ISO strings (ex: 2026-02-23T01:09:01.841Z) para formato datetime-local (yyyy-MM-ddTHH:mm)
        let dtValue = String(value || '');
        if (dtValue && (dtValue.includes('Z') || dtValue.includes('.'))) {
          const d = new Date(dtValue);
          if (!isNaN(d.getTime())) {
            const pad = (n: number) => String(n).padStart(2, '0');
            dtValue = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
          }
        }
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <Input id={field.slug} type="datetime-local" value={dtValue} onChange={(e) => handleFieldChange(field.slug, e.target.value)} disabled={isFieldDisabled} />
            {helpEl}{errorEl}
          </div>
        );
      }

      case 'time':
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <Input id={field.slug} type="time" value={String(value || '')} onChange={(e) => handleFieldChange(field.slug, e.target.value)} disabled={isFieldDisabled} />
            {helpEl}{errorEl}
          </div>
        );

      case 'number':
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <Input id={field.slug} type="number" min={field.min} max={field.max} step={field.step} placeholder={field.placeholder || tPlaceholders('enterField', { field: (field.label || field.name).toLowerCase() })} value={String(value || '')} onChange={(e) => handleFieldChange(field.slug, e.target.value)} disabled={isFieldDisabled} />
            {helpEl}{errorEl}
          </div>
        );

      case 'currency':
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{field.prefix || 'R$'}</span>
              <Input
                id={field.slug}
                type="text"
                inputMode="decimal"
                className="pl-10"
                placeholder="0,00"
                value={String(value || '')}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^\d.,-]/g, '');
                  handleFieldChange(field.slug, raw);
                }}
                onBlur={() => {
                  const v = String(value || '');
                  if (!v) return;
                  const num = parseCurrencyInput(v);
                  if (!isNaN(num)) handleFieldChange(field.slug, formatCurrencyDisplay(num));
                }}
                disabled={isFieldDisabled}
              />
            </div>
            {helpEl}{errorEl}
          </div>
        );

      case 'percentage':
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <div className="relative">
              <Input id={field.slug} type="number" step="0.1" min={field.min ?? 0} max={field.max ?? 100} className="pr-8" placeholder="0" value={String(value || '')} onChange={(e) => handleFieldChange(field.slug, e.target.value)} disabled={isFieldDisabled} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
            </div>
            {helpEl}{errorEl}
          </div>
        );

      case 'email':
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <Input id={field.slug} type="email" placeholder={field.placeholder || tPlaceholders('email')} value={String(value || '')} onChange={(e) => handleFieldChange(field.slug, e.target.value)} disabled={isFieldDisabled} />
            {helpEl}{errorEl}
          </div>
        );

      case 'url':
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <Input id={field.slug} type="url" placeholder={field.placeholder || tPlaceholders('url')} value={String(value || '')} onChange={(e) => handleFieldChange(field.slug, e.target.value)} disabled={isFieldDisabled} />
            {helpEl}{errorEl}
          </div>
        );

      case 'phone':
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <Input id={field.slug} type="tel" placeholder={field.placeholder || tPlaceholders('phone')} value={String(value || '')} onChange={(e) => handleFieldChange(field.slug, applyPhoneMask(e.target.value))} maxLength={15} disabled={isFieldDisabled} />
            {helpEl}{errorEl}
          </div>
        );

      case 'cpf':
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <Input id={field.slug} placeholder={field.placeholder || tPlaceholders('cpf')} value={String(value || '')} onChange={(e) => handleFieldChange(field.slug, applyCpfMask(e.target.value))} maxLength={14} disabled={isFieldDisabled} />
            {helpEl}{errorEl}
          </div>
        );

      case 'cnpj':
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <Input id={field.slug} placeholder={field.placeholder || tPlaceholders('cnpj')} value={String(value || '')} onChange={(e) => handleFieldChange(field.slug, applyCnpjMask(e.target.value))} maxLength={18} disabled={isFieldDisabled} />
            {helpEl}{errorEl}
          </div>
        );

      case 'cep':
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <Input id={field.slug} placeholder={field.placeholder || tPlaceholders('cep')} value={String(value || '')} onChange={(e) => handleFieldChange(field.slug, applyCepMask(e.target.value))} maxLength={9} disabled={isFieldDisabled} />
            {helpEl}{errorEl}
          </div>
        );

      case 'password':
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <div className="relative">
              <Input id={field.slug} type={showPassword[field.slug] ? 'text' : 'password'} placeholder={field.placeholder || tPlaceholders('password')} value={String(value || '')} onChange={(e) => handleFieldChange(field.slug, e.target.value)} className="pr-10" />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(prev => ({ ...prev, [field.slug]: !prev[field.slug] }))}>
                {showPassword[field.slug] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {helpEl}{errorEl}
          </div>
        );

      case 'color':
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <div className="flex items-center gap-3">
              <input type="color" id={field.slug} value={String(value || '#000000')} onChange={(e) => handleFieldChange(field.slug, e.target.value)} className="w-10 h-10 rounded cursor-pointer border" />
              <Input value={String(value || '#000000')} onChange={(e) => handleFieldChange(field.slug, e.target.value)} placeholder="#000000" className="flex-1" />
            </div>
            {helpEl}{errorEl}
          </div>
        );

      case 'rating': {
        const maxStars = field.max || 5;
        const currentRating = Number(value) || 0;
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <div className="flex items-center gap-1">
              {Array.from({ length: maxStars }, (_, i) => (
                <button key={i} type="button" className="p-0.5" onClick={() => handleFieldChange(field.slug, i + 1)}>
                  <Star className={`h-6 w-6 ${i < currentRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                </button>
              ))}
              <span className="ml-2 text-sm text-muted-foreground">{currentRating}/{maxStars}</span>
            </div>
            {helpEl}{errorEl}
          </div>
        );
      }

      case 'slider': {
        const min = field.min ?? 0;
        const max = field.max ?? 100;
        const step = field.step ?? 1;
        const currentVal = Number(value) || min;
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground w-10">{min}</span>
              <SliderUI value={[currentVal]} min={min} max={max} step={step} onValueChange={(vals) => handleFieldChange(field.slug, vals[0])} className="flex-1" />
              <span className="text-sm font-medium w-10 text-right">{currentVal}</span>
            </div>
            {helpEl}{errorEl}
          </div>
        );
      }

      case 'json':
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <Textarea id={field.slug} className="font-mono text-sm" placeholder='{"key": "value"}' value={typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value || '')} onChange={(e) => {
              try { handleFieldChange(field.slug, JSON.parse(e.target.value)); } catch { handleFieldChange(field.slug, e.target.value); }
            }} rows={4} />
            {helpEl}{errorEl}
          </div>
        );

      case 'file':
      case 'image': {
        const ImageUploadField = require('@/components/form/image-upload-field').default;
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <ImageUploadField
              value={value as string | string[] || ''}
              onChange={(v: string | string[]) => handleFieldChange(field.slug, v)}
              mode={field.type === 'image' ? 'image' : 'file'}
              multiple={field.multiple || false}
              maxFiles={field.maxFiles || 10}
              placeholder={field.placeholder}
              folder={field.type === 'image' ? 'images' : 'files'}
              imageSource={field.type === 'image' ? field.imageSource : undefined}
              disabled={isFieldDisabled}
            />
            {helpEl}{errorEl}
          </div>
        );
      }

      case 'map':
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <MapField
              value={(value as MapFieldValue) || {}}
              onChange={(mapValue) => handleFieldChange(field.slug, mapValue)}
              mode={field.mapMode || 'both'}
              defaultCenter={field.mapDefaultCenter}
              defaultZoom={field.mapDefaultZoom}
              height={field.mapHeight || 300}
              placeholder={field.placeholder}
            />
            {helpEl}{errorEl}
          </div>
        );

      case 'array': {
        const ArrayField = require('@/components/form/array-field').default;
        const arrayValue = Array.isArray(value) ? value : (typeof value === 'string' && value ? [value] : []);
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <ArrayField
              value={arrayValue}
              onChange={(vals: string[]) => handleFieldChange(field.slug, vals)}
              placeholder={field.placeholder || `Adicione itens para ${(field.label || field.name).toLowerCase()}`}
            />
            {helpEl}{errorEl}
          </div>
        );
      }

      case 'sub-entity': {
        // Sub-entity field only works when editing an existing record (needs parentRecordId)
        if (!record?.id) {
          return (
            <div key={field.slug} className="space-y-2">
              {fieldLabel}
              <div className="border rounded-lg p-4 text-center text-muted-foreground bg-muted/30">
                <p className="text-sm">💡 {t('subEntitySaveFirst', { name: field.label || field.name })}</p>
                <p className="text-xs mt-1">{t('subEntityNote')}</p>
              </div>
            </div>
          );
        }
        const SubEntityField = require('./sub-entity-field').default;
        return (
          <div key={field.slug} className="col-span-full space-y-2">
            <SubEntityField
              parentRecordId={record.id}
              subEntitySlug={field.subEntitySlug || ''}
              subEntityId={field.subEntityId || ''}
              subEntityDisplayFields={field.subEntityDisplayFields}
              label={field.label || field.name}
            />
          </div>
        );
      }

      case 'zone-diagram': {
        const isTextMode = field.diagramSaveMode === 'text';
        return (
          <div key={field.slug} className="col-span-full space-y-2">
            <ZoneDiagramField
              value={isTextMode ? (value as string) || '' : (value as Record<string, string>) || {}}
              onChange={(val: Record<string, string> | string) => handleFieldChange(field.slug, val)}
              saveMode={field.diagramSaveMode || 'object'}
              diagramImage={field.diagramImage}
              zones={field.diagramZones}
              label={field.label || field.name}
              readOnly={false}
            />
            {errorEl}
          </div>
        );
      }

      // ─── NOVOS TIPOS DE CAMPO ──────────────────────────────────────────────

      case 'user-select': {
        // TODO: Implementar busca de usuarios via API
        // Por enquanto usa as opcoes do campo ou uma lista vazia
        const userOpts: SelectOption[] = (field.options || []).map((option: string | { value: string; label: string }) => {
          const optVal = typeof option === 'object' ? option.value : option;
          const optLabel = typeof option === 'object' ? option.label : option;
          return { value: optVal, label: optLabel };
        });
        const config = field.userSelectConfig;
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <SearchableSelect
              options={userOpts}
              value={config?.allowMultiple ? (Array.isArray(value) ? value : []) : String(value || '')}
              onChange={(val) => handleFieldChange(field.slug, val)}
              multiple={config?.allowMultiple}
              placeholder={field.placeholder || 'Selecione um usuario'}
              disabled={isFieldDisabled}
              allowCustom={false}
            />
            {helpEl}{errorEl}
          </div>
        );
      }

      case 'workflow-status': {
        const config = field.workflowConfig;
        const statuses = config?.statuses || [];
        const currentStatus = String(value || '');
        const currentStatusObj = statuses.find((s: { value: string }) => s.value === currentStatus);

        // Filtra transicoes validas a partir do status atual
        const validTransitions = config?.transitions?.filter((t: { from: string | string[]; to: string }) => {
          const fromArr = Array.isArray(t.from) ? t.from : [t.from];
          return fromArr.includes(currentStatus) || (!currentStatus && statuses.find((s: { isInitial?: boolean; value: string }) => s.isInitial)?.value === t.to);
        }) || [];

        const availableStatuses = statuses.filter((s: { isInitial?: boolean; value: string }) => {
          if (!currentStatus && s.isInitial) return true;
          return validTransitions.some((t: { to: string }) => t.to === s.value);
        });

        // Se nao ha status atual, mostra todos os iniciais
        const displayStatuses = currentStatus ? availableStatuses : statuses.filter((s: { isInitial?: boolean }) => s.isInitial);

        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            {currentStatusObj && (
              <div className="mb-2">
                <Badge style={{ backgroundColor: currentStatusObj.color, color: '#fff' }}>
                  {currentStatusObj.label}
                </Badge>
              </div>
            )}
            <SearchableSelect
              options={displayStatuses.map((s: { value: string; label: string; color: string }) => ({
                value: s.value,
                label: s.label,
                color: s.color
              }))}
              value={currentStatus}
              onChange={(val) => handleFieldChange(field.slug, val)}
              placeholder={field.placeholder || 'Selecione um status'}
              disabled={isFieldDisabled || (currentStatusObj?.isFinal)}
              allowCustom={false}
            />
            {currentStatusObj?.isFinal && (
              <p className="text-xs text-muted-foreground">Status final - nao pode ser alterado</p>
            )}
            {helpEl}{errorEl}
          </div>
        );
      }

      case 'timer': {
        const timerValue = value as { totalSeconds?: number; isRunning?: boolean; lastStartedAt?: string } | undefined;
        const totalSeconds = timerValue?.totalSeconds || 0;
        const isRunning = timerValue?.isRunning || false;
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const displayTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <span className="font-mono text-xl">{displayTime}</span>
              <div className="flex gap-1 ml-auto">
                <Button
                  type="button"
                  size="sm"
                  variant={isRunning ? 'outline' : 'default'}
                  onClick={() => handleFieldChange(field.slug, {
                    ...timerValue,
                    isRunning: !isRunning,
                    lastStartedAt: !isRunning ? new Date().toISOString() : timerValue?.lastStartedAt
                  })}
                  disabled={isFieldDisabled}
                >
                  {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleFieldChange(field.slug, { totalSeconds: 0, isRunning: false })}
                  disabled={isFieldDisabled}
                >
                  <Square className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {helpEl}{errorEl}
          </div>
        );
      }

      case 'sla-status': {
        const slaValue = String(value || 'on-track');
        const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
          'on-track': { color: 'bg-green-500', icon: <CheckCircle className="h-4 w-4" />, label: 'No prazo' },
          'warning': { color: 'bg-yellow-500', icon: <AlertTriangle className="h-4 w-4" />, label: 'Atencao' },
          'breached': { color: 'bg-red-500', icon: <XCircle className="h-4 w-4" />, label: 'SLA violado' },
          'paused': { color: 'bg-gray-500', icon: <Pause className="h-4 w-4" />, label: 'Pausado' },
        };
        const status = statusConfig[slaValue] || statusConfig['on-track'];

        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-white ${status.color}`}>
              {status.icon}
              <span className="text-sm font-medium">{status.label}</span>
            </div>
            <p className="text-xs text-muted-foreground">Campo calculado automaticamente</p>
            {helpEl}{errorEl}
          </div>
        );
      }

      case 'checkbox-group': {
        const config = field.checkboxGroupConfig;
        const options = config?.options || field.options?.map((o: string | { value: string; label: string }) => typeof o === 'object' ? o : { value: o, label: o }) || [];
        const selectedValues = Array.isArray(value) ? value : [];
        const layout = config?.layout || 'vertical';
        const columns = config?.columns || 2;

        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <div className={
              layout === 'horizontal' ? 'flex flex-wrap gap-4' :
              layout === 'grid' ? `grid grid-cols-${columns} gap-2` :
              'space-y-2'
            }>
              {options.map((opt: { value: string; label: string }) => (
                <div key={opt.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${field.slug}-${opt.value}`}
                    checked={selectedValues.includes(opt.value)}
                    onCheckedChange={(checked) => {
                      const newValues = checked
                        ? [...selectedValues, opt.value]
                        : selectedValues.filter((v: string) => v !== opt.value);
                      handleFieldChange(field.slug, newValues);
                    }}
                    disabled={isFieldDisabled}
                  />
                  <Label htmlFor={`${field.slug}-${opt.value}`} className="cursor-pointer text-sm">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </div>
            {helpEl}{errorEl}
          </div>
        );
      }

      case 'radio-group': {
        const config = field.radioGroupConfig;
        const options = config?.options || field.options?.map((o: string | { value: string; label: string }) => typeof o === 'object' ? o : { value: o, label: o }) || [];
        const layout = config?.layout || 'vertical';

        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <RadioGroup
              value={String(value || '')}
              onValueChange={(val) => handleFieldChange(field.slug, val)}
              className={layout === 'horizontal' ? 'flex flex-wrap gap-4' : 'space-y-2'}
              disabled={isFieldDisabled}
            >
              {options.map((opt: { value: string; label: string; description?: string }) => (
                <div key={opt.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={opt.value} id={`${field.slug}-${opt.value}`} />
                  <Label htmlFor={`${field.slug}-${opt.value}`} className="cursor-pointer">
                    <span className="text-sm">{opt.label}</span>
                    {opt.description && (
                      <span className="block text-xs text-muted-foreground">{opt.description}</span>
                    )}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            {helpEl}{errorEl}
          </div>
        );
      }

      case 'tags': {
        const config = field.tagsConfig;
        const tags = Array.isArray(value) ? value as string[] : [];
        const predefined = config?.predefinedTags || [];
        const allowCustom = config?.allowCustom !== false;
        const maxTags = config?.maxTags || 10;
        const colorByValue = config?.colorByValue || {};
        const tagInput = tagInputs[field.slug] || '';

        const addTag = (tag: string) => {
          const trimmed = tag.trim();
          if (trimmed && !tags.includes(trimmed) && tags.length < maxTags) {
            handleFieldChange(field.slug, [...tags, trimmed]);
          }
          setTagInputs(prev => ({ ...prev, [field.slug]: '' }));
        };

        const removeTag = (tag: string) => {
          handleFieldChange(field.slug, tags.filter(t => t !== tag));
        };

        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="flex items-center gap-1"
                  style={colorByValue[tag] ? { backgroundColor: colorByValue[tag], color: '#fff' } : {}}
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-1 hover:text-destructive"
                    disabled={isFieldDisabled}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            {tags.length < maxTags && (
              <div className="flex gap-2">
                {allowCustom && (
                  <Input
                    placeholder="Digite uma tag..."
                    value={tagInput}
                    onChange={(e) => setTagInputs(prev => ({ ...prev, [field.slug]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag(tagInput);
                      }
                    }}
                    disabled={isFieldDisabled}
                    className="flex-1"
                  />
                )}
                {predefined.length > 0 && (
                  <SearchableSelect
                    options={predefined.filter((p: string) => !tags.includes(p)).map((p: string) => ({ value: p, label: p }))}
                    value=""
                    onChange={(val) => addTag(String(val))}
                    placeholder="Adicionar tag"
                    disabled={isFieldDisabled}
                    allowCustom={false}
                  />
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{tags.length}/{maxTags} tags</p>
            {helpEl}{errorEl}
          </div>
        );
      }

      case 'signature': {
        const signatureConfig = field.signatureConfig || {};
        return (
          <div key={field.slug} className="space-y-2">
            <SignatureField
              value={value as string | undefined}
              onChange={(val) => handleFieldChange(field.slug, val)}
              label={field.name}
              required={field.required}
              disabled={isFieldDisabled}
              config={{
                width: signatureConfig.width || 400,
                height: signatureConfig.height || 150,
                penColor: signatureConfig.penColor || '#000000',
                backgroundColor: signatureConfig.backgroundColor || '#ffffff',
              }}
            />
            {helpEl}{errorEl}
          </div>
        );
      }

      case 'lookup': {
        const lookupConfig = field.lookupConfig;
        if (!lookupConfig?.sourceEntity) {
          return (
            <div key={field.slug} className="space-y-2">
              {fieldLabel}
              <div className="p-3 border rounded-lg bg-muted/30 text-muted-foreground">
                Lookup nao configurado (sourceEntity necessario)
              </div>
              {helpEl}{errorEl}
            </div>
          );
        }

        return (
          <div key={field.slug} className="space-y-2">
            <LookupField
              value={value as string | null}
              onChange={(val) => handleFieldChange(field.slug, val)}
              label={field.name}
              required={field.required}
              disabled={isFieldDisabled}
              placeholder={field.placeholder || 'Buscar...'}
              config={{
                sourceEntity: lookupConfig.sourceEntity,
                searchFields: lookupConfig.searchFields || ['nome', 'name', 'titulo', 'title'],
                displayFields: lookupConfig.displayFields || ['nome', 'name'],
                previewFields: lookupConfig.previewFields,
                filterConditions: lookupConfig.filterConditions,
                allowCreate: lookupConfig.allowCreate,
              }}
            />
            {helpEl}{errorEl}
          </div>
        );
      }

      case 'formula': {
        const config = field.formulaConfig;
        const displayValue = value !== undefined && value !== null ? String(value) : '-';

        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <div className="p-3 border rounded-lg bg-muted/30">
              <span className="font-mono text-lg">{displayValue}</span>
            </div>
            {config?.expression && (
              <p className="text-xs text-muted-foreground">Formula: {config.expression}</p>
            )}
            <p className="text-xs text-muted-foreground">Campo calculado automaticamente</p>
            {helpEl}{errorEl}
          </div>
        );
      }

      case 'rollup': {
        const config = field.rollupConfig;
        const displayValue = value !== undefined && value !== null ? String(value) : '0';

        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <div className="p-3 border rounded-lg bg-muted/30">
              <span className="font-mono text-lg">{displayValue}</span>
            </div>
            {config && (
              <p className="text-xs text-muted-foreground">
                {config.aggregation.toUpperCase()}({config.targetField || '*'}) de {config.sourceField}
              </p>
            )}
            <p className="text-xs text-muted-foreground">Campo agregado automaticamente</p>
            {helpEl}{errorEl}
          </div>
        );
      }

      case 'action-button': {
        const actionConfig = field.actionButtonConfig;
        if (!actionConfig?.action) {
          return (
            <div key={field.slug} className="space-y-2">
              <Button type="button" variant="outline" disabled className="w-full">
                {actionConfig?.label || field.name} (nao configurado)
              </Button>
              {helpEl}{errorEl}
            </div>
          );
        }

        return (
          <div key={field.slug} className="space-y-2">
            <ActionButtonField
              config={{
                label: actionConfig.label || field.label || field.name,
                style: actionConfig.style,
                confirmMessage: actionConfig.confirmMessage,
                action: actionConfig.action,
                visibleIf: actionConfig.visibleIf,
              }}
              recordId={record?.id}
              recordData={formData}
              entitySlug={entity.slug}
              disabled={isFieldDisabled || !record?.id}
              onSuccess={() => {
                // Recarregar dados apos acao
                if (onSuccess) onSuccess();
              }}
            />
            {helpEl}{errorEl}
          </div>
        );
      }

      // text, hidden, and default
      default:
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <Input id={field.slug} type="text" placeholder={field.placeholder || tPlaceholders('enterField', { field: (field.label || field.name).toLowerCase() })} value={String(value || '')} onChange={(e) => handleFieldChange(field.slug, e.target.value)} disabled={isFieldDisabled} />
            {helpEl}{errorEl}
          </div>
        );
    }
  };

  // Wrapper para campos desabilitados (field-level permissions)
  const renderFieldWithPermission = (field: EntityField) => {
    const isDisabled = editableFields ? !editableFields.includes(field.slug) : false;
    const rendered = renderField(field);
    if (!isDisabled) return rendered;
    return (
      <div key={field.slug} className="pointer-events-none opacity-60">
        {rendered}
      </div>
    );
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('editRecord') : t('newRecord')} - {entity.name}</DialogTitle>
          <DialogDescription>{isEditing ? t('toast.updated').replace('!', '') : t('toast.created').replace('!', '')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {errors._form && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">{errors._form}</div>
          )}

          {entity.fields?.length > 0 ? (
            fieldRows.length > 0 ? (
              <div className="space-y-4">
                {fieldRows.map((row, rowIdx) => (
                  <div key={rowIdx} className="grid grid-cols-12 gap-4">
                    {row.map((field) => {
                      const colSpan = (field.type === 'sub-entity' || field.type === 'zone-diagram') ? 12 : (field.gridColSpan || 12);
                      const colStart = field.gridColStart;
                      return (
                        <div key={field.slug} style={{ gridColumn: colStart ? `${colStart} / span ${colSpan}` : `span ${colSpan} / span ${colSpan}` }}>
                          {renderFieldWithPermission(field)}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              entity.fields.map((field) => renderFieldWithPermission(field))
            )
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">{tCommon('noResults')}</p>
          )}

          {/* Hidden fields (type === 'hidden' OU hidden === true) */}
          {entity.fields?.filter(f => f.type === 'hidden' || f.hidden).map(field => (
            <input key={field.slug} type="hidden" value={String(formData[field.slug] || field.default || '')} />
          ))}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{tCommon('cancel')}</Button>
            <Button type="submit" disabled={isLoading || !entity.fields?.length}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? tCommon('saving') : isEditing ? tCommon('save') : tCommon('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

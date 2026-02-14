'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Loader2, Star, Eye, EyeOff } from 'lucide-react';
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
import { Slider as SliderUI } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateEntityData, useUpdateEntityData } from '@/hooks/use-data';
import { useTenant } from '@/stores/tenant-context';
import { api } from '@/lib/api';
import dynamic from 'next/dynamic';
import type { EntityField, FieldType } from '@/types';
import type { MapFieldValue } from '@/components/form/map-field';

const MapField = dynamic(() => import('@/components/form/map-field'), { ssr: false });

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

function formatCurrency(value: string | number, prefix = 'R$') {
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^\d.-]/g, '')) : value;
  if (isNaN(num)) return '';
  return `${prefix} ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
        let label = displayField ? itemData[displayField] : undefined;
        if (!label) {
          for (const key of Object.keys(itemData)) {
            if (typeof itemData[key] === 'string' && key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') {
              label = itemData[key]; break;
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
        setFormData(normalizeFormData(record.data || {}, entity.fields || []));
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

  const handleFieldChange = (fieldSlug: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [fieldSlug]: value }));
    if (errors[fieldSlug]) {
      setErrors((prev) => { const newErrors = { ...prev }; delete newErrors[fieldSlug]; return newErrors; });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    entity.fields?.forEach((field) => {
      // Sub-entity fields are not validated (they manage their own data)
      if (field.type === 'sub-entity') return;
      const value = formData[field.slug];
      if (field.required && (value === undefined || value === null || value === '')) {
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
            if (isNaN(Number(String(value).replace(/[^\d.-]/g, '')))) newErrors[field.slug] = tValidation('numberInvalid');
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
          processedData[field.slug] = Number(String(value).replace(/[^\d.-]/g, ''));
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
    const rows: EntityField[][] = [];
    let currentRow: EntityField[] = [];
    let currentRowNum = -1;
    let currentRowSpan = 0;

    for (const field of visibleFields) {
      const fieldRow = field.gridRow || 0;
      const colSpan = field.gridColSpan || 12;

      if (fieldRow > 0 && fieldRow === currentRowNum && currentRowSpan + colSpan <= 12) {
        currentRow.push(field);
        currentRowSpan += colSpan;
      } else {
        if (currentRow.length > 0) rows.push(currentRow);
        currentRow = [field];
        currentRowNum = fieldRow || -1;
        currentRowSpan = colSpan;
      }
    }
    if (currentRow.length > 0) rows.push(currentRow);
    return rows;
  }, [entity.fields]);

  // ─── Render field ─────────────────────────────────────────────────────────
  const renderField = (field: EntityField) => {
    const value = formData[field.slug];
    const error = errors[field.slug];
    const helpText = field.helpText;
    const isFieldDisabled = editableFields ? !editableFields.includes(field.slug) : false;

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
            <Textarea id={field.slug} placeholder={field.placeholder || tPlaceholders('enterField', { field: (field.label || field.name).toLowerCase() })} value={String(value || '')} onChange={(e) => handleFieldChange(field.slug, e.target.value)} rows={3} />
            {helpEl}{errorEl}
          </div>
        );

      case 'boolean':
        return (
          <div key={field.slug} className="flex items-center space-x-2 pt-6">
            <Checkbox id={field.slug} checked={Boolean(value)} onCheckedChange={(checked) => handleFieldChange(field.slug, checked)} />
            <Label htmlFor={field.slug} className="cursor-pointer">{field.label || field.name}{field.required && <span className="text-destructive ml-1">*</span>}</Label>
            {errorEl}
          </div>
        );

      case 'select':
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <Select value={String(value || '')} onValueChange={(val) => handleFieldChange(field.slug, val)}>
              <SelectTrigger><SelectValue placeholder={field.placeholder || tCommon('select')} /></SelectTrigger>
              <SelectContent>
                {field.options?.map((option) => {
                  const optVal = typeof option === 'object' ? option.value : option;
                  const optLabel = typeof option === 'object' ? option.label : option;
                  const optColor = typeof option === 'object' ? option.color : undefined;
                  return (
                    <SelectItem key={optVal} value={optVal}>
                      <span className="flex items-center gap-2">
                        {optColor && <span className="w-3 h-3 rounded-full" style={{ backgroundColor: optColor }} />}
                        {optLabel}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {helpEl}{errorEl}
          </div>
        );

      case 'multiselect':
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
              {field.options?.map((option) => {
                const optVal = typeof option === 'object' ? option.value : option;
                const optLabel = typeof option === 'object' ? option.label : option;
                const selectedValues = Array.isArray(value) ? value : [];
                return (
                  <div key={optVal} className="flex items-center space-x-2">
                    <Checkbox id={`${field.slug}-${optVal}`} checked={selectedValues.includes(optVal)}
                      onCheckedChange={(checked) => {
                        if (checked) handleFieldChange(field.slug, [...selectedValues, optVal]);
                        else handleFieldChange(field.slug, selectedValues.filter((v: string) => v !== optVal));
                      }} />
                    <Label htmlFor={`${field.slug}-${optVal}`} className="cursor-pointer text-sm">{optLabel}</Label>
                  </div>
                );
              })}
            </div>
            {helpEl}{errorEl}
          </div>
        );

      case 'api-select': {
        const options = apiOptions[field.slug] || [];
        const isLoadingOpts = loadingApiOptions[field.slug];
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <Select value={String(value || '')} onValueChange={(val) => handleApiSelectChange(field, val)} disabled={isLoadingOpts}>
              <SelectTrigger>
                {isLoadingOpts ? (
                  <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {t('loadingOptions')}</span>
                ) : (
                  <SelectValue placeholder={field.placeholder || tCommon('select')} />
                )}
              </SelectTrigger>
              <SelectContent>
                {options.length === 0 && !isLoadingOpts ? (
                  <div className="px-2 py-1 text-sm text-muted-foreground">{t('noOptionsAvailable')}</div>
                ) : (
                  options.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)
                )}
              </SelectContent>
            </Select>
            {field.apiEndpoint && <p className="text-xs text-muted-foreground">API: {field.apiEndpoint}</p>}
            {helpEl}{errorEl}
          </div>
        );
      }

      case 'relation': {
        const options = relationOptions[field.slug] || [];
        const isLoadingRel = loadingRelations[field.slug];
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <Select value={String(value || '')} onValueChange={(val) => handleFieldChange(field.slug, val)} disabled={isLoadingRel}>
              <SelectTrigger>
                {isLoadingRel ? (
                  <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {t('loadingOptions')}</span>
                ) : (
                  <SelectValue placeholder={field.placeholder || tCommon('select')} />
                )}
              </SelectTrigger>
              <SelectContent>
                {options.length === 0 && !isLoadingRel ? (
                  <div className="px-2 py-1 text-sm text-muted-foreground">{t('noRecordFound')}</div>
                ) : (
                  options.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)
                )}
              </SelectContent>
            </Select>
            {field.relatedEntitySlug && <p className="text-xs text-muted-foreground">{tCommon('type')}: {field.relatedEntitySlug}</p>}
            {helpEl}{errorEl}
          </div>
        );
      }

      case 'date':
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <Input id={field.slug} type="date" value={String(value || '')} onChange={(e) => handleFieldChange(field.slug, e.target.value)} />
            {helpEl}{errorEl}
          </div>
        );

      case 'datetime':
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <Input id={field.slug} type="datetime-local" value={String(value || '')} onChange={(e) => handleFieldChange(field.slug, e.target.value)} />
            {helpEl}{errorEl}
          </div>
        );

      case 'time':
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <Input id={field.slug} type="time" value={String(value || '')} onChange={(e) => handleFieldChange(field.slug, e.target.value)} />
            {helpEl}{errorEl}
          </div>
        );

      case 'number':
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <Input id={field.slug} type="number" min={field.min} max={field.max} step={field.step} placeholder={field.placeholder || tPlaceholders('enterField', { field: (field.label || field.name).toLowerCase() })} value={String(value || '')} onChange={(e) => handleFieldChange(field.slug, e.target.value)} />
            {helpEl}{errorEl}
          </div>
        );

      case 'currency':
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{field.prefix || 'R$'}</span>
              <Input id={field.slug} type="number" step="0.01" min={field.min} max={field.max} className="pl-10" placeholder="0,00" value={String(value || '')} onChange={(e) => handleFieldChange(field.slug, e.target.value)} />
            </div>
            {helpEl}{errorEl}
          </div>
        );

      case 'percentage':
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <div className="relative">
              <Input id={field.slug} type="number" step="0.1" min={field.min ?? 0} max={field.max ?? 100} className="pr-8" placeholder="0" value={String(value || '')} onChange={(e) => handleFieldChange(field.slug, e.target.value)} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
            </div>
            {helpEl}{errorEl}
          </div>
        );

      case 'email':
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <Input id={field.slug} type="email" placeholder={field.placeholder || tPlaceholders('email')} value={String(value || '')} onChange={(e) => handleFieldChange(field.slug, e.target.value)} />
            {helpEl}{errorEl}
          </div>
        );

      case 'url':
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <Input id={field.slug} type="url" placeholder={field.placeholder || tPlaceholders('url')} value={String(value || '')} onChange={(e) => handleFieldChange(field.slug, e.target.value)} />
            {helpEl}{errorEl}
          </div>
        );

      case 'phone':
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <Input id={field.slug} type="tel" placeholder={field.placeholder || tPlaceholders('phone')} value={String(value || '')} onChange={(e) => handleFieldChange(field.slug, applyPhoneMask(e.target.value))} maxLength={15} />
            {helpEl}{errorEl}
          </div>
        );

      case 'cpf':
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <Input id={field.slug} placeholder={field.placeholder || tPlaceholders('cpf')} value={String(value || '')} onChange={(e) => handleFieldChange(field.slug, applyCpfMask(e.target.value))} maxLength={14} />
            {helpEl}{errorEl}
          </div>
        );

      case 'cnpj':
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <Input id={field.slug} placeholder={field.placeholder || tPlaceholders('cnpj')} value={String(value || '')} onChange={(e) => handleFieldChange(field.slug, applyCnpjMask(e.target.value))} maxLength={18} />
            {helpEl}{errorEl}
          </div>
        );

      case 'cep':
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <Input id={field.slug} placeholder={field.placeholder || tPlaceholders('cep')} value={String(value || '')} onChange={(e) => handleFieldChange(field.slug, applyCepMask(e.target.value))} maxLength={9} />
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
              placeholder={field.placeholder}
              folder={field.type === 'image' ? 'images' : 'files'}
              imageSource={field.type === 'image' ? field.imageSource : undefined}
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
        const ZoneDiagramField = require('@/components/form/zone-diagram-field').default;
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

      // text, hidden, and default
      default:
        return (
          <div key={field.slug} className="space-y-2">
            {fieldLabel}
            <Input id={field.slug} type="text" placeholder={field.placeholder || tPlaceholders('enterField', { field: (field.label || field.name).toLowerCase() })} value={String(value || '')} onChange={(e) => handleFieldChange(field.slug, e.target.value)} />
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
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
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

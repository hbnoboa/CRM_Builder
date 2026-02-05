'use client';

import { useEffect, useState, useCallback } from 'react';
import { AlertCircle, Loader2, Check, ChevronDown } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

interface EntityField {
  slug: string;
  name: string;
  label?: string;
  type: string;
  required?: boolean;
  options?: Array<string | { value: string; label: string }>;
  apiEndpoint?: string;
  valueField?: string;
  labelField?: string;
  autoFillFields?: Array<{ sourceField: string; targetField: string }>;
}

interface EntityDataFormProps {
  entitySlug: string;
  title?: string;
  submitText?: string;
  successMessage?: string;
  mode?: 'create' | 'edit' | 'auto';
  recordId?: string;
  fields?: string[];
  redirectAfterSubmit?: string;
  onSuccess?: () => void;
}

interface EntityInfo {
  id: string;
  name: string;
  slug: string;
  fields: EntityField[];
}

interface ApiSelectOption {
  id: string;
  data: Record<string, unknown>;
  [key: string]: unknown;
}

export function EntityDataForm({
  entitySlug,
  title,
  submitText = 'Salvar',
  successMessage = 'Registro salvo com sucesso!',
  mode = 'auto',
  recordId: propRecordId,
  fields: displayFields,
  redirectAfterSubmit,
  onSuccess,
}: EntityDataFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get record ID from props or URL params
  const recordId = propRecordId || searchParams.get('id') || undefined;
  const effectiveMode = mode === 'auto' ? (recordId ? 'edit' : 'create') : mode;

  const [entity, setEntity] = useState<EntityInfo | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // API Select options cache
  const [apiOptions, setApiOptions] = useState<Record<string, ApiSelectOption[]>>({});
  const [loadingApiOptions, setLoadingApiOptions] = useState<Record<string, boolean>>({});

  const getApiUrl = () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const getTenantId = () => typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;

  // Fetch entity schema
  const fetchEntity = useCallback(async () => {
    if (!entitySlug) {
      setError('Entity slug nao configurado');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${getApiUrl()}/entities/slug/${entitySlug}`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Erro ao carregar entity: ${response.status}`);
      }

      const entityData = await response.json();
      setEntity(entityData);

      // If editing, fetch record data
      if (effectiveMode === 'edit' && recordId) {
        const recordResponse = await fetch(`${getApiUrl()}/data/${entitySlug}/${recordId}`, {
          headers: {
            'Authorization': `Bearer ${getToken()}`,
            'Content-Type': 'application/json',
          },
        });

        if (!recordResponse.ok) {
          throw new Error(`Erro ao carregar registro: ${recordResponse.status}`);
        }

        const recordData = await recordResponse.json();
        setFormData(recordData.data || {});
      }
    } catch (err) {
      console.error('EntityDataForm error:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [entitySlug, effectiveMode, recordId]);

  useEffect(() => {
    fetchEntity();
  }, [fetchEntity]);

  // Fetch options for api-select fields
  const fetchApiOptions = useCallback(async (field: EntityField) => {
    if (!field.apiEndpoint) return;

    const cacheKey = field.slug;
    if (apiOptions[cacheKey] || loadingApiOptions[cacheKey]) return;

    setLoadingApiOptions(prev => ({ ...prev, [cacheKey]: true }));

    try {
      const tenantId = getTenantId();
      const url = `${getApiUrl()}/x/${tenantId}${field.apiEndpoint}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const options = Array.isArray(data) ? data : (data.data || []);
        setApiOptions(prev => ({ ...prev, [cacheKey]: options }));
      }
    } catch (err) {
      console.error('Error fetching API options:', err);
    } finally {
      setLoadingApiOptions(prev => ({ ...prev, [cacheKey]: false }));
    }
  }, [apiOptions, loadingApiOptions]);

  // Load api-select options when entity loads
  useEffect(() => {
    if (!entity) return;

    entity.fields.forEach(field => {
      if (field.type === 'api-select' && field.apiEndpoint) {
        fetchApiOptions(field);
      }
    });
  }, [entity, fetchApiOptions]);

  const handleChange = (fieldSlug: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [fieldSlug]: value }));
  };

  const handleApiSelectChange = (field: EntityField, value: string) => {
    handleChange(field.slug, value);

    // Handle auto-fill
    if (field.autoFillFields && field.autoFillFields.length > 0) {
      const options = apiOptions[field.slug] || [];
      const selectedOption = options.find(opt => opt.id === value);

      if (selectedOption) {
        const updates: Record<string, unknown> = { [field.slug]: value };

        field.autoFillFields.forEach(({ sourceField, targetField }) => {
          const sourceValue = selectedOption.data?.[sourceField] ?? selectedOption[sourceField];
          if (sourceValue !== undefined) {
            updates[targetField] = sourceValue;
          }
        });

        setFormData(prev => ({ ...prev, ...updates }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSubmitting(true);
      setError(null);

      const url = effectiveMode === 'edit' && recordId
        ? `${getApiUrl()}/data/${entitySlug}/${recordId}`
        : `${getApiUrl()}/data/${entitySlug}`;

      const method = effectiveMode === 'edit' ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: formData }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Erro ${response.status}`);
      }

      setSuccess(true);

      if (onSuccess) {
        onSuccess();
      }

      if (redirectAfterSubmit) {
        setTimeout(() => {
          router.push(redirectAfterSubmit);
        }, 1500);
      }
    } catch (err) {
      console.error('Form submit error:', err);
      setError(err instanceof Error ? err.message : 'Erro ao salvar registro');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="border rounded-lg p-8 bg-muted/30">
        <div className="flex flex-col items-center justify-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Carregando formulario...</p>
        </div>
      </div>
    );
  }

  if (error && !entity) {
    return (
      <div className="border border-destructive/50 rounded-lg p-6 bg-destructive/10">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <p className="font-medium">Erro ao carregar formulario</p>
        </div>
        <p className="text-sm text-muted-foreground mt-2">{error}</p>
        <button
          onClick={fetchEntity}
          className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-background border rounded-md hover:bg-muted"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!entity) {
    return null;
  }

  // Filter fields to display
  const fieldsToShow = displayFields && displayFields.length > 0
    ? entity.fields.filter(f => displayFields.includes(f.slug))
    : entity.fields.filter(f => !['id', 'createdAt', 'updatedAt'].includes(f.slug));

  const displayTitle = title || (effectiveMode === 'edit' ? `Editar ${entity.name}` : `Novo ${entity.name}`);

  if (success) {
    return (
      <div className="border border-green-500/50 rounded-lg p-6 bg-green-500/10">
        <div className="flex items-center gap-2 text-green-600">
          <Check className="h-5 w-5" />
          <p className="font-medium">{successMessage}</p>
        </div>
        {redirectAfterSubmit && (
          <p className="text-sm text-muted-foreground mt-2">Redirecionando...</p>
        )}
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <div className="bg-muted/50 px-4 py-3 border-b">
        <h3 className="font-semibold text-lg">{displayTitle}</h3>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/50 rounded-md">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fieldsToShow.map((field) => (
            <div key={field.slug} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
              <label className="block text-sm font-medium mb-1.5">
                {field.label || field.name}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </label>
              {renderField(field, formData[field.slug], (value) => {
                if (field.type === 'api-select') {
                  handleApiSelectChange(field, value as string);
                } else {
                  handleChange(field.slug, value);
                }
              }, apiOptions[field.slug], loadingApiOptions[field.slug])}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-sm border rounded-md hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitText}
          </button>
        </div>
      </form>
    </div>
  );
}

function renderField(
  field: EntityField,
  value: unknown,
  onChange: (value: unknown) => void,
  apiOptions?: ApiSelectOption[],
  loadingOptions?: boolean
) {
  const commonClasses = "w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50";

  switch (field.type) {
    case 'text':
    case 'email':
    case 'phone':
    case 'url':
      return (
        <input
          type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className={commonClasses}
        />
      );

    case 'number':
      return (
        <input
          type="number"
          value={(value as number) ?? ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          required={field.required}
          className={commonClasses}
        />
      );

    case 'textarea':
      return (
        <textarea
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          rows={4}
          className={commonClasses}
        />
      );

    case 'date':
      return (
        <input
          type="date"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className={commonClasses}
        />
      );

    case 'datetime':
      return (
        <input
          type="datetime-local"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className={commonClasses}
        />
      );

    case 'boolean':
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          <span className="text-sm">Sim</span>
        </label>
      );

    case 'select':
      const options = field.options || [];
      return (
        <div className="relative">
          <select
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            className={`${commonClasses} appearance-none pr-8`}
          >
            <option value="">Selecione...</option>
            {options.map((opt) => {
              const optValue = typeof opt === 'string' ? opt : opt.value;
              const optLabel = typeof opt === 'string' ? opt : opt.label;
              return (
                <option key={optValue} value={optValue}>
                  {optLabel}
                </option>
              );
            })}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
      );

    case 'api-select':
      return (
        <div className="relative">
          <select
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            disabled={loadingOptions}
            className={`${commonClasses} appearance-none pr-8 ${loadingOptions ? 'bg-muted' : ''}`}
          >
            <option value="">
              {loadingOptions ? 'Carregando...' : 'Selecione...'}
            </option>
            {(apiOptions || []).map((opt) => {
              const optValue = opt.id;
              const labelField = field.labelField || 'name';
              const optLabel = opt.data?.[labelField] ?? opt[labelField] ?? opt.id;
              return (
                <option key={optValue} value={optValue}>
                  {String(optLabel)}
                </option>
              );
            })}
          </select>
          {loadingOptions ? (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
          ) : (
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          )}
        </div>
      );

    case 'relation':
      // Basic relation field (would need more implementation for full functionality)
      return (
        <input
          type="text"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="ID do registro relacionado"
          className={commonClasses}
        />
      );

    default:
      return (
        <input
          type="text"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          className={commonClasses}
        />
      );
  }
}

// Editor preview component
export function EntityDataFormPreview({
  entitySlug,
  title,
  submitText,
  mode,
  fields,
}: EntityDataFormProps) {
  return (
    <div className="border-2 border-dashed border-primary/30 rounded-lg p-6 bg-primary/5">
      <div className="text-center">
        <p className="text-lg font-medium text-primary">
          Formulario de Dados
        </p>
        {title && <p className="text-sm text-muted-foreground mt-1">{title}</p>}
        <div className="mt-4 text-sm text-muted-foreground space-y-1">
          <p><strong>Entity:</strong> {entitySlug || '[nao configurado]'}</p>
          <p><strong>Modo:</strong> {mode || 'auto'}</p>
          <p><strong>Campos:</strong> {fields?.length ? fields.join(', ') : 'todos'}</p>
          <p><strong>Botao:</strong> {submitText || 'Salvar'}</p>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          O formulario sera renderizado em tempo de execucao
        </p>
      </div>
    </div>
  );
}

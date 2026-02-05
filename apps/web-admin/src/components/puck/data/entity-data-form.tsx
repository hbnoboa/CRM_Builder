'use client';

import { useEffect, useState, useCallback } from 'react';
import { AlertCircle, Loader2, Check, ChevronDown, ArrowLeft, Save, FileEdit } from 'lucide-react';
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
  submitText,
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12">
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
          <p className="text-gray-500 font-medium">Carregando formulario...</p>
        </div>
      </div>
    );
  }

  if (error && !entity) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-red-100 p-8">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-900">Erro ao carregar formulario</p>
            <p className="text-sm text-gray-500 mt-1">{error}</p>
          </div>
          <button
            onClick={fetchEntity}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
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
  const displaySubmitText = submitText || (effectiveMode === 'edit' ? 'Salvar Alteracoes' : `Criar ${entity.name}`);

  if (success) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-green-100 p-12">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <div className="text-center">
            <p className="text-xl font-semibold text-gray-900">{successMessage}</p>
            {redirectAfterSubmit && (
              <p className="text-sm text-gray-500 mt-2">Redirecionando...</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <FileEdit className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{displayTitle}</h2>
              <p className="text-sm text-gray-500">
                {effectiveMode === 'edit' ? 'Atualize as informacoes abaixo' : 'Preencha as informacoes abaixo'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">Erro ao salvar</p>
                <p className="text-sm text-red-600 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {fieldsToShow.map((field) => (
              <div key={field.slug} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {field.label || field.name}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
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
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {displaySubmitText}
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
  const baseClasses = "w-full px-4 py-2.5 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow";

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
          placeholder={`Digite ${(field.label || field.name).toLowerCase()}...`}
          className={baseClasses}
        />
      );

    case 'number':
      return (
        <input
          type="number"
          value={(value as number) ?? ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          required={field.required}
          placeholder="0"
          className={baseClasses}
        />
      );

    case 'textarea':
      return (
        <textarea
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          rows={4}
          placeholder={`Digite ${(field.label || field.name).toLowerCase()}...`}
          className={`${baseClasses} resize-none`}
        />
      );

    case 'date':
      return (
        <input
          type="date"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className={baseClasses}
        />
      );

    case 'datetime':
    case 'time':
      return (
        <input
          type="datetime-local"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className={baseClasses}
        />
      );

    case 'boolean':
      return (
        <label className="flex items-center gap-3 cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </div>
          <span className="text-sm text-gray-700">{value ? 'Sim' : 'Nao'}</span>
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
            className={`${baseClasses} appearance-none pr-10 cursor-pointer`}
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
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
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
            className={`${baseClasses} appearance-none pr-10 cursor-pointer ${loadingOptions ? 'bg-gray-50 text-gray-400' : ''}`}
          >
            <option value="">
              {loadingOptions ? 'Carregando opcoes...' : 'Selecione...'}
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
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 animate-spin" />
          ) : (
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
          )}
        </div>
      );

    case 'relation':
      return (
        <input
          type="text"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="ID do registro relacionado"
          className={baseClasses}
        />
      );

    default:
      return (
        <input
          type="text"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          className={baseClasses}
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
    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border-2 border-dashed border-emerald-200 p-8">
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
          <FileEdit className="h-8 w-8 text-emerald-600" />
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-emerald-900">
            Formulario de Dados
          </p>
          {title && <p className="text-emerald-600 mt-1">{title}</p>}
        </div>
        <div className="bg-white rounded-lg px-4 py-3 text-sm text-gray-600 space-y-1 shadow-sm">
          <p><strong>Entity:</strong> {entitySlug || '[nao configurado]'}</p>
          <p><strong>Modo:</strong> {mode || 'auto'}</p>
          <p><strong>Campos:</strong> {fields?.length ? fields.join(', ') : 'todos'}</p>
          <p><strong>Botao:</strong> {submitText || 'Salvar'}</p>
        </div>
        <p className="text-xs text-emerald-500 mt-2">
          Formulario renderizado em tempo de execucao
        </p>
      </div>
    </div>
  );
}

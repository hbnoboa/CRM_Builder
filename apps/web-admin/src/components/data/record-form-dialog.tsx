'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
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
import type { EntityField, FieldType } from '@/types';

// Interface para opcoes carregadas da API
interface ApiOption {
  value: string;
  label: string;
  data: Record<string, unknown>; // Dados completos para auto-fill
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
}

export function RecordFormDialog({
  open,
  onOpenChange,
  entity,
  record,
  onSuccess,
}: RecordFormDialogProps) {
  const isEditing = !!record;
  const createRecord = useCreateEntityData();
  const updateRecord = useUpdateEntityData();
  const { tenantId } = useTenant();

  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiOptions, setApiOptions] = useState<Record<string, ApiOption[]>>({});
  const [loadingApiOptions, setLoadingApiOptions] = useState<Record<string, boolean>>({});

  // Funcao helper para normalizar valores de select/multiselect
  // Se o valor for um objeto {color, label, value}, extrai apenas o value
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

      if (field?.type === 'select' || field?.type === 'api-select') {
        normalized[key] = normalizeSelectValue(value);
      } else if (field?.type === 'multiselect' && Array.isArray(value)) {
        normalized[key] = value.map(v => normalizeSelectValue(v));
      } else {
        normalized[key] = value;
      }
    }
    return normalized;
  };

  // Funcao para buscar opcoes de uma Custom API
  const fetchApiOptions = useCallback(async (field: EntityField) => {
    if (!field.apiEndpoint || !tenantId) return;

    setLoadingApiOptions(prev => ({ ...prev, [field.slug]: true }));

    try {
      // Custom APIs sao acessadas via /x/:tenantId/:path
      const response = await api.get(`/x/${tenantId}${field.apiEndpoint}`);
      const data = Array.isArray(response.data) ? response.data : response.data.data || [];

      const options: ApiOption[] = data.map((item: Record<string, unknown>) => {
        const valueField = field.valueField || 'id';
        const labelField = field.labelField || 'name' || 'email' || 'company_name';

        // Tenta encontrar o melhor campo para label
        let label = item[labelField];
        if (!label) {
          // Fallback: usa o primeiro campo texto que encontrar
          for (const key of Object.keys(item)) {
            if (typeof item[key] === 'string' && key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') {
              label = item[key];
              break;
            }
          }
        }

        return {
          value: String(item[valueField] || item.id || ''),
          label: String(label || item[valueField] || 'Sem nome'),
          data: item,
        };
      });

      setApiOptions(prev => ({ ...prev, [field.slug]: options }));
    } catch (error) {
      console.error(`Erro ao buscar opcoes da API ${field.apiEndpoint}:`, error);
      setApiOptions(prev => ({ ...prev, [field.slug]: [] }));
    } finally {
      setLoadingApiOptions(prev => ({ ...prev, [field.slug]: false }));
    }
  }, [tenantId]);

  // Carrega opcoes de campos api-select quando o dialog abre
  useEffect(() => {
    if (open && entity.fields) {
      const apiSelectFields = entity.fields.filter(f => f.type === 'api-select' && f.apiEndpoint);
      apiSelectFields.forEach(field => {
        fetchApiOptions(field);
      });
    }
  }, [open, entity.fields, fetchApiOptions]);

  // Handler para quando um campo api-select muda - aplica auto-fill
  const handleApiSelectChange = (field: EntityField, value: string) => {
    const options = apiOptions[field.slug] || [];
    const selectedOption = options.find(opt => opt.value === value);

    // Atualiza o valor do campo
    handleFieldChange(field.slug, value);

    // Aplica auto-fill se configurado
    if (selectedOption && field.autoFillFields) {
      const updates: Record<string, unknown> = {};

      for (const autoFill of field.autoFillFields) {
        const sourceValue = selectedOption.data[autoFill.sourceField];
        if (sourceValue !== undefined) {
          updates[autoFill.targetField] = sourceValue;
        }
      }

      if (Object.keys(updates).length > 0) {
        setFormData(prev => ({ ...prev, ...updates }));
      }
    }
  };

  // Inicializa o formulario quando abre ou muda o record
  useEffect(() => {
    if (open) {
      if (record) {
        // Normaliza os dados para garantir que valores de select/multiselect sao strings
        setFormData(normalizeFormData(record.data || {}, entity.fields || []));
      } else {
        // Inicializa com valores default dos campos
        const initialData: Record<string, unknown> = {};
        entity.fields?.forEach((field) => {
          if (field.default !== undefined) {
            initialData[field.slug] = field.default;
          } else if (field.type === 'boolean') {
            initialData[field.slug] = false;
          } else if (field.type === 'number') {
            initialData[field.slug] = '';
          } else if (field.type === 'multiselect') {
            initialData[field.slug] = [];
          } else {
            initialData[field.slug] = '';
          }
        });
        setFormData(initialData);
      }
      setErrors({});
    }
  }, [open, record, entity.fields]);

  const handleFieldChange = (fieldSlug: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [fieldSlug]: value }));
    // Limpa erro do campo ao editar
    if (errors[fieldSlug]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldSlug];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    entity.fields?.forEach((field) => {
      const value = formData[field.slug];

      // Validacao de campo obrigatorio
      if (field.required) {
        if (value === undefined || value === null || value === '') {
          newErrors[field.slug] = `${field.label || field.name} e obrigatorio`;
          return;
        }
      }

      // Validacoes especificas por tipo
      if (value !== undefined && value !== null && value !== '') {
        switch (field.type) {
          case 'email':
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
              newErrors[field.slug] = 'Email invalido';
            }
            break;
          case 'url':
            try {
              new URL(String(value));
            } catch {
              newErrors[field.slug] = 'URL invalida';
            }
            break;
          case 'number':
            if (isNaN(Number(value))) {
              newErrors[field.slug] = 'Numero invalido';
            }
            break;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Processa os dados antes de enviar
    const processedData: Record<string, unknown> = {};
    entity.fields?.forEach((field) => {
      const value = formData[field.slug];
      if (value !== undefined && value !== '') {
        if (field.type === 'number') {
          processedData[field.slug] = Number(value);
        } else {
          processedData[field.slug] = value;
        }
      }
    });

    try {
      if (isEditing && record) {
        await updateRecord.mutateAsync({
          entitySlug: entity.slug,
          id: record.id,
          data: processedData,
        });
      } else {
        await createRecord.mutateAsync({
          entitySlug: entity.slug,
          data: processedData,
        });
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      // Erro tratado pelo hook
    }
  };

  const isLoading = createRecord.isPending || updateRecord.isPending;

  const renderField = (field: EntityField) => {
    const value = formData[field.slug];
    const error = errors[field.slug];

    switch (field.type) {
      case 'textarea':
        return (
          <div key={field.slug} className="space-y-2">
            <Label htmlFor={field.slug}>
              {field.label || field.name}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Textarea
              id={field.slug}
              placeholder={`Digite ${(field.label || field.name).toLowerCase()}`}
              value={String(value || '')}
              onChange={(e) => handleFieldChange(field.slug, e.target.value)}
              rows={3}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );

      case 'boolean':
        return (
          <div key={field.slug} className="flex items-center space-x-2">
            <Checkbox
              id={field.slug}
              checked={Boolean(value)}
              onCheckedChange={(checked) => handleFieldChange(field.slug, checked)}
            />
            <Label htmlFor={field.slug} className="cursor-pointer">
              {field.label || field.name}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            {error && <p className="text-sm text-destructive ml-6">{error}</p>}
          </div>
        );

      case 'select':
        return (
          <div key={field.slug} className="space-y-2">
            <Label htmlFor={field.slug}>
              {field.label || field.name}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Select
              value={String(value || '')}
              onValueChange={(val) => handleFieldChange(field.slug, val)}
            >
              <SelectTrigger>
                <SelectValue placeholder={`Selecione ${(field.label || field.name).toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option) => {
                  // Handle both string options and object options {label, value, color}
                  const optionValue = typeof option === 'object' ? option.value : option;
                  const optionLabel = typeof option === 'object' ? option.label : option;
                  const optionColor = typeof option === 'object' ? option.color : undefined;
                  return (
                    <SelectItem key={optionValue} value={optionValue}>
                      <span className="flex items-center gap-2">
                        {optionColor && (
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: optionColor }}
                          />
                        )}
                        {optionLabel}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );

      case 'api-select': {
        const options = apiOptions[field.slug] || [];
        const isLoadingOptions = loadingApiOptions[field.slug];

        return (
          <div key={field.slug} className="space-y-2">
            <Label htmlFor={field.slug}>
              {field.label || field.name}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Select
              value={String(value || '')}
              onValueChange={(val) => handleApiSelectChange(field, val)}
              disabled={isLoadingOptions}
            >
              <SelectTrigger>
                {isLoadingOptions ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando...
                  </span>
                ) : (
                  <SelectValue placeholder={`Selecione ${(field.label || field.name).toLowerCase()}`} />
                )}
              </SelectTrigger>
              <SelectContent>
                {options.length === 0 && !isLoadingOptions ? (
                  <div className="px-2 py-1 text-sm text-muted-foreground">
                    Nenhuma opcao disponivel
                  </div>
                ) : (
                  options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );
      }

      case 'multiselect':
        return (
          <div key={field.slug} className="space-y-2">
            <Label>
              {field.label || field.name}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
              {field.options?.map((option) => {
                // Handle both string options and object options {label, value, color}
                const optionValue = typeof option === 'object' ? option.value : option;
                const optionLabel = typeof option === 'object' ? option.label : option;
                const optionColor = typeof option === 'object' ? option.color : undefined;
                const selectedValues = Array.isArray(value) ? value : [];
                return (
                  <div key={optionValue} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${field.slug}-${optionValue}`}
                      checked={selectedValues.includes(optionValue)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          handleFieldChange(field.slug, [...selectedValues, optionValue]);
                        } else {
                          handleFieldChange(
                            field.slug,
                            selectedValues.filter((v: string) => v !== optionValue)
                          );
                        }
                      }}
                    />
                    <Label htmlFor={`${field.slug}-${optionValue}`} className="cursor-pointer text-sm flex items-center gap-2">
                      {optionColor && (
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: optionColor }}
                        />
                      )}
                      {optionLabel}
                    </Label>
                  </div>
                );
              })}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );

      case 'date':
        return (
          <div key={field.slug} className="space-y-2">
            <Label htmlFor={field.slug}>
              {field.label || field.name}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={field.slug}
              type="date"
              value={String(value || '')}
              onChange={(e) => handleFieldChange(field.slug, e.target.value)}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );

      case 'datetime':
        return (
          <div key={field.slug} className="space-y-2">
            <Label htmlFor={field.slug}>
              {field.label || field.name}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={field.slug}
              type="datetime-local"
              value={String(value || '')}
              onChange={(e) => handleFieldChange(field.slug, e.target.value)}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );

      case 'number':
        return (
          <div key={field.slug} className="space-y-2">
            <Label htmlFor={field.slug}>
              {field.label || field.name}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={field.slug}
              type="number"
              placeholder={`Digite ${(field.label || field.name).toLowerCase()}`}
              value={String(value || '')}
              onChange={(e) => handleFieldChange(field.slug, e.target.value)}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );

      case 'email':
        return (
          <div key={field.slug} className="space-y-2">
            <Label htmlFor={field.slug}>
              {field.label || field.name}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={field.slug}
              type="email"
              placeholder="email@exemplo.com"
              value={String(value || '')}
              onChange={(e) => handleFieldChange(field.slug, e.target.value)}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );

      case 'url':
        return (
          <div key={field.slug} className="space-y-2">
            <Label htmlFor={field.slug}>
              {field.label || field.name}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={field.slug}
              type="url"
              placeholder="https://exemplo.com"
              value={String(value || '')}
              onChange={(e) => handleFieldChange(field.slug, e.target.value)}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );

      case 'phone':
        return (
          <div key={field.slug} className="space-y-2">
            <Label htmlFor={field.slug}>
              {field.label || field.name}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={field.slug}
              type="tel"
              placeholder="(00) 00000-0000"
              value={String(value || '')}
              onChange={(e) => handleFieldChange(field.slug, e.target.value)}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );

      // text e outros tipos usam input padrao
      default:
        return (
          <div key={field.slug} className="space-y-2">
            <Label htmlFor={field.slug}>
              {field.label || field.name}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={field.slug}
              type="text"
              placeholder={`Digite ${(field.label || field.name).toLowerCase()}`}
              value={String(value || '')}
              onChange={(e) => handleFieldChange(field.slug, e.target.value)}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `Editar ${entity.name}` : `Novo ${entity.name}`}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Atualize os dados do registro.`
              : `Preencha os campos para criar um novo registro.`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {errors._form && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
              {errors._form}
            </div>
          )}

          {entity.fields?.length > 0 ? (
            entity.fields.map((field) => renderField(field))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Esta entidade nao possui campos definidos.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !entity.fields?.length}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

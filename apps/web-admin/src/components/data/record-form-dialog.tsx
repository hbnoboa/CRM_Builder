'use client';

import { useEffect, useState } from 'react';
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
import type { EntityField, FieldType } from '@/types';

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
  workspaceId: string;
  record?: RecordData | null;
  onSuccess?: () => void;
}

export function RecordFormDialog({
  open,
  onOpenChange,
  entity,
  workspaceId,
  record,
  onSuccess,
}: RecordFormDialogProps) {
  const isEditing = !!record;
  const createRecord = useCreateEntityData();
  const updateRecord = useUpdateEntityData();

  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

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
      const field = fields.find(f => f.name === key);
      const value = data[key];
      
      if (field?.type === 'select') {
        normalized[key] = normalizeSelectValue(value);
      } else if (field?.type === 'multiselect' && Array.isArray(value)) {
        normalized[key] = value.map(v => normalizeSelectValue(v));
      } else {
        normalized[key] = value;
      }
    }
    return normalized;
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
            initialData[field.name] = field.default;
          } else if (field.type === 'boolean') {
            initialData[field.name] = false;
          } else if (field.type === 'number') {
            initialData[field.name] = '';
          } else if (field.type === 'multiselect') {
            initialData[field.name] = [];
          } else {
            initialData[field.name] = '';
          }
        });
        setFormData(initialData);
      }
      setErrors({});
    }
  }, [open, record, entity.fields]);

  const handleFieldChange = (fieldName: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
    // Limpa erro do campo ao editar
    if (errors[fieldName]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    entity.fields?.forEach((field) => {
      const value = formData[field.name];

      // Validacao de campo obrigatorio
      if (field.required) {
        if (value === undefined || value === null || value === '') {
          newErrors[field.name] = `${field.label || field.name} e obrigatorio`;
          return;
        }
      }

      // Validacoes especificas por tipo
      if (value !== undefined && value !== null && value !== '') {
        switch (field.type) {
          case 'email':
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
              newErrors[field.name] = 'Email invalido';
            }
            break;
          case 'url':
            try {
              new URL(String(value));
            } catch {
              newErrors[field.name] = 'URL invalida';
            }
            break;
          case 'number':
            if (isNaN(Number(value))) {
              newErrors[field.name] = 'Numero invalido';
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

    if (!workspaceId) {
      setErrors({ _form: 'Nenhum workspace selecionado. Selecione um workspace primeiro.' });
      return;
    }

    if (!validateForm()) {
      return;
    }

    // Processa os dados antes de enviar
    const processedData: Record<string, unknown> = {};
    entity.fields?.forEach((field) => {
      const value = formData[field.name];
      if (value !== undefined && value !== '') {
        if (field.type === 'number') {
          processedData[field.name] = Number(value);
        } else {
          processedData[field.name] = value;
        }
      }
    });

    try {
      if (isEditing && record) {
        await updateRecord.mutateAsync({
          workspaceId,
          entitySlug: entity.slug,
          id: record.id,
          data: processedData,
        });
      } else {
        await createRecord.mutateAsync({
          workspaceId,
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
    const value = formData[field.name];
    const error = errors[field.name];

    switch (field.type) {
      case 'textarea':
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Textarea
              id={field.name}
              placeholder={`Digite ${(field.label || field.name).toLowerCase()}`}
              value={String(value || '')}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              rows={3}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );

      case 'boolean':
        return (
          <div key={field.name} className="flex items-center space-x-2">
            <Checkbox
              id={field.name}
              checked={Boolean(value)}
              onCheckedChange={(checked) => handleFieldChange(field.name, checked)}
            />
            <Label htmlFor={field.name} className="cursor-pointer">
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            {error && <p className="text-sm text-destructive ml-6">{error}</p>}
          </div>
        );

      case 'select':
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Select
              value={String(value || '')}
              onValueChange={(val) => handleFieldChange(field.name, val)}
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

      case 'multiselect':
        return (
          <div key={field.name} className="space-y-2">
            <Label>
              {field.label}
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
                      id={`${field.name}-${optionValue}`}
                      checked={selectedValues.includes(optionValue)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          handleFieldChange(field.name, [...selectedValues, optionValue]);
                        } else {
                          handleFieldChange(
                            field.name,
                            selectedValues.filter((v: string) => v !== optionValue)
                          );
                        }
                      }}
                    />
                    <Label htmlFor={`${field.name}-${optionValue}`} className="cursor-pointer text-sm flex items-center gap-2">
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
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={field.name}
              type="date"
              value={String(value || '')}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );

      case 'datetime':
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={field.name}
              type="datetime-local"
              value={String(value || '')}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );

      case 'number':
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={field.name}
              type="number"
              placeholder={`Digite ${(field.label || field.name).toLowerCase()}`}
              value={String(value || '')}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );

      case 'email':
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={field.name}
              type="email"
              placeholder="email@exemplo.com"
              value={String(value || '')}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );

      case 'url':
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={field.name}
              type="url"
              placeholder="https://exemplo.com"
              value={String(value || '')}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );

      case 'phone':
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={field.name}
              type="tel"
              placeholder="(00) 00000-0000"
              value={String(value || '')}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );

      // text e outros tipos usam input padrao
      default:
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={field.name}
              type="text"
              placeholder={`Digite ${(field.label || field.name).toLowerCase()}`}
              value={String(value || '')}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
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
          {!workspaceId && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-md text-sm">
              Nenhum workspace selecionado. Selecione um workspace no menu para continuar.
            </div>
          )}

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

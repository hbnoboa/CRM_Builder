'use client';

import { useState } from 'react';

import { Link, useRouter } from '@/i18n/navigation';
import { ArrowLeft, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import api from '@/lib/api';
import type { Field } from '@/types';
import FieldGridEditor from '@/components/entities/field-grid-editor';

const fieldTypes = [
  { value: 'text', label: 'Texto' },
  { value: 'textarea', label: 'Texto Longo' },
  { value: 'richtext', label: 'Rich Text' },
  { value: 'number', label: 'Número' },
  { value: 'currency', label: 'Moeda (R$)' },
  { value: 'percentage', label: 'Porcentagem' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Telefone' },
  { value: 'url', label: 'URL' },
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'cep', label: 'CEP' },
  { value: 'date', label: 'Data' },
  { value: 'datetime', label: 'Data e Hora' },
  { value: 'time', label: 'Hora' },
  { value: 'boolean', label: 'Sim/Não' },
  { value: 'select', label: 'Seleção' },
  { value: 'multiselect', label: 'Multi Seleção' },
  { value: 'relation', label: 'Relação' },
  { value: 'api-select', label: 'API Select' },
  { value: 'color', label: 'Cor' },
  { value: 'rating', label: 'Avaliação' },
  { value: 'slider', label: 'Slider' },
  { value: 'file', label: 'Arquivo' },
  { value: 'image', label: 'Imagem' },
  { value: 'password', label: 'Senha' },
  { value: 'json', label: 'JSON' },
  { value: 'hidden', label: 'Oculto' },
];

export default function NewEntityPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<Partial<Field>[]>([]);

  const addField = () => {
    setFields([
      ...fields,
      {
        name: '',
        type: 'text',
        label: '',
        required: false,
      },
    ]);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, updates: Partial<Field>) => {
    setFields(
      fields.map((field, i) => (i === index ? { ...field, ...updates } : field))
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Entity name is required');
      return;
    }

    setSaving(true);
    try {
      await api.post('/entities', {
        name,
        description,
        fields,
      });
      toast.success('Entity created successfully!');
      router.push('/entities');
    } catch (error) {
      console.error('Error creating entity:', error);
      toast.error('Error creating entity');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground" aria-label="breadcrumb">
        <Link href="/dashboard" className="hover:underline">Dashboard</Link>
        <span>/</span>
        <Link href="/entities" className="hover:underline">Entities</Link>
        <span>/</span>
        <span className="font-semibold text-foreground">New</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/entities">
                <Button variant="ghost" size="icon" aria-label="Back">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent>Back to entities</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div>
          <h1 className="text-3xl font-bold" data-testid="page-title">New Entity</h1>
          <p className="text-muted-foreground">
            Create a new entity for your CRM
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Name and description of the entity
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Customers, Products, Leads..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
              />
            </div>
          </CardContent>
        </Card>

        {/* Fields */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Fields</CardTitle>
                <CardDescription>
                  Configure the entity fields
                </CardDescription>
              </div>
              <Button onClick={addField} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {fields.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No fields defined. Click "Add" to create a new field.
              </p>
            ) : (
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 p-3 border rounded-lg"
                  >
                    <div className="flex-1 grid gap-2 sm:grid-cols-3">
                      <Input
                        placeholder="Field name"
                        value={field.name || ''}
                        onChange={(e) =>
                          updateField(index, { name: e.target.value })
                        }
                      />
                      <Input
                        placeholder="Label"
                        value={field.label || ''}
                        onChange={(e) =>
                          updateField(index, { label: e.target.value })
                        }
                      />
                      <Select
                        value={field.type || 'text'}
                        onValueChange={(value) =>
                          updateField(index, { type: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          {fieldTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeField(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Layout Visual */}
      {fields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Layout Visual</CardTitle>
            <CardDescription>
              Drag fields to reorder rows. Drag the right edge to resize width.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGridEditor
              fields={fields as Field[]}
              onFieldsChange={(updated) => setFields(updated)}
            />
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Link href="/entities">
          <Button variant="outline">Cancel</Button>
        </Link>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Create Entity
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
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
import type { Entity, Field } from '@/types';

const fieldTypes = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'select', label: 'Select' },
  { value: 'relation', label: 'Relation' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'url', label: 'URL' },
  { value: 'phone', label: 'Phone' },
];

export default function EntityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [entity, setEntity] = useState<Entity | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<Partial<Field>[]>([]);

  useEffect(() => {
    if (params.id) {
      loadEntity(params.id as string);
    }
  }, [params.id]);

  const loadEntity = async (id: string) => {
    try {
      const response = await api.get(`/entities/${id}`);
      const entityData = response.data;
      setEntity(entityData);
      setName(entityData.name);
      setDescription(entityData.description || '');
      setFields(entityData.fields || []);
    } catch (error) {
      console.error('Error loading entity:', error);
      toast.error('Entity not found');
      router.push('/entities');
    } finally {
      setLoading(false);
    }
  };

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
      await api.put(`/entities/${params.id}`, {
        name,
        description,
        fields,
      });
      toast.success('Entity updated successfully!');
      router.push('/entities');
    } catch (error) {
      console.error('Error saving entity:', error);
      toast.error('Error saving entity');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Entity not found</p>
        <Link href="/entities">
          <Button variant="link">Back to entities</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground" aria-label="breadcrumb">
        <Link href="/dashboard" className="hover:underline">Dashboard</Link>
        <span>/</span>
        <Link href="/entities" className="hover:underline">Entities</Link>
        <span>/</span>
        <span className="font-semibold text-foreground">{entity.name}</span>
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
          <h1 className="text-3xl font-bold" data-testid="page-title">Edit Entity</h1>
          <p className="text-muted-foreground">
            Edit the entity information and fields
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
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Entity name"
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
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={entity.slug} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">
                The slug cannot be changed after creation
              </p>
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
                  Configure entity fields
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
                          updateField(index, { type: value as Field['type'] })
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

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Link href="/entities">
          <Button variant="outline">Cancel</Button>
        </Link>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

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
import type { Field, FieldType } from '@/types';
import FieldGridEditor from '@/components/entities/field-grid-editor';
import { useTranslations } from 'next-intl';
import { useTenant } from '@/stores/tenant-context';

// Field type keys - labels come from translations
const FIELD_TYPE_KEYS: FieldType[] = [
  'text', 'textarea', 'richtext', 'number', 'currency', 'percentage',
  'email', 'phone', 'url', 'cpf', 'cnpj', 'cep',
  'date', 'datetime', 'time', 'boolean', 'select', 'multiselect',
  'relation', 'api-select', 'color', 'rating', 'slider',
  'file', 'image', 'password', 'json', 'hidden', 'map',
];

export default function NewEntityPage() {
  const router = useRouter();
  const t = useTranslations('entities');
  const tFieldTypes = useTranslations('fieldTypes');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');
  const { effectiveTenantId, isPlatformAdmin } = useTenant();
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
      toast.error(t('validation.nameRequired'));
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name,
        description,
        fields,
      };
      if (effectiveTenantId) {
        payload.tenantId = effectiveTenantId;
      }
      await api.post('/entities', payload);
      toast.success(t('toast.created'));
      router.push('/entities');
    } catch (error) {
      console.error('Error creating entity:', error);
      toast.error(t('toast.createError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground" aria-label="breadcrumb">
        <Link href="/dashboard" className="hover:underline">{tNav('dashboard')}</Link>
        <span>/</span>
        <Link href="/entities" className="hover:underline">{tNav('entities')}</Link>
        <span>/</span>
        <span className="font-semibold text-foreground">{tCommon('new')}</span>
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
            <TooltipContent>{t('backToEntities')}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div>
          <h1 className="text-3xl font-bold" data-testid="page-title">{t('newEntity')}</h1>
          <p className="text-muted-foreground">
            {t('newEntityDescription')}
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>{t('basicInfo')}</CardTitle>
            <CardDescription>
              {t('basicInfoDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('name')} *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('namePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t('description')}</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('descriptionPlaceholder')}
              />
            </div>
          </CardContent>
        </Card>

        {/* Fields */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t('fields')}</CardTitle>
                <CardDescription>
                  {t('fieldsDescription')}
                </CardDescription>
              </div>
              <Button onClick={addField} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                {tCommon('add')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {fields.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {t('noFieldsDefined')}
              </p>
            ) : (
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 p-3 border rounded-lg"
                  >
                    <div className="flex-1 grid gap-2 sm:grid-cols-2">
                      <Input
                        placeholder={t('fieldNamePlaceholder')}
                        value={field.label || ''}
                        onChange={(e) => {
                          const label = e.target.value;
                          const slug = label
                            .normalize('NFD')
                            .replace(/[\u0300-\u036f]/g, '')
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '_')
                            .replace(/^_+|_+$/g, '')
                            .replace(/__+/g, '_');
                          updateField(index, { label, name: slug });
                        }}
                      />
                      <Select
                        value={field.type || 'text'}
                        onValueChange={(value) =>
                          updateField(index, { type: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('typePlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_TYPE_KEYS.map((typeKey) => (
                            <SelectItem key={typeKey} value={typeKey}>
                              {tFieldTypes(typeKey)}
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
            <CardTitle>{t('visualLayout')}</CardTitle>
            <CardDescription>
              {t('visualLayoutDescription')}
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
          <Button variant="outline">{tCommon('cancel')}</Button>
        </Link>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t('creating')}
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {t('createEntity')}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

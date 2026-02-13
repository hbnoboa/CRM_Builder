'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Link, useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft, Plus, Trash2, Save, Loader2, MoreHorizontal,
  GripVertical, ChevronDown, ChevronUp, Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useTenant } from '@/stores/tenant-context';
import type { CustomApi } from '@/services/custom-apis.service';
import type { Entity, Field, FieldType } from '@/types';
import FieldGridEditor from '@/components/entities/field-grid-editor';

// ─── Field Type Definitions ────────────────────────────────────────────────
// Uses translation keys that are resolved at runtime in the component
const fieldTypeCategories = [
  {
    labelKey: 'fieldCategories.text',
    types: [
      { value: 'text', labelKey: 'text', icon: 'Aa', descKey: 'fieldDesc.text' },
      { value: 'textarea', labelKey: 'textarea', icon: '¶', descKey: 'fieldDesc.textarea' },
      { value: 'richtext', labelKey: 'richtext', icon: '📝', descKey: 'fieldDesc.richtext' },
      { value: 'password', labelKey: 'password', icon: '🔒', descKey: 'fieldDesc.password' },
      { value: 'array', labelKey: 'array', icon: '📋', descKey: 'fieldDesc.array' },
    ],
  },
  {
    labelKey: 'fieldCategories.numbers',
    types: [
      { value: 'number', labelKey: 'number', icon: '#', descKey: 'fieldDesc.number' },
      { value: 'currency', labelKey: 'currency', icon: 'R$', descKey: 'fieldDesc.currency' },
      { value: 'percentage', labelKey: 'percentage', icon: '%', descKey: 'fieldDesc.percentage' },
      { value: 'slider', labelKey: 'slider', icon: '🎚', descKey: 'fieldDesc.slider' },
      { value: 'rating', labelKey: 'rating', icon: '⭐', descKey: 'fieldDesc.rating' },
    ],
  },
  {
    labelKey: 'fieldCategories.contact',
    types: [
      { value: 'email', labelKey: 'email', icon: '@', descKey: 'fieldDesc.email' },
      { value: 'phone', labelKey: 'phone', icon: '📞', descKey: 'fieldDesc.phone' },
      { value: 'url', labelKey: 'url', icon: '🔗', descKey: 'fieldDesc.url' },
    ],
  },
  {
    labelKey: 'fieldCategories.documents',
    types: [
      { value: 'cpf', labelKey: 'cpf', icon: '🪪', descKey: 'fieldDesc.cpf' },
      { value: 'cnpj', labelKey: 'cnpj', icon: '🏢', descKey: 'fieldDesc.cnpj' },
      { value: 'cep', labelKey: 'cep', icon: '📮', descKey: 'fieldDesc.cep' },
    ],
  },
  {
    labelKey: 'fieldCategories.datetime',
    types: [
      { value: 'date', labelKey: 'date', icon: '📅', descKey: 'fieldDesc.date' },
      { value: 'datetime', labelKey: 'datetime', icon: '🕐', descKey: 'fieldDesc.datetime' },
      { value: 'time', labelKey: 'time', icon: '⏰', descKey: 'fieldDesc.time' },
    ],
  },
  {
    labelKey: 'fieldCategories.selection',
    types: [
      { value: 'boolean', labelKey: 'boolean', icon: '☑', descKey: 'fieldDesc.boolean' },
      { value: 'select', labelKey: 'select', icon: '▼', descKey: 'fieldDesc.select' },
      { value: 'multiselect', labelKey: 'multiselect', icon: '☰', descKey: 'fieldDesc.multiselect' },
      { value: 'color', labelKey: 'color', icon: '🎨', descKey: 'fieldDesc.color' },
    ],
  },
  {
    labelKey: 'fieldCategories.relationship',
    types: [
      { value: 'relation', labelKey: 'relation', icon: '🔗', descKey: 'fieldDesc.relation' },
      { value: 'api-select', labelKey: 'apiSelect', icon: '⚡', descKey: 'fieldDesc.apiSelect' },
      { value: 'sub-entity', labelKey: 'subEntity', icon: '📂', descKey: 'fieldDesc.subEntity' },
      { value: 'zone-diagram', labelKey: 'zoneDiagram', icon: '🗺️', descKey: 'fieldDesc.zoneDiagram' },
    ],
  },
  {
    labelKey: 'fieldCategories.media',
    types: [
      { value: 'file', labelKey: 'file', icon: '📎', descKey: 'fieldDesc.file' },
      { value: 'image', labelKey: 'image', icon: '🖼', descKey: 'fieldDesc.image' },
    ],
  },
  {
    labelKey: 'fieldCategories.location',
    types: [
      { value: 'map', labelKey: 'map', icon: '🗺️', descKey: 'fieldDesc.map' },
    ],
  },
  {
    labelKey: 'fieldCategories.other',
    types: [
      { value: 'json', labelKey: 'json', icon: '{}', descKey: 'fieldDesc.json' },
      { value: 'hidden', labelKey: 'hidden', icon: '👁', descKey: 'fieldDesc.hidden' },
    ],
  },
];

const allFieldTypes = fieldTypeCategories.flatMap(c => c.types);

const getFieldTypeInfo = (type: string) =>
  allFieldTypes.find(t => t.value === type) || { value: type, labelKey: type, icon: '?', descKey: '' };

interface RelatedEntity {
  id: string;
  name: string;
  slug: string;
  fields?: { name: string; slug: string; type: string; label?: string }[];
}

export default function EntityDetailPage() {
  const t = useTranslations('entities.detail');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');
  const tToast = useTranslations('entities.toast');
  const tFieldTypes = useTranslations('fieldTypes');
  const tFieldCategories = useTranslations('fieldCategories');
  const tFieldDesc = useTranslations('fieldDesc');
  const tFieldConfig = useTranslations('entities.fieldConfig');
  const tImport = useTranslations('entities.import');

  // Helper to get translated field type label
  const getFieldTypeLabel = (type: string): string => {
    try {
      return tFieldTypes(type as 'text') || type;
    } catch {
      return type;
    }
  };

  const params = useParams();
  const router = useRouter();
  const [entity, setEntity] = useState<Entity | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<Partial<Field>[]>([]);
  const [expandedFieldIndex, setExpandedFieldIndex] = useState<number | null>(null);
  const [allEntities, setAllEntities] = useState<RelatedEntity[]>([]);
  const [allCustomApis, setAllCustomApis] = useState<CustomApi[]>([]);
  const { tenantId, effectiveTenantId } = useTenant();

  // Derive API fields from the custom API config (sourceEntity.fields) instead of executing the endpoint
  const getApiFields = (endpoint: string): string[] => {
    const selectedApi = allCustomApis.find(a => a.path === endpoint);
    if (!selectedApi) return [];
    const entityFields = (selectedApi.sourceEntity?.fields || []) as Array<{ slug: string; name: string; type?: string }>;
    return ['id', ...entityFields.map(f => f.slug)].filter((v, i, a) => a.indexOf(v) === i);
  };

  // Find the first text-like field for auto-defaulting labelField
  const getDefaultLabelField = (endpoint: string): string => {
    const selectedApi = allCustomApis.find(a => a.path === endpoint);
    if (!selectedApi) return '';
    const entityFields = (selectedApi.sourceEntity?.fields || []) as Array<{ slug: string; type?: string }>;
    const textField = entityFields.find(f => !f.type || f.type === 'text' || f.type === 'email');
    return textField?.slug || entityFields[0]?.slug || '';
  };

  useEffect(() => {
    if (params.id) {
      loadEntity(params.id as string);
      loadAllEntities();
      loadAllCustomApis();
    }
  }, [params.id]);

  // Auto-populate apiFields for existing api-select fields when allCustomApis loads
  useEffect(() => {
    if (allCustomApis.length === 0 || fields.length === 0) return;
    let changed = false;
    const updated = fields.map(field => {
      if (field.type === 'api-select' && field.apiEndpoint && (!field.apiFields || field.apiFields.length === 0)) {
        const apiFields = getApiFields(field.apiEndpoint);
        if (apiFields.length > 0) {
          changed = true;
          return { ...field, apiFields };
        }
      }
      return field;
    });
    if (changed) setFields(updated);
  }, [allCustomApis]);

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
      toast.error(tToast('notFound'));
      router.push('/entities');
    } finally {
      setLoading(false);
    }
  };

  const loadAllEntities = async () => {
    try {
      const response = await api.get('/entities');
      const list = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setAllEntities(list);
    } catch (error) {
      console.error('Error loading entities:', error);
    }
  };

  const loadAllCustomApis = async () => {
    try {
      const response = await api.get('/custom-apis');
      const list = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setAllCustomApis(list.filter((a: CustomApi) => a.isActive && a.method === 'GET'));
    } catch (error) {
      console.error('Error loading custom APIs:', error);
    }
  };

  const addField = () => {
    const newField: Partial<Field> = {
      name: '', type: 'text', label: '', required: false,
      gridRow: Math.max(1, ...fields.map(f => f.gridRow || 1)) + 1,
      gridColSpan: 12,
    };
    setFields([...fields, newField]);
    setExpandedFieldIndex(fields.length);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
    if (expandedFieldIndex === index) setExpandedFieldIndex(null);
    else if (expandedFieldIndex !== null && expandedFieldIndex > index) {
      setExpandedFieldIndex(expandedFieldIndex - 1);
    }
  };

  const updateField = (index: number, updates: Partial<Field>) => {
    setFields(fields.map((field, i) => (i === index ? { ...field, ...updates } : field)));
  };

  const duplicateField = (index: number) => {
    const field = fields[index];
    const newField = { ...field, name: `${field.name}_copy`, label: `${field.label || ''} (${tCommon('copy')})`, gridRow: (field.gridRow || 1) + 1 };
    const newFields = [...fields];
    newFields.splice(index + 1, 0, newField);
    setFields(newFields);
    setExpandedFieldIndex(index + 1);
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newFields = [...fields];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newFields.length) return;
    [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
    setFields(newFields);
    setExpandedFieldIndex(targetIndex);
  };

  const addOption = (fieldIndex: number) => {
    const field = fields[fieldIndex];
    const options = [...(field.options || []), ''];
    updateField(fieldIndex, { options });
  };

  const updateOption = (fieldIndex: number, optIndex: number, value: string) => {
    const field = fields[fieldIndex];
    const options = [...(field.options || [])];
    options[optIndex] = value;
    updateField(fieldIndex, { options });
  };

  const removeOption = (fieldIndex: number, optIndex: number) => {
    const field = fields[fieldIndex];
    const options = (field.options || []).filter((_, i) => i !== optIndex);
    updateField(fieldIndex, { options });
  };

  const addAutoFill = (fieldIndex: number) => {
    const field = fields[fieldIndex];
    const autoFillFields = [...(field.autoFillFields || []), { sourceField: '', targetField: '' }];
    updateField(fieldIndex, { autoFillFields });
  };

  const updateAutoFill = (fieldIndex: number, afIndex: number, updates: Partial<{ sourceField: string; targetField: string }>) => {
    const field = fields[fieldIndex];
    const autoFillFields = [...(field.autoFillFields || [])];
    autoFillFields[afIndex] = { ...autoFillFields[afIndex], ...updates };
    updateField(fieldIndex, { autoFillFields });
  };

  const removeAutoFill = (fieldIndex: number, afIndex: number) => {
    const field = fields[fieldIndex];
    const autoFillFields = (field.autoFillFields || []).filter((_, i) => i !== afIndex);
    updateField(fieldIndex, { autoFillFields });
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error(tToast('nameRequired')); return; }
    setSaving(true);
    try {
      await api.patch(`/entities/${params.id}`, { name, description, fields });
      toast.success(tToast('updated'));
      router.push('/entities');
    } catch (error) {
      console.error('Error saving entity:', error);
      toast.error(tToast('saveError'));
    } finally {
      setSaving(false);
    }
  };

  const getRelatedEntityFields = (entityId: string) => {
    const ent = allEntities.find(e => e.id === entityId);
    return ent?.fields || [];
  };

  // Estados globais para importação de opções por campo
  const [importPreview, setImportPreview] = useState<Record<number, any[] | null>>({});
  const [importError, setImportError] = useState<Record<number, string | null>>({});

  // Handler de importação
  const handleImportOptions = async (e: React.ChangeEvent<HTMLInputElement>, fieldIndex: number) => {
    setImportError(prev => ({ ...prev, [fieldIndex]: null }));
    setImportPreview(prev => ({ ...prev, [fieldIndex]: null }));
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    try {
      if (ext === 'json') {
        const text = await file.text();
        const data = JSON.parse(text);
        if (Array.isArray(data)) setImportPreview(prev => ({ ...prev, [fieldIndex]: data }));
        else setImportError(prev => ({ ...prev, [fieldIndex]: tImport('jsonMustBeArray') }));
      } else if (ext === 'csv') {
        Papa.parse(file, {
          header: true,
          complete: (results: Papa.ParseResult<any>) => {
            setImportPreview(prev => ({ ...prev, [fieldIndex]: results.data }));
          },
          error: (err: any) => setImportError(prev => ({ ...prev, [fieldIndex]: tImport('csvReadError') + err.message })),
        });
      } else if (ext === 'xlsx') {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet);
        setImportPreview(prev => ({ ...prev, [fieldIndex]: json }));
      } else {
        setImportError(prev => ({ ...prev, [fieldIndex]: tImport('unsupportedFormat') }));
      }
    } catch (err: any) {
      setImportError(prev => ({ ...prev, [fieldIndex]: tImport('importError') + (err.message || String(err)) }));
    }
  };

  // Aplicar preview ao campo
  const applyImportPreview = (fieldIndex: number) => {
    const preview = importPreview[fieldIndex];
    if (!preview) return;
    const options = preview.map((item: any) => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null) {
        if ('value' in item && 'label' in item) return { value: item.value, label: item.label };
        if ('value' in item) return { value: item.value, label: String(item.value) };
        if ('label' in item) return { value: String(item.label), label: item.label };
        const firstKey = Object.keys(item)[0];
        return { value: item[firstKey], label: String(item[firstKey]) };
      }
      return String(item);
    });
    updateField(fieldIndex, { options });
    setImportPreview(prev => ({ ...prev, [fieldIndex]: null }));
  };

  // ─── Type-specific config render ─────────────────────────────────────────
  const renderFieldTypeSpecificConfig = (field: Partial<Field>, index: number) => {
    const type = field.type as FieldType;

    if (type === 'array') {
      return null;
    }

    if (type === 'select' || type === 'multiselect') {
      return (
        <div className="space-y-3 mt-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-sm font-medium text-blue-700 dark:text-blue-300">{tFieldConfig('selectOptions')}</Label>
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                <label style={{ cursor: 'pointer' }}>
                  <Plus className="h-3 w-3 mr-1" /> {tFieldConfig('option')}
                  <input type="file" accept=".json,.csv,.xlsx" style={{ display: 'none' }} onChange={(e) => handleImportOptions(e, index)} />
                </label>
              </Button>
              <Button onClick={() => addOption(index)} size="sm" variant="outline" className="h-7 text-xs">
                +1
              </Button>
            </div>
          </div>
          {importError[index] && <div className="text-xs text-red-600">{importError[index]}</div>}
          {importPreview[index] && (
            <div className="bg-muted p-2 rounded border text-xs mb-2">
              <div className="mb-1 font-medium">{tFieldConfig('importPreview', { count: importPreview[index].length })}</div>
              <ul className="max-h-32 overflow-y-auto">
                {importPreview[index].slice(0, 10).map((item: any, i: number) => (
                  <li key={i}>{typeof item === 'object' ? JSON.stringify(item) : String(item)}</li>
                ))}
                {importPreview[index].length > 10 && <li>{tFieldConfig('andMore', { count: importPreview[index].length - 10 })}</li>}
              </ul>
              <Button size="sm" className="mt-2" onClick={() => applyImportPreview(index)}>{tFieldConfig('applyOptions')}</Button>
              <Button size="sm" variant="ghost" className="mt-2 ml-2" onClick={() => setImportPreview(prev => ({ ...prev, [index]: null }))}>{tCommon('cancel')}</Button>
            </div>
          )}
          {(field.options || []).length === 0 ? (
            <p className="text-xs text-muted-foreground">{tFieldConfig('noOptions')}</p>
          ) : (
            <div className="space-y-2">
              {(field.options || []).map((opt, optIdx) => (
                <div key={optIdx} className="flex items-center gap-2">
                  <Input value={typeof opt === 'object' ? opt.value : opt} onChange={(e) => updateOption(index, optIdx, e.target.value)} placeholder={`${tFieldConfig('option')} ${optIdx + 1}`} className="h-8 text-sm" />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeOption(index, optIdx)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (type === 'relation') {
      return (
        <div className="space-y-3 mt-3 p-3 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
          <Label className="text-sm font-medium text-indigo-700 dark:text-indigo-300">{tFieldConfig('relationConfig')}</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">{tFieldConfig('relatedEntity')}</Label>
              <Select
                value={field.relatedEntityId || ''}
                onValueChange={(val) => {
                  const ent = allEntities.find(e => e.id === val);
                  updateField(index, { relatedEntityId: val, relatedEntitySlug: ent?.slug || '', relatedDisplayField: '' });
                }}
              >
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={tFieldConfig('selectEntity')} /></SelectTrigger>
                <SelectContent>
                  {allEntities.filter(e => e.id !== entity?.id).map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name} <span className="text-muted-foreground ml-1">/{e.slug}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {field.relatedEntityId && (
              <div className="space-y-1">
                <Label className="text-xs">{tFieldConfig('displayField')}</Label>
                <Select value={field.relatedDisplayField || ''} onValueChange={(val) => updateField(index, { relatedDisplayField: val })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={tFieldConfig('fieldToDisplay')} /></SelectTrigger>
                  <SelectContent>
                    {getRelatedEntityFields(field.relatedEntityId).map(f => (
                      <SelectItem key={f.slug || f.name} value={f.slug || f.name}>{f.label || f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{tFieldConfig('displayFieldHint')}</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (type === 'sub-entity') {
      const selectedSubEntity = allEntities.find(e => e.id === field.subEntityId);
      const subEntityFields = selectedSubEntity?.fields || [];
      return (
        <div className="space-y-3 mt-3 p-3 bg-violet-50 dark:bg-violet-950/20 rounded-lg border border-violet-200 dark:border-violet-800">
          <Label className="text-sm font-medium text-violet-700 dark:text-violet-300">{tFieldConfig('subEntityConfig')}</Label>
          <p className="text-xs text-muted-foreground">
            {tFieldConfig('subEntityDescription')}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">{tFieldConfig('childEntity')}</Label>
              <Select
                value={field.subEntityId || ''}
                onValueChange={(val) => {
                  const ent = allEntities.find(e => e.id === val);
                  updateField(index, {
                    subEntityId: val,
                    subEntitySlug: ent?.slug || '',
                    subEntityDisplayFields: [],
                  });
                }}
              >
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={tFieldConfig('selectChildEntity')} /></SelectTrigger>
                <SelectContent>
                  {allEntities.filter(e => e.id !== entity?.id).map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} <span className="text-muted-foreground ml-1">/{e.slug}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {field.subEntityId && subEntityFields.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">{tFieldConfig('fieldsToShow')}</Label>
                <div className="flex flex-wrap gap-1.5 p-2 border rounded-lg bg-background min-h-[34px]">
                  {subEntityFields.map((f: any) => {
                    const slug = f.slug || f.name;
                    const isSelected = (field.subEntityDisplayFields || []).includes(slug);
                    return (
                      <button
                        key={slug}
                        type="button"
                        className={`px-2 py-0.5 rounded-full text-xs transition-colors ${
                          isSelected
                            ? 'bg-violet-500 text-white'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                        onClick={() => {
                          const current = field.subEntityDisplayFields || [];
                          const updated = isSelected
                            ? current.filter((s: string) => s !== slug)
                            : [...current, slug];
                          updateField(index, { subEntityDisplayFields: updated });
                        }}
                      >
                        {f.label || f.name}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">{tFieldConfig('clickToToggle')}</p>
              </div>
            )}
          </div>
          {field.subEntityId && (
            <div className="text-xs text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/30 rounded p-2">
              {tFieldConfig('subEntityHint')}
            </div>
          )}
        </div>
      );
    }

    if (type === 'zone-diagram') {
      const ZoneDiagramEditor = require('@/components/form/zone-diagram-editor').default;
      return (
        <ZoneDiagramEditor
          diagramImage={field.diagramImage}
          diagramZones={field.diagramZones}
          allEntities={allEntities}
          onUpdate={(updates: Record<string, unknown>) => updateField(index, updates)}
        />
      );
    }

    if (type === 'api-select') {
      return (
        <div className="space-y-3 mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <Label className="text-sm font-medium text-amber-700 dark:text-amber-300">{tFieldConfig('apiSelectConfig')}</Label>
          <div className="space-y-1">
            <Label className="text-xs">{tFieldConfig('customApiEndpoint')}</Label>
            <Select
              value={field.apiEndpoint || ''}
              onValueChange={(val) => {
                const apiFields = getApiFields(val);
                const defaultLabel = getDefaultLabelField(val);
                updateField(index, {
                  apiEndpoint: val,
                  apiFields,
                  valueField: 'id',
                  labelField: field.labelField || defaultLabel,
                });
              }}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={tFieldConfig('selectDataApi')} /></SelectTrigger>
              <SelectContent>
                {allCustomApis.map(ca => (
                  <SelectItem key={ca.id} value={ca.path}>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-500 text-white text-[10px] h-4">{ca.method}</Badge>
                      <span>{ca.name}</span>
                      <span className="text-xs text-muted-foreground">{ca.path}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{tFieldConfig('apiDisplayField')}</Label>
            <Select value={field.labelField || ''} onValueChange={(val) => updateField(index, { labelField: val, valueField: 'id' })}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={tFieldConfig('selectField')} /></SelectTrigger>
              <SelectContent>
                {(field.apiFields || []).filter((f: string) => f !== 'id').map((f: string) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">{tFieldConfig('autoFill')}</Label>
              <Button onClick={() => addAutoFill(index)} size="sm" variant="outline" className="h-6 text-[10px]">
                <Plus className="h-2 w-2 mr-1" /> {tFieldConfig('rule')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{tFieldConfig('autoFillDescription')}</p>
            {(field.autoFillFields || []).map((af, afIdx) => (
              <div key={afIdx} className="flex flex-col sm:flex-row sm:items-center gap-2">
                <Select
                  value={af.sourceField}
                  onValueChange={(val) => updateAutoFill(index, afIdx, { sourceField: val })}
                >
                  <SelectTrigger className="h-7 text-xs flex-1">
                    <SelectValue placeholder={tFieldConfig('sourceField')} />
                  </SelectTrigger>
                  <SelectContent>
                    {!Array.isArray(field.apiFields) || field.apiFields.length === 0 ? (
                      <SelectItem value="__empty__" disabled>
                        {tFieldConfig('selectApiFirst')}
                      </SelectItem>
                    ) : (
                      field.apiFields.map((apiField: string) => (
                        <SelectItem key={apiField} value={apiField}>{apiField}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">→</span>
                <Select value={af.targetField} onValueChange={(val) => updateAutoFill(index, afIdx, { targetField: val })}>
                  <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder={tFieldConfig('targetField')} /></SelectTrigger>
                  <SelectContent>
                    {fields.filter((_, i) => i !== index).map(f => (
                      <SelectItem key={f.slug || f.name} value={f.slug || f.name || ''}>{f.label || f.name} <span className="text-muted-foreground">({f.slug || f.name})</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeAutoFill(index, afIdx)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (['number', 'currency', 'percentage', 'slider', 'rating'].includes(type)) {
      return (
        <div className="space-y-3 mt-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
          <Label className="text-sm font-medium text-green-700 dark:text-green-300">{tFieldConfig('numericConfig')}</Label>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs">{tFieldConfig('minimum')}</Label>
              <Input type="number" className="h-8 text-sm" value={field.min ?? ''} placeholder="0" onChange={(e) => updateField(index, { min: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{tFieldConfig('maximum')}</Label>
              <Input type="number" className="h-8 text-sm" value={field.max ?? ''} placeholder="100" onChange={(e) => updateField(index, { max: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{tFieldConfig('step')}</Label>
              <Input type="number" className="h-8 text-sm" value={field.step ?? ''} placeholder="1" onChange={(e) => updateField(index, { step: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
            {type === 'currency' && (
              <div className="space-y-1">
                <Label className="text-xs">{tFieldConfig('prefix')}</Label>
                <Input className="h-8 text-sm" value={field.prefix ?? ''} placeholder="R$" onChange={(e) => updateField(index, { prefix: e.target.value })} />
              </div>
            )}
          </div>
        </div>
      );
    }

    if (type === 'map') {
      return (
        <div className="space-y-3 mt-3 p-3 bg-teal-50 dark:bg-teal-950/20 rounded-lg border border-teal-200 dark:border-teal-800">
          <Label className="text-sm font-medium text-teal-700 dark:text-teal-300">{tFieldConfig('mapConfig')}</Label>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">{tFieldConfig('inputMode')}</Label>
              <Select value={field.mapMode || 'both'} onValueChange={(val) => updateField(index, { mapMode: val as 'latlng' | 'address' | 'both' })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">{tFieldConfig('addressAndLatLng')}</SelectItem>
                  <SelectItem value="address">{tFieldConfig('addressOnly')}</SelectItem>
                  <SelectItem value="latlng">{tFieldConfig('latLngOnly')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{tFieldConfig('inputModeHint')}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">{tFieldConfig('defaultCenterLat')}</Label>
                <Input type="number" step="any" className="h-8 text-sm" placeholder="-15.7801" value={field.mapDefaultCenter?.[0] ?? ''} onChange={(e) => {
                  const lat = parseFloat(e.target.value);
                  if (!isNaN(lat)) updateField(index, { mapDefaultCenter: [lat, field.mapDefaultCenter?.[1] ?? -47.9292] });
                }} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{tFieldConfig('defaultCenterLng')}</Label>
                <Input type="number" step="any" className="h-8 text-sm" placeholder="-47.9292" value={field.mapDefaultCenter?.[1] ?? ''} onChange={(e) => {
                  const lng = parseFloat(e.target.value);
                  if (!isNaN(lng)) updateField(index, { mapDefaultCenter: [field.mapDefaultCenter?.[0] ?? -15.7801, lng] });
                }} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">{tFieldConfig('defaultZoom')}</Label>
                <Input type="number" min={1} max={18} className="h-8 text-sm" value={field.mapDefaultZoom ?? 4} onChange={(e) => updateField(index, { mapDefaultZoom: parseInt(e.target.value) || 4 })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{tFieldConfig('mapHeight')}</Label>
                <Input type="number" min={150} max={600} className="h-8 text-sm" value={field.mapHeight ?? 300} onChange={(e) => updateField(index, { mapHeight: parseInt(e.target.value) || 300 })} />
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  // ─── Loading / Not Found ─────────────────────────────────────────────────
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
        <p className="text-muted-foreground">{tToast('notFound')}</p>
        <Link href="/entities"><Button variant="link">{tCommon('back')}</Button></Link>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/entities"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
            </TooltipTrigger>
            <TooltipContent>{tCommon('back')}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold truncate">{entity.name}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground truncate">/{entity.slug} — {entity._count?.data || 0} {tCommon('fields').toLowerCase()}</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {tCommon('save')}
        </Button>
      </div>

      <Tabs defaultValue="fields" className="space-y-4">
        <TabsList className="w-full overflow-x-auto flex-wrap h-auto gap-1">
          <TabsTrigger value="info">{t('basicInfo')}</TabsTrigger>
          <TabsTrigger value="fields">{t('fieldsTab')} ({fields.length})</TabsTrigger>
          <TabsTrigger value="layout">{t('visualLayout')}</TabsTrigger>
        </TabsList>

        {/* Info Tab */}
        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle>{t('basicInfo')}</CardTitle>
              <CardDescription>{tCommon('name')} {tCommon('and').toLowerCase()} {tCommon('description').toLowerCase()}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">{tCommon('name')}</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('namePlaceholder')} />
                </div>
                <div className="space-y-2">
                  <Label>{tCommon('slug')}</Label>
                  <Input value={entity.slug} disabled className="bg-muted" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">{tCommon('description')}</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('descriptionPlaceholder')} rows={3} />
              </div>
              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium mb-3">{t('autoEndpoints')}</h4>
                <div className="grid gap-2 text-xs sm:text-sm font-mono overflow-x-auto">
                  {[
                    { method: 'GET', path: `/${entity.slug}`, desc: t('listAll'), color: 'bg-green-500' },
                    { method: 'GET', path: `/${entity.slug}/:id`, desc: t('findOne'), color: 'bg-green-500' },
                    { method: 'POST', path: `/${entity.slug}`, desc: t('createOne'), color: 'bg-blue-500' },
                    { method: 'PUT', path: `/${entity.slug}/:id`, desc: t('updateOne'), color: 'bg-yellow-500' },
                    { method: 'DELETE', path: `/${entity.slug}/:id`, desc: t('deleteOne'), color: 'bg-red-500' },
                  ].map(ep => (
                    <div key={`${ep.method}-${ep.path}`} className="flex items-center gap-2 min-w-0">
                      <Badge className={`${ep.color} text-white w-16 justify-center flex-shrink-0`}>{ep.method}</Badge>
                      <span className="text-muted-foreground truncate">/api{ep.path}</span>
                      <span className="text-xs text-muted-foreground ml-auto flex-shrink-0 hidden sm:inline">{ep.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fields Tab */}
        <TabsContent value="fields">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle>{tCommon('fields')}</CardTitle>
                  <CardDescription>{t('fieldsTab')}</CardDescription>
                </div>
                <Button onClick={addField} size="sm" className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-1" /> {t('addField')}</Button>
              </div>
            </CardHeader>
            <CardContent>
              {fields.length === 0 ? (
                <div className="text-center py-8 sm:py-12 border-2 border-dashed rounded-lg px-4">
                  <p className="text-muted-foreground mb-4 text-sm sm:text-base">{t('noFieldsDefined')}</p>
                  <Button onClick={addField} variant="outline"><Plus className="h-4 w-4 mr-2" /> {t('addFirstField')}</Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {fields.map((field, index) => {
                    const typeInfo = getFieldTypeInfo(field.type || 'text');
                    const isExpanded = expandedFieldIndex === index;
                    return (
                      <div key={index} className={`border rounded-lg transition-all ${isExpanded ? 'border-primary shadow-sm' : 'hover:border-muted-foreground/30'}`}>
                        <div className="flex items-center gap-2 p-3 cursor-pointer" onClick={() => setExpandedFieldIndex(isExpanded ? null : index)}>
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <span className="w-8 h-8 flex items-center justify-center bg-muted rounded text-sm font-medium">{typeInfo.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">{field.label || field.name || `(${tCommon('name').toLowerCase()})`}</span>
                              <Badge variant="secondary" className="text-[10px] h-5">{getFieldTypeLabel(typeInfo.labelKey)}</Badge>
                              {field.required && <Badge variant="destructive" className="text-[10px] h-5">{tCommon('required').toLowerCase()}</Badge>}
                            </div>
                            {field.name && <p className="text-xs text-muted-foreground truncate">{field.name}</p>}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); moveField(index, 'up'); }} disabled={index === 0}><ChevronUp className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); moveField(index, 'down'); }} disabled={index === fields.length - 1}><ChevronDown className="h-3 w-3" /></Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}><MoreHorizontal className="h-3 w-3" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => duplicateField(index)}><Copy className="h-4 w-4 mr-2" /> {tCommon('duplicate')}</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => removeField(index)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" /> {tCommon('delete')}</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="px-3 pb-4 pt-1 border-t space-y-4">
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                              <div className="space-y-1">
                                <Label className="text-xs">{t('fieldLabel')}</Label>
                                <Input placeholder={t('fieldNamePlaceholder')} value={field.label || ''} onChange={(e) => {
                                  const label = e.target.value;
                                  const isExistingField = !!(field as Record<string, unknown>).id || (entity?.fields || []).some((ef: Partial<Field>) => ef.name === field.name && field.name);
                                  if (isExistingField) {
                                    updateField(index, { label });
                                  } else {
                                    const slug = label
                                      .normalize('NFD')
                                      .replace(/[\u0300-\u036f]/g, '')
                                      .toLowerCase()
                                      .replace(/[^a-z0-9]+/g, '_')
                                      .replace(/^_+|_+$/g, '')
                                      .replace(/__+/g, '_');
                                    updateField(index, { label, name: slug });
                                  }
                                }} className="h-8 text-sm" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">{tCommon('type')}</Label>
                                <Select value={field.type || 'text'} onValueChange={(value) => updateField(index, { type: value as FieldType })}>
                                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {fieldTypeCategories.map(cat => (
                                      <div key={cat.labelKey}>
                                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">{tFieldCategories(cat.labelKey.split('.')[1] as 'text')}</div>
                                        {cat.types.map(ft => (
                                          <SelectItem key={ft.value} value={ft.value}>
                                            <span className="flex items-center gap-2"><span className="w-5 text-center">{ft.icon}</span>{getFieldTypeLabel(ft.labelKey)}</span>
                                          </SelectItem>
                                        ))}
                                      </div>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">{tCommon('required')}</Label>
                                <div className="pt-1"><Switch checked={field.required || false} onCheckedChange={(checked) => updateField(index, { required: checked })} /></div>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">{tCommon('unique')}</Label>
                                <div className="pt-1"><Switch checked={field.unique || false} onCheckedChange={(checked) => updateField(index, { unique: checked })} /></div>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">{tCommon('hidden')}</Label>
                                <div className="pt-1"><Switch checked={field.hidden || false} onCheckedChange={(checked) => updateField(index, { hidden: checked })} /></div>
                                <p className="text-[10px] text-muted-foreground">{t('fieldFilledByApi')}</p>
                              </div>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-1">
                                <Label className="text-xs">{t('placeholder')}</Label>
                                <Input className="h-8 text-sm" value={field.placeholder || ''} placeholder={tFieldConfig('placeholderHint')} onChange={(e) => updateField(index, { placeholder: e.target.value })} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">{t('helpText')}</Label>
                                <Input className="h-8 text-sm" value={field.helpText || ''} placeholder={tFieldConfig('helpTextHint')} onChange={(e) => updateField(index, { helpText: e.target.value })} />
                              </div>
                            </div>
                            {renderFieldTypeSpecificConfig(field, index)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Layout Editor Tab */}
        <TabsContent value="layout">
          <Card>
            <CardHeader>
              <CardTitle>{t('visualLayout')}</CardTitle>
              <CardDescription>{tFieldConfig('layoutDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              {fields.length === 0 ? (
                <div className="text-center py-8 sm:py-12 border-2 border-dashed rounded-lg px-4">
                  <p className="text-muted-foreground mb-4 text-sm sm:text-base">{tFieldConfig('addFieldsInTab')}</p>
                  <Button onClick={() => { addField(); }} variant="outline"><Plus className="h-4 w-4 mr-2" /> {t('addFirstField')}</Button>
                </div>
              ) : (
                <div className="pl-0 sm:pl-8">
                  <FieldGridEditor
                    fields={fields}
                    onFieldsChange={setFields}
                    onFieldSelect={(idx) => setExpandedFieldIndex(idx)}
                    selectedFieldIndex={expandedFieldIndex}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}



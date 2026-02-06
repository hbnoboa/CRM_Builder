'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Link, useRouter } from '@/i18n/navigation';
import {
  ArrowLeft, Plus, Trash2, Save, Loader2, Code, Zap, MoreHorizontal,
  GripVertical, ChevronDown, ChevronUp, Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { customApisService, type CustomApi, type CreateCustomApiData } from '@/services/custom-apis.service';
import type { Entity, Field, FieldType } from '@/types';
import FieldGridEditor from '@/components/entities/field-grid-editor';

// ─── Field Type Definitions ────────────────────────────────────────────────
const fieldTypeCategories = [
  {
    label: 'Texto',
    types: [
      { value: 'text', label: 'Texto', icon: 'Aa', desc: 'Campo de texto simples' },
      { value: 'textarea', label: 'Texto Longo', icon: '¶', desc: 'Área de texto com múltiplas linhas' },
      { value: 'richtext', label: 'Rich Text', icon: '📝', desc: 'Editor de texto formatado' },
      { value: 'password', label: 'Senha', icon: '🔒', desc: 'Campo de senha mascarado' },
    ],
  },
  {
    label: 'Números',
    types: [
      { value: 'number', label: 'Número', icon: '#', desc: 'Valor numérico' },
      { value: 'currency', label: 'Moeda', icon: 'R$', desc: 'Valor monetário com formatação' },
      { value: 'percentage', label: 'Porcentagem', icon: '%', desc: 'Valor percentual' },
      { value: 'slider', label: 'Slider', icon: '🎚', desc: 'Seletor deslizante de valor' },
      { value: 'rating', label: 'Avaliação', icon: '⭐', desc: 'Avaliação em estrelas' },
    ],
  },
  {
    label: 'Contato',
    types: [
      { value: 'email', label: 'Email', icon: '@', desc: 'Endereço de email' },
      { value: 'phone', label: 'Telefone', icon: '📞', desc: 'Número de telefone' },
      { value: 'url', label: 'URL', icon: '🔗', desc: 'Link/endereço web' },
    ],
  },
  {
    label: 'Documentos BR',
    types: [
      { value: 'cpf', label: 'CPF', icon: '🪪', desc: 'CPF com máscara' },
      { value: 'cnpj', label: 'CNPJ', icon: '🏢', desc: 'CNPJ com máscara' },
      { value: 'cep', label: 'CEP', icon: '📮', desc: 'CEP com máscara' },
    ],
  },
  {
    label: 'Data e Hora',
    types: [
      { value: 'date', label: 'Data', icon: '📅', desc: 'Seletor de data' },
      { value: 'datetime', label: 'Data e Hora', icon: '🕐', desc: 'Data com hora' },
      { value: 'time', label: 'Hora', icon: '⏰', desc: 'Apenas hora' },
    ],
  },
  {
    label: 'Seleção',
    types: [
      { value: 'boolean', label: 'Sim/Não', icon: '☑', desc: 'Valor verdadeiro/falso' },
      { value: 'select', label: 'Seleção', icon: '▼', desc: 'Escolha única de uma lista' },
      { value: 'multiselect', label: 'Multi Seleção', icon: '☰', desc: 'Múltiplas escolhas de uma lista' },
      { value: 'color', label: 'Cor', icon: '🎨', desc: 'Seletor de cor' },
    ],
  },
  {
    label: 'Relacionamento',
    types: [
      { value: 'relation', label: 'Relação', icon: '🔗', desc: 'Vínculo com outra entidade' },
      { value: 'api-select', label: 'API Select', icon: '⚡', desc: 'Seleção via Custom API' },
    ],
  },
  {
    label: 'Mídia',
    types: [
      { value: 'file', label: 'Arquivo', icon: '📎', desc: 'Upload de arquivo' },
      { value: 'image', label: 'Imagem', icon: '🖼', desc: 'Upload de imagem' },
    ],
  },
  {
    label: 'Outros',
    types: [
      { value: 'json', label: 'JSON', icon: '{}', desc: 'Dados em formato JSON' },
      { value: 'hidden', label: 'Oculto', icon: '👁', desc: 'Campo oculto no formulário' },
    ],
  },
];

const allFieldTypes = fieldTypeCategories.flatMap(c => c.types);

const getFieldTypeInfo = (type: string) =>
  allFieldTypes.find(t => t.value === type) || { value: type, label: type, icon: '?', desc: '' };

const httpMethods = [
  { value: 'GET', label: 'GET', color: 'bg-green-500' },
  { value: 'POST', label: 'POST', color: 'bg-blue-500' },
  { value: 'PUT', label: 'PUT', color: 'bg-yellow-500' },
  { value: 'PATCH', label: 'PATCH', color: 'bg-orange-500' },
  { value: 'DELETE', label: 'DELETE', color: 'bg-red-500' },
];

interface RelatedEntity {
  id: string;
  name: string;
  slug: string;
  fields?: { name: string; slug: string; type: string; label?: string }[];
}

export default function EntityDetailPage() {
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
  const [customApis, setCustomApis] = useState<CustomApi[]>([]);
  const [loadingApis, setLoadingApis] = useState(false);
  const [apiDialogOpen, setApiDialogOpen] = useState(false);
  const [editingApi, setEditingApi] = useState<CustomApi | null>(null);
  const [apiForm, setApiForm] = useState<CreateCustomApiData>({
    name: '', path: '', method: 'GET', description: '', code: '',
  });
  const [savingApi, setSavingApi] = useState(false);

  useEffect(() => {
    if (params.id) {
      loadEntity(params.id as string);
      loadAllEntities();
      loadAllCustomApis();
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
      loadCustomApis(id);
    } catch (error) {
      console.error('Error loading entity:', error);
      toast.error('Entidade não encontrada');
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

  const loadCustomApis = async (entityId: string) => {
    setLoadingApis(true);
    try {
      const response = await customApisService.getByEntityId(entityId);
      setCustomApis(response.data || []);
    } catch (error) {
      console.error('Error loading custom APIs:', error);
    } finally {
      setLoadingApis(false);
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
    const newField = { ...field, name: `${field.name}_copy`, label: `${field.label || ''} (Cópia)`, gridRow: (field.gridRow || 1) + 1 };
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
    if (!name.trim()) { toast.error('Nome da entidade obrigatório'); return; }
    setSaving(true);
    try {
      await api.patch(`/entities/${params.id}`, { name, description, fields });
      toast.success('Entidade atualizada!');
      router.push('/entities');
    } catch (error) {
      console.error('Error saving entity:', error);
      toast.error('Erro ao salvar entidade');
    } finally {
      setSaving(false);
    }
  };

  const openApiDialog = (existingApi?: CustomApi) => {
    if (existingApi) {
      setEditingApi(existingApi);
      setApiForm({ name: existingApi.name, path: existingApi.path, method: existingApi.method, description: existingApi.description || '', code: existingApi.code || '' });
    } else {
      setEditingApi(null);
      setApiForm({ name: '', path: '', method: 'GET', description: '', code: '' });
    }
    setApiDialogOpen(true);
  };

  const handleSaveApi = async () => {
    if (!apiForm.name.trim() || !apiForm.path.trim()) { toast.error('Nome e caminho são obrigatórios'); return; }
    setSavingApi(true);
    try {
      if (editingApi) {
        await customApisService.update(editingApi.id, apiForm);
        toast.success('API atualizada!');
      } else {
        await customApisService.create({ ...apiForm, sourceEntityId: params.id as string });
        toast.success('API criada!');
      }
      setApiDialogOpen(false);
      loadCustomApis(params.id as string);
    } catch (error) {
      console.error('Error saving API:', error);
      toast.error('Erro ao salvar API');
    } finally {
      setSavingApi(false);
    }
  };

  const handleDeleteApi = async (apiToDelete: CustomApi) => {
    if (!confirm(`Deletar API "${apiToDelete.name}"?`)) return;
    try {
      await customApisService.delete(apiToDelete.id);
      toast.success('API deletada!');
      loadCustomApis(params.id as string);
    } catch (error) {
      console.error('Error deleting API:', error);
      toast.error('Erro ao deletar API');
    }
  };

  const handleToggleApi = async (apiToToggle: CustomApi) => {
    try {
      if (apiToToggle.isActive) await customApisService.deactivate(apiToToggle.id);
      else await customApisService.activate(apiToToggle.id);
      loadCustomApis(params.id as string);
    } catch (error) {
      console.error('Error toggling API:', error);
      toast.error('Erro ao alterar status');
    }
  };

  const getMethodColor = (method: string) =>
    httpMethods.find(m => m.value === method)?.color || 'bg-gray-500';

  const getRelatedEntityFields = (entityId: string) => {
    const ent = allEntities.find(e => e.id === entityId);
    return ent?.fields || [];
  };

  // ─── Type-specific config render ─────────────────────────────────────────
  const renderFieldTypeSpecificConfig = (field: Partial<Field>, index: number) => {
    const type = field.type as FieldType;

    if (type === 'select' || type === 'multiselect') {
      return (
        <div className="space-y-3 mt-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-blue-700 dark:text-blue-300">Opções de Seleção</Label>
            <Button onClick={() => addOption(index)} size="sm" variant="outline" className="h-7 text-xs">
              <Plus className="h-3 w-3 mr-1" /> Opção
            </Button>
          </div>
          {(field.options || []).length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma opção. Adicione opções para o seletor.</p>
          ) : (
            <div className="space-y-2">
              {(field.options || []).map((opt, optIdx) => (
                <div key={optIdx} className="flex items-center gap-2">
                  <Input value={typeof opt === 'object' ? opt.value : opt} onChange={(e) => updateOption(index, optIdx, e.target.value)} placeholder={`Opção ${optIdx + 1}`} className="h-8 text-sm" />
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
          <Label className="text-sm font-medium text-indigo-700 dark:text-indigo-300">🔗 Configuração da Relação</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Entidade Relacionada</Label>
              <Select
                value={field.relatedEntityId || ''}
                onValueChange={(val) => {
                  const ent = allEntities.find(e => e.id === val);
                  updateField(index, { relatedEntityId: val, relatedEntitySlug: ent?.slug || '', relatedDisplayField: '' });
                }}
              >
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione a entidade" /></SelectTrigger>
                <SelectContent>
                  {allEntities.filter(e => e.id !== entity?.id).map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name} <span className="text-muted-foreground ml-1">/{e.slug}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {field.relatedEntityId && (
              <div className="space-y-1">
                <Label className="text-xs">Campo para Exibição</Label>
                <Select value={field.relatedDisplayField || ''} onValueChange={(val) => updateField(index, { relatedDisplayField: val })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Campo para exibir" /></SelectTrigger>
                  <SelectContent>
                    {getRelatedEntityFields(field.relatedEntityId).map(f => (
                      <SelectItem key={f.slug || f.name} value={f.slug || f.name}>{f.label || f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Qual campo da entidade relacionada será exibido no formulário</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (type === 'api-select') {
      return (
        <div className="space-y-3 mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <Label className="text-sm font-medium text-amber-700 dark:text-amber-300">⚡ Configuração da API Select</Label>
          <div className="space-y-1">
            <Label className="text-xs">Custom API (Endpoint)</Label>
            <Select
              value={field.apiEndpoint || ''}
              onValueChange={(val) => updateField(index, { apiEndpoint: val === '__custom__' ? '' : val })}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione a API de dados" /></SelectTrigger>
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
                <SelectItem value="__custom__">
                  <span className="text-muted-foreground">✏️ Digitar manualmente...</span>
                </SelectItem>
              </SelectContent>
            </Select>
            {(!field.apiEndpoint || field.apiEndpoint === '') && (
              <Input className="h-8 text-sm mt-1" placeholder="/meu-endpoint" value={field.apiEndpoint || ''} onChange={(e) => updateField(index, { apiEndpoint: e.target.value })} />
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Campo Valor (value)</Label>
              <Input className="h-8 text-sm" placeholder="id" value={field.valueField || ''} onChange={(e) => updateField(index, { valueField: e.target.value })} />
              <p className="text-xs text-muted-foreground">Campo da API usado como valor (padrão: id)</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Campo Label (exibição)</Label>
              <Input className="h-8 text-sm" placeholder="name" value={field.labelField || ''} onChange={(e) => updateField(index, { labelField: e.target.value })} />
              <p className="text-xs text-muted-foreground">Campo da API exibido no seletor (padrão: name)</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Auto-preenchimento</Label>
              <Button onClick={() => addAutoFill(index)} size="sm" variant="outline" className="h-6 text-[10px]">
                <Plus className="h-2 w-2 mr-1" /> Regra
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Ao selecionar um item, preenche automaticamente outros campos</p>
            {(field.autoFillFields || []).map((af, afIdx) => (
              <div key={afIdx} className="flex items-center gap-2">
                <Input className="h-7 text-xs flex-1" placeholder="Campo da API (source)" value={af.sourceField} onChange={(e) => updateAutoFill(index, afIdx, { sourceField: e.target.value })} />
                <span className="text-xs text-muted-foreground">→</span>
                <Select value={af.targetField} onValueChange={(val) => updateAutoFill(index, afIdx, { targetField: val })}>
                  <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="Campo destino" /></SelectTrigger>
                  <SelectContent>
                    {fields.filter((_, i) => i !== index).map(f => (
                      <SelectItem key={f.name} value={f.name || f.slug || ''}>{f.label || f.name}</SelectItem>
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
          <Label className="text-sm font-medium text-green-700 dark:text-green-300">Configuração Numérica</Label>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs">Mínimo</Label>
              <Input type="number" className="h-8 text-sm" value={field.min ?? ''} placeholder="0" onChange={(e) => updateField(index, { min: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Máximo</Label>
              <Input type="number" className="h-8 text-sm" value={field.max ?? ''} placeholder="100" onChange={(e) => updateField(index, { max: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Passo</Label>
              <Input type="number" className="h-8 text-sm" value={field.step ?? ''} placeholder="1" onChange={(e) => updateField(index, { step: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
            {type === 'currency' && (
              <div className="space-y-1">
                <Label className="text-xs">Prefixo</Label>
                <Input className="h-8 text-sm" value={field.prefix ?? ''} placeholder="R$" onChange={(e) => updateField(index, { prefix: e.target.value })} />
              </div>
            )}
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
        <p className="text-muted-foreground">Entidade não encontrada</p>
        <Link href="/entities"><Button variant="link">Voltar para entidades</Button></Link>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/entities"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
            </TooltipTrigger>
            <TooltipContent>Voltar</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{entity.name}</h1>
          <p className="text-sm text-muted-foreground">/{entity.slug} — {entity._count?.data || 0} registros</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar
        </Button>
      </div>

      <Tabs defaultValue="fields" className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">Informações</TabsTrigger>
          <TabsTrigger value="fields">Campos ({fields.length})</TabsTrigger>
          <TabsTrigger value="layout">Layout Visual</TabsTrigger>
          <TabsTrigger value="apis">Custom APIs ({customApis.length})</TabsTrigger>
        </TabsList>

        {/* Info Tab */}
        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
              <CardDescription>Nome e descrição da entidade</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da entidade" />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input value={entity.slug} disabled className="bg-muted" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição (opcional)" rows={3} />
              </div>
              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium mb-3">Endpoints Automáticos (CRUD)</h4>
                <div className="grid gap-2 text-sm font-mono">
                  {[
                    { method: 'GET', path: `/${entity.slug}`, desc: 'Listar todos', color: 'bg-green-500' },
                    { method: 'GET', path: `/${entity.slug}/:id`, desc: 'Buscar um', color: 'bg-green-500' },
                    { method: 'POST', path: `/${entity.slug}`, desc: 'Criar', color: 'bg-blue-500' },
                    { method: 'PUT', path: `/${entity.slug}/:id`, desc: 'Atualizar', color: 'bg-yellow-500' },
                    { method: 'DELETE', path: `/${entity.slug}/:id`, desc: 'Deletar', color: 'bg-red-500' },
                  ].map(ep => (
                    <div key={`${ep.method}-${ep.path}`} className="flex items-center gap-2">
                      <Badge className={`${ep.color} text-white w-16 justify-center`}>{ep.method}</Badge>
                      <span className="text-muted-foreground">/api{ep.path}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{ep.desc}</span>
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Campos</CardTitle>
                  <CardDescription>Configure os campos da entidade. Clique para expandir.</CardDescription>
                </div>
                <Button onClick={addField} size="sm"><Plus className="h-4 w-4 mr-1" /> Adicionar Campo</Button>
              </div>
            </CardHeader>
            <CardContent>
              {fields.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <p className="text-muted-foreground mb-4">Nenhum campo definido.</p>
                  <Button onClick={addField} variant="outline"><Plus className="h-4 w-4 mr-2" /> Adicionar primeiro campo</Button>
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
                              <span className="font-medium text-sm truncate">{field.label || field.name || '(sem nome)'}</span>
                              <Badge variant="secondary" className="text-[10px] h-5">{typeInfo.label}</Badge>
                              {field.required && <Badge variant="destructive" className="text-[10px] h-5">obrigatório</Badge>}
                            </div>
                            {field.name && <p className="text-xs text-muted-foreground truncate">{field.name}</p>}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); moveField(index, 'up'); }} disabled={index === 0}><ChevronUp className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); moveField(index, 'down'); }} disabled={index === fields.length - 1}><ChevronDown className="h-3 w-3" /></Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}><MoreHorizontal className="h-3 w-3" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => duplicateField(index)}><Copy className="h-4 w-4 mr-2" /> Duplicar</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => removeField(index)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Excluir</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="px-3 pb-4 pt-1 border-t space-y-4">
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                              <div className="space-y-1">
                                <Label className="text-xs">Nome do campo (slug)</Label>
                                <Input placeholder="nome_campo" value={field.name || ''} onChange={(e) => updateField(index, { name: e.target.value })} className="h-8 text-sm" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Label (exibição)</Label>
                                <Input placeholder="Nome do Campo" value={field.label || ''} onChange={(e) => updateField(index, { label: e.target.value })} className="h-8 text-sm" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Tipo</Label>
                                <Select value={field.type || 'text'} onValueChange={(value) => updateField(index, { type: value as FieldType })}>
                                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {fieldTypeCategories.map(cat => (
                                      <div key={cat.label}>
                                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">{cat.label}</div>
                                        {cat.types.map(t => (
                                          <SelectItem key={t.value} value={t.value}>
                                            <span className="flex items-center gap-2"><span className="w-5 text-center">{t.icon}</span>{t.label}</span>
                                          </SelectItem>
                                        ))}
                                      </div>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Obrigatório</Label>
                                <div className="pt-1"><Switch checked={field.required || false} onCheckedChange={(checked) => updateField(index, { required: checked })} /></div>
                              </div>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-1">
                                <Label className="text-xs">Placeholder</Label>
                                <Input className="h-8 text-sm" value={field.placeholder || ''} placeholder="Texto de ajuda no campo" onChange={(e) => updateField(index, { placeholder: e.target.value })} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Texto de ajuda</Label>
                                <Input className="h-8 text-sm" value={field.helpText || ''} placeholder="Dica exibida abaixo do campo" onChange={(e) => updateField(index, { helpText: e.target.value })} />
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
              <CardTitle>Layout do Formulário</CardTitle>
              <CardDescription>Arraste os campos para reordená-los. Arraste a borda direita para redimensionar. Use os botões de % para larguras rápidas.</CardDescription>
            </CardHeader>
            <CardContent>
              {fields.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <p className="text-muted-foreground mb-4">Adicione campos na aba "Campos" primeiro</p>
                  <Button onClick={() => { addField(); }} variant="outline"><Plus className="h-4 w-4 mr-2" /> Adicionar primeiro campo</Button>
                </div>
              ) : (
                <div className="pl-8">
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

        {/* Custom APIs Tab */}
        <TabsContent value="apis">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Custom APIs</CardTitle>
                  <CardDescription>Endpoints customizados para esta entidade.</CardDescription>
                </div>
                <Button onClick={() => openApiDialog()} size="sm"><Plus className="h-4 w-4 mr-1" /> Nova API</Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingApis ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : customApis.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <Zap className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="font-medium mb-2">Nenhuma Custom API</h3>
                  <p className="text-muted-foreground text-sm mb-4 max-w-md mx-auto">Crie endpoints customizados para ações como "Aprovar", "Enviar Email", etc.</p>
                  <Button onClick={() => openApiDialog()} variant="outline"><Plus className="h-4 w-4 mr-2" /> Criar primeira API</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {customApis.map((customApi) => (
                    <div key={customApi.id} className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                      <Badge className={`${getMethodColor(customApi.method)} text-white w-16 justify-center`}>{customApi.method}</Badge>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{customApi.name}</span>
                          {!customApi.isActive && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
                        </div>
                        <div className="text-sm text-muted-foreground font-mono truncate">/api/{entity.slug}/{customApi.path}</div>
                        {customApi.description && <p className="text-xs text-muted-foreground mt-1">{customApi.description}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={customApi.isActive} onCheckedChange={() => handleToggleApi(customApi)} />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openApiDialog(customApi)}><Code className="h-4 w-4 mr-2" /> Editar</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteApi(customApi)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Deletar</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Custom API Dialog */}
      <Dialog open={apiDialogOpen} onOpenChange={setApiDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingApi ? 'Editar Custom API' : 'Nova Custom API'}</DialogTitle>
            <DialogDescription>Crie um endpoint customizado para {entity.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={apiForm.name} onChange={(e) => setApiForm({ ...apiForm, name: e.target.value })} placeholder="Ex: Aprovar Pedido" />
              </div>
              <div className="space-y-2">
                <Label>Método HTTP</Label>
                <Select value={apiForm.method} onValueChange={(value: any) => setApiForm({ ...apiForm, method: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {httpMethods.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        <div className="flex items-center gap-2"><Badge className={`${method.color} text-white text-xs`}>{method.label}</Badge></div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Caminho (path)</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">/api/{entity.slug}/</span>
                <Input value={apiForm.path} onChange={(e) => setApiForm({ ...apiForm, path: e.target.value })} placeholder="aprovar ou :id/aprovar" className="flex-1" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={apiForm.description} onChange={(e) => setApiForm({ ...apiForm, description: e.target.value })} placeholder="O que essa API faz?" />
            </div>
            <div className="space-y-2">
              <Label>Código (JavaScript)</Label>
              <Textarea value={apiForm.code} onChange={(e) => setApiForm({ ...apiForm, code: e.target.value })} placeholder={`// Contexto: ctx.params, ctx.body, ctx.user, ctx.entity\nconst { id } = ctx.params;\nconst record = await ctx.entity.findById(id);\nreturn { success: true, data: record };`} rows={10} className="font-mono text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApiDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveApi} disabled={savingApi}>
              {savingApi ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {editingApi ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}



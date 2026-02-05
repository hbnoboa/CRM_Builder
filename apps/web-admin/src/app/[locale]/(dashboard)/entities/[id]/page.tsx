'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, Plus, Trash2, Save, Loader2, Code, Zap, Play, MoreHorizontal } from 'lucide-react';
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
import type { Entity, Field } from '@/types';

const fieldTypes = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Numero' },
  { value: 'email', label: 'Email' },
  { value: 'date', label: 'Data' },
  { value: 'boolean', label: 'Sim/Nao' },
  { value: 'select', label: 'Selecao' },
  { value: 'relation', label: 'Relacao' },
  { value: 'textarea', label: 'Texto Longo' },
  { value: 'url', label: 'URL' },
  { value: 'phone', label: 'Telefone' },
  { value: 'file', label: 'Arquivo' },
  { value: 'image', label: 'Imagem' },
];

const httpMethods = [
  { value: 'GET', label: 'GET', color: 'bg-green-500' },
  { value: 'POST', label: 'POST', color: 'bg-blue-500' },
  { value: 'PUT', label: 'PUT', color: 'bg-yellow-500' },
  { value: 'PATCH', label: 'PATCH', color: 'bg-orange-500' },
  { value: 'DELETE', label: 'DELETE', color: 'bg-red-500' },
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

  // Custom APIs state
  const [customApis, setCustomApis] = useState<CustomApi[]>([]);
  const [loadingApis, setLoadingApis] = useState(false);
  const [apiDialogOpen, setApiDialogOpen] = useState(false);
  const [editingApi, setEditingApi] = useState<CustomApi | null>(null);
  const [apiForm, setApiForm] = useState<CreateCustomApiData>({
    name: '',
    path: '',
    method: 'GET',
    description: '',
    code: '',
  });
  const [savingApi, setSavingApi] = useState(false);

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
      // Load custom APIs for this entity
      loadCustomApis(id);
    } catch (error) {
      console.error('Error loading entity:', error);
      toast.error('Entidade nao encontrada');
      router.push('/entities');
    } finally {
      setLoading(false);
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
      toast.error('Nome da entidade obrigatorio');
      return;
    }

    setSaving(true);
    try {
      await api.put(`/entities/${params.id}`, {
        name,
        description,
        fields,
      });
      toast.success('Entidade atualizada!');
      router.push('/entities');
    } catch (error) {
      console.error('Error saving entity:', error);
      toast.error('Erro ao salvar entidade');
    } finally {
      setSaving(false);
    }
  };

  // Custom API handlers
  const openApiDialog = (api?: CustomApi) => {
    if (api) {
      setEditingApi(api);
      setApiForm({
        name: api.name,
        path: api.path,
        method: api.method,
        description: api.description || '',
        code: api.code || '',
      });
    } else {
      setEditingApi(null);
      setApiForm({
        name: '',
        path: '',
        method: 'GET',
        description: '',
        code: '',
      });
    }
    setApiDialogOpen(true);
  };

  const handleSaveApi = async () => {
    if (!apiForm.name.trim() || !apiForm.path.trim()) {
      toast.error('Nome e caminho sao obrigatorios');
      return;
    }

    setSavingApi(true);
    try {
      if (editingApi) {
        await customApisService.update(editingApi.id, apiForm);
        toast.success('API atualizada!');
      } else {
        await customApisService.create({
          ...apiForm,
          sourceEntityId: params.id as string,
        });
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

  const handleDeleteApi = async (api: CustomApi) => {
    if (!confirm(`Deletar API "${api.name}"?`)) return;

    try {
      await customApisService.delete(api.id);
      toast.success('API deletada!');
      loadCustomApis(params.id as string);
    } catch (error) {
      console.error('Error deleting API:', error);
      toast.error('Erro ao deletar API');
    }
  };

  const handleToggleApi = async (api: CustomApi) => {
    try {
      if (api.isActive) {
        await customApisService.deactivate(api.id);
      } else {
        await customApisService.activate(api.id);
      }
      loadCustomApis(params.id as string);
    } catch (error) {
      console.error('Error toggling API:', error);
      toast.error('Erro ao alterar status');
    }
  };

  const getMethodColor = (method: string) => {
    return httpMethods.find(m => m.value === method)?.color || 'bg-gray-500';
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
        <p className="text-muted-foreground">Entidade nao encontrada</p>
        <Link href="/entities">
          <Button variant="link">Voltar para entidades</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/entities">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent>Voltar</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{entity.name}</h1>
          <p className="text-sm text-muted-foreground">
            /{entity.slug} - {entity._count?.data || 0} registros
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info" className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">Informacoes</TabsTrigger>
          <TabsTrigger value="fields">Campos ({fields.length})</TabsTrigger>
          <TabsTrigger value="apis">
            Custom APIs ({customApis.length})
          </TabsTrigger>
        </TabsList>

        {/* Info Tab */}
        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle>Informacoes Basicas</CardTitle>
              <CardDescription>Nome e descricao da entidade</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome da entidade"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input value={entity.slug} disabled className="bg-muted" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descricao</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descricao da entidade (opcional)"
                  rows={3}
                />
              </div>

              {/* Auto-generated endpoints info */}
              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium mb-3">Endpoints Automaticos (CRUD)</h4>
                <div className="grid gap-2 text-sm font-mono">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-500 text-white w-16 justify-center">GET</Badge>
                    <span className="text-muted-foreground">/api/{entity.slug}</span>
                    <span className="text-xs text-muted-foreground ml-auto">Listar todos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-500 text-white w-16 justify-center">GET</Badge>
                    <span className="text-muted-foreground">/api/{entity.slug}/:id</span>
                    <span className="text-xs text-muted-foreground ml-auto">Buscar um</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-500 text-white w-16 justify-center">POST</Badge>
                    <span className="text-muted-foreground">/api/{entity.slug}</span>
                    <span className="text-xs text-muted-foreground ml-auto">Criar</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-yellow-500 text-white w-16 justify-center">PUT</Badge>
                    <span className="text-muted-foreground">/api/{entity.slug}/:id</span>
                    <span className="text-xs text-muted-foreground ml-auto">Atualizar</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-red-500 text-white w-16 justify-center">DELETE</Badge>
                    <span className="text-muted-foreground">/api/{entity.slug}/:id</span>
                    <span className="text-xs text-muted-foreground ml-auto">Deletar</span>
                  </div>
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
                  <CardDescription>Configure os campos da entidade</CardDescription>
                </div>
                <Button onClick={addField} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Campo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {fields.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <p className="text-muted-foreground mb-4">
                    Nenhum campo definido. Clique em "Adicionar Campo" para comecar.
                  </p>
                  <Button onClick={addField} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar primeiro campo
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-4 border rounded-lg bg-muted/30"
                    >
                      <div className="flex-1 grid gap-3 sm:grid-cols-4">
                        <div className="space-y-1">
                          <Label className="text-xs">Nome do campo</Label>
                          <Input
                            placeholder="nome_campo"
                            value={field.name || ''}
                            onChange={(e) =>
                              updateField(index, { name: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Label</Label>
                          <Input
                            placeholder="Nome do Campo"
                            value={field.label || ''}
                            onChange={(e) =>
                              updateField(index, { label: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Tipo</Label>
                          <Select
                            value={field.type || 'text'}
                            onValueChange={(value) =>
                              updateField(index, { type: value as Field['type'] })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
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
                        <div className="space-y-1">
                          <Label className="text-xs">Obrigatorio</Label>
                          <div className="pt-2">
                            <Switch
                              checked={field.required || false}
                              onCheckedChange={(checked) =>
                                updateField(index, { required: checked })
                              }
                            />
                          </div>
                        </div>
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
        </TabsContent>

        {/* Custom APIs Tab */}
        <TabsContent value="apis">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Custom APIs</CardTitle>
                  <CardDescription>
                    Endpoints customizados para esta entidade. Use em botoes, acoes e integrações.
                  </CardDescription>
                </div>
                <Button onClick={() => openApiDialog()} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Nova API
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingApis ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : customApis.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <Zap className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="font-medium mb-2">Nenhuma Custom API</h3>
                  <p className="text-muted-foreground text-sm mb-4 max-w-md mx-auto">
                    Crie endpoints customizados para acoes como "Aprovar", "Enviar Email",
                    "Gerar Relatorio", etc. Depois use em botoes nas suas Pages.
                  </p>
                  <Button onClick={() => openApiDialog()} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Criar primeira API
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {customApis.map((customApi) => (
                    <div
                      key={customApi.id}
                      className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <Badge className={`${getMethodColor(customApi.method)} text-white w-16 justify-center`}>
                        {customApi.method}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{customApi.name}</span>
                          {!customApi.isActive && (
                            <Badge variant="secondary" className="text-xs">Inativo</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground font-mono truncate">
                          /api/{entity.slug}/{customApi.path}
                        </div>
                        {customApi.description && (
                          <p className="text-xs text-muted-foreground mt-1">{customApi.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={customApi.isActive}
                          onCheckedChange={() => handleToggleApi(customApi)}
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openApiDialog(customApi)}>
                              <Code className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteApi(customApi)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Deletar
                            </DropdownMenuItem>
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
            <DialogTitle>
              {editingApi ? 'Editar Custom API' : 'Nova Custom API'}
            </DialogTitle>
            <DialogDescription>
              Crie um endpoint customizado para {entity.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={apiForm.name}
                  onChange={(e) => setApiForm({ ...apiForm, name: e.target.value })}
                  placeholder="Ex: Aprovar Pedido"
                />
              </div>
              <div className="space-y-2">
                <Label>Metodo HTTP</Label>
                <Select
                  value={apiForm.method}
                  onValueChange={(value: any) => setApiForm({ ...apiForm, method: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {httpMethods.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        <div className="flex items-center gap-2">
                          <Badge className={`${method.color} text-white text-xs`}>
                            {method.label}
                          </Badge>
                        </div>
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
                <Input
                  value={apiForm.path}
                  onChange={(e) => setApiForm({ ...apiForm, path: e.target.value })}
                  placeholder="aprovar ou :id/aprovar"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Use :id para parametros dinamicos. Ex: ":id/aprovar" vira "/api/{entity.slug}/123/aprovar"
              </p>
            </div>

            <div className="space-y-2">
              <Label>Descricao</Label>
              <Input
                value={apiForm.description}
                onChange={(e) => setApiForm({ ...apiForm, description: e.target.value })}
                placeholder="O que essa API faz?"
              />
            </div>

            <div className="space-y-2">
              <Label>Codigo (JavaScript)</Label>
              <Textarea
                value={apiForm.code}
                onChange={(e) => setApiForm({ ...apiForm, code: e.target.value })}
                placeholder={`// Contexto disponivel: ctx.params, ctx.body, ctx.user, ctx.entity
// Retorne o resultado da operacao

const { id } = ctx.params;
const record = await ctx.entity.findById(id);

// Sua logica aqui...

return { success: true, data: record };`}
                rows={10}
                className="font-mono text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setApiDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveApi} disabled={savingApi}>
              {savingApi ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {editingApi ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

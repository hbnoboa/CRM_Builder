'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, FileText, List, FilePlus, PenSquare, LayoutTemplate } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useCreatePage, useUpdatePage } from '@/hooks/use-pages';
import { api } from '@/lib/api';
import type { Entity, EntityField } from '@/types';
import type { Page } from '@/services/pages.service';

type PageType = 'list' | 'create' | 'edit' | 'custom';

const PAGE_TYPES: { id: PageType; label: string; description: string; icon: React.ReactNode }[] = [
  { id: 'list', label: 'Lista', description: 'Tabela com registros', icon: <List className="h-4 w-4" /> },
  { id: 'create', label: 'Novo', description: 'Formulario de criacao', icon: <FilePlus className="h-4 w-4" /> },
  { id: 'edit', label: 'Editar', description: 'Formulario de edicao', icon: <PenSquare className="h-4 w-4" /> },
  { id: 'custom', label: 'Custom', description: 'Pagina livre', icon: <LayoutTemplate className="h-4 w-4" /> },
];

interface PageFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  page?: Page | null;
  onSuccess?: () => void;
}

// Gera slug a partir de titulo
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Gera o conteudo Puck automaticamente com base no tipo e campos selecionados
function generatePuckContent(
  pageType: PageType,
  entity: Entity | null,
  selectedFields: string[],
  title: string,
  redirectSlug?: string,
) {
  if (pageType === 'custom') {
    return {
      root: { props: { title } },
      content: [
        {
          type: 'Hero',
          props: { id: `hero-${Date.now()}`, title, subtitle: '' },
        },
      ],
      zones: {},
    };
  }

  if (!entity) return { root: { props: { title } }, content: [], zones: {} };

  if (pageType === 'list') {
    return {
      root: { props: { title } },
      content: [
        {
          type: 'Hero',
          props: { id: `hero-${Date.now()}`, title, subtitle: `Gerencie registros de ${entity.name}` },
        },
        {
          type: 'EntityDataTable',
          props: {
            id: `table-${Date.now()}`,
            entitySlug: entity.slug,
            columns: selectedFields.map(slug => {
              const field = entity.fields?.find(f => f.slug === slug);
              return { field: slug, label: field?.label || field?.name || slug };
            }),
            showActions: true,
            editPageSlug: `/${entity.slug}-editar`,
            createPageSlug: `/${entity.slug}-novo`,
            pageSize: 10,
          },
        },
      ],
      zones: {},
    };
  }

  // create or edit form
  const mode = pageType === 'create' ? 'create' : 'edit';
  const fields = entity.fields?.filter(f => selectedFields.includes(f.slug)) || [];

  return {
    root: { props: { title } },
    content: [
      {
        type: 'Hero',
        props: {
          id: `hero-${Date.now()}`,
          title,
          subtitle: mode === 'create'
            ? `Preencha os dados para criar um novo ${entity.name}`
            : `Edite os dados de ${entity.name}`,
        },
      },
      {
        type: 'EntityDataForm',
        props: {
          id: `form-${Date.now()}`,
          entitySlug: entity.slug,
          mode,
          fields: fields.map(f => ({
            slug: f.slug,
            label: f.label || f.name,
            type: f.type,
            required: f.required || false,
            options: f.options,
            apiEndpoint: f.apiEndpoint,
            valueField: f.valueField,
            labelField: f.labelField,
            autoFillFields: f.autoFillFields,
          })),
          redirectAfterSubmit: redirectSlug || `/${entity.slug}-lista`,
          showBackButton: true,
        },
      },
    ],
    zones: {},
  };
}

export function PageFormDialog({
  open,
  onOpenChange,
  page,
  onSuccess,
}: PageFormDialogProps) {
  const isEditing = !!page;
  const createPage = useCreatePage();
  const updatePage = useUpdatePage();

  // Dados do formulario
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [pageType, setPageType] = useState<PageType>('list');
  const [entityId, setEntityId] = useState('');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);

  // Dados carregados
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(true);

  // Carrega entidades
  useEffect(() => {
    if (open) {
      loadEntities();
    }
  }, [open]);

  const loadEntities = async () => {
    setLoadingEntities(true);
    try {
      const response = await api.get('/entities');
      const data = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setEntities(data);
    } catch (error) {
      console.error('Erro ao carregar entidades:', error);
    } finally {
      setLoadingEntities(false);
    }
  };

  const selectedEntity = entities.find(e => e.id === entityId) || null;

  // Carrega detalhes da entidade (campos) quando selecionada
  useEffect(() => {
    if (entityId && open) {
      const entity = entities.find(e => e.id === entityId);
      if (entity && (!entity.fields || entity.fields.length === 0)) {
        api.get(`/entities/${entityId}`).then(res => {
          const updated = res.data;
          setEntities(prev => prev.map(e => e.id === entityId ? { ...e, ...updated } : e));
        }).catch(console.error);
      }
    }
  }, [entityId, open]);

  // Selecionar todos os campos quando muda entidade
  useEffect(() => {
    if (selectedEntity?.fields) {
      setSelectedFields(selectedEntity.fields.map(f => f.slug));
    }
  }, [selectedEntity?.id, selectedEntity?.fields?.length]);

  // Auto-gera titulo e slug
  useEffect(() => {
    if (!isEditing && selectedEntity && pageType !== 'custom') {
      const typeLabels: Record<PageType, string> = {
        list: `Lista de ${selectedEntity.name}`,
        create: `Novo ${selectedEntity.name}`,
        edit: `Editar ${selectedEntity.name}`,
        custom: '',
      };
      const autoTitle = typeLabels[pageType];
      if (autoTitle) {
        setTitle(autoTitle);
        setSlug(generateSlug(autoTitle));
      }
    }
  }, [entityId, pageType, isEditing, selectedEntity?.name]);

  // Inicializa com dados da pagina ao editar
  useEffect(() => {
    if (open && page) {
      setTitle(page.title || '');
      setSlug(page.slug || '');
      setDescription(page.description || '');
    } else if (open && !page) {
      setTitle('');
      setSlug('');
      setDescription('');
      setPageType('list');
      setEntityId('');
      setSelectedFields([]);
    }
  }, [open, page]);

  const toggleField = (fieldSlug: string) => {
    setSelectedFields(prev =>
      prev.includes(fieldSlug)
        ? prev.filter(s => s !== fieldSlug)
        : [...prev, fieldSlug]
    );
  };

  const selectAllFields = () => {
    if (selectedEntity?.fields) {
      setSelectedFields(selectedEntity.fields.map(f => f.slug));
    }
  };

  const deselectAllFields = () => {
    setSelectedFields([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return;
    if (!slug.trim()) return;

    const content = isEditing
      ? page?.content
      : generatePuckContent(
          pageType,
          selectedEntity,
          selectedFields,
          title,
          selectedEntity ? `/${selectedEntity.slug}-lista` : undefined,
        );

    try {
      if (isEditing && page) {
        await updatePage.mutateAsync({
          id: page.id,
          data: {
            title,
            slug,
            description: description || undefined,
            content: content as Record<string, unknown>,
          },
        });
      } else {
        await createPage.mutateAsync({
          title,
          slug,
          description: description || undefined,
          content: content as Record<string, unknown>,
          isPublished: true,
        });
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      // Erro tratado pelo hook
    }
  };

  const isLoading = createPage.isPending || updatePage.isPending;

  const getFieldTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      text: 'Texto',
      textarea: 'Area de Texto',
      number: 'Numero',
      email: 'Email',
      phone: 'Telefone',
      url: 'URL',
      date: 'Data',
      datetime: 'Data/Hora',
      boolean: 'Sim/Nao',
      select: 'Selecao',
      multiselect: 'Selecao Multipla',
      'api-select': 'API Select',
      file: 'Arquivo',
      image: 'Imagem',
    };
    return labels[type] || type;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {isEditing ? 'Editar Pagina' : 'Nova Pagina'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Altere o titulo, slug ou descricao da pagina.'
              : 'Escolha o tipo, a entidade e os campos. A pagina sera gerada automaticamente.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Tipo de Pagina (somente criacao) */}
          {!isEditing && (
            <div className="space-y-2">
              <Label>Tipo de Pagina</Label>
              <div className="grid grid-cols-4 gap-2">
                {PAGE_TYPES.map(type => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setPageType(type.id)}
                    className={`p-3 rounded-lg border-2 text-center transition-all ${
                      pageType === type.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <div className="flex justify-center mb-1">{type.icon}</div>
                    <div className="text-sm font-medium">{type.label}</div>
                    <div className="text-[10px] text-muted-foreground">{type.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Selecao de entidade (somente criacao e nao-custom) */}
          {!isEditing && pageType !== 'custom' && (
            <div className="space-y-2">
              <Label>Entidade</Label>
              {loadingEntities ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                </div>
              ) : (
                <Select value={entityId} onValueChange={setEntityId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a entidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {entities.map(entity => (
                      <SelectItem key={entity.id} value={entity.id}>
                        {entity.name}
                        <span className="text-muted-foreground ml-2 text-xs">({entity.fields?.length || 0} campos)</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Titulo e Slug */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="page-title">Titulo</Label>
              <Input
                id="page-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (!isEditing) {
                    setSlug(generateSlug(e.target.value));
                  }
                }}
                placeholder="Ex: Lista de Clientes"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="page-slug">Slug (URL)</Label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">/preview/</span>
                <Input
                  id="page-slug"
                  value={slug}
                  onChange={(e) => setSlug(generateSlug(e.target.value))}
                  placeholder="lista-clientes"
                  required
                />
              </div>
            </div>
          </div>

          {/* Descricao */}
          <div className="space-y-2">
            <Label htmlFor="page-desc">Descricao (opcional)</Label>
            <Input
              id="page-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descricao breve da pagina"
            />
          </div>

          {/* Campos da entidade (somente criacao e nao-custom) */}
          {!isEditing && pageType !== 'custom' && selectedEntity?.fields && selectedEntity.fields.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Campos do formulario</Label>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={selectAllFields}>
                    Todos
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={deselectAllFields}>
                    Nenhum
                  </Button>
                </div>
              </div>
              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {selectedEntity.fields.map(field => (
                  <label
                    key={field.slug}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedFields.includes(field.slug)}
                      onCheckedChange={() => toggleField(field.slug)}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{field.label || field.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">({field.slug})</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      {getFieldTypeLabel(field.type)}
                    </Badge>
                    {field.required && (
                      <Badge variant="destructive" className="text-[10px]">
                        Obrigatorio
                      </Badge>
                    )}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedFields.length} de {selectedEntity.fields.length} campos selecionados
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !title.trim() || !slug.trim() || (!isEditing && pageType !== 'custom' && !entityId)}
            >
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? 'Salvar' : 'Criar Pagina'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

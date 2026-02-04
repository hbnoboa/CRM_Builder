'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Columns,
  List,
  Eye,
  PenSquare,
  FilePlus,
  LayoutTemplate,
  Database,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { puckConfig, initialData } from '@/lib/puck-config';
import api from '@/lib/api';
import type { Data } from '@measured/puck';
import type { Entity } from '@/types';

const Puck = dynamic(
  () => import('@measured/puck').then((mod) => mod.Puck),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-96">Carregando editor...</div> }
);

import '@measured/puck/puck.css';

// ============================================================================
// TYPES
// ============================================================================

type PageType = 'index' | 'show' | 'create' | 'edit' | 'custom';

interface RowItem {
  id: string;
  columns: number[];
}

const PAGE_TYPES = [
  {
    id: 'index' as PageType,
    label: 'Index (Lista)',
    description: 'Lista todos os registros da entidade',
    icon: List,
    color: 'bg-blue-500',
    defaultEndpoint: 'GET /api/{entity}',
  },
  {
    id: 'show' as PageType,
    label: 'Show (Visualizar)',
    description: 'Visualiza um registro especifico',
    icon: Eye,
    color: 'bg-green-500',
    defaultEndpoint: 'GET /api/{entity}/:id',
  },
  {
    id: 'create' as PageType,
    label: 'Create (Criar)',
    description: 'Formulario para criar novo registro',
    icon: FilePlus,
    color: 'bg-purple-500',
    defaultEndpoint: 'POST /api/{entity}',
  },
  {
    id: 'edit' as PageType,
    label: 'Edit (Editar)',
    description: 'Formulario para editar registro',
    icon: PenSquare,
    color: 'bg-orange-500',
    defaultEndpoint: 'PUT /api/{entity}/:id',
  },
  {
    id: 'custom' as PageType,
    label: 'Custom (Livre)',
    description: 'Pagina customizada sem vinculo a entidade',
    icon: LayoutTemplate,
    color: 'bg-gray-500',
    defaultEndpoint: null,
  },
];

// ============================================================================
// ROW COMPONENT
// ============================================================================

function RowCard({
  row,
  index,
  total,
  onUpdate,
  onDelete,
  onMove,
}: {
  row: RowItem;
  index: number;
  total: number;
  onUpdate: (columns: number[]) => void;
  onDelete: () => void;
  onMove: (direction: 'up' | 'down') => void;
}) {
  const presets = [
    { label: '1', cols: [12] },
    { label: '2', cols: [6, 6] },
    { label: '3', cols: [4, 4, 4] },
    { label: '4', cols: [3, 3, 3, 3] },
  ];

  const addColumn = () => {
    if (row.columns.length >= 4) return;
    const newCols = [...row.columns, 3];
    const colTotal = newCols.reduce((a, b) => a + b, 0);
    if (colTotal > 12) {
      const excess = colTotal - 12;
      newCols[0] = Math.max(1, newCols[0] - excess);
    }
    onUpdate(newCols);
  };

  const removeColumn = (colIndex: number) => {
    if (row.columns.length <= 1) return;
    const newCols = row.columns.filter((_, i) => i !== colIndex);
    const removed = row.columns[colIndex];
    newCols[0] = Math.min(12, newCols[0] + removed);
    onUpdate(newCols);
  };

  const updateColumnSize = (colIndex: number, newSize: number) => {
    const newCols = [...row.columns];
    const oldSize = newCols[colIndex];
    const diff = newSize - oldSize;
    const otherIndex = colIndex === 0 ? 1 : 0;
    if (newCols[otherIndex] !== undefined) {
      const otherNewSize = newCols[otherIndex] - diff;
      if (otherNewSize >= 1 && otherNewSize <= 11) {
        newCols[colIndex] = newSize;
        newCols[otherIndex] = otherNewSize;
        onUpdate(newCols);
      }
    }
  };

  const getColumnPercent = (size: number) => Math.round((size / 12) * 100);

  return (
    <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b">
        <Columns className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-medium flex-1">
          Linha {index + 1} - {row.columns.length} {row.columns.length === 1 ? 'coluna' : 'colunas'}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onMove('up')} disabled={index === 0}>
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onMove('down')} disabled={index === total - 1}>
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Colunas:</span>
          {presets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => onUpdate(preset.cols)}
              className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                row.columns.length === preset.cols.length &&
                row.columns.every((c, i) => c === preset.cols[i])
                  ? 'bg-blue-600 text-white'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {preset.label}
            </button>
          ))}
          {row.columns.length < 4 && (
            <button
              onClick={addColumn}
              className="w-8 h-8 rounded-lg text-sm font-medium bg-muted hover:bg-muted/80 flex items-center justify-center"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex gap-1 h-16 rounded-lg overflow-hidden border">
          {row.columns.map((size, colIndex) => (
            <div
              key={colIndex}
              className="bg-blue-100 border-r last:border-r-0 border-blue-200 flex items-center justify-center relative group"
              style={{ width: `${getColumnPercent(size)}%` }}
            >
              <span className="text-xs font-medium text-blue-700">
                {getColumnPercent(size)}%
              </span>
              {row.columns.length > 1 && (
                <button
                  onClick={() => removeColumn(colIndex)}
                  className="absolute top-1 right-1 w-5 h-5 rounded bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>

        {row.columns.length > 1 && (
          <div className="space-y-3 pt-2">
            <span className="text-xs text-muted-foreground">Ajustar tamanhos:</span>
            {row.columns.map((size, colIndex) => (
              <div key={colIndex} className="flex items-center gap-3">
                <span className="text-xs w-16 text-muted-foreground">Col {colIndex + 1}</span>
                <Slider
                  value={[size]}
                  min={1}
                  max={11}
                  step={1}
                  onValueChange={([value]) => updateColumnSize(colIndex, value)}
                  className="flex-1"
                />
                <span className="text-xs w-12 text-right font-mono">{getColumnPercent(size)}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function NewPageEditor() {
  const router = useRouter();
  const [step, setStep] = useState<'type' | 'config' | 'layout' | 'visual'>('type');

  // Step 1: Type selection
  const [pageType, setPageType] = useState<PageType | null>(null);
  const [entityId, setEntityId] = useState<string>('');
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(true);

  // Step 2: Config
  const [pageTitle, setPageTitle] = useState('');
  const [pageSlug, setPageSlug] = useState('');
  const [pageBackground, setPageBackground] = useState('#FFFFFF');
  const [pageTextColor, setPageTextColor] = useState('#000000');

  // Step 3: Layout
  const [rows, setRows] = useState<RowItem[]>([]);

  // Visual editor
  const [data, setData] = useState<Data>(initialData);
  const [saving, setSaving] = useState(false);

  // Load entities
  useEffect(() => {
    loadEntities();
  }, []);

  const loadEntities = async () => {
    try {
      const response = await api.get('/entities');
      const data = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setEntities(data);
    } catch (error) {
      console.error('Error loading entities:', error);
    } finally {
      setLoadingEntities(false);
    }
  };

  const selectedEntity = entities.find(e => e.id === entityId);
  const selectedPageType = PAGE_TYPES.find(t => t.id === pageType);

  const handleSave = useCallback(async (puckData: Data) => {
    if (!pageTitle.trim()) {
      alert('Titulo da pagina obrigatorio');
      return;
    }

    setSaving(true);
    try {
      await api.post('/pages', {
        title: pageTitle,
        slug: pageSlug || generateSlug(pageTitle),
        type: pageType,
        entityId: entityId || null,
        content: puckData,
        settings: {
          backgroundColor: pageBackground,
          textColor: pageTextColor,
        },
        isPublished: false,
      });
      router.push('/pages');
    } catch (error: any) {
      console.error('Error saving:', error);
      alert(error.response?.data?.message || 'Erro ao salvar pagina');
    } finally {
      setSaving(false);
    }
  }, [pageTitle, pageSlug, pageType, entityId, pageBackground, pageTextColor, router]);

  const generateSlug = (title: string) => {
    if (!title) return '';
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const addRow = (columns: number[] = [6, 6]) => {
    setRows([...rows, { id: `row-${Date.now()}`, columns }]);
  };

  const updateRow = (index: number, columns: number[]) => {
    setRows(rows.map((r, i) => (i === index ? { ...r, columns } : r)));
  };

  const deleteRow = (index: number) => {
    setRows(rows.filter((_, i) => i !== index));
  };

  const moveRow = (index: number, direction: 'up' | 'down') => {
    const newRows = [...rows];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= rows.length) return;
    [newRows[index], newRows[targetIndex]] = [newRows[targetIndex], newRows[index]];
    setRows(newRows);
  };

  const goToVisualEditor = () => {
    const content = rows.map((row) => ({
      type: 'Row',
      props: {
        id: row.id,
        columns: row.columns,
        gap: 'md',
      },
    }));

    setData({
      content: content as any,
      root: { props: {} },
    });

    setStep('visual');
  };

  const handleSelectType = (type: PageType) => {
    setPageType(type);
    if (type === 'custom') {
      setEntityId('');
    }
  };

  const canProceedFromType = () => {
    if (!pageType) return false;
    if (pageType !== 'custom' && !entityId) return false;
    return true;
  };

  const proceedToConfig = () => {
    if (!canProceedFromType()) return;

    // Auto-generate title based on type and entity
    if (selectedEntity && pageType) {
      const typeLabels: Record<PageType, string> = {
        index: 'Lista de',
        show: 'Visualizar',
        create: 'Criar',
        edit: 'Editar',
        custom: '',
      };
      const autoTitle = `${typeLabels[pageType]} ${selectedEntity.name}`;
      setPageTitle(autoTitle);
      setPageSlug(generateSlug(autoTitle));
    }

    setStep('config');
  };

  // ========== STEP 1: TYPE SELECTION ==========
  if (step === 'type') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background">
        <header className="sticky top-0 z-50 h-14 border-b bg-background/95 backdrop-blur flex items-center px-4 gap-4">
          <Link href="/pages">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Nova Pagina</h1>
          </div>
        </header>

        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {/* Page Type Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Tipo de Pagina</CardTitle>
              <CardDescription>Escolha o tipo de pagina que deseja criar</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {PAGE_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      onClick={() => handleSelectType(type.id)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        pageType === type.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg ${type.color} flex items-center justify-center mb-3`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <div className="font-medium">{type.label}</div>
                      <div className="text-sm text-muted-foreground mt-1">{type.description}</div>
                      {type.defaultEndpoint && (
                        <Badge variant="secondary" className="mt-2 text-xs font-mono">
                          {type.defaultEndpoint}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Entity Selection (not for custom) */}
          {pageType && pageType !== 'custom' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Selecione a Entidade
                </CardTitle>
                <CardDescription>
                  Qual entidade esta pagina vai gerenciar?
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingEntities ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                ) : entities.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">Nenhuma entidade criada ainda.</p>
                    <Link href="/entities/new">
                      <Button variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Criar Entidade
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {entities.map((entity) => (
                      <button
                        key={entity.id}
                        onClick={() => setEntityId(entity.id)}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          entityId === entity.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="font-medium">{entity.name}</div>
                        <div className="text-xs text-muted-foreground">/{entity.slug}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {entity.fields?.length || 0} campos - {entity._count?.data || 0} registros
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Summary & Continue */}
          {canProceedFromType() && (
            <Card className="border-primary/50 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">
                      {selectedPageType?.label}
                      {selectedEntity && ` - ${selectedEntity.name}`}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {selectedPageType?.description}
                    </div>
                  </div>
                  <Button onClick={proceedToConfig}>
                    Continuar
                    <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // ========== STEP 2: CONFIG ==========
  if (step === 'config') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background">
        <header className="sticky top-0 z-50 h-14 border-b bg-background/95 backdrop-blur flex items-center px-4 gap-4">
          <Button variant="ghost" size="sm" onClick={() => setStep('type')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Configuracoes</h1>
          </div>
          <Button onClick={() => setStep('layout')} disabled={!pageTitle.trim()}>
            Continuar
            <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
          </Button>
        </header>

        <div className="max-w-3xl mx-auto p-6 space-y-6">
          {/* Type Summary */}
          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
            {selectedPageType && (
              <>
                <div className={`w-10 h-10 rounded-lg ${selectedPageType.color} flex items-center justify-center`}>
                  <selectedPageType.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="font-medium">{selectedPageType.label}</div>
                  {selectedEntity && (
                    <div className="text-sm text-muted-foreground">Entidade: {selectedEntity.name}</div>
                  )}
                </div>
              </>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Configuracoes da Pagina</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="title">Nome da pagina</Label>
                  <Input
                    id="title"
                    value={pageTitle}
                    onChange={(e) => {
                      setPageTitle(e.target.value);
                      if (!pageSlug || pageSlug === generateSlug(pageTitle)) {
                        setPageSlug(generateSlug(e.target.value));
                      }
                    }}
                    placeholder="Ex: Lista de Clientes"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">URL</Label>
                  <div className="flex items-center">
                    <span className="text-muted-foreground text-sm mr-1">/</span>
                    <Input
                      id="slug"
                      value={pageSlug}
                      onChange={(e) => setPageSlug(generateSlug(e.target.value))}
                      placeholder="lista-clientes"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={pageBackground}
                    onChange={(e) => setPageBackground(e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border-2 border-border"
                  />
                  <div>
                    <Label className="text-xs">Fundo</Label>
                    <div className="text-[10px] text-muted-foreground font-mono">{pageBackground}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={pageTextColor}
                    onChange={(e) => setPageTextColor(e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border-2 border-border"
                  />
                  <div>
                    <Label className="text-xs">Texto</Label>
                    <div className="text-[10px] text-muted-foreground font-mono">{pageTextColor}</div>
                  </div>
                </div>
                <div
                  className="flex-1 py-2 px-3 rounded-lg border text-sm"
                  style={{ backgroundColor: pageBackground, color: pageTextColor }}
                >
                  Preview do texto
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ========== STEP 3: LAYOUT ==========
  if (step === 'layout') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background">
        <header className="sticky top-0 z-50 h-14 border-b bg-background/95 backdrop-blur flex items-center px-4 gap-4">
          <Button variant="ghost" size="sm" onClick={() => setStep('config')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Layout - {pageTitle}</h1>
          </div>
          <Button onClick={goToVisualEditor} disabled={rows.length === 0}>
            Continuar para Editor
            <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
          </Button>
        </header>

        <div className="max-w-3xl mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Layout da Pagina</h2>
            <Button onClick={() => addRow()} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Linha
            </Button>
          </div>

          {rows.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed rounded-xl bg-muted/20">
              <Columns className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Comece criando linhas</h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
                Cada linha pode ter de 1 a 4 colunas. Depois voce adiciona campos em cada coluna.
              </p>
              <div className="flex justify-center gap-2">
                <Button onClick={() => addRow([12])} variant="outline">1 Coluna</Button>
                <Button onClick={() => addRow([6, 6])} variant="outline">2 Colunas</Button>
                <Button onClick={() => addRow([4, 4, 4])} variant="outline">3 Colunas</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((row, index) => (
                <RowCard
                  key={row.id}
                  row={row}
                  index={index}
                  total={rows.length}
                  onUpdate={(columns) => updateRow(index, columns)}
                  onDelete={() => deleteRow(index)}
                  onMove={(direction) => moveRow(index, direction)}
                />
              ))}
              <button
                onClick={() => addRow()}
                className="w-full py-4 border-2 border-dashed rounded-xl text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Adicionar outra linha
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ========== STEP 4: VISUAL EDITOR ==========
  return (
    <div className="h-screen flex flex-col">
      <header className="h-14 border-b bg-background flex items-center px-4 gap-4">
        <Button variant="ghost" size="sm" onClick={() => setStep('layout')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar ao Layout
        </Button>
        <div className="h-6 w-px bg-border" />
        <div className="flex-1 flex items-center gap-3">
          <Badge className={selectedPageType?.color + ' text-white'}>
            {selectedPageType?.label}
          </Badge>
          <span className="font-medium">{pageTitle}</span>
          <span className="text-sm text-muted-foreground">/{pageSlug}</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => handleSave(data)} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </header>

      <div className="flex-1 overflow-hidden">
        <Puck
          config={puckConfig}
          data={data}
          onPublish={handleSave}
          onChange={setData}
        />
      </div>
    </div>
  );
}

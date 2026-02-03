'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  Save,
  Settings,
  LayoutGrid,
  Columns,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Minus,
  Square,
  SplitSquareHorizontal,
  Grid3X3,
  AlignHorizontalSpaceBetween,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { puckConfig, initialData } from '@/lib/puck-config';
import api from '@/lib/api';
import type { Data } from '@measured/puck';

// Dynamic import for Puck
const Puck = dynamic(
  () => import('@measured/puck').then((mod) => mod.Puck),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-96">Carregando editor...</div> }
);

import '@measured/puck/puck.css';

// ============================================================================
// STRUCTURE TYPES
// ============================================================================

type StructureType = 'section' | 'row' | 'spacer' | 'divider';

interface StructureItem {
  id: string;
  type: StructureType;
  // Row specific
  layout?: string;
  columns?: number[];
  // Section specific
  background?: string;
  maxWidth?: string;
  paddingY?: string;
  // Spacer specific
  size?: string;
  // Divider specific
  margin?: string;
}

// ============================================================================
// LAYOUT PRESETS
// ============================================================================

const ROW_LAYOUTS = [
  { id: '1', label: '1 Coluna', visual: ['100%'], columns: [12] },
  { id: '2-equal', label: '2 Colunas Iguais', visual: ['50%', '50%'], columns: [6, 6] },
  { id: '2-left', label: '2 Colunas (Grande + Pequena)', visual: ['66%', '33%'], columns: [8, 4] },
  { id: '2-right', label: '2 Colunas (Pequena + Grande)', visual: ['33%', '66%'], columns: [4, 8] },
  { id: '3-equal', label: '3 Colunas Iguais', visual: ['33%', '33%', '33%'], columns: [4, 4, 4] },
  { id: '3-center', label: '3 Colunas (Centro Maior)', visual: ['25%', '50%', '25%'], columns: [3, 6, 3] },
  { id: '4-equal', label: '4 Colunas Iguais', visual: ['25%', '25%', '25%', '25%'], columns: [3, 3, 3, 3] },
];

const SECTION_BACKGROUNDS = [
  { id: 'none', label: 'Sem Fundo', color: 'transparent' },
  { id: 'muted', label: 'Cinza Claro', color: '#f4f4f5' },
  { id: 'primary', label: 'Cor Primaria', color: '#3b82f6' },
  { id: 'secondary', label: 'Cor Secundaria', color: '#6366f1' },
  { id: 'gradient', label: 'Gradiente', color: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' },
];

const SPACER_SIZES = [
  { id: 'xs', label: 'Extra Pequeno', height: 8 },
  { id: 'sm', label: 'Pequeno', height: 16 },
  { id: 'md', label: 'Medio', height: 32 },
  { id: 'lg', label: 'Grande', height: 64 },
  { id: 'xl', label: 'Extra Grande', height: 96 },
];

// ============================================================================
// STRUCTURE PREVIEWS
// ============================================================================

function RowPreviewCard({ layout, selected, onClick }: { layout: typeof ROW_LAYOUTS[0]; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
        selected
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50 hover:bg-muted/50'
      }`}
    >
      <div className="text-xs font-medium mb-2">{layout.label}</div>
      <div className="flex gap-1 h-8">
        {layout.visual.map((width, i) => (
          <div
            key={i}
            className={`rounded flex items-center justify-center text-[10px] font-mono ${
              selected ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
            }`}
            style={{ width }}
          >
            {width}
          </div>
        ))}
      </div>
    </button>
  );
}

function SectionPreviewCard({ bg, selected, onClick }: { bg: typeof SECTION_BACKGROUNDS[0]; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-lg border-2 transition-all ${
        selected
          ? 'border-primary'
          : 'border-border hover:border-primary/50'
      }`}
    >
      <div
        className="w-16 h-10 rounded mb-2 border"
        style={{ background: bg.color }}
      />
      <div className="text-xs">{bg.label}</div>
    </button>
  );
}

function SpacerPreviewCard({ size, selected, onClick }: { size: typeof SPACER_SIZES[0]; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 p-2 rounded-lg border-2 transition-all ${
        selected
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50'
      }`}
    >
      <div className="flex items-center justify-center mb-1">
        <div
          className={`w-full rounded ${selected ? 'bg-primary/30' : 'bg-muted'}`}
          style={{ height: Math.min(size.height / 2, 24) }}
        />
      </div>
      <div className="text-[10px] text-center">{size.label}</div>
    </button>
  );
}

// ============================================================================
// STRUCTURE ITEM COMPONENT
// ============================================================================

function StructureItemCard({
  item,
  index,
  total,
  onUpdate,
  onDelete,
  onMove,
}: {
  item: StructureItem;
  index: number;
  total: number;
  onUpdate: (updates: Partial<StructureItem>) => void;
  onDelete: () => void;
  onMove: (direction: 'up' | 'down') => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const typeLabels: Record<StructureType, string> = {
    section: 'Secao',
    row: 'Linha de Colunas',
    spacer: 'Espacamento',
    divider: 'Divisor',
  };

  const typeColors: Record<StructureType, string> = {
    section: 'bg-green-500',
    row: 'bg-blue-500',
    spacer: 'bg-orange-500',
    divider: 'bg-gray-500',
  };

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b">
        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
        <div className={`w-2 h-2 rounded-full ${typeColors[item.type]}`} />
        <span className="text-sm font-medium flex-1">
          {index + 1}. {typeLabels[item.type]}
        </span>

        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onMove('up')} disabled={index === 0}>
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onMove('down')} disabled={index === total - 1}>
          <ChevronDown className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      {expanded && (
        <div className="p-4">
          {item.type === 'row' && (
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">Escolha o layout das colunas:</Label>
              <div className="grid grid-cols-2 gap-2">
                {ROW_LAYOUTS.map((layout) => (
                  <RowPreviewCard
                    key={layout.id}
                    layout={layout}
                    selected={item.layout === layout.id}
                    onClick={() => onUpdate({ layout: layout.id, columns: layout.columns })}
                  />
                ))}
              </div>
            </div>
          )}

          {item.type === 'section' && (
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">Cor de fundo da secao:</Label>
              <div className="flex gap-2 flex-wrap">
                {SECTION_BACKGROUNDS.map((bg) => (
                  <SectionPreviewCard
                    key={bg.id}
                    bg={bg}
                    selected={item.background === bg.id}
                    onClick={() => onUpdate({ background: bg.id })}
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <Label className="text-xs">Largura Maxima</Label>
                  <Select value={item.maxWidth || 'lg'} onValueChange={(v) => onUpdate({ maxWidth: v })}>
                    <SelectTrigger className="h-9 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sm">Pequena (640px)</SelectItem>
                      <SelectItem value="md">Media (768px)</SelectItem>
                      <SelectItem value="lg">Grande (1024px)</SelectItem>
                      <SelectItem value="xl">Extra Grande (1280px)</SelectItem>
                      <SelectItem value="full">Tela Cheia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Espacamento Vertical</Label>
                  <Select value={item.paddingY || 'md'} onValueChange={(v) => onUpdate({ paddingY: v })}>
                    <SelectTrigger className="h-9 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      <SelectItem value="sm">Pequeno</SelectItem>
                      <SelectItem value="md">Medio</SelectItem>
                      <SelectItem value="lg">Grande</SelectItem>
                      <SelectItem value="xl">Extra Grande</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {item.type === 'spacer' && (
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">Tamanho do espacamento:</Label>
              <div className="flex gap-2">
                {SPACER_SIZES.map((size) => (
                  <SpacerPreviewCard
                    key={size.id}
                    size={size}
                    selected={item.size === size.id}
                    onClick={() => onUpdate({ size: size.id })}
                  />
                ))}
              </div>
            </div>
          )}

          {item.type === 'divider' && (
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">Preview do divisor:</Label>
              <div className="py-4 px-8">
                <hr className="border-t-2 border-border" />
              </div>
              <div>
                <Label className="text-xs">Margem</Label>
                <Select value={item.margin || 'md'} onValueChange={(v) => onUpdate({ margin: v })}>
                  <SelectTrigger className="h-9 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sm">Pequena</SelectItem>
                    <SelectItem value="md">Media</SelectItem>
                    <SelectItem value="lg">Grande</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function NewPageEditor() {
  const router = useRouter();
  const [mode, setMode] = useState<'setup' | 'visual'>('setup');
  const [pageTitle, setPageTitle] = useState('');
  const [pageSlug, setPageSlug] = useState('');
  const [pageDescription, setPageDescription] = useState('');
  const [data, setData] = useState<Data>(initialData);
  const [saving, setSaving] = useState(false);
  const [structures, setStructures] = useState<StructureItem[]>([]);

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
        description: pageDescription,
        content: puckData,
        isPublished: false,
      });
      router.push('/pages');
    } catch (error: any) {
      console.error('Error saving:', error);
      alert(error.response?.data?.message || 'Erro ao salvar pagina');
    } finally {
      setSaving(false);
    }
  }, [pageTitle, pageSlug, pageDescription, router]);

  const generateSlug = (title: string) => {
    if (!title) return '';
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const addStructure = (type: StructureType) => {
    const newItem: StructureItem = {
      id: `${type}-${Date.now()}`,
      type,
    };

    // Set defaults based on type
    if (type === 'row') {
      newItem.layout = '2-equal';
      newItem.columns = [6, 6];
    } else if (type === 'section') {
      newItem.background = 'none';
      newItem.maxWidth = 'lg';
      newItem.paddingY = 'md';
    } else if (type === 'spacer') {
      newItem.size = 'md';
    } else if (type === 'divider') {
      newItem.margin = 'md';
    }

    setStructures([...structures, newItem]);
  };

  const updateStructure = (index: number, updates: Partial<StructureItem>) => {
    setStructures(structures.map((s, i) => (i === index ? { ...s, ...updates } : s)));
  };

  const deleteStructure = (index: number) => {
    setStructures(structures.filter((_, i) => i !== index));
  };

  const moveStructure = (index: number, direction: 'up' | 'down') => {
    const newStructures = [...structures];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= structures.length) return;
    [newStructures[index], newStructures[targetIndex]] = [newStructures[targetIndex], newStructures[index]];
    setStructures(newStructures);
  };

  const goToVisualEditor = () => {
    if (!pageTitle.trim()) {
      alert('Por favor, preencha o titulo da pagina');
      return;
    }

    // Convert structures to Puck components
    const content = structures.map((item) => {
      if (item.type === 'row') {
        return {
          type: 'Row',
          props: {
            id: item.id,
            layout: item.layout || '2-equal',
            gap: 'md',
            verticalAlign: 'stretch',
          },
        };
      } else if (item.type === 'section') {
        return {
          type: 'Section',
          props: {
            id: item.id,
            background: item.background || 'none',
            maxWidth: item.maxWidth || 'lg',
            paddingY: item.paddingY || 'md',
          },
        };
      } else if (item.type === 'spacer') {
        return {
          type: 'Spacer',
          props: {
            id: item.id,
            size: item.size || 'md',
          },
        };
      } else if (item.type === 'divider') {
        return {
          type: 'Divider',
          props: {
            id: item.id,
            margin: item.margin || 'md',
          },
        };
      }
      return null;
    }).filter(Boolean);

    setData({
      content: content as any,
      root: { props: {} },
    });

    setMode('visual');
  };

  // ========== SETUP MODE ==========
  if (mode === 'setup') {
    return (
      <div className="min-h-screen bg-muted/30">
        {/* Header */}
        <header className="sticky top-0 z-50 h-14 border-b bg-background flex items-center px-4 gap-4">
          <Link href="/pages">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Nova Pagina</h1>
          </div>
          <Button onClick={goToVisualEditor} disabled={!pageTitle.trim() || structures.length === 0}>
            <LayoutGrid className="h-4 w-4 mr-2" />
            Continuar para Campos
          </Button>
        </header>

        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {/* Page Info */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Informacoes da Pagina
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="title">Titulo *</Label>
                  <Input
                    id="title"
                    value={pageTitle}
                    onChange={(e) => {
                      setPageTitle(e.target.value);
                      if (!pageSlug) setPageSlug(generateSlug(e.target.value));
                    }}
                    placeholder="Ex: Cadastro de Cliente"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">URL</Label>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">/</span>
                    <Input
                      id="slug"
                      value={pageSlug}
                      onChange={(e) => setPageSlug(generateSlug(e.target.value))}
                      placeholder="cadastro-cliente"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Add Structure Buttons */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Adicionar Estrutura</CardTitle>
              <CardDescription>
                Clique para adicionar elementos de layout a sua pagina
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Row Button */}
                <button
                  onClick={() => addStructure('row')}
                  className="p-4 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-100/50 hover:border-blue-400 transition-all group"
                >
                  <div className="flex justify-center mb-3">
                    <div className="flex gap-1">
                      <div className="w-8 h-12 rounded bg-blue-200 group-hover:bg-blue-300" />
                      <div className="w-8 h-12 rounded bg-blue-200 group-hover:bg-blue-300" />
                    </div>
                  </div>
                  <div className="text-sm font-medium text-blue-700">Linha de Colunas</div>
                  <div className="text-xs text-blue-600/70">1 a 4 colunas lado a lado</div>
                </button>

                {/* Section Button */}
                <button
                  onClick={() => addStructure('section')}
                  className="p-4 rounded-lg border-2 border-dashed border-green-300 bg-green-50/50 hover:bg-green-100/50 hover:border-green-400 transition-all group"
                >
                  <div className="flex justify-center mb-3">
                    <div className="w-20 h-12 rounded bg-green-200 group-hover:bg-green-300 flex items-center justify-center">
                      <Square className="h-5 w-5 text-green-600" />
                    </div>
                  </div>
                  <div className="text-sm font-medium text-green-700">Secao</div>
                  <div className="text-xs text-green-600/70">Area com fundo colorido</div>
                </button>

                {/* Spacer Button */}
                <button
                  onClick={() => addStructure('spacer')}
                  className="p-4 rounded-lg border-2 border-dashed border-orange-300 bg-orange-50/50 hover:bg-orange-100/50 hover:border-orange-400 transition-all group"
                >
                  <div className="flex justify-center mb-3">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-16 h-3 rounded bg-orange-200 group-hover:bg-orange-300" />
                      <div className="w-16 h-4 rounded bg-orange-100 border border-orange-200" />
                      <div className="w-16 h-3 rounded bg-orange-200 group-hover:bg-orange-300" />
                    </div>
                  </div>
                  <div className="text-sm font-medium text-orange-700">Espacamento</div>
                  <div className="text-xs text-orange-600/70">Espaco vertical</div>
                </button>

                {/* Divider Button */}
                <button
                  onClick={() => addStructure('divider')}
                  className="p-4 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50/50 hover:bg-gray-100/50 hover:border-gray-400 transition-all group"
                >
                  <div className="flex justify-center mb-3">
                    <div className="flex flex-col items-center gap-2 w-16">
                      <div className="w-full h-3 rounded bg-gray-200 group-hover:bg-gray-300" />
                      <div className="w-full h-0.5 bg-gray-400" />
                      <div className="w-full h-3 rounded bg-gray-200 group-hover:bg-gray-300" />
                    </div>
                  </div>
                  <div className="text-sm font-medium text-gray-700">Divisor</div>
                  <div className="text-xs text-gray-600/70">Linha horizontal</div>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Structure List */}
          {structures.length > 0 && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Estrutura da Pagina</CardTitle>
                <CardDescription>
                  {structures.length} elemento{structures.length !== 1 ? 's' : ''} - arraste para reordenar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {structures.map((item, index) => (
                  <StructureItemCard
                    key={item.id}
                    item={item}
                    index={index}
                    total={structures.length}
                    onUpdate={(updates) => updateStructure(index, updates)}
                    onDelete={() => deleteStructure(index)}
                    onMove={(direction) => moveStructure(index, direction)}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {structures.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/30">
              <LayoutGrid className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhuma estrutura adicionada</h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-4">
                Adicione linhas de colunas, secoes, espacamentos ou divisores
                para criar o layout da sua pagina.
              </p>
              <Button onClick={() => addStructure('row')}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar primeira linha
              </Button>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between items-center pt-4 border-t">
            <Link href="/pages">
              <Button variant="outline">Cancelar</Button>
            </Link>
            <Button
              size="lg"
              onClick={goToVisualEditor}
              disabled={!pageTitle.trim() || structures.length === 0}
            >
              <LayoutGrid className="h-4 w-4 mr-2" />
              Continuar para Adicionar Campos
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ========== VISUAL EDITOR MODE ==========
  return (
    <div className="h-screen flex flex-col">
      <header className="h-14 border-b bg-background flex items-center px-4 gap-4">
        <Button variant="ghost" size="sm" onClick={() => setMode('setup')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar ao Layout
        </Button>
        <div className="h-6 w-px bg-border" />
        <div className="flex-1 flex items-center gap-3">
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

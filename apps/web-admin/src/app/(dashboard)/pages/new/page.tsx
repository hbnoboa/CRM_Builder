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
  Eye,
  Code,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { puckConfig, initialData } from '@/lib/puck-config';
import api from '@/lib/api';
import type { Data } from '@measured/puck';

// Dynamic import for Puck to avoid SSR issues
const Puck = dynamic(
  () => import('@measured/puck').then((mod) => mod.Puck),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-96">Carregando editor...</div> }
);

// Import Puck CSS
import '@measured/puck/puck.css';

// Layout presets - inspired by iOS form generator
const LAYOUT_PRESETS = [
  { id: '1', label: '1 Coluna', icon: '[ ]', columns: [12] },
  { id: '2-equal', label: '2 Colunas', icon: '[ | ]', columns: [6, 6] },
  { id: '2-left', label: '2/3 + 1/3', icon: '[  | ]', columns: [8, 4] },
  { id: '2-right', label: '1/3 + 2/3', icon: '[ |  ]', columns: [4, 8] },
  { id: '3-equal', label: '3 Colunas', icon: '[ | | ]', columns: [4, 4, 4] },
  { id: '4-equal', label: '4 Colunas', icon: '[||||]', columns: [3, 3, 3, 3] },
];

interface PageLine {
  id: string;
  layout: string;
  columns: number[];
  expanded: boolean;
}

export default function NewPageEditor() {
  const router = useRouter();
  const [mode, setMode] = useState<'setup' | 'visual' | 'preview'>('setup');
  const [pageTitle, setPageTitle] = useState('');
  const [pageSlug, setPageSlug] = useState('');
  const [pageDescription, setPageDescription] = useState('');
  const [data, setData] = useState<Data>(initialData);
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState<PageLine[]>([]);

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
      const message = error.response?.data?.message || 'Erro ao salvar pagina';
      alert(message);
    } finally {
      setSaving(false);
    }
  }, [pageTitle, pageSlug, pageDescription, router]);

  const generateSlug = (title: string) => {
    if (!title || typeof title !== 'string') return '';
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const addLine = (layout: string = '2-equal') => {
    const preset = LAYOUT_PRESETS.find((p) => p.id === layout) || LAYOUT_PRESETS[1];
    setLines([
      ...lines,
      {
        id: `line-${Date.now()}`,
        layout: preset.id,
        columns: [...preset.columns],
        expanded: true,
      },
    ]);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLineLayout = (index: number, layoutId: string) => {
    const preset = LAYOUT_PRESETS.find((p) => p.id === layoutId);
    if (!preset) return;

    setLines(
      lines.map((line, i) =>
        i === index
          ? { ...line, layout: layoutId, columns: [...preset.columns] }
          : line
      )
    );
  };

  const toggleLineExpanded = (index: number) => {
    setLines(
      lines.map((line, i) =>
        i === index ? { ...line, expanded: !line.expanded } : line
      )
    );
  };

  const moveLine = (index: number, direction: 'up' | 'down') => {
    const newLines = [...lines];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= lines.length) return;
    [newLines[index], newLines[targetIndex]] = [newLines[targetIndex], newLines[index]];
    setLines(newLines);
  };

  const goToVisualEditor = () => {
    if (!pageTitle.trim()) {
      alert('Por favor, preencha o titulo da pagina');
      return;
    }

    // Convert lines structure to Puck data with Row components
    if (lines.length > 0) {
      const content = lines.map((line, index) => ({
        type: 'Row',
        props: {
          id: `row-${index}`,
          layout: line.layout,
          gap: 'md',
          verticalAlign: 'stretch',
        },
      }));

      setData({
        content,
        root: { props: {} },
      });
    }

    setMode('visual');
  };

  // Setup Mode - Configure page settings and layout structure
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

          <Button onClick={goToVisualEditor} disabled={!pageTitle.trim()}>
            <LayoutGrid className="h-4 w-4 mr-2" />
            Abrir Editor Visual
          </Button>
        </header>

        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {/* Page Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Informacoes da Pagina
              </CardTitle>
              <CardDescription>
                Configure o titulo, URL e descricao da pagina
              </CardDescription>
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
                      if (!pageSlug || pageSlug === generateSlug(pageTitle)) {
                        setPageSlug(generateSlug(e.target.value));
                      }
                    }}
                    placeholder="Ex: Dashboard, Relatorio de Vendas..."
                    className="text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">URL (Slug)</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">/</span>
                    <Input
                      id="slug"
                      value={pageSlug}
                      onChange={(e) => setPageSlug(generateSlug(e.target.value))}
                      placeholder="url-da-pagina"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descricao (opcional)</Label>
                <Textarea
                  id="description"
                  value={pageDescription}
                  onChange={(e) => setPageDescription(e.target.value)}
                  placeholder="Breve descricao do conteudo da pagina..."
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Layout Structure Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Columns className="h-5 w-5" />
                    Estrutura do Layout
                  </CardTitle>
                  <CardDescription>
                    Defina as linhas e colunas da pagina antes de adicionar conteudo
                  </CardDescription>
                </div>
                <Button onClick={() => addLine()} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Linha
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {lines.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/50">
                  <Columns className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Nenhuma linha definida</h3>
                  <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                    Adicione linhas para estruturar o layout da sua pagina.
                    Cada linha pode ter de 1 a 4 colunas.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {LAYOUT_PRESETS.slice(0, 4).map((preset) => (
                      <Button
                        key={preset.id}
                        variant="outline"
                        onClick={() => addLine(preset.id)}
                        className="h-auto py-3 px-4"
                      >
                        <div className="text-center">
                          <div className="text-lg font-mono mb-1">{preset.icon}</div>
                          <div className="text-xs">{preset.label}</div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {lines.map((line, index) => (
                    <div
                      key={line.id}
                      className="border rounded-lg bg-card overflow-hidden"
                    >
                      {/* Line Header */}
                      <div className="flex items-center gap-2 p-3 bg-muted/50 border-b">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <GripVertical className="h-4 w-4 cursor-grab" />
                          <span className="text-sm font-medium">Linha {index + 1}</span>
                        </div>

                        <Select
                          value={line.layout}
                          onValueChange={(value) => updateLineLayout(index, value)}
                        >
                          <SelectTrigger className="w-40 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LAYOUT_PRESETS.map((preset) => (
                              <SelectItem key={preset.id} value={preset.id}>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs">{preset.icon}</span>
                                  <span>{preset.label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <div className="flex-1" />

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => moveLine(index, 'up')}
                            disabled={index === 0}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => moveLine(index, 'down')}
                            disabled={index === lines.length - 1}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => removeLine(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Line Preview */}
                      <div className="p-3">
                        <div className="grid grid-cols-12 gap-2">
                          {line.columns.map((span, colIndex) => (
                            <div
                              key={colIndex}
                              className="h-16 rounded bg-muted/80 border-2 border-dashed border-muted-foreground/30 flex items-center justify-center"
                              style={{ gridColumn: `span ${span}` }}
                            >
                              <span className="text-xs text-muted-foreground font-medium">
                                Col {colIndex + 1} ({Math.round((span / 12) * 100)}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Add More Line Button */}
                  <Button
                    variant="outline"
                    className="w-full border-dashed"
                    onClick={() => addLine()}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar mais uma linha
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Tips */}
          <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900">
            <CardContent className="pt-6">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                Dicas de Layout
              </h4>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>Use <strong>1 coluna</strong> para titulos e textos longos</li>
                <li>Use <strong>2 colunas</strong> para formularios e dados lado a lado</li>
                <li>Use <strong>3 ou 4 colunas</strong> para cards de estatisticas</li>
                <li>Voce pode alterar o layout a qualquer momento no editor visual</li>
              </ul>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-4 border-t">
            <Link href="/pages">
              <Button variant="outline">Cancelar</Button>
            </Link>
            <Button
              size="lg"
              onClick={goToVisualEditor}
              disabled={!pageTitle.trim()}
            >
              <LayoutGrid className="h-4 w-4 mr-2" />
              Continuar para o Editor Visual
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Visual Editor Mode - Full Puck editor
  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="h-14 border-b bg-background flex items-center px-4 gap-4">
        <Button variant="ghost" size="sm" onClick={() => setMode('setup')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Configuracoes
        </Button>

        <div className="h-6 w-px bg-border" />

        <div className="flex-1 flex items-center gap-3">
          <span className="font-medium">{pageTitle}</span>
          <span className="text-sm text-muted-foreground">/{pageSlug}</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSave(data)}
            disabled={saving}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar Rascunho'}
          </Button>
        </div>
      </header>

      {/* Puck Editor */}
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

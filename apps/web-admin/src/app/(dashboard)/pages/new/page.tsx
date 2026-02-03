'use client';

import { useState, useCallback } from 'react';
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
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { puckConfig, initialData } from '@/lib/puck-config';
import api from '@/lib/api';
import type { Data } from '@measured/puck';

const Puck = dynamic(
  () => import('@measured/puck').then((mod) => mod.Puck),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-96">Carregando editor...</div> }
);

import '@measured/puck/puck.css';

// ============================================================================
// TYPES
// ============================================================================

interface RowItem {
  id: string;
  columns: number[]; // Array of column sizes (must sum to 12)
}

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
    // Redistribute to sum to 12
    const total = newCols.reduce((a, b) => a + b, 0);
    if (total > 12) {
      const excess = total - 12;
      newCols[0] = Math.max(1, newCols[0] - excess);
    }
    onUpdate(newCols);
  };

  const removeColumn = (colIndex: number) => {
    if (row.columns.length <= 1) return;
    const newCols = row.columns.filter((_, i) => i !== colIndex);
    // Redistribute removed space to first column
    const removed = row.columns[colIndex];
    newCols[0] = Math.min(12, newCols[0] + removed);
    onUpdate(newCols);
  };

  const updateColumnSize = (colIndex: number, newSize: number) => {
    const newCols = [...row.columns];
    const oldSize = newCols[colIndex];
    const diff = newSize - oldSize;

    // Find a column to take/give space
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
      {/* Header */}
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
        {/* Quick Presets */}
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

        {/* Visual Preview */}
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

        {/* Size Sliders */}
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
  const [mode, setMode] = useState<'setup' | 'visual'>('setup');
  const [pageTitle, setPageTitle] = useState('');
  const [pageSlug, setPageSlug] = useState('');
  const [pageBackground, setPageBackground] = useState('#FFFFFF');
  const [pageTextColor, setPageTextColor] = useState('#000000');
  const [data, setData] = useState<Data>(initialData);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<RowItem[]>([]);

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
  }, [pageTitle, pageSlug, pageBackground, pageTextColor, router]);

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
    if (!pageTitle.trim()) {
      alert('Por favor, preencha o titulo da pagina');
      return;
    }

    // Convert rows to Puck components
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

    setMode('visual');
  };

  // ========== SETUP MODE ==========
  if (mode === 'setup') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background">
        {/* Header */}
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
          <Button onClick={goToVisualEditor} disabled={!pageTitle.trim() || rows.length === 0}>
            Continuar
            <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
          </Button>
        </header>

        <div className="max-w-3xl mx-auto p-6 space-y-6">
          {/* Page Info */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Configuracoes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Title & Slug */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="title">Nome da pagina</Label>
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
                  <div className="flex items-center">
                    <span className="text-muted-foreground text-sm mr-1">/</span>
                    <Input
                      id="slug"
                      value={pageSlug}
                      onChange={(e) => setPageSlug(generateSlug(e.target.value))}
                      placeholder="cadastro-cliente"
                    />
                  </div>
                </div>
              </div>

              {/* Colors */}
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

          {/* Rows */}
          <div className="space-y-4">
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
                  Cada linha pode ter de 1 a 4 colunas. Voce pode ajustar o tamanho de cada coluna.
                </p>
                <div className="flex justify-center gap-2">
                  <Button onClick={() => addRow([12])} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    1 Coluna
                  </Button>
                  <Button onClick={() => addRow([6, 6])} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    2 Colunas
                  </Button>
                  <Button onClick={() => addRow([4, 4, 4])} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    3 Colunas
                  </Button>
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

                {/* Add more button */}
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

          {/* Actions */}
          {rows.length > 0 && (
            <div className="flex justify-end pt-4">
              <Button
                size="lg"
                onClick={goToVisualEditor}
                disabled={!pageTitle.trim()}
              >
                Continuar para Adicionar Campos
                <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
              </Button>
            </div>
          )}
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

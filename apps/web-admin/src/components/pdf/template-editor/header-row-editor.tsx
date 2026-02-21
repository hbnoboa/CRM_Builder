'use client';

import { useState, useRef } from 'react';
import {
  Plus,
  Trash2,
  Image,
  Type,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Upload,
  Loader2,
  AlertCircle,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import type { HeaderRow, HeaderElement } from '@/services/pdf-templates.service';

function generateId(): string {
  return `he_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

interface HeaderRowEditorProps {
  rows: HeaderRow[];
  onChange: (rows: HeaderRow[]) => void;
  availableFields?: Array<{ slug: string; name: string; label?: string; type: string }>;
}

export function HeaderRowEditor({ rows, onChange, availableFields = [] }: HeaderRowEditorProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [uploadingElement, setUploadingElement] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleAddRow = () => {
    const newRow: HeaderRow = {
      id: generateId(),
      elements: [],
      marginBottom: 10,
      verticalAlign: 'center',
    };
    onChange([...rows, newRow]);
    setExpandedRows((prev) => new Set([...prev, newRow.id]));
  };

  const handleRemoveRow = (rowId: string) => {
    onChange(rows.filter((r) => r.id !== rowId));
  };

  const handleUpdateRow = (rowId: string, updates: Partial<HeaderRow>) => {
    onChange(rows.map((r) => (r.id === rowId ? { ...r, ...updates } : r)));
  };

  const handleMoveRow = (rowId: string, direction: 'up' | 'down') => {
    const index = rows.findIndex((r) => r.id === rowId);
    if (index === -1) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= rows.length) return;
    const newRows = [...rows];
    [newRows[index], newRows[newIndex]] = [newRows[newIndex], newRows[index]];
    onChange(newRows);
  };

  const handleAddElement = (rowId: string, type: 'image' | 'text') => {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;

    const newElement: HeaderElement = {
      id: generateId(),
      type,
      position: row.elements.length === 0 ? 'left' : row.elements.length === 1 ? 'right' : 'center',
      ...(type === 'image'
        ? { width: 150, height: 60 }
        : { text: 'Texto', fontSize: 12, bold: false }),
    };

    handleUpdateRow(rowId, { elements: [...row.elements, newElement] });
  };

  const handleRemoveElement = (rowId: string, elementId: string) => {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    handleUpdateRow(rowId, { elements: row.elements.filter((e) => e.id !== elementId) });
  };

  const handleUpdateElement = (rowId: string, elementId: string, updates: Partial<HeaderElement>) => {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    handleUpdateRow(rowId, {
      elements: row.elements.map((e) => (e.id === elementId ? { ...e, ...updates } : e)),
    });
  };

  const handleFileUpload = async (rowId: string, elementId: string, file: File) => {
    setUploadError(null);
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Imagem muito grande (max 10MB)');
      return;
    }
    setUploadingElement(elementId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'logos');
      const response = await api.post('/upload/file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = response.data.publicUrl || response.data.url;
      handleUpdateElement(rowId, elementId, { url });
    } catch {
      setUploadError('Erro ao enviar imagem');
    } finally {
      setUploadingElement(null);
    }
  };

  const toggleExpanded = (rowId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
          <p className="mb-2">Nenhuma linha no header</p>
          <Button variant="outline" size="sm" onClick={handleAddRow}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar Linha
          </Button>
        </div>
      ) : (
        <>
          {rows.map((row, rowIndex) => {
            const isExpanded = expandedRows.has(row.id);

            return (
              <Card key={row.id}>
                <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(row.id)}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="p-3 cursor-pointer hover:bg-muted/50">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <span className="font-medium">Linha {rowIndex + 1}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {row.elements.length} elemento(s)
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveRow(row.id, 'up');
                            }}
                            disabled={rowIndex === 0}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveRow(row.id, 'down');
                            }}
                            disabled={rowIndex === rows.length - 1}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveRow(row.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-4 space-y-4">
                      {/* Elementos da linha */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">Elementos</Label>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Plus className="h-3 w-3 mr-1" />
                                Adicionar
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleAddElement(row.id, 'image')}>
                                <Image className="h-4 w-4 mr-2" />
                                Imagem
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAddElement(row.id, 'text')}>
                                <Type className="h-4 w-4 mr-2" />
                                Texto
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {row.elements.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4 border rounded">
                            Adicione imagens ou textos a esta linha
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {row.elements.map((element) => (
                              <div
                                key={element.id}
                                className="border rounded-lg p-3 space-y-3 bg-muted/30"
                              >
                                {/* Cabecalho do elemento */}
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {element.type === 'image' ? (
                                      <>
                                        <Image className="h-3 w-3 mr-1" />
                                        Imagem
                                      </>
                                    ) : (
                                      <>
                                        <Type className="h-3 w-3 mr-1" />
                                        Texto
                                      </>
                                    )}
                                  </Badge>
                                  <Select
                                    value={element.position}
                                    onValueChange={(value) =>
                                      handleUpdateElement(row.id, element.id, {
                                        position: value as 'left' | 'center' | 'right',
                                      })
                                    }
                                  >
                                    <SelectTrigger className="w-28 h-7 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="left">Esquerda</SelectItem>
                                      <SelectItem value="center">Centro</SelectItem>
                                      <SelectItem value="right">Direita</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <div className="flex-1" />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-destructive"
                                    onClick={() => handleRemoveElement(row.id, element.id)}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>

                                {/* Conteudo do elemento */}
                                {element.type === 'image' ? (
                                  <div className="space-y-2">
                                    {element.url ? (
                                      <div className="flex items-center gap-3">
                                        <img
                                          src={element.url}
                                          alt="Preview"
                                          className="max-h-12 max-w-[100px] object-contain border rounded"
                                        />
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="text-destructive text-xs"
                                          onClick={() =>
                                            handleUpdateElement(row.id, element.id, { url: undefined })
                                          }
                                        >
                                          <X className="h-3 w-3 mr-1" />
                                          Remover
                                        </Button>
                                      </div>
                                    ) : (
                                      <label
                                        className={cn(
                                          'flex items-center justify-center gap-2 border-2 border-dashed rounded p-3 cursor-pointer',
                                          'hover:border-primary/50 transition-colors',
                                          uploadingElement === element.id && 'pointer-events-none opacity-60'
                                        )}
                                      >
                                        <input
                                          type="file"
                                          accept="image/*"
                                          className="hidden"
                                          disabled={uploadingElement === element.id}
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleFileUpload(row.id, element.id, file);
                                            e.target.value = '';
                                          }}
                                        />
                                        {uploadingElement === element.id ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <>
                                            <Upload className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-xs text-muted-foreground">
                                              Upload imagem
                                            </span>
                                          </>
                                        )}
                                      </label>
                                    )}

                                    {/* Tamanho */}
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="space-y-1">
                                        <Label className="text-xs">Largura</Label>
                                        <div className="flex items-center gap-2">
                                          <Slider
                                            value={[element.width || 100]}
                                            onValueChange={([value]) =>
                                              handleUpdateElement(row.id, element.id, { width: value })
                                            }
                                            min={30}
                                            max={400}
                                            step={5}
                                            className="flex-1"
                                          />
                                          <span className="w-10 text-xs text-muted-foreground">
                                            {element.width || 100}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">Altura</Label>
                                        <div className="flex items-center gap-2">
                                          <Slider
                                            value={[element.height || 60]}
                                            onValueChange={([value]) =>
                                              handleUpdateElement(row.id, element.id, { height: value })
                                            }
                                            min={20}
                                            max={200}
                                            step={5}
                                            className="flex-1"
                                          />
                                          <span className="w-10 text-xs text-muted-foreground">
                                            {element.height || 60}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {/* Texto */}
                                    <div>
                                      <Input
                                        placeholder="Texto do elemento"
                                        value={element.text || ''}
                                        onChange={(e) =>
                                          handleUpdateElement(row.id, element.id, { text: e.target.value })
                                        }
                                        className="text-sm"
                                      />
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Use {'{{campo}}'} para dados dinamicos
                                      </p>
                                    </div>

                                    {/* Fonte e estilo */}
                                    <div className="flex items-center gap-3">
                                      <div className="flex-1 space-y-1">
                                        <Label className="text-xs">Tamanho</Label>
                                        <div className="flex items-center gap-2">
                                          <Slider
                                            value={[element.fontSize || 12]}
                                            onValueChange={([value]) =>
                                              handleUpdateElement(row.id, element.id, { fontSize: value })
                                            }
                                            min={8}
                                            max={24}
                                            step={1}
                                            className="flex-1"
                                          />
                                          <span className="w-8 text-xs text-muted-foreground">
                                            {element.fontSize || 12}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 pt-4">
                                        <Switch
                                          checked={element.bold || false}
                                          onCheckedChange={(checked) =>
                                            handleUpdateElement(row.id, element.id, { bold: checked })
                                          }
                                        />
                                        <span className="text-xs font-bold">B</span>
                                      </div>
                                    </div>

                                    {/* Borda */}
                                    <div className="flex items-center gap-3">
                                      <Switch
                                        checked={element.hasBorder || false}
                                        onCheckedChange={(checked) =>
                                          handleUpdateElement(row.id, element.id, { hasBorder: checked })
                                        }
                                      />
                                      <Label className="text-xs">Com borda (caixa)</Label>
                                      {element.hasBorder && (
                                        <div className="flex items-center gap-2 ml-auto">
                                          <Label className="text-xs">Padding</Label>
                                          <Slider
                                            value={[element.padding || 8]}
                                            onValueChange={([value]) =>
                                              handleUpdateElement(row.id, element.id, { padding: value })
                                            }
                                            min={2}
                                            max={20}
                                            step={1}
                                            className="w-20"
                                          />
                                          <span className="w-6 text-xs text-muted-foreground">
                                            {element.padding || 8}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Espacamento da linha */}
                      <div className="space-y-1">
                        <Label className="text-xs">Espaco abaixo da linha</Label>
                        <div className="flex items-center gap-2">
                          <Slider
                            value={[row.marginBottom || 10]}
                            onValueChange={([value]) =>
                              handleUpdateRow(row.id, { marginBottom: value })
                            }
                            min={0}
                            max={50}
                            step={5}
                            className="flex-1"
                          />
                          <span className="w-10 text-xs text-muted-foreground">
                            {row.marginBottom || 10}px
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}

          <Button variant="outline" className="w-full" onClick={handleAddRow}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Linha
          </Button>
        </>
      )}

      {uploadError && (
        <div className="flex items-center gap-2 text-sm text-red-500">
          <AlertCircle className="h-4 w-4" />
          {uploadError}
        </div>
      )}
    </div>
  );
}

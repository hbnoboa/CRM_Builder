'use client';

import { useState } from 'react';
import {
  Plus,
  GripVertical,
  Trash2,
  ChevronDown,
  ChevronUp,
  Type,
  Table,
  Image,
  Minus,
  BarChart3,
  LayoutGrid,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import type { PdfElement, ComputedField } from '@/services/pdf-templates.service';

// Element editors (appearance)
import { TextElementEditor } from './elements/text-element-editor';
import { FieldGroupElementEditor } from './elements/field-group-element-editor';
import { TableElementEditor } from './elements/table-element-editor';
import { ImageGridElementEditor } from './elements/image-grid-element-editor';
import { DividerElementEditor } from './elements/divider-element-editor';
import { SpacerElementEditor } from './elements/spacer-element-editor';
import { StatisticsElementEditor } from './elements/statistics-element-editor';

// Data editors
import { FieldGroupDataEditor } from './data-editors/field-group-data-editor';
import { TableDataEditor } from './data-editors/table-data-editor';
import { ImageGridDataEditor } from './data-editors/image-grid-data-editor';
import { StatisticsDataEditor } from './data-editors/statistics-data-editor';
import { VisibilityEditor } from './data-editors/visibility-editor';

interface ElementsTabProps {
  elements: PdfElement[];
  sourceEntity?: {
    id: string;
    name: string;
    slug: string;
    fields?: Array<{ slug: string; name: string; label?: string; type: string }>;
  };
  onChange: (elements: PdfElement[]) => void;
  subEntities?: Record<string, {
    id: string;
    name: string;
    slug: string;
    fields?: Array<{ slug: string; name: string; label?: string; type: string }>;
  }>;
  computedFields?: ComputedField[];
  templateType?: string;
}

const ELEMENT_TYPES = [
  { type: 'text', label: 'Texto', icon: Type, description: 'Texto estatico ou dinamico' },
  { type: 'field-group', label: 'Grupo de Campos', icon: LayoutGrid, description: 'Exibe varios campos' },
  { type: 'table', label: 'Tabela', icon: Table, description: 'Tabela com dados' },
  { type: 'image-grid', label: 'Grade de Imagens', icon: Image, description: 'Grid de imagens' },
  { type: 'statistics', label: 'Estatisticas', icon: BarChart3, description: 'Dados agrupados' },
  { type: 'divider', label: 'Divisor', icon: Minus, description: 'Linha horizontal' },
  { type: 'spacer', label: 'Espacador', icon: ChevronDown, description: 'Espaco em branco' },
] as const;

const SYSTEM_FIELDS = [
  { slug: 'createdAt', name: 'Data de Criacao', label: 'Data de Criacao', type: 'datetime' },
  { slug: 'updatedAt', name: 'Data de Atualizacao', label: 'Data de Atualizacao', type: 'datetime' },
  { slug: '_geolocation.lat', name: 'Latitude', label: 'Latitude', type: 'number' },
  { slug: '_geolocation.lng', name: 'Longitude', label: 'Longitude', type: 'number' },
  { slug: '_geolocation.city', name: 'Cidade (GPS)', label: 'Cidade (GPS)', type: 'text' },
  { slug: '_geolocation.uf', name: 'Estado (GPS)', label: 'Estado (GPS)', type: 'text' },
  { slug: '_geolocation.address', name: 'Endereco (GPS)', label: 'Endereco (GPS)', type: 'text' },
];

function generateId(): string {
  return `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function createDefaultElement(type: string): PdfElement {
  const id = generateId();

  switch (type) {
    case 'text':
      return {
        id,
        type: 'text',
        content: 'Texto de exemplo',
        fontSize: 10,
        fontWeight: 'normal',
        color: '#000000',
        align: 'left',
      };
    case 'field-group':
      return {
        id,
        type: 'field-group',
        layout: 'horizontal',
        fields: [
          { label: 'Campo:', binding: '{{campo}}', labelBold: true },
        ],
      };
    case 'table':
      return {
        id,
        type: 'table',
        title: 'Tabela',
        columns: [
          { field: 'coluna1', header: 'Coluna 1', width: 100, align: 'left' },
          { field: 'coluna2', header: 'Coluna 2', width: 100, align: 'left' },
        ],
        showHeader: true,
        headerStyle: { bold: true, fontSize: 9 },
        cellStyle: { fontSize: 8 },
      };
    case 'image-grid':
      return {
        id,
        type: 'image-grid',
        columns: 4,
        dataSource: 'imagens',
        imageWidth: 90,
        imageHeight: 68,
        showCaptions: false,
      };
    case 'statistics':
      return {
        id,
        type: 'statistics',
        title: 'Estatisticas',
        groupBy: ['campo'],
        metrics: [
          { field: '_count', aggregation: 'count', label: 'Total' },
        ],
      };
    case 'divider':
      return {
        id,
        type: 'divider',
        color: '#cccccc',
        thickness: 1,
      };
    case 'spacer':
      return {
        id,
        type: 'spacer',
        height: 20,
      };
    default:
      return {
        id,
        type: 'text',
        content: 'Elemento desconhecido',
      } as PdfElement;
  }
}

function getElementIcon(type: string) {
  const found = ELEMENT_TYPES.find((t) => t.type === type);
  return found ? found.icon : Type;
}

function getElementLabel(type: string) {
  const found = ELEMENT_TYPES.find((t) => t.type === type);
  return found ? found.label : type;
}

const DATA_ELEMENT_TYPES = ['field-group', 'table', 'image-grid', 'statistics'] as const;

function hasDataEditor(type: string): boolean {
  return DATA_ELEMENT_TYPES.includes(type as (typeof DATA_ELEMENT_TYPES)[number]);
}

export function ElementsTab({
  elements,
  sourceEntity,
  onChange,
  subEntities,
  computedFields,
  templateType,
}: ElementsTabProps) {
  const [expandedElements, setExpandedElements] = useState<Set<string>>(new Set());

  const availableFields = [...(sourceEntity?.fields || []), ...SYSTEM_FIELDS];

  const handleAddElement = (type: string) => {
    const newElement = createDefaultElement(type);
    onChange([...elements, newElement]);
    setExpandedElements((prev) => new Set([...prev, newElement.id]));
  };

  const handleRemoveElement = (id: string) => {
    onChange(elements.filter((el) => el.id !== id));
    setExpandedElements((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleUpdateElement = (id: string, updates: Partial<PdfElement>) => {
    onChange(
      elements.map((el) => (el.id === id ? { ...el, ...updates } : el))
    );
  };

  const handleMoveElement = (id: string, direction: 'up' | 'down') => {
    const index = elements.findIndex((el) => el.id === id);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= elements.length) return;

    const newElements = [...elements];
    [newElements[index], newElements[newIndex]] = [newElements[newIndex], newElements[index]];
    onChange(newElements);
  };

  const toggleExpanded = (id: string) => {
    setExpandedElements((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Header com botao de adicionar */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Elementos do PDF</h3>
          <p className="text-sm text-muted-foreground">
            Cada elemento vira uma secao do documento
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {ELEMENT_TYPES.map((type) => (
              <DropdownMenuItem
                key={type.type}
                onClick={() => handleAddElement(type.type)}
                className="flex items-center gap-2"
              >
                <type.icon className="h-4 w-4" />
                <div>
                  <div className="font-medium">{type.label}</div>
                  <div className="text-xs text-muted-foreground">{type.description}</div>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Lista de elementos */}
      {elements.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground mb-4">
              Nenhum elemento adicionado ainda. Clique em &quot;Adicionar&quot; para comecar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {elements.map((element, index) => {
            const Icon = getElementIcon(element.type);
            const isExpanded = expandedElements.has(element.id);

            return (
              <Card key={element.id}>
                <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(element.id)}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="p-3 cursor-pointer hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                        <Icon className="h-4 w-4" />
                        <div className="flex-1 text-left min-w-0">
                          <span className="font-medium">{getElementLabel(element.type)}</span>
                          {element.type === 'text' && (
                            <span className="ml-2 text-sm text-muted-foreground truncate">
                              {(element as { content?: string }).content?.slice(0, 30)}...
                            </span>
                          )}
                          {element.type === 'table' && (
                            <span className="ml-2 text-sm text-muted-foreground">
                              {(element as { title?: string }).title}
                            </span>
                          )}
                        </div>
                        {element.visibility && (
                          <Badge variant="secondary" className="text-xs flex-shrink-0">
                            Condicional
                          </Badge>
                        )}
                        {templateType === 'batch' && element.repeatPerRecord && (
                          <Badge variant="secondary" className="text-xs flex-shrink-0 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                            Repete
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          #{index + 1}
                        </Badge>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveElement(element.id, 'up');
                            }}
                            disabled={index === 0}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveElement(element.id, 'down');
                            }}
                            disabled={index === elements.length - 1}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveElement(element.id);
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
                      {/* Aparencia */}
                      {element.type === 'text' && (
                        <TextElementEditor
                          element={element}
                          onChange={(updates) => handleUpdateElement(element.id, updates)}
                          availableFields={availableFields}
                        />
                      )}
                      {element.type === 'field-group' && (
                        <FieldGroupElementEditor
                          element={element}
                          onChange={(updates) => handleUpdateElement(element.id, updates)}
                        />
                      )}
                      {element.type === 'table' && (
                        <TableElementEditor
                          element={element}
                          onChange={(updates) => handleUpdateElement(element.id, updates)}
                        />
                      )}
                      {element.type === 'image-grid' && (
                        <ImageGridElementEditor
                          element={element}
                          onChange={(updates) => handleUpdateElement(element.id, updates)}
                        />
                      )}
                      {element.type === 'statistics' && (
                        <StatisticsElementEditor
                          element={element}
                          onChange={(updates) => handleUpdateElement(element.id, updates)}
                        />
                      )}
                      {element.type === 'divider' && (
                        <DividerElementEditor
                          element={element}
                          onChange={(updates) => handleUpdateElement(element.id, updates)}
                        />
                      )}
                      {element.type === 'spacer' && (
                        <SpacerElementEditor
                          element={element}
                          onChange={(updates) => handleUpdateElement(element.id, updates)}
                        />
                      )}

                      {/* Dados - separados por divider */}
                      {hasDataEditor(element.type) && (
                        <div className="border-t pt-4 space-y-4">
                          <h4 className="text-sm font-medium text-muted-foreground">Dados</h4>

                          {element.type === 'field-group' && (
                            <FieldGroupDataEditor
                              element={element}
                              onChange={(updates) => handleUpdateElement(element.id, updates)}
                              availableFields={availableFields}
                              isBatch={templateType === 'batch'}
                              computedFields={computedFields}
                            />
                          )}
                          {element.type === 'table' && (
                            <TableDataEditor
                              element={element}
                              onChange={(updates) => handleUpdateElement(element.id, updates)}
                              availableFields={availableFields}
                              subEntities={subEntities}
                            />
                          )}
                          {element.type === 'image-grid' && (
                            <ImageGridDataEditor
                              element={element}
                              onChange={(updates) => handleUpdateElement(element.id, updates)}
                              availableFields={availableFields}
                              subEntities={subEntities}
                            />
                          )}
                          {element.type === 'statistics' && (
                            <StatisticsDataEditor
                              element={element}
                              onChange={(updates) => handleUpdateElement(element.id, updates)}
                              availableFields={availableFields}
                            />
                          )}
                        </div>
                      )}

                      {/* Visibilidade condicional - para todos os elementos */}
                      <div className="border-t pt-4">
                        <VisibilityEditor
                          visibility={element.visibility}
                          onChange={(v) => handleUpdateElement(element.id, { visibility: v } as Partial<PdfElement>)}
                          availableFields={availableFields}
                        />
                      </div>

                      {/* Repetir por registro - apenas para batch */}
                      {templateType === 'batch' && (
                        <div className="border-t pt-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-sm font-medium">Repetir por registro</h4>
                              <p className="text-xs text-muted-foreground">
                                Renderiza este elemento para cada registro do lote
                              </p>
                            </div>
                            <Switch
                              checked={!!element.repeatPerRecord}
                              onCheckedChange={(checked) =>
                                handleUpdateElement(element.id, { repeatPerRecord: checked } as Partial<PdfElement>)
                              }
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}

      {/* Campos disponiveis */}
      {availableFields.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="text-sm font-medium">Campos Disponiveis</div>
            <p className="text-xs text-muted-foreground">
              Clique para copiar o codigo do campo
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {availableFields.map((field) => (
                <Badge
                  key={field.slug}
                  variant="outline"
                  className="cursor-pointer hover:bg-muted"
                  onClick={() => {
                    navigator.clipboard.writeText(`{{${field.slug}}}`);
                  }}
                >
                  {field.label || field.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

'use client';

import { useMemo, useCallback, useEffect, useState } from 'react';
import { useEntityData, EntityDataProvider } from '@/components/entity-data/entity-data-context';
import { useUpdateEntityData } from '@/hooks/use-data';
import { WidgetWrapper } from './widget-wrapper';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface KanbanBoardWidgetProps {
  entitySlug: string;
  title?: string;
  config: {
    groupByField: string;
    cardTitleField: string;
    cardSubtitleFields?: string[];
    cardBadgeField?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    columnOrder?: string[];
  };
  entityFields?: Array<{
    slug: string;
    name: string;
    label?: string;
    type: string;
    options?: Array<{ label: string; value: string }> | string[];
  }>;
}

interface KanbanCard {
  id: string;
  [key: string]: unknown;
}

interface KanbanColumn {
  title: string;
  value: string;
  cards: KanbanCard[];
  count: number;
  colIndex: number;
}

// Extrair valor de exibição de um campo (pode ser string, objeto, etc.)
function getDisplayValue(value: unknown, showDashIfEmpty = false): string {
  if (value === null || value === undefined || value === '') return showDashIfEmpty ? '-' : '';

  // Se for objeto, tentar extrair label/name/nome (campos de relação retornam { value, label })
  if (typeof value === 'object' && value !== null) {
    const obj = value as any;
    const extracted = obj.label || obj.name || obj.nome || obj.title || obj.value || '';

    // Se extraiu um valor, verificar se não é um ID técnico
    if (extracted && typeof extracted === 'string') {
      const str = extracted.trim();
      // Se for ID técnico, não mostrar
      if (
        str.length > 15 &&
        (/^[a-z]{2}[a-z0-9]{15,}$/i.test(str) ||
         /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(str))
      ) {
        return showDashIfEmpty ? '-' : '';
      }
      return str;
    }

    return showDashIfEmpty ? '-' : '';
  }

  const strValue = String(value).trim();

  // Detectar IDs técnicos (cuid/nanoid/uuid) - não mostrar IDs diretamente
  if (
    strValue.length > 15 &&
    (/^[a-z]{2}[a-z0-9]{15,}$/i.test(strValue) ||
     /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(strValue))
  ) {
    return showDashIfEmpty ? '-' : '';
  }

  return strValue || (showDashIfEmpty ? '-' : '');
}

// Normalizar opções: suporta array de strings ou array de objetos
function normalizeOptions(
  options?: Array<{ label: string; value: string }> | string[],
  fieldType?: string
): Array<{ label: string; value: string }> {
  if (fieldType === 'checkbox') {
    return [
      { label: '✓ Sim', value: 'true' },
      { label: '✗ Não', value: 'false' },
    ];
  }

  if (fieldType === 'relation') {
    return [];
  }

  if (!options || options.length === 0) return [];

  if (typeof options[0] === 'string') {
    return (options as string[]).map((opt) => ({ label: opt, value: opt }));
  }

  return options as Array<{ label: string; value: string }>;
}

function KanbanCardItem({
  card,
  config,
  columnValue
}: {
  card: KanbanCard;
  config: KanbanBoardWidgetProps['config'];
  columnValue: string;
}) {
  const cardData = (card as any).data || card;

  // 🔍 LOG 1: Ver dados do card ao renderizar
  console.log('[Kanban Card Render]', {
    cardId: (card as any).id,
    columnValue,
    cardTitleField: config.cardTitleField,
    titleValue: cardData[config.cardTitleField],
    cardDataKeys: Object.keys(cardData),
    fullCardData: cardData,
  });

  const title = getDisplayValue(cardData[config.cardTitleField], true) || (card as any).id || '-';
  const subtitles = config.cardSubtitleFields?.map((field) => {
    const value = cardData[field];
    const displayValue = getDisplayValue(value, true);

    // 🔍 LOG 2: Ver cada subtitle individualmente
    console.log('[Kanban Subtitle]', {
      field,
      rawValue: value,
      displayValue,
    });

    return displayValue;
  }) || [];
  const badge = config.cardBadgeField ? getDisplayValue(cardData[config.cardBadgeField]) : null;

  const getBadgeVariant = (value: string) => {
    const lower = value.toLowerCase();
    if (lower.includes('urgente') || lower.includes('alta') || lower.includes('high')) return 'destructive';
    if (lower.includes('média') || lower.includes('medium')) return 'default';
    if (lower.includes('baixa') || lower.includes('low')) return 'secondary';
    return 'outline';
  };

  return (
    <Card className="p-4 hover:shadow-md transition-shadow min-h-[100px] h-full cursor-move">
      <div className="flex items-start gap-3 h-full">
        <GripVertical className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm mb-2 truncate">{title}</div>
          {subtitles.length > 0 && (
            <div className="text-xs text-muted-foreground space-y-1">
              {subtitles.map((subtitle, idx) => (
                <div key={idx} className="truncate">{subtitle}</div>
              ))}
            </div>
          )}
          {badge && (
            <div className="mt-2">
              <Badge variant={getBadgeVariant(badge)} className="text-xs">
                {badge}
              </Badge>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function KanbanBoardContent({ entitySlug, title, config, entityFields }: KanbanBoardWidgetProps) {
  const { sortedRecords: data, isLoading, updateRecord } = useEntityData();
  const [layouts, setLayouts] = useState<{ lg: any[]; md?: any[]; sm?: any[] }>({ lg: [] });
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const updateMutation = useUpdateEntityData({
    success: 'Status atualizado com sucesso!',
  });

  // Buscar campo de agrupamento e suas opções
  const groupField = useMemo(() => {
    return entityFields?.find((f) => f.slug === config.groupByField);
  }, [entityFields, config.groupByField]);

  const fieldOptions = useMemo(() => {
    return normalizeOptions(groupField?.options, groupField?.type);
  }, [groupField]);

  const isValidGroupField = useMemo(() => {
    if (!groupField) return false;
    const validTypes = ['select', 'radio', 'checkbox', 'relation'];
    return validTypes.includes(groupField.type);
  }, [groupField]);

  // Agrupar cards por coluna e gerar layout
  const { columns, gridLayout, cardColumnMap } = useMemo(() => {
    // 🔍 LOG 4: Ver quando columns é recalculado
    console.log('[Kanban useMemo Recalculate]', {
      dataLength: data?.length,
      isValidGroupField,
      sampleRecord: data?.[0],
    });

    if (!data || !Array.isArray(data) || !isValidGroupField) {
      return { columns: [], gridLayout: [], cardColumnMap: new Map() };
    }

    const records = data.slice(0, config.limit || 100) as KanbanCard[];

    // Criar mapa de registros por valor
    const recordsByValue = new Map<string, KanbanCard[]>();
    records.forEach((record: any) => {
      const recordData = record.data || record;
      let groupValue = recordData[config.groupByField];

      if (groupField?.type === 'checkbox') {
        groupValue = groupValue === true || groupValue === 'true' ? 'true' : 'false';
      } else {
        groupValue = String(groupValue || '');
      }

      if (!recordsByValue.has(groupValue)) {
        recordsByValue.set(groupValue, []);
      }
      recordsByValue.get(groupValue)!.push(record);
    });

    // Ordenar cards dentro de cada grupo
    recordsByValue.forEach((cards) => {
      if (config.sortBy) {
        cards.sort((a, b) => {
          const aVal = a[config.sortBy!];
          const bVal = b[config.sortBy!];
          const order = config.sortOrder === 'asc' ? 1 : -1;

          if (aVal === bVal) return 0;
          if (aVal === null || aVal === undefined) return 1;
          if (bVal === null || bVal === undefined) return -1;

          return (aVal < bVal ? -1 : 1) * order;
        });
      }
    });

    // Criar colunas
    let orderedValues: string[];
    let optionsMap: Map<string, string>;

    if (groupField?.type === 'relation') {
      orderedValues = Array.from(recordsByValue.keys()).filter((v) => v && v !== '');
      optionsMap = new Map(orderedValues.map((v) => [v, v]));
    } else {
      if (fieldOptions.length === 0) {
        return { columns: [], gridLayout: [], cardColumnMap: new Map() };
      }

      const allOptionValues = fieldOptions.map((opt) => opt.value);
      optionsMap = new Map(fieldOptions.map((opt) => [opt.value, opt.label]));

      orderedValues = config.columnOrder && config.columnOrder.length > 0
        ? config.columnOrder
        : allOptionValues;
    }

    const cols: KanbanColumn[] = orderedValues.map((value, colIndex) => {
      const cards = recordsByValue.get(value) || [];
      const label = optionsMap.get(value) || value;

      return {
        title: label,
        value,
        cards,
        count: cards.length,
        colIndex,
      };
    });

    // Gerar layout do grid
    // Usar o número de colunas Kanban como base para o grid (100% de aproveitamento)
    const numColumns = cols.length;
    const colWidth = 1; // Cada coluna Kanban ocupa 1 unidade do grid

    const layout: any[] = [];
    const columnMap = new Map<string, string>(); // cardId -> columnValue

    cols.forEach((col) => {
      const xPos = col.colIndex * colWidth;

      col.cards.forEach((card, cardIndex) => {
        layout.push({
          i: card.id,
          x: xPos,
          y: cardIndex,
          w: colWidth,
          h: 1,
          minW: colWidth,
          maxW: colWidth,
        });

        columnMap.set(card.id, col.value);
      });
    });

    return { columns: cols, gridLayout: layout, cardColumnMap: columnMap };
  }, [data, config, isValidGroupField, fieldOptions, groupField]);

  // Calcular número de colunas do grid baseado nas colunas do Kanban
  const gridCols = useMemo(() => {
    const numCols = columns.length || 1;
    return {
      lg: numCols,
      md: Math.min(numCols, 10),
      sm: Math.min(numCols, 6),
    };
  }, [columns.length]);

  // Atualizar layouts quando gridLayout mudar
  useEffect(() => {
    if (gridLayout.length > 0) {
      setLayouts({
        lg: gridLayout,
        md: gridLayout.map((item) => ({
          ...item,
          w: 1,
        })),
        sm: gridLayout.map((item) => ({
          ...item,
          w: 1,
          x: item.x % gridCols.sm,
        })),
      });
      // Marcar como carregado após definir o layout inicial
      setTimeout(() => setIsInitialLoad(false), 100);
    }
  }, [gridLayout, gridCols.sm]);

  // Handler durante o drag para restringir movimento às colunas
  const handleDrag = useCallback(
    (_layout: any[], _oldItem: any, newItem: any, _placeholder: any, _event: MouseEvent, _element: HTMLElement) => {
      if (!columns || columns.length === 0) return;

      const numColumns = columns.length;
      const colWidth = 1; // Cada coluna ocupa 1 unidade

      // Calcular a coluna mais próxima
      const targetColIndex = Math.round(newItem.x / colWidth);
      const clampedColIndex = Math.max(0, Math.min(targetColIndex, numColumns - 1));

      // Forçar X para a posição exata da coluna
      newItem.x = clampedColIndex * colWidth;
      newItem.w = colWidth;
    },
    [columns]
  );

  // Handler para mudança de layout (drag & drop)
  const handleLayoutChange = useCallback(
    (newLayout: any[]) => {
      // Ignorar mudanças durante o carregamento inicial
      if (isInitialLoad) return;
      if (!columns || columns.length === 0) return;

      const numColumns = columns.length;
      const colWidth = 1; // Cada coluna ocupa 1 unidade

      // Verificar se algum card mudou de coluna
      newLayout.forEach((item) => {
        const cardId = item.i;
        const newColIndex = Math.floor(item.x / colWidth);

        // Garantir que está dentro do range
        const clampedColIndex = Math.max(0, Math.min(newColIndex, numColumns - 1));
        const targetColumn = columns[clampedColIndex];

        if (!targetColumn) return;

        const currentColumnValue = cardColumnMap.get(cardId);

        // Se mudou de coluna, atualizar via API
        if (currentColumnValue && currentColumnValue !== targetColumn.value) {
          // 🔍 LOG 3: Ver o que está sendo atualizado
          console.log('[Kanban Update]', {
            cardId,
            groupByField: config.groupByField,
            from: currentColumnValue,
            to: targetColumn.value,
            updateData: { [config.groupByField]: targetColumn.value },
          });

          // Update otimista: atualizar localmente ANTES da API responder
          updateRecord(cardId, {
            [config.groupByField]: targetColumn.value,
          });

          // Enviar update para a API
          updateMutation.mutate({
            entitySlug,
            id: cardId,
            data: {
              [config.groupByField]: targetColumn.value,
            },
          });

          toast.success(`Movido para "${targetColumn.title}"`);
        }
      });
    },
    [isInitialLoad, columns, cardColumnMap, config.groupByField, entitySlug, updateMutation]
  );

  if (isLoading) {
    return (
      <WidgetWrapper title={title}>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 min-w-[280px] max-w-[350px]">
              <div className="bg-muted/50 rounded-lg p-3 h-full flex flex-col">
                <div className="flex items-center justify-between mb-3 pb-2 border-b">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-8" />
                </div>
                <div className="space-y-2">
                  {[1, 2].map((j) => (
                    <Card key={j} className="p-4 min-h-[100px]">
                      <div className="flex items-start gap-3">
                        <Skeleton className="h-5 w-5" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-3 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </WidgetWrapper>
    );
  }

  if (!isValidGroupField) {
    return (
      <WidgetWrapper title={title}>
        <div className="text-center text-sm text-muted-foreground py-8">
          ⚠️ O campo "{config.groupByField}" deve ser do tipo Select, Radio, Checkbox ou Relação para usar no Kanban
        </div>
      </WidgetWrapper>
    );
  }

  if (groupField?.type !== 'relation' && fieldOptions.length === 0) {
    return (
      <WidgetWrapper title={title}>
        <div className="text-center text-sm text-muted-foreground py-8">
          ⚠️ O campo "{config.groupByField}" não possui opções configuradas
        </div>
      </WidgetWrapper>
    );
  }

  if (columns.length === 0) {
    return (
      <WidgetWrapper title={title}>
        <div className="text-center text-sm text-muted-foreground py-8">
          Nenhum dado disponível
        </div>
      </WidgetWrapper>
    );
  }

  return (
    <WidgetWrapper title={title}>
      <div className="flex pb-2 relative overflow-x-auto overflow-y-auto max-h-[800px]">
        {/* Headers das colunas */}
        <div className="absolute top-0 left-0 right-0 flex gap-2 z-10 pointer-events-none">
          {columns.map((column) => (
            <div
              key={column.value}
              className="flex-1"
              style={{ width: `${100 / columns.length}%` }}
            >
              <div className="bg-muted/50 rounded-lg p-3 shadow-sm mb-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm truncate">{column.title}</h3>
                  <Badge variant="secondary" className="ml-2 flex-shrink-0">
                    {column.count}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Grid com cards */}
        <div className="w-full mt-20">
          <ResponsiveGridLayout
            className="layout"
            layouts={layouts}
            breakpoints={{ lg: 1200, md: 996, sm: 768 }}
            cols={gridCols}
            rowHeight={120}
            margin={[8, 12]}
            isDraggable={true}
            isResizable={false}
            compactType="vertical"
            containerPadding={[0, 0]}
            preventCollision={false}
            onDrag={handleDrag}
            onLayoutChange={handleLayoutChange}
          >
            {columns.flatMap((column) =>
              column.cards.map((card) => (
                <div key={card.id}>
                  <KanbanCardItem
                    card={card}
                    config={config}
                    columnValue={column.value}
                  />
                </div>
              ))
            )}
          </ResponsiveGridLayout>
        </div>
      </div>
    </WidgetWrapper>
  );
}

export function KanbanBoardWidget(props: KanbanBoardWidgetProps) {
  return (
    <EntityDataProvider entitySlug={props.entitySlug}>
      <KanbanBoardContent {...props} />
    </EntityDataProvider>
  );
}

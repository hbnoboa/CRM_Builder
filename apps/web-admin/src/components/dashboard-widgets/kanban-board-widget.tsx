'use client';

import { useMemo, useState } from 'react';
import { useEntityData } from '@/components/entity-data/entity-data-context';
import { WidgetWrapper } from './widget-wrapper';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Loader2, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
    columnOrder?: string[]; // ordem específica das colunas
  };
}

interface KanbanCard {
  id: string;
  [key: string]: unknown;
}

function KanbanCardItem({ card, config }: { card: KanbanCard; config: KanbanBoardWidgetProps['config'] }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const title = String(card[config.cardTitleField] || card.id || '');
  const subtitles = config.cardSubtitleFields?.map((field) => String(card[field] || '')).filter(Boolean) || [];
  const badge = config.cardBadgeField ? String(card[config.cardBadgeField] || '') : null;

  // Badge color por prioridade
  const getBadgeVariant = (value: string) => {
    const lower = value.toLowerCase();
    if (lower.includes('urgente') || lower.includes('alta') || lower.includes('high')) return 'destructive';
    if (lower.includes('média') || lower.includes('medium')) return 'default';
    if (lower.includes('baixa') || lower.includes('low')) return 'secondary';
    return 'outline';
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'mb-2 cursor-move',
        isDragging && 'opacity-50'
      )}
      {...attributes}
      {...listeners}
    >
      <Card className="p-3 hover:shadow-md transition-shadow">
        <div className="flex items-start gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm mb-1 truncate">{title}</div>
            {subtitles.length > 0 && (
              <div className="text-xs text-muted-foreground space-y-0.5">
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
    </div>
  );
}

function KanbanColumn({
  title,
  cards,
  count,
  config,
}: {
  title: string;
  cards: KanbanCard[];
  count: number;
  config: KanbanBoardWidgetProps['config'];
}) {
  const columnId = `column-${title}`;

  return (
    <div className="flex-1 min-w-[280px] max-w-[350px]">
      <div className="bg-muted/50 rounded-lg p-3 h-full flex flex-col">
        <div className="flex items-center justify-between mb-3 pb-2 border-b">
          <h3 className="font-semibold text-sm truncate">{title}</h3>
          <Badge variant="secondary" className="ml-2 flex-shrink-0">
            {count}
          </Badge>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1" style={{ maxHeight: '600px' }}>
          <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {cards.map((card) => (
              <KanbanCardItem key={card.id} card={card} config={config} />
            ))}
          </SortableContext>

          {cards.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-8">
              Nenhum item
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function KanbanBoardWidget({ entitySlug, title, config }: KanbanBoardWidgetProps) {
  const { data, isLoading } = useEntityData();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Agrupar cards por coluna
  const { columns, allCards } = useMemo(() => {
    if (!data || !Array.isArray(data)) return { columns: [], allCards: [] };

    const records = data.slice(0, config.limit || 100) as KanbanCard[];

    // Agrupar por campo
    const groups = new Map<string, KanbanCard[]>();
    records.forEach((record) => {
      const groupValue = String(record[config.groupByField] || 'Sem Status');
      if (!groups.has(groupValue)) {
        groups.set(groupValue, []);
      }
      groups.get(groupValue)!.push(record);
    });

    // Ordenar cards dentro de cada grupo
    groups.forEach((cards) => {
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

    // Converter para array de colunas
    let cols = Array.from(groups.entries()).map(([title, cards]) => ({
      title,
      cards,
      count: cards.length,
    }));

    // Aplicar ordem customizada de colunas se fornecida
    if (config.columnOrder && config.columnOrder.length > 0) {
      const orderedCols: typeof cols = [];
      const colsMap = new Map(cols.map((c) => [c.title, c]));

      config.columnOrder.forEach((colTitle) => {
        const col = colsMap.get(colTitle);
        if (col) {
          orderedCols.push(col);
          colsMap.delete(colTitle);
        }
      });

      // Adicionar colunas não especificadas no final
      colsMap.forEach((col) => orderedCols.push(col));
      cols = orderedCols;
    }

    return { columns: cols, allCards: records };
  }, [data, config]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);

    // TODO: Implementar atualização do status via API
    // const { active, over } = event;
    // if (over && active.id !== over.id) {
    //   // Atualizar registro movendo entre colunas
    //   updateRecord(active.id, { [config.groupByField]: over.id });
    // }
  };

  const activeCard = activeId ? allCards.find((c) => c.id === activeId) : null;

  if (isLoading) {
    return (
      <WidgetWrapper title={title}>
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {columns.map((column) => (
            <KanbanColumn
              key={column.title}
              title={column.title}
              cards={column.cards}
              count={column.count}
              config={config}
            />
          ))}
        </div>

        <DragOverlay>
          {activeCard ? (
            <Card className="p-3 shadow-lg opacity-90 w-[280px]">
              <div className="flex items-start gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="font-medium text-sm">
                    {String(activeCard[config.cardTitleField] || activeCard.id)}
                  </div>
                </div>
              </div>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>
    </WidgetWrapper>
  );
}

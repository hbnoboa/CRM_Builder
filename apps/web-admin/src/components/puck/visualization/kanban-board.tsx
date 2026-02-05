'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { GripVertical, MoreHorizontal, Plus } from 'lucide-react';

export interface KanbanColumn {
  id: string;
  title: string;
  color?: string;
}

export interface KanbanCard {
  id: string;
  title: string;
  description?: string;
  column: string;
}

export interface KanbanBoardProps {
  columns: KanbanColumn[];
  entitySlug?: string;
  statusField?: string;
  titleField?: string;
  descriptionField?: string;
}

// Sample data for preview
const sampleCards: KanbanCard[] = [
  { id: '1', title: 'Lead: João Silva', description: 'Primeiro contato', column: 'novo' },
  { id: '2', title: 'Lead: Maria Santos', description: 'Aguardando retorno', column: 'contato' },
  { id: '3', title: 'Proposta: Empresa X', description: 'R$ 15.000', column: 'negociacao' },
  { id: '4', title: 'Contrato: Empresa Y', description: 'Fechado!', column: 'ganho' },
];

export function KanbanBoard({ columns, entitySlug, statusField, titleField, descriptionField }: KanbanBoardProps) {
  const safeColumns = Array.isArray(columns) ? columns : [];
  const [cards] = useState(sampleCards);

  const getColumnCards = (columnId: string) => {
    return cards.filter(card => card.column === columnId);
  };

  const getColumnColor = (color?: string) => {
    const colors: Record<string, string> = {
      blue: 'bg-blue-500',
      green: 'bg-green-500',
      yellow: 'bg-yellow-500',
      red: 'bg-red-500',
      purple: 'bg-purple-500',
      gray: 'bg-gray-500',
      orange: 'bg-orange-500',
      pink: 'bg-pink-500',
    };
    return colors[color || 'gray'] || 'bg-gray-500';
  };

  if (safeColumns.length === 0) {
    return (
      <div className="border rounded-lg p-8 bg-muted/50 text-center">
        <p className="text-muted-foreground">
          📋 Configure as colunas do Kanban
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Adicione colunas para representar os estágios do seu pipeline
        </p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex gap-4 min-w-max p-4">
        {safeColumns.map((column) => {
          const columnCards = getColumnCards(column.id);
          return (
            <div
              key={column.id}
              className="w-72 flex-shrink-0 bg-muted/30 rounded-lg"
            >
              {/* Column Header */}
              <div className="p-3 flex items-center justify-between border-b">
                <div className="flex items-center gap-2">
                  <div className={cn('w-3 h-3 rounded-full', getColumnColor(column.color))} />
                  <span className="font-medium text-sm">{column.title}</span>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {columnCards.length}
                  </span>
                </div>
                <button className="p-1 hover:bg-muted rounded">
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              {/* Cards */}
              <div className="p-2 space-y-2 min-h-[200px]">
                {columnCards.map((card) => (
                  <div
                    key={card.id}
                    className="bg-background border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{card.title}</p>
                        {card.description && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {card.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add Card Button */}
                <button className="w-full p-2 text-sm text-muted-foreground hover:bg-muted rounded-lg flex items-center justify-center gap-1 transition-colors">
                  <Plus className="h-4 w-4" />
                  Adicionar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function KanbanBoardPreview({ columns, entitySlug }: KanbanBoardProps) {
  const safeColumns = Array.isArray(columns) ? columns : [];

  return (
    <div className="border rounded-lg p-4 bg-muted/50">
      <p className="text-center text-muted-foreground mb-3">
        📋 Kanban Board
        {entitySlug && <span className="font-medium"> - {entitySlug}</span>}
      </p>
      <div className="flex gap-2 justify-center overflow-x-auto">
        {safeColumns.length > 0 ? (
          safeColumns.map((col, idx) => (
            <div
              key={idx}
              className="flex-shrink-0 w-24 h-16 bg-background border rounded flex items-center justify-center text-xs text-center px-1"
            >
              {col?.title || `Col ${idx + 1}`}
            </div>
          ))
        ) : (
          <>
            <div className="flex-shrink-0 w-20 h-12 bg-blue-100 border border-blue-300 rounded flex items-center justify-center text-xs">
              Novo
            </div>
            <div className="flex-shrink-0 w-20 h-12 bg-yellow-100 border border-yellow-300 rounded flex items-center justify-center text-xs">
              Em Progresso
            </div>
            <div className="flex-shrink-0 w-20 h-12 bg-green-100 border border-green-300 rounded flex items-center justify-center text-xs">
              Concluído
            </div>
          </>
        )}
      </div>
    </div>
  );
}

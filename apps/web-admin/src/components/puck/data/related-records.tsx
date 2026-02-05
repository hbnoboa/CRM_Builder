'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, ExternalLink, MoreHorizontal } from 'lucide-react';

export interface RelatedRecordsProps {
  title?: string;
  entitySlug: string;
  relationField?: string;
  displayFields?: string[];
  limit?: number;
  layout?: 'list' | 'table' | 'cards';
  allowAdd?: boolean;
  allowLink?: boolean;
}

// Sample data for preview
const sampleRecords = [
  { id: '1', name: 'Pedido #1234', status: 'Entregue', value: 'R$ 1.500,00' },
  { id: '2', name: 'Pedido #1235', status: 'Em Trânsito', value: 'R$ 2.300,00' },
  { id: '3', name: 'Pedido #1236', status: 'Pendente', value: 'R$ 890,00' },
];

export function RelatedRecords({
  title,
  entitySlug,
  relationField,
  displayFields,
  limit = 5,
  layout = 'list',
  allowAdd = true,
  allowLink = true,
}: RelatedRecordsProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-medium">{title || entitySlug || 'Registros Relacionados'}</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {sampleRecords.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {allowAdd && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                // Add action
              }}
              className="text-xs text-primary hover:underline"
            >
              + Adicionar
            </button>
          )}
          {allowLink && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                // View all action
              }}
              className="p-1 hover:bg-muted rounded"
            >
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-3">
          {layout === 'table' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Nome</th>
                    <th className="text-left py-2 font-medium">Status</th>
                    <th className="text-right py-2 font-medium">Valor</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {sampleRecords.slice(0, limit).map((record) => (
                    <tr key={record.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2">
                        <a href="#" className="text-primary hover:underline">
                          {record.name}
                        </a>
                      </td>
                      <td className="py-2">{record.status}</td>
                      <td className="py-2 text-right">{record.value}</td>
                      <td className="py-2">
                        <button className="p-1 hover:bg-muted rounded">
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {layout === 'list' && (
            <div className="space-y-2">
              {sampleRecords.slice(0, limit).map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-2 rounded hover:bg-muted/30 transition-colors"
                >
                  <div>
                    <a href="#" className="font-medium text-sm text-primary hover:underline">
                      {record.name}
                    </a>
                    <p className="text-xs text-muted-foreground">
                      {record.status} · {record.value}
                    </p>
                  </div>
                  <button className="p-1 hover:bg-muted rounded">
                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {layout === 'cards' && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {sampleRecords.slice(0, limit).map((record) => (
                <div
                  key={record.id}
                  className="border rounded-lg p-3 hover:shadow-sm transition-shadow cursor-pointer"
                >
                  <a href="#" className="font-medium text-sm text-primary hover:underline block truncate">
                    {record.name}
                  </a>
                  <p className="text-xs text-muted-foreground mt-1">{record.status}</p>
                  <p className="text-sm font-medium mt-2">{record.value}</p>
                </div>
              ))}
            </div>
          )}

          {sampleRecords.length > limit && (
            <button className="w-full text-center text-sm text-primary hover:underline mt-3">
              Ver todos ({sampleRecords.length})
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function RelatedRecordsPreview({ title, entitySlug, layout }: RelatedRecordsProps) {
  return (
    <div className="border rounded-lg p-4 bg-muted/50">
      <p className="text-center text-muted-foreground mb-2">
        🔗 Registros Relacionados
      </p>
      <p className="text-center text-sm font-medium">
        {title || entitySlug || 'Configure a entidade'}
      </p>
      <p className="text-center text-xs text-muted-foreground mt-1">
        Layout: {layout || 'list'}
      </p>
    </div>
  );
}

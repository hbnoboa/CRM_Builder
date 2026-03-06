'use client';

import { useState } from 'react';
import {
  Type,
  Table,
  Image,
  Minus,
  BarChart3,
  LayoutGrid,
  MoveVertical,
  Search,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { PdfElement } from '@/services/pdf-templates.service';

// ─── Element type definitions ────────────────────────────

interface ElementTypeDef {
  type: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'content' | 'data' | 'media' | 'layout';
}

const ELEMENT_TYPES: ElementTypeDef[] = [
  {
    type: 'text',
    label: 'Texto',
    description: 'Texto estatico ou dinamico com bindings',
    icon: Type,
    category: 'content',
  },
  {
    type: 'field-group',
    label: 'Grupo de Campos',
    description: 'Exibe labels e valores em linha, coluna ou grid',
    icon: LayoutGrid,
    category: 'content',
  },
  {
    type: 'table',
    label: 'Tabela',
    description: 'Tabela com colunas e dados de sub-entidade',
    icon: Table,
    category: 'data',
  },
  {
    type: 'statistics',
    label: 'Estatisticas',
    description: 'Dados agrupados com metricas (count, sum, avg)',
    icon: BarChart3,
    category: 'data',
  },
  {
    type: 'image-grid',
    label: 'Grade de Imagens',
    description: 'Grid de imagens do registro ou sub-entidade',
    icon: Image,
    category: 'media',
  },
  {
    type: 'divider',
    label: 'Divisor',
    description: 'Linha horizontal de separacao',
    icon: Minus,
    category: 'layout',
  },
  {
    type: 'spacer',
    label: 'Espacador',
    description: 'Espaco em branco vertical',
    icon: MoveVertical,
    category: 'layout',
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  content: 'Conteudo',
  data: 'Dados',
  media: 'Midia',
  layout: 'Layout',
};

const CATEGORY_COLORS: Record<string, string> = {
  content: 'border-blue-500/40 bg-blue-50/50 dark:bg-blue-950/20',
  data: 'border-green-500/40 bg-green-50/50 dark:bg-green-950/20',
  media: 'border-purple-500/40 bg-purple-50/50 dark:bg-purple-950/20',
  layout: 'border-orange-500/40 bg-orange-50/50 dark:bg-orange-950/20',
};

// ─── Default element factory ─────────────────────────────

function generateId(): string {
  return `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createDefaultElement(type: string): PdfElement {
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

// ─── Modal Component ─────────────────────────────────────

interface ElementPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (element: PdfElement) => void;
}

export function ElementPickerModal({
  open,
  onClose,
  onSelect,
}: ElementPickerModalProps) {
  const [search, setSearch] = useState('');

  const filtered = search
    ? ELEMENT_TYPES.filter(
        (t) =>
          t.label.toLowerCase().includes(search.toLowerCase()) ||
          t.description.toLowerCase().includes(search.toLowerCase()),
      )
    : ELEMENT_TYPES;

  // Group by category
  const categories = ['content', 'data', 'media', 'layout'] as const;

  const handleSelect = (type: string) => {
    const element = createDefaultElement(type);
    onSelect(element);
    onClose();
    setSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar Elemento</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar elemento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {categories.map((cat) => {
            const items = filtered.filter((t) => t.category === cat);
            if (items.length === 0) return null;

            return (
              <div key={cat}>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  {CATEGORY_LABELS[cat]}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.type}
                        onClick={() => handleSelect(item.type)}
                        className={cn(
                          'flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all hover:shadow-sm',
                          CATEGORY_COLORS[item.category],
                        )}
                      >
                        <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-sm font-medium">{item.label}</div>
                          <div className="text-xs text-muted-foreground leading-snug">
                            {item.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              Nenhum elemento encontrado
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

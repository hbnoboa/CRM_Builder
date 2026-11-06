'use client';

import { useEffect, useState } from 'react';
import {
  Type,
  Table,
  Image,
  Minus,
  BarChart3,
  LayoutGrid,
  MoveVertical,
  Search,
  CircleHelp,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useEntities } from '@/hooks/use-entities';
import { usePreviewPdf } from '@/hooks/use-pdf-templates';
import { smartPdfElement } from '@/lib/pdf-starter';
import type { Entity } from '@/types';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { PdfElement, PdfTemplateContent } from '@/services/pdf-templates.service';

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
    description: 'Texto estático ou dinâmico com bindings',
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
    description: 'Tabela com colunas e dados de sub-tabela',
    icon: Table,
    category: 'data',
  },
  {
    type: 'statistics',
    label: 'Estatísticas',
    description: 'Dados agrupados com metricas (count, sum, avg)',
    icon: BarChart3,
    category: 'data',
  },
  {
    type: 'image-grid',
    label: 'Grade de Imagens',
    description: 'Grid de imagens do registro ou sub-tabela',
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
        title: 'Estatísticas',
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
  /** Modelo e tabela de origem: o elemento ja nasce ligado aos campos e a previa usa o PDF real. */
  templateId?: string;
  sourceEntity?: Entity;
}

/** Para que serve cada elemento, em linguagem simples (previa do "?"). */
const ELEMENT_HELP: Record<string, string> = {
  text: 'Um texto livre. Pode misturar palavras fixas com valores do registro, como "Problema relatado: [Problema]".',
  'field-group': 'Vários campos do registro com o nome ao lado, em colunas. É o miolo de uma ficha.',
  table: 'Lista os itens que ficam dentro do registro (ex.: peças e serviços da OS), em linhas e colunas.',
  statistics: 'Conta ou soma os registros agrupando por um campo (ex.: quantas OS por situação). Útil em relatórios.',
  'image-grid': 'As fotos e assinaturas do registro, lado a lado, com legenda.',
  divider: 'Uma linha para separar partes do documento.',
  spacer: 'Um espaço em branco entre partes do documento.',
};

export function ElementPickerModal({
  open,
  onClose,
  onSelect,
  templateId,
  sourceEntity,
}: ElementPickerModalProps) {
  const [search, setSearch] = useState('');
  const [helpType, setHelpType] = useState<string | null>(null);
  const { data: entitiesPage } = useEntities({ limit: 200 });
  const allEntities = (entitiesPage?.data || []) as Entity[];

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
    // Ja ligado aos campos da tabela quando possivel (senao, o modelo generico)
    const element = (sourceEntity && smartPdfElement(type, sourceEntity, allEntities)) || createDefaultElement(type);
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
                      <div key={item.type} className="relative">
                      <button
                        onClick={() => handleSelect(item.type)}
                        data-testid={`pdf-element-${item.type}`}
                        className={cn(
                          'flex w-full items-start gap-3 p-3 pr-8 rounded-lg border-2 text-left transition-all hover:shadow-sm',
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
                      <button
                        type="button"
                        onClick={() => setHelpType(item.type)}
                        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-primary"
                        aria-label={`Ver como fica: ${item.label}`}
                        title="Ver como fica no PDF"
                        data-testid={`pdf-element-help-${item.type}`}
                      >
                        <CircleHelp className="h-4 w-4" />
                      </button>
                      </div>
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
      <PdfElementPreviewDialog
        type={helpType}
        label={ELEMENT_TYPES.find((t) => t.type === helpType)?.label ?? ''}
        help={helpType ? ELEMENT_HELP[helpType] : ''}
        element={helpType && sourceEntity ? smartPdfElement(helpType, sourceEntity, allEntities) : null}
        templateId={templateId}
        entityName={sourceEntity?.name}
        onClose={() => setHelpType(null)}
        onAdd={() => { if (helpType) handleSelect(helpType); setHelpType(null); }}
      />
    </Dialog>
  );
}

/** "?" do elemento: gera um PDF de verdade so com ele, usando um registro da tabela. */
function PdfElementPreviewDialog({
  type, label, help, element, templateId, entityName, onClose, onAdd,
}: {
  type: string | null;
  label: string;
  help: string;
  element: PdfElement | null;
  templateId?: string;
  entityName?: string;
  onClose: () => void;
  onAdd: () => void;
}) {
  const previewPdf = usePreviewPdf();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!type || !element || !templateId) return;
    let alive = true;
    let objectUrl: string | null = null;
    setUrl(null);
    setFailed(false);
    previewPdf
      .mutateAsync({ templateId, content: { header: {}, body: [element], footer: {} } as PdfTemplateContent })
      .then((blob) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // previewPdf muda a cada render; so refaz quando o elemento muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, templateId, element?.type]);

  return (
    <Dialog open={!!type} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto" data-testid="pdf-element-preview">
        <DialogTitle>{label}</DialogTitle>
        <DialogDescription>{help}</DialogDescription>
        {!element ? (
          <p className="rounded-lg bg-muted/60 p-3 text-sm">
            {type === 'divider' || type === 'spacer'
              ? 'Este elemento não usa dados.'
              : `A tabela ${entityName ?? ''} ainda não tem o que este elemento precisa (por exemplo, uma lista de itens, fotos ou uma lista de opções). Ele pode ser adicionado e configurado depois.`}
          </p>
        ) : (
          <>
            <p className="text-sm font-semibold">Assim sai no PDF (com dados de exemplo)</p>
            <div className="h-[420px] overflow-hidden rounded-lg border bg-muted/30" data-testid="pdf-element-preview-frame">
              {url ? (
                <iframe src={`${url}#toolbar=0&navpanes=0&view=FitH`} title={`Prévia: ${label}`} className="h-full w-full" />
              ) : failed ? (
                <p className="p-4 text-sm text-muted-foreground">Não foi possível gerar a prévia agora.</p>
              ) : (
                <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Gerando o PDF...
                </div>
              )}
            </div>
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Voltar</Button>
          <Button onClick={onAdd} data-testid="pdf-element-preview-add">Adicionar ao PDF</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

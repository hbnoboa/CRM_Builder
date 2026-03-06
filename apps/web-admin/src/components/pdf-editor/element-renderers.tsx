'use client';

import {
  Type,
  Table,
  Image,
  Minus,
  BarChart3,
  LayoutGrid,
  MoveVertical,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type {
  PdfElement,
  TextElement,
  FieldGroupElement,
  TableElement,
  ImageGridElement,
  DividerElement,
  SpacerElement,
  StatisticsElement,
  PdfHeader,
  PdfFooter,
} from '@/services/pdf-templates.service';

// ─── Helpers ──────────────────────────────────────────────

function highlightBindings(text: string) {
  const parts = text.split(/(\{\{[^}]+\}\})/g);
  return parts.map((part, i) => {
    if (part.startsWith('{{') && part.endsWith('}}')) {
      return (
        <span
          key={i}
          className="inline-flex items-center px-1 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-mono dark:bg-blue-900 dark:text-blue-300"
        >
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ─── Text Renderer ────────────────────────────────────────

function TextRenderer({ element }: { element: TextElement }) {
  const style: React.CSSProperties = {
    fontSize: `${Math.min((element.fontSize || 10) * 1.2, 20)}px`,
    fontWeight: element.fontWeight === 'bold' ? 'bold' : 'normal',
    color: element.color || '#000000',
    textAlign: (element.align as React.CSSProperties['textAlign']) || 'left',
  };

  return (
    <div style={style} className="leading-relaxed whitespace-pre-wrap">
      {highlightBindings(element.content || '')}
    </div>
  );
}

// ─── Field Group Renderer ─────────────────────────────────

function FieldGroupRenderer({ element }: { element: FieldGroupElement }) {
  const fields = element.fields || [];
  const layout = element.layout || 'horizontal';
  const cols = element.columns || 2;

  return (
    <div className="space-y-1">
      {element.title && (
        <div className="text-xs font-semibold text-center mb-2">{element.title}</div>
      )}
      <div
        className={
          layout === 'grid'
            ? `grid gap-x-4 gap-y-1`
            : layout === 'vertical'
              ? 'space-y-1'
              : 'space-y-1'
        }
        style={layout === 'grid' ? { gridTemplateColumns: `repeat(${cols}, 1fr)` } : undefined}
      >
        {fields.map((field, i) => (
          <div
            key={i}
            className={
              layout === 'horizontal'
                ? 'flex items-baseline gap-1 text-xs'
                : 'text-xs'
            }
          >
            <span className={field.labelBold ? 'font-bold' : 'font-medium'} style={{ color: '#333' }}>
              {field.label}
            </span>
            {layout === 'horizontal' && (
              <span className="text-muted-foreground">
                {highlightBindings(field.binding || '____')}
              </span>
            )}
            {layout !== 'horizontal' && (
              <div className="text-muted-foreground">
                {highlightBindings(field.binding || '____')}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Table Renderer ───────────────────────────────────────

function TableRenderer({ element }: { element: TableElement }) {
  const columns = element.columns || [];
  return (
    <div className="space-y-1">
      {element.title && (
        <div className="text-xs font-semibold text-center mb-1">{element.title}</div>
      )}
      <div className="border rounded overflow-hidden text-[10px]">
        {element.showHeader !== false && (
          <div className="flex bg-muted/60 border-b">
            {columns.map((col, i) => (
              <div
                key={i}
                className="flex-1 px-2 py-1 font-semibold truncate"
                style={{ textAlign: col.align || 'left' }}
              >
                {col.header}
              </div>
            ))}
          </div>
        )}
        {[0, 1].map((row) => (
          <div key={row} className="flex border-b last:border-0">
            {columns.map((col, i) => (
              <div
                key={i}
                className="flex-1 px-2 py-1 text-muted-foreground truncate"
                style={{ textAlign: col.align || 'left' }}
              >
                ────
              </div>
            ))}
          </div>
        ))}
      </div>
      {element.dataSource && (
        <div className="text-[10px] text-muted-foreground">
          Fonte: <Badge variant="outline" className="text-[9px] h-4">{element.dataSource}</Badge>
        </div>
      )}
    </div>
  );
}

// ─── Image Grid Renderer ──────────────────────────────────

function ImageGridRenderer({ element }: { element: ImageGridElement }) {
  const cols = element.columns || 4;
  const parentCols = element.parentImageFields?.length || 0;
  const childCols = element.imageFields?.length || 0;
  const totalCols = parentCols + childCols || cols;
  const headers = element.captionFields || [];

  return (
    <div className="space-y-1">
      {element.title && (
        <div className="text-xs font-semibold text-center mb-1">{element.title}</div>
      )}
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${totalCols}, 1fr)` }}
      >
        {headers.length > 0 && headers.map((h, i) => (
          <div key={`h-${i}`} className="text-[9px] font-medium text-center text-muted-foreground truncate">
            {h || `Col ${i + 1}`}
          </div>
        ))}
        {Array.from({ length: totalCols }).map((_, i) => (
          <div
            key={i}
            className="aspect-[4/3] bg-muted/40 rounded border-2 border-dashed border-muted-foreground/20 flex items-center justify-center"
          >
            <Image className="h-4 w-4 text-muted-foreground/40" />
          </div>
        ))}
      </div>
      {element.dataSource && (
        <div className="text-[10px] text-muted-foreground">
          Fonte: <Badge variant="outline" className="text-[9px] h-4">{element.dataSource}</Badge>
        </div>
      )}
    </div>
  );
}

// ─── Statistics Renderer ──────────────────────────────────

function StatisticsRenderer({ element }: { element: StatisticsElement }) {
  const metrics = element.metrics || [];
  const groupBy = element.groupBy || [];

  return (
    <div className="space-y-1">
      {element.title && (
        <div className="text-xs font-semibold text-center mb-1">{element.title}</div>
      )}
      <div className="border rounded overflow-hidden text-[10px]">
        <div className="flex bg-muted/60 border-b">
          {groupBy.map((g, i) => (
            <div key={`g-${i}`} className="flex-1 px-2 py-1 font-semibold truncate">
              {g}
            </div>
          ))}
          {metrics.map((m, i) => (
            <div key={`m-${i}`} className="flex-1 px-2 py-1 font-semibold text-center truncate">
              {m.label}
            </div>
          ))}
        </div>
        {[0, 1].map((row) => (
          <div key={row} className="flex border-b last:border-0">
            {groupBy.map((_, i) => (
              <div key={`g-${i}`} className="flex-1 px-2 py-1 text-muted-foreground">────</div>
            ))}
            {metrics.map((_, i) => (
              <div key={`m-${i}`} className="flex-1 px-2 py-1 text-muted-foreground text-center">──</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Divider Renderer ─────────────────────────────────────

function DividerRenderer({ element }: { element: DividerElement }) {
  return (
    <hr
      className="my-1"
      style={{
        borderColor: element.color || '#cccccc',
        borderTopWidth: `${element.thickness || 1}px`,
      }}
    />
  );
}

// ─── Spacer Renderer ──────────────────────────────────────

function SpacerRenderer({ element }: { element: SpacerElement }) {
  return (
    <div
      className="flex items-center justify-center border-2 border-dashed border-muted-foreground/15 rounded text-[10px] text-muted-foreground/40"
      style={{ height: `${Math.min(element.height || 20, 60)}px` }}
    >
      <MoveVertical className="h-3 w-3 mr-1" />
      {element.height || 20}px
    </div>
  );
}

// ─── Header Renderer ──────────────────────────────────────

export function HeaderRenderer({ header }: { header?: PdfHeader }) {
  if (!header) {
    return (
      <div className="text-xs text-muted-foreground text-center py-3">
        Clique para configurar o header
      </div>
    );
  }

  // Flexible header
  if (header.rows && header.rows.length > 0) {
    return (
      <div className="space-y-1">
        {header.rows.map((row) => (
          <div key={row.id} className="flex items-center gap-2">
            {row.elements.map((el) => (
              <div key={el.id} className={`flex-1 ${el.position === 'center' ? 'text-center' : el.position === 'right' ? 'text-right' : 'text-left'}`}>
                {el.type === 'image' ? (
                  <div className="inline-flex items-center gap-1 px-2 py-1 bg-muted/40 rounded text-[10px] text-muted-foreground">
                    <Image className="h-3 w-3" />
                    Logo
                  </div>
                ) : (
                  <span
                    className="text-xs"
                    style={{
                      fontWeight: el.bold ? 'bold' : 'normal',
                      fontSize: `${Math.min((el.fontSize || 10) * 1.1, 16)}px`,
                      color: el.color || '#000',
                    }}
                  >
                    {highlightBindings(el.text || '')}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
        {header.showDivider !== false && <hr className="border-muted-foreground/20" />}
      </div>
    );
  }

  // Legacy header
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {header.logo && (
          <div className="inline-flex items-center gap-1 px-2 py-1 bg-muted/40 rounded text-[10px] text-muted-foreground">
            <Image className="h-3 w-3" />
            Logo
          </div>
        )}
        {header.title && (
          <div className="flex-1 text-center text-xs font-bold">
            {header.title.text}
          </div>
        )}
      </div>
      {header.subtitle && (
        <div className="text-[10px] text-center text-muted-foreground">
          {highlightBindings(header.subtitle.text || '')}
        </div>
      )}
      {header.showDivider !== false && <hr className="border-muted-foreground/20" />}
    </div>
  );
}

// ─── Footer Renderer ──────────────────────────────────────

export function FooterRenderer({ footer }: { footer?: PdfFooter }) {
  if (!footer) {
    return (
      <div className="text-xs text-muted-foreground text-center py-2">
        Clique para configurar o footer
      </div>
    );
  }

  const align = footer.position || 'center';

  return (
    <div className={`text-[10px] text-muted-foreground ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'}`}>
      {footer.text && <span>{footer.text}</span>}
      {footer.text && footer.showPageNumbers && <span> — </span>}
      {footer.showPageNumbers && <span>Pagina X de Y</span>}
      {!footer.text && !footer.showPageNumbers && (
        <span>Clique para configurar o footer</span>
      )}
    </div>
  );
}

// ─── Element Renderer (dispatcher) ────────────────────────

const ELEMENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  text: Type,
  'field-group': LayoutGrid,
  table: Table,
  'image-grid': Image,
  statistics: BarChart3,
  divider: Minus,
  spacer: MoveVertical,
};

const ELEMENT_LABELS: Record<string, string> = {
  text: 'Texto',
  'field-group': 'Grupo de Campos',
  table: 'Tabela',
  'image-grid': 'Grade de Imagens',
  statistics: 'Estatisticas',
  divider: 'Divisor',
  spacer: 'Espacador',
};

export function getElementIcon(type: string) {
  return ELEMENT_ICONS[type] || Type;
}

export function getElementLabel(type: string) {
  return ELEMENT_LABELS[type] || type;
}

export function ElementRenderer({ element }: { element: PdfElement }) {
  switch (element.type) {
    case 'text':
      return <TextRenderer element={element} />;
    case 'field-group':
      return <FieldGroupRenderer element={element} />;
    case 'table':
      return <TableRenderer element={element} />;
    case 'image-grid':
      return <ImageGridRenderer element={element} />;
    case 'statistics':
      return <StatisticsRenderer element={element} />;
    case 'divider':
      return <DividerRenderer element={element} />;
    case 'spacer':
      return <SpacerRenderer element={element} />;
    default:
      return <div className="text-xs text-muted-foreground">Elemento desconhecido</div>;
  }
}

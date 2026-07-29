'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import type { Layout } from 'react-grid-layout';
import { ArrowLeft, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Entity, EntityField, EntitySettings } from '@crm-builder/shared';
import { RecordFormFields } from '@/components/data/record-form-dialog';
import { FieldPickerModal } from './panels/field-picker-modal';
import { FULL_WIDTH_TYPES, FieldProperties, uniqueSlug } from './react-form-builder';

import 'react-grid-layout/css/styles.css';

const GridLayout = WidthProvider(Responsive);

// Linha pequena + medição do conteúdo => a altura do tile cola no campo real
// (em vez de altura fixa generosa, que ficava alta demais).
const ROW_H = 6;
const MARGIN_X = 16; // gap horizontal (igual ao gap-4 do form runtime)
const MARGIN_Y = 12; // gap vertical
const CARD_CHROME = 20; // padding (p-2 = 16) + borda (2*2)
const FALLBACK_H = 7; // linhas enquanto o campo ainda não foi medido

const rowsForPx = (px: number) =>
  Math.max(2, Math.ceil((px + CARD_CHROME + MARGIN_Y) / (ROW_H + MARGIN_Y)));

// Conteúdo do campo (componente real) que se auto-mede e reporta a altura natural.
function FieldContent({
  field,
  entity,
  onMeasure,
}: {
  field: EntityField;
  entity: Entity;
  onMeasure: (slug: string, px: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const report = () => onMeasure(field.slug, el.scrollHeight);
    const ro = new ResizeObserver(report);
    ro.observe(el);
    report();
    return () => ro.disconnect();
  }, [field.slug, onMeasure]);
  const singleFieldEntity = {
    ...entity,
    fields: [{ ...field, gridColSpan: 12, gridColStart: undefined }],
  } as Entity;
  return (
    // Sem readOnly: renderiza o componente exatamente como no form (com botão de
    // calendário, dropzone de arquivo, etc.). pointer-events-none impede interação.
    <div ref={ref} className="pointer-events-none">
      <RecordFormFields entity={singleFieldEntity} hideFooter />
    </div>
  );
}

interface Props {
  entity: Entity;
  onSave: (data: {
    name: string;
    description?: string;
    fields: EntityField[];
    settings?: EntitySettings;
  }) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}

/**
 * Variante do form builder usando react-grid-layout (a mesma lib do dashboard),
 * para o mesmo feel fluido de arrasto/resize. Renderiza os componentes REAIS,
 * resize só horizontal (largura/span), altura fixa por tipo. Ativado por
 * ?editor=react; a versão dnd-kit segue em ?editor=dnd.
 */
export default function ReactFormBuilderGrid({ entity, onSave, onCancel }: Props) {
  const [fields, setFields] = useState<EntityField[]>(entity.fields || []);
  const [name, setName] = useState(entity.name);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [heights, setHeights] = useState<Record<string, number>>({}); // px do conteúdo medido

  const handleMeasure = useCallback((slug: string, px: number) => {
    setHeights((prev) => (prev[slug] === px ? prev : { ...prev, [slug]: px }));
  }, []);

  const selected = fields.find((f) => f.slug === selectedSlug) || null;
  const visibleFields = useMemo(
    () => fields.filter((f) => f.type !== 'hidden' && !f.hidden),
    [fields],
  );

  const layout: Layout = useMemo(
    () =>
      visibleFields.map((f, idx) => {
        const isFull = FULL_WIDTH_TYPES.has(f.type);
        const w = isFull ? 12 : Math.min(f.gridColSpan || 12, 12);
        const x = isFull ? 0 : Math.min(Math.max((f.gridColStart ?? 1) - 1, 0), 12 - w);
        const px = heights[f.slug];
        return {
          i: f.slug,
          x,
          y: f.gridRow ?? idx,
          w,
          h: px ? rowsForPx(px) : FALLBACK_H,
          minW: 2,
          maxW: 12,
          isResizable: !isFull,
        };
      }),
    [visibleFields, heights],
  );

  const updateSelected = (patch: Partial<EntityField>) => {
    if (!selectedSlug) return;
    setFields((prev) => prev.map((f) => (f.slug === selectedSlug ? { ...f, ...patch } : f)));
  };

  const deleteField = (slug: string) => {
    setFields((prev) => prev.filter((f) => f.slug !== slug));
    if (selectedSlug === slug) setSelectedSlug(null);
  };

  const addField = (fieldType: string, label: string) => {
    const slug = uniqueSlug(label, fields);
    const nf = { slug, name: label, label, type: fieldType, gridColSpan: 12 } as EntityField;
    setFields((prev) => [...prev, nf]);
    setSelectedSlug(slug);
    setPickerOpen(false);
  };

  const handleLayoutChange = (next: Layout) => {
    const byId = new Map(next.map((l) => [l.i, l]));
    setFields((prev) => {
      const positioned = prev.filter((f) => byId.has(f.slug));
      const hidden = prev.filter((f) => !byId.has(f.slug));
      // Ordem visual: de cima p/ baixo (y), depois esquerda→direita (x).
      const sorted = [...positioned].sort((a, b) => {
        const la = byId.get(a.slug)!;
        const lb = byId.get(b.slug)!;
        return la.y - lb.y || la.x - lb.x;
      });
      // gridRow 1-based por faixa de y (campos lado a lado dividem a linha).
      // NUNCA 0 — no record-form, gridRow 0 = "sem linha" e vai pro fim (causava
      // a inversão de ordem builder × form).
      let rowNum = 0;
      let lastY: number | null = null;
      const updated = sorted.map((f) => {
        const l = byId.get(f.slug)!;
        if (l.y !== lastY) {
          rowNum += 1;
          lastY = l.y;
        }
        const isFull = FULL_WIDTH_TYPES.has(f.type);
        return {
          ...f,
          gridRow: rowNum,
          gridColStart: isFull ? undefined : l.x + 1,
          gridColSpan: isFull ? 12 : l.w,
        };
      });
      const result = [...updated, ...hidden];
      const same =
        result.length === prev.length &&
        result.every(
          (f, i) =>
            prev[i]?.slug === f.slug &&
            prev[i]?.gridRow === f.gridRow &&
            prev[i]?.gridColStart === f.gridColStart &&
            prev[i]?.gridColSpan === f.gridColSpan,
        );
      return same ? prev : result;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ name, description: entity.description, fields, settings: entity.settings });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Estilo das alças de resize horizontal (bordas esq/dir) — o RGL só estiliza
          a alça do canto por padrão; aqui viram barras verticais agarráveis. */}
      <style>{`
        .rfb-grid .react-resizable-handle {
          background-image: none; width: 14px; height: 100%; top: 0; bottom: 0;
          margin: 0; padding: 0; transform: none; z-index: 5;
        }
        .rfb-grid .react-resizable-handle-e { right: 0; cursor: ew-resize; transform: none !important; }
        .rfb-grid .react-resizable-handle-w { left: 0; cursor: ew-resize; transform: none !important; }
        .rfb-grid .react-resizable-handle::after {
          content: ''; position: absolute; top: 50%; transform: translateY(-50%);
          width: 4px; height: 30px; border-radius: 3px;
          background: hsl(var(--primary) / 0.55); opacity: 0; transition: opacity .15s;
        }
        .rfb-grid .react-resizable-handle-e::after { right: 4px; }
        .rfb-grid .react-resizable-handle-w::after { left: 4px; }
        .rfb-grid .react-grid-item:hover .react-resizable-handle::after { opacity: 1; }
      `}</style>
      {/* Toolbar */}
      <div className="h-14 border-b bg-card flex items-center px-2 sm:px-4 gap-2 flex-shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="text-sm font-semibold bg-transparent border-none outline-none focus:ring-1 focus:ring-ring rounded px-2 py-1 max-w-[260px]"
        />
        <span className="text-xs text-muted-foreground mr-auto">Editor de campos</span>
        <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
          <Plus className="h-4 w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">Campo</span>
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 sm:mr-1.5 animate-spin" /> : <Save className="h-4 w-4 sm:mr-1.5" />}
          <span className="hidden sm:inline">Salvar</span>
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas: react-grid-layout com componentes reais */}
        <div className="flex-1 overflow-y-auto p-6 bg-muted/30">
          <div className="max-w-4xl mx-auto bg-card p-4 rounded-lg border">
            {visibleFields.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-10">
                Nenhum campo ainda. Clique em &quot;Campo&quot; para adicionar.
              </p>
            ) : (
              <GridLayout
                className="rfb-grid"
                layouts={{ lg: layout }}
                breakpoints={{ lg: 0 }}
                cols={{ lg: 12 }}
                rowHeight={ROW_H}
                margin={[MARGIN_X, MARGIN_Y]}
                containerPadding={[0, 0]}
                isDraggable
                isResizable
                resizeHandles={['e', 'w']}
                compactType="vertical"
                onLayoutChange={handleLayoutChange}
              >
                {visibleFields.map((field) => {
                  const isSelected = selectedSlug === field.slug;
                  return (
                    <div
                      key={field.slug}
                      onClick={() => setSelectedSlug(field.slug)}
                      className={cn(
                        'relative rounded-md border-2 p-2 overflow-hidden cursor-grab active:cursor-grabbing transition-colors',
                        isSelected ? 'border-primary bg-primary/5' : 'border-transparent hover:border-border',
                      )}
                    >
                      <FieldContent field={field} entity={entity} onMeasure={handleMeasure} />
                      {isSelected && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6 bg-background/80 text-destructive z-10"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteField(field.slug);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </GridLayout>
            )}
          </div>
        </div>

        {/* Propriedades por tipo (reusa o painel da versão dnd) */}
        <div className="w-72 lg:w-80 border-l bg-card flex-shrink-0 overflow-y-auto p-4">
          {selected ? (
            <FieldProperties field={selected} allFields={fields} onChange={updateSelected} />
          ) : (
            <p className="text-sm text-muted-foreground">Selecione um campo no canvas para editar.</p>
          )}
        </div>
      </div>

      <FieldPickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={addField} />
    </div>
  );
}

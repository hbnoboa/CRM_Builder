'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GridLayout, useContainerWidth, type Layout, type LayoutItem } from 'react-grid-layout';
import type { PositionStrategy } from 'react-grid-layout/core';
import { AlertTriangle, Copy, EyeOff, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BLOCK_KINDS } from '@/components/site/site-block-editor';
import { BlockView, SITE_GRID, SectionShell, SiteFrame, itemVisual, mobileOrder, readingOrder, rowsToPx, siteLook } from '@/components/site/site-page-view';
import type { SiteBlockDraft } from '@/hooks/use-site-pages';
import type { SiteBlockView, SiteLayoutItem, SitePageData, SiteSection } from '@/lib/site-api';
import { DEFAULT_W, missingPart, type PageDoc, type Selection } from './page-doc';
import { RichTextEditor } from './rich-text-editor';
import { plainToDoc } from '@/components/site/rich-text-view';
import type { RichNode } from '@/lib/site-api';
import 'react-grid-layout/css/styles.css';

/**
 * Posicao na grade com a pagina em escala (modo computador). A estrategia de escala
 * da propria biblioteca calcula o inicio do arrasto pela janela, e nao pela grade
 * (o elemento pulava); sem calcDragPosition ela usa a conta certa (pai, escala).
 */
const scaledStrategy = (scale: number): PositionStrategy => ({
  type: 'transform',
  scale,
  calcStyle: ({ top, left, width, height }) => ({
    transform: `translate(${left}px,${top}px)`, width: `${width}px`, height: `${height}px`, position: 'absolute',
  }),
});
const GRID_CANCEL = ".no-drag,[contenteditable='true'],[contenteditable='plaintext-only']";

/** Largura da pagina no modo computador (a tela do editor mostra em escala). */
export const DESKTOP_WIDTH = 1280;
export const PHONE_WIDTH = 390;
const ITEM_PAD_PX: Record<string, number> = { sm: 24, md: 40, lg: 64 };
export const TEXT_TYPES = new Set(['heading', 'text', 'quote']);

/** Linhas da grade para uma altura em px (mesma conta da pagina publicada). */
export const rowsFor = (px: number, gapY: number) => Math.max(1, Math.ceil((px + gapY) / (SITE_GRID.rowPx + gapY)));

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/**
 * Bloco como aparece no editor. Os simples saem do rascunho na hora; vitrine,
 * formulario e acompanhamento precisam do servidor (vem da previa).
 */
function viewFor(b: SiteBlockDraft, fromServer: Map<string, SiteBlockView>): SiteBlockView | string {
  const id = b.id!;
  switch (b.type) {
    case 'heading': return { id, type: 'heading', text: str(b.text) || 'Título', size: b.size === 'md' ? 'md' : 'lg' };
    case 'text': return str(b.text) ? { id, type: 'text', text: str(b.text), doc: b.doc as RichNode | undefined } : 'Texto vazio: dois cliques para escrever.';
    case 'image': return str(b.url) ? { id, type: 'image', url: str(b.url), alt: str(b.alt) } : 'Imagem: escolha a foto no painel ao lado.';
    case 'button': return { id, type: 'button', label: str(b.label) || 'Botão', url: str(b.url) || '#' };
    case 'divider': return { id, type: 'divider' };
    case 'hero': return { id, type: 'hero', title: str(b.title) || 'Título', text: str(b.text), imageUrl: str(b.imageUrl) || undefined, buttonLabel: str(b.buttonLabel), buttonUrl: str(b.buttonUrl) };
    case 'gallery': {
      const images = ((b.images as Array<{ url?: string; caption?: string }> | undefined) || []).filter((i) => i?.url).map((i) => ({ url: i.url!, caption: i.caption }));
      return images.length ? { id, type: 'gallery', title: str(b.title), layout: (b.layout as 'polaroid' | 'grid' | 'mosaic') || 'polaroid', images } : 'Galeria: adicione fotos no painel ao lado.';
    }
    case 'cards': {
      const items = ((b.items as Array<{ title?: string }> | undefined) || []).filter((i) => i?.title) as Array<{ title: string }>;
      return items.length ? { id, type: 'cards', title: str(b.title), columns: ([1, 2, 3].includes(Number(b.columns)) ? Number(b.columns) : 3) as 1 | 2 | 3, items } : 'Cartões: escreva o título de pelo menos um.';
    }
    case 'quote': return str(b.text) ? { id, type: 'quote', text: str(b.text), author: str(b.author) } : 'Citação vazia: escreva a frase no painel ao lado.';
    case 'video': case 'map': case 'faq': case 'icons': case 'social': case 'spacer': case 'stats': case 'pricing': case 'testimonials': case 'logos': {
      const kind = BLOCK_KINDS.find((k) => k.type === b.type)?.label ?? 'Elemento';
      const missing = missingPart(b);
      // Mesmo formato do servidor; item sem o principal (pergunta, nome...) nao aparece
      const rows = (v: unknown) => (Array.isArray(v) ? (v as Array<Record<string, unknown>>) : []);
      const clean = {
        ...b,
        items: rows(b.items).filter((i) => str(i.q) || str(i.title) || str(i.value) || str(i.text)),
        links: rows(b.links).filter((l) => str(l.url)),
        plans: rows(b.plans).filter((p) => str(p.name)).map((p) => ({ ...p, features: (Array.isArray(p.features) ? p.features : []).filter(Boolean) })),
        images: rows(b.images).filter((i) => str(i.url)),
        columns: Number(b.columns) || 3, zoom: Number(b.zoom) || 15, height: Number(b.height) || (b.type === 'spacer' ? 48 : 320),
      };
      return missing && b.type !== 'spacer' ? `${kind}: falta ${missing} (no painel ao lado).` : (clean as unknown as SiteBlockView);
    }
    default: {
      const kind = BLOCK_KINDS.find((k) => k.type === b.type)?.label ?? 'Bloco';
      return fromServer.get(id) ?? `${kind}: configure no painel ao lado.`;
    }
  }
}

interface CanvasProps {
  doc: PageDoc;
  frame: SitePageData;
  serverBlocks: Map<string, SiteBlockView>;
  device: 'desktop' | 'mobile';
  scale: number;
  selection: Selection;
  onSelect: (sel: Selection) => void;
  editingId: string | null;
  editVersion: number;
  onStartEdit: (id: string) => void;
  onCommitText: (id: string, text: string | null) => void;
  heights: Record<string, number>;
  onMeasure: (id: string, px: number) => void;
  onGridChange: (sectionId: string, grid: Array<{ i: string; x: number; y: number; w: number; h: number }>) => void;
  onGestureStart: () => void;
  onGestureEnd: () => void;
  dragType: string | null;
  onDropBlock: (sectionId: string, type: string, at: { x: number; y: number; w: number }) => void;
  onAddSection: (afterId: string | null) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  /** Secao embaixo do ponteiro enquanto arrasta um elemento de outra secao. */
  dragOverSection: string | null;
  onDragOverSection: (sectionId: string | null) => void;
  onMoveAcross: (id: string, sectionId: string, point: { x: number; y: number }) => void;
  onResizeItem: (id: string, h: number) => void;
  onMobileOrder: (sectionId: string, ids: string[]) => void;
  /** Texto formatado: barra de formatacao (em cima da pagina) e mudancas. */
  toolbarSlot: HTMLElement | null;
  onRichChange: (id: string, doc: RichNode, text: string) => void;
}

/** Secao (que nao seja a de origem) embaixo do ponteiro. */
function sectionAt(point: { x: number; y: number }, except: string): string | null {
  for (const el of document.elementsFromPoint(point.x, point.y)) {
    const id = (el as HTMLElement).closest<HTMLElement>('[data-section-box]')?.dataset.sectionBox;
    if (id && id !== except) return id;
  }
  return null;
}

const pointOf = (e: Event) => {
  const t = (e as TouchEvent).changedTouches?.[0];
  return t ? { x: t.clientX, y: t.clientY } : { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };
};

export function PageCanvas(props: CanvasProps) {
  const { doc, frame, device, selection, onSelect } = props;
  const { brand, scrap } = siteLook(frame);
  const data = useMemo(() => ({ ...frame, layout: doc.layout }), [frame, doc.layout]);
  const blocks = useMemo(() => new Map(doc.blocks.map((b) => [b.id!, b])), [doc.blocks]);
  let order = 0;
  const nextIndex = () => order++;

  return (
    <SiteFrame
      data={data}
      preview
      onHeaderClick={() => onSelect({ kind: 'header' })}
      onFooterClick={() => onSelect({ kind: 'footer' })}
      highlight={selection.kind === 'header' || selection.kind === 'footer' ? selection.kind : null}
    >
      <main onClick={(e) => { if (e.target === e.currentTarget) onSelect({ kind: 'page' }); }} className="pb-4">
        {doc.layout.sections.map((section, i) => {
          const selected = selection.kind === 'section' && selection.id === section.id;
          const hidden = section.hide === (device === 'mobile' ? 'mobile' : 'desktop');
          const dropHere = props.dragOverSection === section.id;
          return (
            <div key={section.id} className="group/section relative" data-testid="editor-section" data-section-box={section.id}>
              <div
                onClick={(e) => { e.stopPropagation(); onSelect({ kind: 'section', id: section.id }); }}
                className={cn('outline-offset-[-2px] transition-[outline-color]', selected ? 'outline outline-2 outline-sky-500' : 'outline-dashed outline-1 outline-transparent hover:outline-sky-400/70', hidden && 'opacity-40',
                  dropHere && 'bg-sky-400/10 outline outline-4 outline-sky-500')}
              >
                <SectionShell section={section} brand={brand} scrap={scrap} editing>
                  {device === 'desktop'
                    ? <SectionGrid {...props} section={section} blocks={blocks} data={data} brand={brand} scrap={scrap} nextIndex={nextIndex} />
                    : <SectionStack {...props} section={section} blocks={blocks} data={data} brand={brand} scrap={scrap} nextIndex={nextIndex} />}
                </SectionShell>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onSelect({ kind: 'section', id: section.id }); }}
                className={cn('absolute left-2 top-2 z-20 rounded-md bg-sky-500 px-2 py-0.5 text-[11px] font-medium text-white shadow transition-opacity',
                  selected || dropHere ? 'opacity-100' : 'opacity-0 group-hover/section:opacity-100')}
              >
                {dropHere ? 'Soltar nesta seção' : section.name || `Seção ${i + 1}`}{hidden ? ` · escondida no ${device === 'mobile' ? 'celular' : 'computador'}` : ''}
              </button>
              <AddSectionButton onClick={() => props.onAddSection(section.id)} />
            </div>
          );
        })}
        {doc.layout.sections.length === 0 && (
          <div className="mx-auto my-10 max-w-md rounded-xl border-2 border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            Página vazia. <button type="button" className="font-medium text-sky-600 underline" onClick={() => props.onAddSection(null)}>Adicionar uma seção</button>
          </div>
        )}
      </main>
    </SiteFrame>
  );
}

function AddSectionButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 -bottom-3 z-30 flex justify-center opacity-0 transition-opacity group-hover/section:opacity-100">
      <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-sky-500 px-3 py-1 text-xs font-medium text-white shadow-md hover:bg-sky-600"
        data-testid="editor-add-section">
        <Plus className="h-3.5 w-3.5" /> Seção
      </button>
    </div>
  );
}

type SectionProps = CanvasProps & {
  section: SiteSection;
  blocks: Map<string, SiteBlockDraft>;
  data: SitePageData;
  brand: string;
  scrap: boolean;
  nextIndex: () => number;
};

/**
 * Computador: grade de 12 colunas. Arrastar muda o lugar (ate para outra secao),
 * as laterais mudam a largura e a borda de baixo a altura; blocos novos sao soltos aqui.
 */
function SectionGrid(props: SectionProps) {
  const { section, heights, scrap, scale, editingId, dragType } = props;
  const gapY = SITE_GRID.gapY(scrap);
  const items = readingOrder(section.items);
  const [dragging, setDragging] = useState<string | null>(null);
  const { width, containerRef, mounted } = useContainerWidth();
  const strategy = useMemo(() => scaledStrategy(scale), [scale]);
  const layout = items.map((it) => ({
    i: it.id, x: it.x, y: it.y, w: it.w, minW: 1, maxW: SITE_GRID.cols,
    h: heights[it.id] ? Math.max(rowsFor(heights[it.id], gapY), it.minH ?? 1) : it.h,
    isDraggable: editingId !== it.id,
  }));
  // Arrastando: a grade nao cresce sem fim para baixo, assim o ponteiro alcanca a proxima secao
  const bottom = layout.reduce((max, l) => Math.max(max, l.y + l.h), 0);
  const draggedH = layout.find((l) => l.i === dragging)?.h ?? 0;
  const dropW = dragType ? DEFAULT_W[dragType] ?? SITE_GRID.cols : SITE_GRID.cols;
  return (
    <div data-grid-section={section.id} ref={containerRef}>
      {mounted && (
        <GridLayout
          width={width}
          className={cn('site-editor-grid', items.length === 0 && 'min-h-[110px] rounded-lg border-2 border-dashed border-slate-300/80')}
          layout={layout}
          gridConfig={{ cols: SITE_GRID.cols, rowHeight: SITE_GRID.rowPx, margin: [SITE_GRID.gapX, gapY], containerPadding: [0, 0], maxRows: dragging ? bottom + draggedH : Infinity }}
          // Precisa mover 4px para virar arrasto: clique e dois cliques continuam sendo clique
          dragConfig={{ enabled: true, cancel: GRID_CANCEL, threshold: 4 }}
          resizeConfig={{ enabled: true, handles: ['e', 'w', 's', 'se', 'sw'] }}
          dropConfig={{ enabled: !!dragType, defaultItem: { w: dropW, h: 6 } }}
          positionStrategy={strategy}
          droppingItem={{ i: '__novo__', x: 0, y: 0, w: dropW, h: 6 }}
          onDropDragOver={() => (dragType ? { w: dropW, h: 6 } : false)}
          onDrop={(_l: Layout, item: LayoutItem | undefined) => { if (dragType && item) props.onDropBlock(section.id, dragType, { x: item.x, y: item.y, w: item.w }); }}
          onLayoutChange={(l: Layout) => props.onGridChange(section.id, l.filter((g) => g.i !== '__novo__'))}
          onDragStart={(_l, _o, n) => { setDragging(n?.i ?? null); props.onGestureStart(); }}
          onDrag={(_l, _o, _n, _p, e) => props.onDragOverSection(sectionAt(pointOf(e), section.id))}
          onDragStop={(_l, _o, n, _p, e) => {
            setDragging(null);
            props.onDragOverSection(null);
            const point = pointOf(e);
            const target = n ? sectionAt(point, section.id) : null;
            if (n && target) props.onMoveAcross(n.i, target, point);
            else props.onGestureEnd();
          }}
          onResizeStart={props.onGestureStart}
          onResizeStop={(_l, _o, n) => { if (n) props.onResizeItem(n.i, n.h); props.onGestureEnd(); }}
        >
          {items.map((it) => (
            <div key={it.id}>
              <ItemBox {...props} item={it} measure />
            </div>
          ))}
        </GridLayout>
      )}
    </div>
  );
}

/** Posicao na grade de uma secao para um ponto da tela (onde o elemento foi solto). */
export function gridSpot(sectionId: string, point: { x: number; y: number }, w: number, scale: number, scrap: boolean) {
  const el = document.querySelector<HTMLElement>(`[data-grid-section="${sectionId}"]`);
  if (!el) return undefined;
  const rect = el.getBoundingClientRect();
  const width = rect.width / scale;
  const colW = (width + SITE_GRID.gapX) / SITE_GRID.cols;
  const x = Math.round(((point.x - rect.left) / scale) / colW - w / 2);
  const y = Math.floor(((point.y - rect.top) / scale) / (SITE_GRID.rowPx + SITE_GRID.gapY(scrap)));
  return { x: Math.min(Math.max(x, 0), SITE_GRID.cols - w), y: Math.max(y, 0) };
}

/** Celular: um embaixo do outro, na ordem do celular; arrastar muda essa ordem. */
function SectionStack(props: SectionProps) {
  const items = mobileOrder(props.section.items);
  const ids = items.map((it) => it.id);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const next = ids.filter((id) => id !== e.active.id);
    next.splice(ids.indexOf(String(e.over.id)), 0, String(e.active.id));
    props.onMobileOrder(props.section.id, next);
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={cn('flex flex-col', items.length === 0 && 'min-h-[80px] rounded-lg border-2 border-dashed border-slate-300/80')} style={{ gap: 'var(--site-gap-y)' }}>
          {items.map((it) => <SortableItem key={it.id} {...props} item={it} />)}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableItem(props: SectionProps & { item: SiteLayoutItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.item.id, disabled: props.editingId === props.item.id });
  const minH = props.item.minH ? rowsToPx(props.item.minH, props.scrap) : undefined;
  return (
    <div ref={setNodeRef} {...attributes} {...listeners}
      style={{ transform: CSS.Transform.toString(transform), transition, minHeight: minH, zIndex: isDragging ? 30 : undefined, position: 'relative' }}
      className={cn('flex flex-col', isDragging && 'opacity-80')}>
      <ItemBox {...props} />
    </div>
  );
}

function ItemBox(props: SectionProps & { item: SiteLayoutItem; measure?: boolean }) {
  const { item, blocks, selection, onSelect, editingId, device } = props;
  const block = blocks.get(item.id);
  const index = props.nextIndex();
  if (!block) return null;
  const view = viewFor(block, props.serverBlocks);
  const selected = selection.kind === 'item' && selection.id === item.id;
  const editing = editingId === item.id;
  const hidden = item.hide === (device === 'mobile' ? 'mobile' : 'desktop');
  const visual = itemVisual(item);
  const pad = ITEM_PAD_PX[item.style?.padding ?? ''] ?? 0;
  const missing = missingPart(block);
  return (
    <div
      className={cn('group/item relative flex h-full flex-1 flex-col', !editing && 'cursor-grab active:cursor-grabbing',
        selected ? 'outline outline-2 outline-offset-2 outline-primary' : 'hover:outline hover:outline-1 hover:outline-offset-2 hover:outline-primary/60')}
      // Sem stopPropagation: o mousedown precisa chegar na grade para arrastar
      onMouseDown={() => { if (!editing) onSelect({ kind: 'item', id: item.id }); }}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={() => { if (TEXT_TYPES.has(block.type) && (typeof view !== 'string' || block.type === 'text')) props.onStartEdit(item.id); }}
      data-testid="editor-item"
      data-type={block.type}
    >
      <div className={cn('flex-1', visual.className, hidden && 'opacity-40')} style={visual.style}>
        <Measured
          key={`${item.id}-${editing ? 'edit' : props.editVersion}`}
          id={item.id}
          extra={pad}
          onMeasure={props.measure ? props.onMeasure : undefined}
          editing={editing && block.type !== 'text'}
          live={editing && block.type === 'text'}
          onCommit={(text) => props.onCommitText(item.id, text)}
        >
          {editing && block.type === 'text' ? (
            <RichTextEditor
              doc={(block.doc as RichNode | undefined) ?? plainToDoc(str(block.text))}
              fonts={props.data.fonts || []}
              toolbarSlot={props.toolbarSlot}
              onChange={(doc, text) => props.onRichChange(item.id, doc, text)}
              onDone={() => props.onCommitText(item.id, null)}
            />
          ) : typeof view === 'string' ? (
            <div className="rounded-lg border-2 border-dashed border-slate-300 bg-white/70 p-4 text-center text-sm text-slate-500">{view}</div>
          ) : (
            <BlockView block={view} index={index} data={props.data} brand="var(--site-accent)" scrap={props.scrap} tenantSlug="" pageSlug="" preview />
          )}
        </Measured>
      </div>
      {missing && typeof view !== 'string' && (
        <span className="absolute bottom-1 left-1 z-10 inline-flex items-center gap-1 rounded bg-amber-500 px-1.5 py-0.5 text-[11px] font-medium text-white shadow" data-testid="editor-item-draft">
          <AlertTriangle className="h-3 w-3" /> Falta {missing}: não aparece na página
        </span>
      )}
      {hidden && (
        <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] text-white">
          <EyeOff className="h-3 w-3" /> Escondido no {device === 'mobile' ? 'celular' : 'computador'}
        </span>
      )}
      {selected && !editing && (
        <div className="no-drag absolute -top-3 right-1 z-20 flex gap-0.5 rounded-md border bg-background p-0.5 shadow-md" onMouseDown={(e) => e.stopPropagation()}>
          <button type="button" className="rounded p-1 hover:bg-muted" title="Duplicar" aria-label="Duplicar" onClick={() => props.onDuplicate(item.id)}><Copy className="h-3.5 w-3.5" /></button>
          <button type="button" className="rounded p-1 text-destructive hover:bg-muted" title="Excluir" aria-label="Excluir" onClick={() => props.onRemove(item.id)} data-testid="editor-item-remove"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      )}
      {selected && TEXT_TYPES.has(block.type) && !editing && (
        <span className="pointer-events-none absolute -bottom-7 left-0 z-20 rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground">
          {block.type === 'text' ? 'Dois cliques para escrever e formatar (como no Word)' : 'Dois cliques para editar o texto'}
        </span>
      )}
    </div>
  );
}

/**
 * Conteudo do bloco: mede a altura natural (para a grade) e, em edicao,
 * deixa o texto editavel ali mesmo na pagina.
 */
function Measured({ id, extra, onMeasure, editing, live, onCommit, children }: {
  id: string; extra: number; onMeasure?: (id: string, px: number) => void; editing: boolean; live?: boolean; onCommit: (text: string | null) => void; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;

  useEffect(() => {
    const el = ref.current;
    if (!el || !onMeasure) return;
    const report = () => onMeasure(id, el.offsetHeight + extra);
    const ro = new ResizeObserver(report);
    ro.observe(el);
    report();
    return () => ro.disconnect();
  }, [id, extra, onMeasure]);

  useEffect(() => {
    if (!editing) return;
    const target = ref.current?.querySelector<HTMLElement>('[data-edit]');
    if (!target) { commitRef.current(null); return; }
    target.contentEditable = 'plaintext-only';
    if (target.contentEditable !== 'plaintext-only') target.contentEditable = 'true';
    target.classList.add('outline-none', 'cursor-text');
    target.focus();
    const range = document.createRange();
    range.selectNodeContents(target);
    range.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    let done = false;
    const finish = (save: boolean) => {
      if (done) return;
      done = true;
      commitRef.current(save ? target.innerText.replace(/\n{3,}/g, '\n\n').trim() : null);
    };
    const onBlur = () => finish(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      if (e.key === 'Enter' && !e.shiftKey && target.tagName !== 'P') { e.preventDefault(); target.blur(); }
      e.stopPropagation();
    };
    target.addEventListener('blur', onBlur);
    target.addEventListener('keydown', onKey);
    return () => {
      target.removeEventListener('blur', onBlur);
      target.removeEventListener('keydown', onKey);
    };
  }, [editing]);

  return <div ref={ref} className={editing || live ? undefined : 'pointer-events-none select-none'}>{children}</div>;
}

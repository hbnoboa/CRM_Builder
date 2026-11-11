'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, Copy, ExternalLink, Globe, GripVertical, Loader2, Monitor, Plus, Redo2, Save, Smartphone, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/i18n/tenant-navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BLOCK_KINDS, type EditorEntity, type EditorPdf, type SiteLookDraft } from '@/components/site/site-block-editor';
import { useEntities } from '@/hooks/use-entities';
import { usePdfTemplates } from '@/hooks/use-pdf-templates';
import {
  previewSitePage, usePublishSitePage, useSiteConfig, useSitePage, useUpdateSiteConfig, useUpdateSitePage,
  type SiteConfigDraft, type SitePage,
} from '@/hooks/use-site-pages';
import { getErrorMessage } from '@/lib/get-error-message';
import { absoluteSiteUrl, type SiteBlockView, type SitePageData } from '@/lib/site-api';
import { cn } from '@/lib/utils';
import { useTenant } from '@/stores/tenant-context';
import { SITE_GRID, siteLook } from '@/components/site/site-page-view';
import { DESKTOP_WIDTH, PHONE_WIDTH, PageCanvas, TEXT_TYPES, gridSpot, rowsFor } from './page-canvas';
import { PageInspector } from './page-inspector';
import * as ops from './page-doc';
import { useDocHistory } from './use-doc-history';

const docOf = (page: SitePage, site: SiteConfigDraft): ops.PageDoc => ({
  blocks: page.blocks,
  layout: page.layout ?? { sections: [] },
  look: (page.settings as SiteLookDraft | undefined) || {},
  site,
});
const EMPTY_SITE: SiteConfigDraft = { look: {}, menu: [], footer: {} };

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

/**
 * Editor visual das paginas para clientes: a propria pagina na tela, em secoes
 * com grade (computador) e empilhada (celular). Seleciona, arrasta, muda largura,
 * edita o texto ali mesmo; o painel da direita mostra o que estiver selecionado.
 */
export function SitePageEditor({ id }: { id: string }) {
  const { data: page, isLoading } = useSitePage(id);
  const update = useUpdateSitePage(id);
  const { data: siteInfo } = useSiteConfig();
  const updateSite = useUpdateSiteConfig();
  const publish = usePublishSitePage(id);
  const { data: entitiesPage } = useEntities({ limit: 200 });
  const { data: pdfPage } = usePdfTemplates({ limit: 100 } as never);
  const entities = (entitiesPage?.data || []) as unknown as EditorEntity[];
  const pdfs = useMemo(() => {
    const raw = pdfPage as unknown as { data?: EditorPdf[] } | EditorPdf[] | undefined;
    return (Array.isArray(raw) ? raw : raw?.data || []) as EditorPdf[];
  }, [pdfPage]);
  const { tenant } = useTenant();
  const brandColor = (tenant?.settings as { theme?: { brandColor?: string } } | undefined)?.theme?.brandColor ?? null;

  const history = useDocHistory<ops.PageDoc>({ blocks: [], layout: { sections: [] }, look: {}, site: EMPTY_SITE });
  const { doc, update: updateDoc, checkpoint, reset, undo, redo } = history;
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [meta, setMeta] = useState(false); // titulo/endereco mudaram
  const [saved, setSaved] = useState('');
  const [savedSite, setSavedSite] = useState('');
  const [touched, setTouched] = useState(false);
  const loaded = useRef(false);

  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [selection, setSelection] = useState<ops.Selection>({ kind: 'page' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVersion, setEditVersion] = useState(0);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [dragType, setDragType] = useState<string | null>(null);
  const [dragOverSection, setDragOverSection] = useState<string | null>(null);
  const [preview, setPreview] = useState<SitePageData | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const snapshot = (d: ops.PageDoc) => JSON.stringify({ b: d.blocks, l: d.layout, k: d.look });
  const siteChanged = touched && JSON.stringify(doc.site) !== savedSite;
  const dirty = meta || siteChanged || (touched && snapshot(doc) !== saved);

  useEffect(() => {
    if (!page || !siteInfo || loaded.current) return;
    loaded.current = true;
    setTitle(page.title);
    setSlug(page.slug);
    const first = docOf(page, siteInfo.config);
    reset(first);
    setSaved(snapshot(first));
    setSavedSite(JSON.stringify(first.site));
  }, [page, siteInfo, reset]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Previa do servidor: topo/menu/rodape e os blocos que dependem de dados (vitrine, formulario, acompanhamento)
  useEffect(() => {
    if (!loaded.current) return;
    const timer = setTimeout(() => {
      previewSitePage(doc.blocks, title, doc.look, page?.slug, doc.site)
        .then((res) => {
          if ('error' in res) setPreviewError(res.error);
          else { setPreviewError(null); setPreview(res); }
        })
        .catch(() => undefined);
    }, 450);
    return () => clearTimeout(timer);
  }, [doc.blocks, doc.look, doc.site, title, page?.slug]);

  const serverBlocks = useMemo(() => new Map<string, SiteBlockView>((preview?.blocks || []).map((b) => [b.id, b])), [preview]);

  const change = useCallback((fn: (d: ops.PageDoc) => ops.PageDoc, tag?: string) => {
    updateDoc(fn, { tag });
    setTouched(true);
  }, [updateDoc]);

  // Arrastar/redimensionar: um passo de desfazer por gesto
  const beforeGesture = useRef<ops.PageDoc | null>(null);
  const docRef = useRef(doc);
  docRef.current = doc;
  const onGestureStart = useCallback(() => { beforeGesture.current = docRef.current; }, []);
  const onGestureEnd = useCallback(() => {
    const before = beforeGesture.current;
    beforeGesture.current = null;
    // a grade avisa a nova posicao logo depois; registra o passo quando ela chegar
    setTimeout(() => { if (before && before !== docRef.current) { checkpoint(before); setTouched(true); } }, 0);
  }, [checkpoint]);
  const onGridChange = useCallback((sectionId: string, grid: Array<{ i: string; x: number; y: number; w: number; h: number }>) => {
    updateDoc((d) => ops.applyGrid(d, sectionId, grid), { silent: true });
  }, [updateDoc]);
  const onMeasure = useCallback((bid: string, px: number) => {
    setHeights((prev) => (prev[bid] === px ? prev : { ...prev, [bid]: px }));
  }, []);

  const selectedSectionId = selection.kind === 'section' ? selection.id
    : selection.kind === 'item' ? ops.sectionOf(doc.layout, selection.id)?.id ?? null : null;

  const addBlock = (type: string, sectionId: string | null = selectedSectionId, at?: { x: number; y: number; w: number }) => {
    if (type === 'tracking' && doc.blocks.some((b) => b.type === 'tracking')) {
      toast.error('A página pode ter só um bloco de acompanhamento.');
      return;
    }
    const res = ops.addBlock(doc, type, sectionId, at);
    change(() => res.doc);
    setSelection({ kind: 'item', id: res.id });
  };
  const removeItem = (bid: string) => { change((d) => ops.removeItem(d, bid)); setSelection({ kind: 'page' }); };
  const duplicateItem = (bid: string) => {
    const res = ops.duplicateItem(doc, bid);
    if (res) { change(() => res.doc); setSelection({ kind: 'item', id: res.id }); }
  };
  const addSection = (afterId: string | null) => {
    const res = ops.addSection(doc, afterId);
    change(() => res.doc);
    setSelection({ kind: 'section', id: res.id });
  };
  const commitText = (bid: string, text: string | null) => {
    setEditingId(null);
    setEditVersion((v) => v + 1);
    if (text !== null && text) change((d) => ops.patchBlock(d, bid, { text }));
  };

  // Atalhos: desfazer/refazer, apagar e duplicar o selecionado, Esc tira a selecao
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (selection.kind === 'item' && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); removeItem(selection.id); return; }
      if (selection.kind === 'item' && mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateItem(selection.id); return; }
      if (selection.kind === 'item' && e.key === 'Enter') {
        const block = doc.blocks.find((b) => b.id === selection.id);
        if (block && TEXT_TYPES.has(block.type)) { e.preventDefault(); setEditingId(block.id!); }
        return;
      }
      if (e.key === 'Escape') setSelection({ kind: 'page' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Escala do modo computador: a pagina tem DESKTOP_WIDTH e aparece reduzida para caber
  const ready = preview !== null;
  const stageRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [stageWidth, setStageWidth] = useState(DESKTOP_WIDTH);
  const [pageHeight, setPageHeight] = useState(0);
  useEffect(() => {
    const stage = stageRef.current;
    const inner = pageRef.current;
    if (!stage || !inner) return;
    const ro = new ResizeObserver(() => { setStageWidth(stage.clientWidth); setPageHeight(inner.offsetHeight); });
    ro.observe(stage);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [ready, device]);
  const scale = device === 'desktop' ? Math.min(1, (stageWidth - 48) / DESKTOP_WIDTH) : 1;
  const pageWidth = device === 'desktop' ? DESKTOP_WIDTH : PHONE_WIDTH;

  const save = async (): Promise<boolean> => {
    try {
      const res = await update.mutateAsync({ title, slug, blocks: doc.blocks, layout: doc.layout, settings: doc.look });
      // Aparencia comum, menu e rodape valem para todas as paginas: salvos junto
      const site = siteChanged ? (await updateSite.mutateAsync(doc.site)).config : doc.site;
      setSlug(res.slug);
      const next = docOf(res, site);
      reset(next, true);
      setSaved(snapshot(next));
      setSavedSite(JSON.stringify(site));
      setTouched(false);
      setMeta(false);
      toast.success(siteChanged ? 'Página e site salvos!' : 'Página salva!');
      return true;
    } catch (error) {
      toast.error(getErrorMessage(error, 'Não foi possível salvar.'));
      return false;
    }
  };
  const togglePublish = async () => {
    if (!page) return;
    if (dirty && !(await save())) return;
    publish.mutate(!page.isPublished);
  };

  if (isLoading || !page || !siteInfo) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  const scrap = preview ? siteLook(preview).scrap : false;
  const contentRows = (bid: string) => (heights[bid] ? rowsFor(heights[bid], SITE_GRID.gapY(scrap)) : 0);
  const fullUrl = absoluteSiteUrl(page.url.replace(/[^/]+$/, slug || page.slug));
  const hasTracking = doc.blocks.some((b) => b.type === 'tracking');

  const actions = {
    patchLook: (patch: SiteLookDraft) => change((d) => ({ ...d, look: { ...d.look, ...patch } }), 'look'),
    patchSite: (patch: Partial<SiteConfigDraft>, tag?: string) => change((d) => ({ ...d, site: { ...d.site, ...patch } }), tag),
    select: setSelection,
    patchBlock: (bid: string, patch: Record<string, unknown>) => change((d) => ops.patchBlock(d, bid, patch), `block:${bid}:${Object.keys(patch).join()}`),
    patchItem: (bid: string, patch: Parameters<typeof ops.patchItem>[2]) => change((d) => ops.patchItem(d, bid, patch)),
    patchSection: (sid: string, patch: Parameters<typeof ops.patchSection>[2]) => change((d) => ops.patchSection(d, sid, patch), `section:${sid}:${Object.keys(patch).join()}`),
    moveItemToSection: (bid: string, sid: string) => change((d) => ops.moveItemToSection(d, bid, sid)),
    moveOnPhone: (bid: string, dir: -1 | 1) => change((d) => ops.moveOnPhone(d, bid, dir)),
    autoMobileOrder: (sid: string) => change((d) => ops.autoMobileOrder(d, sid)),
    setMinH: (bid: string, rows: number | undefined) => change((d) => {
      const item = ops.itemOf(d.layout, bid);
      return ops.patchItem(d, bid, { minH: rows, h: Math.max(rows ?? 1, contentRows(bid) || item?.h || 1) });
    }, `minh:${bid}`),
    duplicateItem,
    removeItem,
    moveSection: (sid: string, dir: -1 | 1) => change((d) => ops.moveSection(d, sid, d.layout.sections.findIndex((s) => s.id === sid) + dir)),
    duplicateSection: (sid: string) => {
      const res = ops.duplicateSection(doc, sid);
      if (res) { change(() => res.doc); setSelection({ kind: 'section', id: res.id }); }
    },
    removeSection: (sid: string) => {
      const section = doc.layout.sections.find((s) => s.id === sid);
      if (section?.items.length && !window.confirm(`Excluir a seção e os ${section.items.length} elementos dela?`)) return;
      change((d) => ops.removeSection(d, sid));
      setSelection({ kind: 'page' });
    },
  };

  // Tela cheia por cima do menu do sistema (portal no body: menus e avisos abrem por cima)
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-background" data-testid="site-page-editor">
      {/* Barra de cima */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
        <Button asChild variant="ghost" size="icon" aria-label="Voltar"><Link href="/gestao/pages"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <Input value={title} onChange={(e) => { setTitle(e.target.value); setMeta(true); }} className="h-9 w-56 font-semibold" aria-label="Título da página" data-testid="page-editor-title" />
        <div className="hidden items-center gap-1 text-xs text-muted-foreground xl:flex">
          <span className="max-w-[220px] truncate">{fullUrl.replace(/[^/]+$/, '')}</span>
          <Input value={slug} onChange={(e) => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')); setMeta(true); }} className="h-8 w-36 text-xs" aria-label="Endereço da página" />
          {page.isPublished && !hasTracking && (
            <>
              <Button size="icon" variant="ghost" className="h-8 w-8" title="Copiar link" onClick={() => { void navigator.clipboard?.writeText(fullUrl); toast.success('Link copiado!'); }}><Copy className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" title="Abrir" onClick={() => window.open(fullUrl, '_blank')}><ExternalLink className="h-3.5 w-3.5" /></Button>
            </>
          )}
        </div>

        <div className="mx-auto flex items-center gap-1 rounded-lg border p-0.5">
          {([['desktop', Monitor, 'Computador'], ['mobile', Smartphone, 'Celular']] as const).map(([value, Icon, label]) => (
            <Button key={value} size="sm" variant={device === value ? 'secondary' : 'ghost'} className="h-8" onClick={() => setDevice(value)} data-testid={`editor-device-${value}`}>
              <Icon className="mr-1.5 h-4 w-4" />{label}
            </Button>
          ))}
        </div>

        <Button size="icon" variant="ghost" className="h-9 w-9" disabled={!history.canUndo} onClick={undo} title="Desfazer (Ctrl+Z)" data-testid="editor-undo"><Undo2 className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" className="h-9 w-9" disabled={!history.canRedo} onClick={redo} title="Refazer (Ctrl+Shift+Z)" data-testid="editor-redo"><Redo2 className="h-4 w-4" /></Button>
        <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', page.isPublished ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-muted text-muted-foreground')}>
          {page.isPublished ? 'No ar' : 'Rascunho'}
        </span>
        <Button variant="outline" onClick={() => void save()} disabled={update.isPending || updateSite.isPending || !dirty} data-testid="page-save">
          {update.isPending || updateSite.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          {dirty ? 'Salvar' : 'Salvo'}
        </Button>
        <Button onClick={() => void togglePublish()} disabled={publish.isPending} variant={page.isPublished ? 'outline' : 'default'} data-testid="page-publish">
          <Globe className="mr-1.5 h-4 w-4" /> {page.isPublished ? 'Tirar do ar' : 'Publicar'}
        </Button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Esquerda: elementos para adicionar e secoes */}
        <aside className="w-60 shrink-0 overflow-y-auto border-r p-3" data-testid="editor-palette">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Adicionar</p>
          <p className="mb-2 text-[11px] text-muted-foreground">Arraste para a página ou clique.</p>
          <div className="grid grid-cols-2 gap-1.5">
            {BLOCK_KINDS.filter((k) => k.type !== 'tracking' || !hasTracking).map((k) => (
              <button
                key={k.type}
                type="button"
                draggable={device === 'desktop'}
                unselectable="on"
                onDragStart={(e) => { e.dataTransfer.setData('text/plain', k.type); setDragType(k.type); }}
                onDragEnd={() => setDragType(null)}
                onClick={() => addBlock(k.type)}
                title={k.hint}
                className="flex flex-col items-center gap-1 rounded-md border bg-card p-2 text-center text-[11px] leading-tight hover:border-primary hover:bg-primary/5"
                data-testid={`editor-add-${k.type}`}
              >
                <k.icon className="h-4 w-4" />
                {k.label}
              </button>
            ))}
          </div>
          <SectionList
            doc={doc}
            selectedId={selectedSectionId}
            onSelect={(sid) => { setSelection({ kind: 'section', id: sid }); document.getElementById(sid)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
            onMove={(sid, to) => change((d) => ops.moveSection(d, sid, to))}
            onAdd={() => addSection(doc.layout.sections[doc.layout.sections.length - 1]?.id ?? null)}
          />
        </aside>

        {/* Centro: a pagina */}
        <div ref={stageRef} className="min-w-0 flex-1 overflow-auto bg-muted/50 p-6" onClick={() => setSelection({ kind: 'page' })} data-testid="page-preview">
          {previewError && <p className="mx-auto mb-3 max-w-xl rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{previewError}</p>}
          {!preview ? (
            <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="mx-auto" style={{ width: pageWidth * scale, height: pageHeight ? pageHeight * scale : undefined }}>
              <div
                ref={pageRef}
                className={cn('origin-top-left overflow-hidden bg-white shadow-xl', device === 'mobile' && 'rounded-[2rem] border-[6px] border-slate-800')}
                style={{ width: pageWidth, transform: scale < 1 ? `scale(${scale})` : undefined }}
                onClick={(e) => e.stopPropagation()}
                onClickCapture={(e) => { if ((e.target as HTMLElement).closest('a')) e.preventDefault(); }}
              >
                <PageCanvas
                  doc={doc}
                  frame={preview}
                  serverBlocks={serverBlocks}
                  device={device}
                  scale={scale}
                  selection={selection}
                  onSelect={setSelection}
                  editingId={editingId}
                  editVersion={editVersion}
                  onStartEdit={setEditingId}
                  onCommitText={commitText}
                  heights={heights}
                  onMeasure={onMeasure}
                  onGridChange={onGridChange}
                  onGestureStart={onGestureStart}
                  onGestureEnd={onGestureEnd}
                  dragType={dragType}
                  onDropBlock={(sid, type, at) => { setDragType(null); addBlock(type, sid, at); }}
                  onAddSection={addSection}
                  onDuplicate={duplicateItem}
                  onRemove={removeItem}
                  dragOverSection={dragOverSection}
                  onDragOverSection={setDragOverSection}
                  onMoveAcross={(bid, sid, point) => {
                    beforeGesture.current = null;
                    const item = ops.itemOf(doc.layout, bid);
                    const at = item ? gridSpot(sid, point, item.w, scale, scrap) : undefined;
                    change((d) => ops.moveItemToSection(d, bid, sid, at));
                    setSelection({ kind: 'item', id: bid });
                  }}
                  onResizeItem={(bid, h) => {
                    // Mais alto que o conteudo: guarda a altura escolhida; menor: volta a automatica
                    updateDoc((d) => ops.patchItem(d, bid, { minH: h > contentRows(bid) ? h : undefined }), { silent: true });
                  }}
                  onMobileOrder={(sid, ids) => change((d) => ops.setMobileOrder(d, sid, ids))}
                />
              </div>
            </div>
          )}
          {device === 'mobile' && (
            <p className="mx-auto mt-3 max-w-sm text-center text-xs text-muted-foreground">
              No celular, os elementos de cada seção ficam um embaixo do outro. Arraste para mudar a ordem só no celular.
            </p>
          )}
        </div>

        {/* Direita: propriedades */}
        <aside className="w-80 shrink-0 overflow-y-auto border-l">
          <PageInspector doc={doc} selection={selection} brandColor={brandColor} entities={entities} pdfs={pdfs} scrap={scrap} sitePages={siteInfo.pages} {...actions} />
        </aside>
      </div>
    </div>,
    document.body,
  );
}

/** Lista das secoes (arraste para mudar a ordem). */
function SectionList({ doc, selectedId, onSelect, onMove, onAdd }: {
  doc: ops.PageDoc; selectedId: string | null; onSelect: (id: string) => void; onMove: (id: string, to: number) => void; onAdd: () => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const ids = doc.layout.sections.map((s) => s.id);
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    onMove(String(e.active.id), ids.indexOf(String(e.over.id)));
  };
  return (
    <div className="mt-5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Seções</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="space-y-1" data-testid="editor-section-list">
            {doc.layout.sections.map((s, i) => (
              <SectionRow key={s.id} id={s.id} label={s.name || `Seção ${i + 1}`} count={s.items.length} selected={selectedId === s.id} onSelect={() => onSelect(s.id)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <Button variant="outline" size="sm" className="mt-2 w-full border-dashed" onClick={onAdd}><Plus className="mr-1 h-3.5 w-3.5" />Nova seção</Button>
    </div>
  );
}

function SectionRow({ id, label, count, selected, onSelect }: { id: string; label: string; count: number; selected: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('flex items-center gap-1 rounded-md border bg-card text-sm', selected && 'border-primary bg-primary/5', isDragging && 'z-10 shadow-md')}>
      <button type="button" className="cursor-grab p-1.5 text-muted-foreground" aria-label="Arrastar seção" {...attributes} {...listeners}><GripVertical className="h-3.5 w-3.5" /></button>
      <button type="button" className="min-w-0 flex-1 truncate py-1.5 pr-2 text-left" onClick={onSelect}>
        {label} <span className="text-[11px] text-muted-foreground">· {count}</span>
      </button>
    </div>
  );
}

'use client';

import { absoluteSiteUrl } from '@/lib/site-api';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, ChevronDown, Copy, ExternalLink, Globe, Loader2, Palette, Plus, Save, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/i18n/tenant-navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { RequireRole } from '@/components/auth/require-role';
import { DesktopOnlyEditor } from '@/components/layout/desktop-only-editor';
import { SitePageView } from '@/components/site/site-page-view';
import { AppearanceFields, BLOCK_KINDS, BlockCard, type EditorEntity, type EditorPdf, type SiteLookDraft } from '@/components/site/site-block-editor';
import { useEntities } from '@/hooks/use-entities';
import { usePdfTemplates } from '@/hooks/use-pdf-templates';
import { previewSitePage, usePublishSitePage, useSitePage, useUpdateSitePage, type SiteBlockDraft } from '@/hooks/use-site-pages';
import { getErrorMessage } from '@/lib/get-error-message';
import type { SitePageData } from '@/lib/site-api';
import { cn } from '@/lib/utils';
import { useTenant } from '@/stores/tenant-context';

const newId = (type: string) => `${type}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e3).toString(36)}`;

function EditorContent({ id }: { id: string }) {
  const { data: page, isLoading } = useSitePage(id);
  const update = useUpdateSitePage(id);
  const publish = usePublishSitePage(id);
  const { data: entitiesPage } = useEntities({ limit: 200 });
  const { data: pdfPage } = usePdfTemplates({ limit: 100 } as never);
  const entities = (entitiesPage?.data || []) as unknown as EditorEntity[];
  const pdfs = useMemo(() => {
    const raw = pdfPage as unknown as { data?: EditorPdf[] } | EditorPdf[] | undefined;
    return (Array.isArray(raw) ? raw : raw?.data || []) as EditorPdf[];
  }, [pdfPage]);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [blocks, setBlocks] = useState<SiteBlockDraft[]>([]);
  const [look, setLook] = useState<SiteLookDraft>({});
  const [lookOpen, setLookOpen] = useState(false);
  const { tenant } = useTenant();
  const brandColor = (tenant?.settings as { theme?: { brandColor?: string } } | undefined)?.theme?.brandColor ?? null;
  const [openId, setOpenId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const loaded = useRef(false);
  const [preview, setPreview] = useState<SitePageData | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!page || loaded.current) return;
    loaded.current = true;
    setTitle(page.title);
    setSlug(page.slug);
    setBlocks(page.blocks.map((b) => ({ ...b, id: b.id || newId(b.type) })));
    setLook((page.settings as SiteLookDraft | undefined) || {});
  }, [page]);

  // Previa ao vivo (com registro de exemplo no acompanhamento)
  useEffect(() => {
    if (!loaded.current) return;
    const timer = setTimeout(() => {
      previewSitePage(blocks, title, look)
        .then((res) => {
          if ('error' in res) setPreviewError(res.error);
          else {
            setPreviewError(null);
            setPreview(res);
          }
        })
        .catch(() => undefined);
    }, 500);
    return () => clearTimeout(timer);
  }, [blocks, title, look]);

  const change = (fn: (prev: SiteBlockDraft[]) => SiteBlockDraft[]) => {
    setBlocks(fn);
    setDirty(true);
  };
  const patchBlock = (bid: string, patch: Record<string, unknown>) => change((prev) => prev.map((b) => (b.id === bid ? { ...b, ...patch } : b)));
  const move = (index: number, dir: -1 | 1) => change((prev) => {
    const next = [...prev];
    const [item] = next.splice(index, 1);
    next.splice(index + dir, 0, item);
    return next;
  });
  const add = (type: string) => {
    const starters: Record<string, Record<string, unknown>> = {
      heading: { text: 'Novo título' }, text: { text: '' }, hero: { title: 'Bem-vindo!' },
      gallery: { layout: 'polaroid', images: [{ url: '' }] }, cards: { columns: 3, items: [{ title: '' }] }, quote: { text: '' },
    };
    const block: SiteBlockDraft = { id: newId(type), type, ...(starters[type] || {}) };
    change((prev) => [...prev, block]);
    setOpenId(block.id!);
  };

  const save = async (): Promise<boolean> => {
    try {
      const saved = await update.mutateAsync({ title, slug, blocks, settings: look });
      setSlug(saved.slug);
      setBlocks(saved.blocks);
      setLook((saved.settings as SiteLookDraft | undefined) || {});
      setDirty(false);
      toast.success('Página salva!');
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

  if (isLoading || !page) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  const fullUrl = absoluteSiteUrl(page.url.replace(/[^/]+$/, slug || page.slug));
  const hasTracking = blocks.some((b) => b.type === 'tracking');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="Voltar"><Link href="/gestao/pages"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div className="min-w-[220px] flex-1">
          <Input value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} className="h-10 text-lg font-semibold" aria-label="Título da página" data-testid="page-editor-title" />
        </div>
        <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', page.isPublished ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-muted text-muted-foreground')}>
          {page.isPublished ? 'No ar' : 'Rascunho'}
        </span>
        <Button variant="outline" onClick={() => void save()} disabled={update.isPending || !dirty} data-testid="page-save">
          {update.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          {dirty ? 'Salvar' : 'Salvo'}
        </Button>
        <Button onClick={() => void togglePublish()} disabled={publish.isPending} variant={page.isPublished ? 'outline' : 'default'} data-testid="page-publish">
          <Globe className="mr-1.5 h-4 w-4" /> {page.isPublished ? 'Tirar do ar' : 'Publicar'}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
        <Label htmlFor="page-slug" className="text-xs text-muted-foreground">Endereço</Label>
        <span className="text-xs text-muted-foreground">{fullUrl.replace(/[^/]+$/, '')}</span>
        <Input id="page-slug" value={slug} onChange={(e) => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')); setDirty(true); }} className="h-8 w-56" />
        {page.isPublished && !hasTracking && (
          <>
            <Button size="sm" variant="ghost" onClick={() => { void navigator.clipboard?.writeText(fullUrl); toast.success('Link copiado!'); }}><Copy className="mr-1 h-3.5 w-3.5" />Copiar</Button>
            <Button size="sm" variant="ghost" onClick={() => window.open(fullUrl, '_blank')}><ExternalLink className="mr-1 h-3.5 w-3.5" />Abrir</Button>
          </>
        )}
        {hasTracking && <span className="text-xs text-muted-foreground">· O link de cada cliente sai do registro (botão “Link de acompanhamento”).</span>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-2" data-testid="page-blocks">
          <div className="rounded-lg border bg-card">
            <button type="button" onClick={() => setLookOpen((v) => !v)} className="flex w-full items-center gap-2 p-2.5 text-left" data-testid="page-appearance-toggle">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted"><Palette className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">Aparência da página</span>
                <span className="block truncate text-xs text-muted-foreground">{look.style === 'scrapbook' ? 'Scrapbook' : 'Clássico'} · estilo, fundo, cor e capa</span>
              </span>
              <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', lookOpen && 'rotate-180')} />
            </button>
            {lookOpen && (
              <div className="border-t p-3">
                <AppearanceFields look={look} brandColor={brandColor} onChange={(p) => { setLook((prev) => ({ ...prev, ...p })); setDirty(true); }} />
              </div>
            )}
          </div>
          {blocks.map((b, i) => (
            <BlockCard
              key={b.id}
              block={b}
              open={openId === b.id}
              onToggle={() => setOpenId(openId === b.id ? null : b.id!)}
              onChange={(patch) => patchBlock(b.id!, patch)}
              onMove={(dir) => move(i, dir)}
              onRemove={() => change((prev) => prev.filter((x) => x.id !== b.id))}
              first={i === 0}
              last={i === blocks.length - 1}
              entities={entities}
              pdfs={pdfs}
            />
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full border-dashed" data-testid="page-add-block"><Plus className="mr-1.5 h-4 w-4" />Adicionar bloco</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              {BLOCK_KINDS.filter((k) => k.type !== 'tracking' || !hasTracking).map((k) => (
                <DropdownMenuItem key={k.type} onClick={() => add(k.type)} className="items-start gap-2">
                  <k.icon className="mt-0.5 h-4 w-4" />
                  <span><span className="block text-sm">{k.label}</span><span className="block text-xs text-muted-foreground">{k.hint}</span></span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Smartphone className="h-3.5 w-3.5" />Como o cliente vê no celular{hasTracking ? ' (com um registro de exemplo)' : ''}</p>
          <div className="mx-auto h-[75vh] max-w-[420px] overflow-y-auto rounded-[2rem] border-[6px] border-slate-800 bg-slate-50 shadow-xl" data-testid="page-preview">
            {previewError ? (
              <p className="m-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{previewError}</p>
            ) : preview ? (
              <SitePageView data={preview} tenantSlug="" pageSlug="" preview />
            ) : (
              <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SitePageEditorPage() {
  const params = useParams<{ id: string }>();
  return (
    <RequireRole module="publicLinks">
      <DesktopOnlyEditor action="editar páginas">
        <EditorContent id={params.id} />
      </DesktopOnlyEditor>
    </RequireRole>
  );
}

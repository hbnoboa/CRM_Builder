'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, ChevronRight, Copy, Monitor, PanelBottom, PanelTop, Smartphone, Trash2, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  BLOCK_KINDS, BlockFields, ImagePick, Segmented,
  type EditorEntity, type EditorPdf, type SiteLookDraft,
} from '@/components/site/site-block-editor';
import { SiteFooterFields, SiteMenuFields } from '@/components/site/site-config-fields';
import ImageUploadField from '@/components/form/image-upload-field';
import type { SiteConfigDraft, SiteInfo } from '@/hooks/use-site-pages';
import type { SiteHideOn, SiteItemStyle, SiteLayoutItem, SiteSection, SiteSpacing } from '@/lib/site-api';
import { SITE_GRID, mobileOrder, rowsToPx } from '@/components/site/site-page-view';
import { sectionOf, type PageDoc, type Selection } from './page-doc';
import { ThemeFields, type SavedTheme } from './theme-fields';

const SPACING: Array<{ value: SiteSpacing; label: string }> = [
  { value: 'none', label: 'Nenhum' }, { value: 'sm', label: 'Pequeno' }, { value: 'md', label: 'Médio' }, { value: 'lg', label: 'Grande' },
];
const SHOW: Array<{ value: 'all' | SiteHideOn; label: string }> = [
  { value: 'all', label: 'Sempre' }, { value: 'mobile', label: 'Só no computador' }, { value: 'desktop', label: 'Só no celular' },
];
const WIDTHS: Array<{ value: number; label: string }> = [
  { value: 3, label: '1/4' }, { value: 4, label: '1/3' }, { value: 6, label: '1/2' }, { value: 8, label: '2/3' }, { value: 12, label: 'Inteira' },
];

export interface InspectorActions {
  patchLook: (patch: SiteLookDraft) => void;
  patchSite: (patch: Partial<SiteConfigDraft>, tag?: string) => void;
  select: (sel: Selection) => void;
  /** Abre o texto formatado para escrever na propria pagina. */
  editText: (id: string) => void;
  patchBlock: (id: string, patch: Record<string, unknown>) => void;
  patchItem: (id: string, patch: Partial<SiteLayoutItem>) => void;
  patchSection: (id: string, patch: Partial<SiteSection>) => void;
  moveItemToSection: (id: string, sectionId: string) => void;
  moveOnPhone: (id: string, dir: -1 | 1) => void;
  autoMobileOrder: (sectionId: string) => void;
  setMinH: (id: string, rows: number | undefined) => void;
  duplicateItem: (id: string) => void;
  removeItem: (id: string) => void;
  moveSection: (id: string, dir: -1 | 1) => void;
  duplicateSection: (id: string) => void;
  removeSection: (id: string) => void;
}

interface Props extends InspectorActions {
  doc: PageDoc;
  selection: Selection;
  brandColor: string | null;
  entities: EditorEntity[];
  pdfs: EditorPdf[];
  scrap: boolean;
  sitePages: SiteInfo['pages'];
}

/** Painel da direita: o que estiver selecionado na pagina (pagina, secao ou elemento). */
export function PageInspector(props: Props) {
  const { doc, selection } = props;
  if (selection.kind === 'item') {
    const block = doc.blocks.find((b) => b.id === selection.id);
    const section = sectionOf(doc.layout, selection.id);
    const item = section?.items.find((it) => it.id === selection.id);
    if (block && section && item) return <ItemPanel {...props} block={block} section={section} item={item} />;
  }
  if (selection.kind === 'section') {
    const index = doc.layout.sections.findIndex((s) => s.id === selection.id);
    if (index >= 0) return <SectionPanel {...props} section={doc.layout.sections[index]} index={index} />;
  }
  if (selection.kind === 'header') return <HeaderPanel {...props} />;
  if (selection.kind === 'footer') return <FooterPanel {...props} />;
  return <PagePanel {...props} />;
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="space-y-4 p-4" data-testid="editor-inspector">
      <div>
        <p className="font-semibold">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value?: string; onChange: (v: string | undefined) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Label className="flex-1 text-xs">{label}</Label>
      <input type="color" value={value || '#ffffff'} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded border bg-background" aria-label={label} />
      {value ? <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => onChange(undefined)}>Sem cor</Button> : <span className="w-[62px] text-[11px] text-muted-foreground">Sem cor</span>}
    </div>
  );
}

/** Aparencia (tema) que vale nesta pagina: a do site ou a propria, e como mudar. */
function useActiveLook({ doc, patchLook, patchSite }: Props) {
  const own = !!doc.look.ownLook;
  return {
    own,
    look: (own ? doc.look : doc.site.look) as SiteLookDraft,
    patch: (p: SiteLookDraft) => (own ? patchLook(p) : patchSite({ look: { ...doc.site.look, ...p } }, `site-look:${Object.keys(p).join()}`)),
  };
}

function LookScope({ doc, patchLook }: Props) {
  const own = !!doc.look.ownLook;
  return (
    <div className="space-y-2">
      <Segmented value={own ? 'own' : 'site'} onChange={(v) => patchLook({ ownLook: v === 'own' })}
        options={[{ value: 'site', label: 'A do site' }, { value: 'own', label: 'Só desta página' }]} />
      <p className="rounded-md bg-sky-50 px-2.5 py-1.5 text-[11px] text-sky-900 dark:bg-sky-950 dark:text-sky-200" data-testid="editor-look-scope">
        {own
          ? 'Esta página tem aparência própria: o que mudar aqui vale só para ela.'
          : 'Aparência de todas as páginas do site: o que mudar aqui muda as outras páginas também.'}
      </p>
    </div>
  );
}

/** Tema completo (cores, fontes, estilos de texto, botoes, fundo...). */
function LookFields(props: Props) {
  const { doc, brandColor, patchSite } = props;
  const active = useActiveLook(props);
  return (
    <div className="space-y-3">
      <LookScope {...props} />
      <ThemeFields look={active.look} brandColor={brandColor} onChange={active.patch}
        saved={(doc.site.savedThemes || []) as SavedTheme[]} onSaved={(list) => patchSite({ savedThemes: list }, 'saved-themes')} />
    </div>
  );
}

function JumpButton({ icon: Icon, title, text, onClick }: { icon: typeof PanelTop; title: string; text: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2.5 rounded-lg border p-2.5 text-left hover:bg-muted">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted"><Icon className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{text}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

function PagePanel(props: Props) {
  const { select } = props;
  return (
    <Panel title="Aparência" subtitle="Tema do site: cores, fontes, estilos de texto, botões e fundo.">
      <LookFields {...props} />
      <div className="space-y-1.5 border-t pt-4">
        <p className="text-xs font-medium text-muted-foreground">Também em todas as páginas</p>
        <JumpButton icon={PanelTop} title="Topo e menu" text="Menu entre as páginas e página inicial" onClick={() => select({ kind: 'header' })} />
        <JumpButton icon={PanelBottom} title="Rodapé" text="Endereço, horários e contato" onClick={() => select({ kind: 'footer' })} />
      </div>
      <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
        <p className="mb-1 font-medium text-foreground">Como montar</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>Clique no topo, numa seção, num elemento ou no rodapé da página para mudar só aquilo.</li>
          <li>Arraste um elemento da esquerda para dentro de uma seção (ou clique nele).</li>
          <li>Arraste os elementos para mudar o lugar; puxe as laterais para a largura e a borda de baixo para a altura.</li>
          <li>Dois cliques num título ou texto para escrever direto na página.</li>
        </ul>
      </div>
    </Panel>
  );
}

function HeaderPanel(props: Props) {
  const { doc, sitePages, patchSite } = props;
  return (
    <Panel title="Topo e menu" subtitle="O menu e a página inicial valem para todas as páginas do site.">
      <HeaderLook {...props} />
      <div className="space-y-2 border-t pt-4">
        <p className="text-sm font-medium">Menu do site</p>
        <SiteMenuFields site={doc.site} pages={sitePages} onChange={(p) => patchSite(p, `site-menu:${Object.keys(p).join()}`)} />
      </div>
    </Panel>
  );
}

/** Capa e frase do topo (da aparencia que vale nesta pagina). */
function HeaderLook(props: Props) {
  const active = useActiveLook(props);
  return (
    <div className="space-y-3">
      <LookScope {...props} />
      <Field label="Foto de capa (topo da página)">
        <ImagePick value={active.look.coverUrl} onChange={(url) => active.patch({ coverUrl: url || undefined })} />
      </Field>
      <Field label="Frase embaixo do nome">
        <Input value={active.look.tagline ?? ''} onChange={(e) => active.patch({ tagline: e.target.value })} placeholder="Ex.: o cantinho mais fofo da cidade" className="h-8" />
      </Field>
    </div>
  );
}

function FooterPanel({ doc, patchSite }: Props) {
  return (
    <Panel title="Rodapé" subtitle="Igual em todas as páginas do site. Campo vazio não aparece.">
      <SiteFooterFields footer={doc.site.footer} onChange={(footer) => patchSite({ footer }, 'site-footer')} />
    </Panel>
  );
}

function SectionPanel({ section, index, doc, patchSection, moveSection, duplicateSection, removeSection }: Props & { section: SiteSection; index: number }) {
  const set = (patch: Partial<SiteSection>) => patchSection(section.id, patch);
  return (
    <Panel title={section.name || `Seção ${index + 1}`} subtitle="Uma faixa da página, de ponta a ponta.">
      <div className="flex gap-1.5">
        <Button size="sm" variant="outline" disabled={index === 0} onClick={() => moveSection(section.id, -1)}><ArrowUp className="mr-1 h-3.5 w-3.5" />Subir</Button>
        <Button size="sm" variant="outline" disabled={index === doc.layout.sections.length - 1} onClick={() => moveSection(section.id, 1)}><ArrowDown className="mr-1 h-3.5 w-3.5" />Descer</Button>
        <Button size="sm" variant="outline" onClick={() => duplicateSection(section.id)} aria-label="Duplicar seção"><Copy className="h-3.5 w-3.5" /></Button>
        <Button size="sm" variant="outline" className="text-destructive" onClick={() => removeSection(section.id)} aria-label="Excluir seção" data-testid="editor-section-remove"><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
      <Field label="Nome (só para você)">
        <Input value={section.name ?? ''} onChange={(e) => set({ name: e.target.value || undefined })} placeholder="Ex.: Topo, Sobre nós, Contato" className="h-8" />
      </Field>
      <Field label="Largura do conteúdo" hint="O fundo da seção sempre vai de ponta a ponta.">
        <Segmented value={section.width} onChange={(v) => set({ width: v })}
          options={[{ value: 'narrow', label: 'Estreita' }, { value: 'normal', label: 'Normal' }, { value: 'full', label: 'Tela toda' }]} />
      </Field>
      <Field label="Espaço em cima e embaixo">
        <Segmented value={section.padding} onChange={(v) => set({ padding: v })} options={SPACING} />
      </Field>
      <Field label="Cores da seção" hint="Variações do tema: mudou o tema, a seção acompanha.">
        <Segmented value={section.tone ?? 'page'} onChange={(v) => set({ tone: v === 'page' ? undefined : v })}
          options={[{ value: 'page', label: 'Como a página' }, { value: 'surface', label: 'Caixa' }, { value: 'accent', label: 'Destaque' }, { value: 'accent2', label: 'Destaque 2' }, { value: 'dark', label: 'Escura' }]} />
      </Field>
      <ColorField label="Cor de fundo própria" value={section.bg} onChange={(bg) => set({ bg })} />
      <div className="space-y-2 rounded-md border p-2.5">
        <label className="flex items-center justify-between text-sm">Degradê
          <Switch checked={!!section.gradient} onCheckedChange={(v) => set({ gradient: v ? { from: '#6366f1', to: '#ec4899', angle: 135, kind: 'linear' } : undefined })} data-testid="editor-section-gradient" />
        </label>
        {section.gradient && (
          <>
            <div className="flex items-center gap-2 text-xs">
              <input type="color" value={section.gradient.from} onChange={(e) => set({ gradient: { ...section.gradient!, from: e.target.value } })} className="h-8 w-10 rounded border" aria-label="Cor inicial" />
              <span>para</span>
              <input type="color" value={section.gradient.to} onChange={(e) => set({ gradient: { ...section.gradient!, to: e.target.value } })} className="h-8 w-10 rounded border" aria-label="Cor final" />
              <Segmented value={section.gradient.kind} onChange={(kind) => set({ gradient: { ...section.gradient!, kind } })}
                options={[{ value: 'linear', label: 'Reto' }, { value: 'radial', label: 'Redondo' }]} />
            </div>
            {section.gradient.kind === 'linear' && (
              <label className="block text-[11px] text-muted-foreground">Ângulo: {section.gradient.angle}°
                <input type="range" min={0} max={360} step={15} value={section.gradient.angle} onChange={(e) => set({ gradient: { ...section.gradient!, angle: Number(e.target.value) } })} className="w-full" />
              </label>
            )}
          </>
        )}
      </div>
      <Field label="Padrão por cima">
        <Segmented value={section.pattern ?? 'plain'} onChange={(v) => set({ pattern: v === 'plain' ? undefined : v })}
          options={[{ value: 'plain', label: 'Nenhum' }, { value: 'dots', label: 'Bolinhas' }, { value: 'hearts', label: 'Corações' }, { value: 'stars', label: 'Estrelas' }, { value: 'stripes', label: 'Listras' }, { value: 'grid', label: 'Caderno' }]} />
      </Field>
      <Field label="Foto de fundo">
        <ImagePick value={section.bgImage} onChange={(url) => set({ bgImage: url || undefined })} />
      </Field>
      <Field label="Vídeo de fundo (mp4 ou webm)">
        <ImageUploadField value={section.bgVideo ?? ''} onChange={(v) => set({ bgVideo: String(Array.isArray(v) ? v[0] ?? '' : v) || undefined })} mode="file" accept="video/mp4,video/webm" folder="site" />
        <Input value={section.bgVideo ?? ''} onChange={(e) => set({ bgVideo: e.target.value.trim() || undefined })} placeholder="…ou cole o link do vídeo (https://…mp4)" className="h-8 text-xs" />
      </Field>
      {(section.bgImage || section.bgVideo) && (
        <>
          <label className="flex items-center justify-between text-sm">Escurecer a foto/vídeo <Switch checked={!!section.overlay} onCheckedChange={(v) => set({ overlay: v })} /></label>
          {section.bgImage && !section.bgVideo && (
            <label className="flex items-center justify-between text-sm">Foto parada ao rolar (efeito parallax) <Switch checked={!!section.parallax} onCheckedChange={(v) => set({ parallax: v })} /></label>
          )}
        </>
      )}
      <label className="flex items-center justify-between text-sm">Texto claro (para fundo escuro) <Switch checked={!!section.light} onCheckedChange={(v) => set({ light: v })} /></label>
      <Field label="Mostrar">
        <Segmented value={section.hide ?? 'all'} onChange={(v) => set({ hide: v === 'all' ? undefined : v })} options={SHOW} />
      </Field>
    </Panel>
  );
}

function ItemPanel({ block, section, item, doc, entities, pdfs, scrap, editText, patchBlock, patchItem, moveItemToSection, duplicateItem, removeItem, moveOnPhone, autoMobileOrder, setMinH }: Props & {
  block: PageDoc['blocks'][number]; section: SiteSection; item: SiteLayoutItem;
}) {
  const [tab, setTab] = useState<'content' | 'style'>('content');
  const kind = BLOCK_KINDS.find((k) => k.type === block.type);
  const Icon = kind?.icon ?? Type;
  const style = item.style || {};
  const setStyle = (patch: Partial<SiteItemStyle>) => {
    const next = Object.fromEntries(Object.entries({ ...style, ...patch }).filter(([, v]) => v !== undefined && v !== false));
    patchItem(item.id, { style: Object.keys(next).length ? next : undefined });
  };
  return (
    <div data-testid="editor-inspector">
      <div className="flex items-center gap-2 border-b p-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted"><Icon className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{kind?.label ?? block.type}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{kind?.hint}</span>
        </span>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => duplicateItem(item.id)} aria-label="Duplicar"><Copy className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeItem(item.id)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button>
      </div>
      <div className="flex border-b text-sm">
        {(['content', 'style'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} data-testid={`editor-tab-${t}`}
            className={cn('flex-1 border-b-2 py-2 font-medium', tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {t === 'content' ? 'Conteúdo' : 'Estilo e posição'}
          </button>
        ))}
      </div>
      {tab === 'content' ? (
        <div className="space-y-3 p-4">
          {block.type === 'text' ? (
            <div className="space-y-2 rounded-lg bg-muted/60 p-3 text-sm">
              <p>O texto é escrito e formatado direto na página, como no Word: fonte, tamanho, cor, negrito, listas, alinhamento e links.</p>
              <Button size="sm" onClick={() => editText(item.id)} data-testid="editor-edit-text"><Type className="mr-1.5 h-4 w-4" />Escrever e formatar</Button>
              <p className="text-[11px] text-muted-foreground">Atalho: dois cliques no texto.</p>
            </div>
          ) : (
            <BlockFields block={block} onChange={(patch) => patchBlock(item.id, patch)} entities={entities} pdfs={pdfs} />
          )}
          {(block.type === 'image' || block.type === 'gallery') && (
            <p className="text-[11px] text-muted-foreground">Sem foto, fica guardado, mas não aparece na página publicada.</p>
          )}
          {block.type === 'button' && !block.url && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400">Sem link, o botão fica guardado, mas não aparece na página publicada.</p>
          )}
        </div>
      ) : (
        <div className="space-y-4 p-4">
          <Field label="Largura no computador" hint="Também dá para puxar pelas laterais do elemento na página.">
            <Segmented value={WIDTHS.some((w) => w.value === item.w) ? item.w : -1} options={WIDTHS}
              onChange={(w) => patchItem(item.id, { w, x: Math.min(item.x, 12 - w) })} />
          </Field>
          <HeightField item={item} scrap={scrap} onChange={(rows) => setMinH(item.id, rows)} />
          <PhoneOrderField item={item} section={section} onMove={(dir) => moveOnPhone(item.id, dir)} onAuto={() => autoMobileOrder(section.id)} />
          <Field label="Alinhamento do texto">
            <div className="flex gap-1.5">
              {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([value, AlignIcon]) => (
                <Button key={value} type="button" size="sm" variant={style.align === value ? 'default' : 'outline'} aria-label={value}
                  onClick={() => setStyle({ align: style.align === value ? undefined : value })}><AlignIcon className="h-4 w-4" /></Button>
              ))}
            </div>
          </Field>
          <Field label="Posição na altura" hint="Quando o elemento fica ao lado de outro mais alto.">
            <Segmented value={style.vAlign ?? 'top'} onChange={(v) => setStyle({ vAlign: v === 'top' ? undefined : v })}
              options={[{ value: 'top', label: 'Em cima' }, { value: 'center', label: 'No meio' }, { value: 'bottom', label: 'Embaixo' }]} />
          </Field>
          <ColorField label="Cor de fundo" value={style.bg} onChange={(bg) => setStyle({ bg })} />
          <Field label="Espaço interno">
            <Segmented value={style.padding ?? 'none'} onChange={(v) => setStyle({ padding: v === 'none' ? undefined : v })} options={SPACING} />
          </Field>
          <Field label="Cantos">
            <Segmented value={style.radius ?? 'none'} onChange={(v) => setStyle({ radius: v === 'none' ? undefined : v })}
              options={[{ value: 'none', label: 'Retos' }, { value: 'sm', label: 'Arredondados' }, { value: 'lg', label: 'Bem redondos' }]} />
          </Field>
          <label className="flex items-center justify-between text-sm">Sombra <Switch checked={!!style.shadow} onCheckedChange={(v) => setStyle({ shadow: v })} /></label>
          <label className="flex items-center justify-between text-sm">Texto claro <Switch checked={!!style.light} onCheckedChange={(v) => setStyle({ light: v })} /></label>
          <Field label="Mostrar">
            <div className="flex flex-wrap gap-1.5">
              {SHOW.map((o) => {
                const OIcon = o.value === 'mobile' ? Monitor : o.value === 'desktop' ? Smartphone : null;
                return (
                  <Button key={o.value} type="button" size="sm" variant={(item.hide ?? 'all') === o.value ? 'default' : 'outline'}
                    onClick={() => patchItem(item.id, { hide: o.value === 'all' ? undefined : o.value })} data-testid={`editor-show-${o.value}`}>
                    {OIcon && <OIcon className="mr-1 h-3.5 w-3.5" />}{o.label}
                  </Button>
                );
              })}
            </div>
          </Field>
          {doc.layout.sections.length > 1 && (
            <Field label="Seção">
              <select value={section.id} onChange={(e) => moveItemToSection(item.id, e.target.value)} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                {doc.layout.sections.map((s, i) => <option key={s.id} value={s.id}>{s.name || `Seção ${i + 1}`}</option>)}
              </select>
            </Field>
          )}
        </div>
      )}
    </div>
  );
}

/** Altura escolhida (px). Vazio: a do conteudo. Tambem da para puxar a borda de baixo na pagina. */
function HeightField({ item, scrap, onChange }: { item: SiteLayoutItem; scrap: boolean; onChange: (rows: number | undefined) => void }) {
  const current = item.minH ? String(rowsToPx(item.minH, scrap)) : '';
  const [text, setText] = useState(current);
  useEffect(() => setText(current), [current]);
  const commit = () => {
    const px = Number(text);
    if (!text.trim() || !Number.isFinite(px) || px <= 0) { onChange(undefined); setText(''); return; }
    const gap = SITE_GRID.gapY(scrap);
    onChange(Math.min(1000, Math.max(1, Math.ceil((px + gap) / (SITE_GRID.rowPx + gap)))));
  };
  return (
    <Field label="Altura mínima" hint="Puxe a borda de baixo do elemento na página, ou escreva em pixels. Vazio: a altura do conteúdo.">
      <div className="flex items-center gap-2">
        <Input value={text} inputMode="numeric" placeholder="Automática" className="h-8 w-28"
          onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, ''))} onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} data-testid="editor-min-height" />
        <span className="text-xs text-muted-foreground">px</span>
        {item.minH && <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => onChange(undefined)}>Automática</Button>}
      </div>
    </Field>
  );
}

/** Posicao do elemento no celular (dentro da secao). */
function PhoneOrderField({ item, section, onMove, onAuto }: { item: SiteLayoutItem; section: SiteSection; onMove: (dir: -1 | 1) => void; onAuto: () => void }) {
  const list = mobileOrder(section.items);
  const index = list.findIndex((it) => it.id === item.id);
  const custom = section.items.some((it) => it.order !== undefined);
  return (
    <Field label={`Ordem no celular: ${index + 1}º de ${list.length}`} hint={custom ? 'Ordem escolhida para esta seção.' : 'Automática: de cima para baixo, da esquerda para a direita.'}>
      <div className="flex flex-wrap gap-1.5">
        <Button type="button" size="sm" variant="outline" disabled={index <= 0} onClick={() => onMove(-1)} data-testid="editor-phone-up"><ArrowUp className="mr-1 h-3.5 w-3.5" />Antes</Button>
        <Button type="button" size="sm" variant="outline" disabled={index >= list.length - 1} onClick={() => onMove(1)} data-testid="editor-phone-down"><ArrowDown className="mr-1 h-3.5 w-3.5" />Depois</Button>
        {custom && <Button type="button" size="sm" variant="ghost" onClick={onAuto}>Voltar à automática</Button>}
      </div>
    </Field>
  );
}

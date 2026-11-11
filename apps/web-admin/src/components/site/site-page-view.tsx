'use client';

import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { AtSign, CheckCircle2, Clock, Copy, Download, ExternalLink, FileText, Loader2, Mail, MapPin, MessageCircle, Paperclip, Phone, Star, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { siteScriptFont } from '@/lib/site-fonts';
import { absoluteSiteUrl, siteApi, type SiteAppearance, type SiteFooter, type SiteBlockView, type SiteCatalogItem, type SiteFieldDef, type SiteItemStyle, type SiteLayout, type SiteLayoutItem, type SitePageData, type SiteRecordView, type SiteSection, type SiteSpacing, type SiteValue } from '@/lib/site-api';

const DEFAULT_BRAND = '#2563eb';
const SERIF = "Georgia, 'Times New Roman', serif";
const SCRIPT = "var(--font-site-script), 'Snell Roundhand', 'Segoe Script', cursive";

interface SitePageViewProps {
  data: SitePageData;
  tenantSlug: string;
  pageSlug: string;
  token?: string | null;
  /** Previa do editor: mostra tudo, mas nao envia nada. */
  preview?: boolean;
  onChanged?: () => void;
}

/** Mistura a cor com branco (ou transparente) em CSS: so precisa do hex da marca. */
const tint = (color: string, pct: number, base = 'white') => `color-mix(in srgb, ${color} ${pct}%, ${base})`;

const svgUrl = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

/** Fundo da pagina: cor clara da marca com um padrao leve (bolinhas, coracoes...). */
function backgroundStyle(look: SiteAppearance, brand: string): CSSProperties {
  const scrap = look.style === 'scrapbook';
  const base = scrap ? tint(brand, 9) : '#f8fafc';
  const ink = tint(brand, scrap ? 26 : 14, 'transparent');
  switch (look.background) {
    case 'dots':
      return { backgroundColor: base, backgroundImage: `radial-gradient(${ink} 1.6px, transparent 1.8px)`, backgroundSize: '20px 20px' };
    case 'hearts':
      return {
        backgroundColor: base,
        backgroundImage: svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='56' height='56'><path d='M28 40s-11-7-11-14a6 6 0 0 1 11-3 6 6 0 0 1 11 3c0 7-11 14-11 14z' fill='${brand}' fill-opacity='0.09'/></svg>`),
        backgroundSize: '56px 56px',
      };
    case 'stars':
      return {
        backgroundColor: base,
        backgroundImage: svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><path d='M15 8l2 5 5 .4-4 3.3 1.3 5-4.3-2.8-4.3 2.8 1.3-5-4-3.3 5-.4z' fill='${brand}' fill-opacity='0.16'/><circle cx='44' cy='42' r='2' fill='${brand}' fill-opacity='0.2'/></svg>`),
        backgroundSize: '60px 60px',
      };
    case 'stripes':
      return { backgroundColor: base, backgroundImage: `repeating-linear-gradient(135deg, ${tint(brand, 6, 'transparent')} 0 16px, transparent 16px 32px)` };
    case 'grid':
      return {
        backgroundColor: scrap ? '#fffdf8' : base,
        backgroundImage: `linear-gradient(${ink} 1px, transparent 1px), linear-gradient(90deg, ${ink} 1px, transparent 1px)`,
        backgroundSize: '24px 24px',
      };
    default:
      return { backgroundColor: base };
  }
}

export function siteLook(data: SitePageData) {
  const look: SiteAppearance = data.page.settings ?? { style: 'classic', background: 'plain' };
  const brand = look.accent || data.tenant.brandColor || DEFAULT_BRAND;
  return { look, brand, scrap: look.style === 'scrapbook' };
}

/** Pagina antiga (sem secoes): uma secao estreita com os blocos em sequencia. */
export function layoutOf(data: Pick<SitePageData, 'blocks' | 'layout'>): SiteLayout {
  if (data.layout?.sections?.length) return data.layout;
  return { sections: [{ id: 'secao-1', width: 'narrow', padding: 'md', items: data.blocks.map((b, i) => ({ id: b.id, x: 0, y: i, w: 12, h: 1 })) }] };
}

/** Ordem de leitura de uma secao (de cima para baixo, da esquerda para a direita). */
export const readingOrder = (items: SiteLayoutItem[]) => [...items].sort((a, b) => a.y - b.y || a.x - b.x);

/** Ordem no celular: a escolhida no editor ou, sem escolha, a de leitura. */
export function mobileOrder(items: SiteLayoutItem[]): SiteLayoutItem[] {
  const read = readingOrder(items);
  if (!items.some((it) => it.order !== undefined)) return read;
  return read.map((it, i) => ({ it, k: it.order ?? 1000 + i })).sort((a, b) => a.k - b.k).map((x) => x.it);
}

/** Altura escolhida (linhas da grade) em px. */
export const rowsToPx = (rows: number, scrap: boolean) => rows * (SITE_GRID.rowPx + SITE_GRID.gapY(scrap)) - SITE_GRID.gapY(scrap);

/**
 * Grade: no computador 12 colunas (linha minima de ROW_PX, espacos de GAP_X/gap);
 * no celular, um embaixo do outro. O editor usa os mesmos numeros, para a pagina
 * sair igual ao que se montou.
 */
export const SITE_GRID = { cols: 12, rowPx: 8, gapX: 24, gapY: (scrap: boolean) => (scrap ? 32 : 20) };

/** Pagina para clientes: o que o cliente final ve, no computador e no celular. */
export function SitePageView({ data, tenantSlug, pageSlug, token, preview, onChanged }: SitePageViewProps) {
  const { brand, scrap } = siteLook(data);
  const byId = new Map(data.blocks.map((b) => [b.id, b]));
  let order = 0;
  return (
    <SiteFrame data={data} preview={preview}>
      <main>
        {layoutOf(data).sections.map((section) => {
          const onPhone = mobileOrder(section.items);
          return (
            <SectionShell key={section.id} section={section} brand={brand} scrap={scrap}>
              <div className="site-grid">
                {readingOrder(section.items).map((item) => {
                  const block = byId.get(item.id);
                  if (!block) return null;
                  const visual = itemVisual(item);
                  return (
                    <div
                      key={item.id}
                      id={block.id}
                      className={cn('site-item scroll-mt-4', visual.className, item.hide && `site-hide-${item.hide}`)}
                      style={{
                        ...visual.style,
                        '--site-col': `${item.x + 1} / span ${item.w}`,
                        '--site-rows': `${item.y + 1} / span ${item.h}`,
                        '--site-order': onPhone.indexOf(item),
                        ...(item.minH ? { '--site-minh': `${rowsToPx(item.minH, scrap)}px` } : {}),
                      } as CSSProperties}
                    >
                      <BlockView
                        block={block} index={order++} data={data} brand={brand} scrap={scrap}
                        tenantSlug={tenantSlug} pageSlug={pageSlug} token={token} preview={preview} onChanged={onChanged}
                      />
                    </div>
                  );
                })}
              </div>
            </SectionShell>
          );
        })}
      </main>
    </SiteFrame>
  );
}

/** Fundo, topo, menu e rodape da pagina, em volta do conteudo. */
export function SiteFrame({ data, preview, children, onHeaderClick }: { data: SitePageData; preview?: boolean; children: ReactNode; onHeaderClick?: () => void }) {
  const { look, brand, scrap } = siteLook(data);
  // Topo, menu e rodape acompanham a largura do conteudo (pagina so com secoes estreitas fica como era)
  const width = layoutOf(data).sections.some((s) => s.width !== 'narrow') ? 'max-w-6xl' : scrap ? 'max-w-3xl' : 'max-w-2xl';
  const style = { '--site-brand': brand, '--site-gap-y': `${SITE_GRID.gapY(scrap)}px`, ...backgroundStyle(look, brand) } as CSSProperties;
  return (
    <div className={cn('site-canvas text-slate-900', siteScriptFont.variable, preview ? 'min-h-full' : 'min-h-screen')} style={style} data-testid="site-page" data-style={look.style}>
      <div onClick={onHeaderClick} className={onHeaderClick ? 'cursor-pointer' : undefined}>
        {scrap ? <ScrapHeader data={data} look={look} brand={brand} /> : <ClassicHeader data={data} look={look} brand={brand} width={width} />}
        <SiteMenu data={data} brand={brand} scrap={scrap} preview={preview} width={width} />
      </div>
      {children}
      <SiteFooterInfo footer={data.site?.footer} brand={brand} scrap={scrap} width={width} />
      {scrap ? (
        <footer className="px-4 pb-10 pt-4 text-center">
          <p className="text-2xl" style={{ fontFamily: SCRIPT, color: brand }}>feito com ♡</p>
          <p className="mt-1 text-xs text-slate-500">{data.tenant.name} · CRM Builder</p>
        </footer>
      ) : (
        <footer className={cn('mx-auto px-4 pb-8 pt-2 text-center text-xs text-slate-400', width)}>
          {data.tenant.name} · feito com CRM Builder
        </footer>
      )}
    </div>
  );
}

const SECTION_WIDTH: Record<SiteSection['width'], string> = { narrow: 'max-w-3xl', normal: 'max-w-6xl', full: 'max-w-none csm:px-8' };
const SECTION_PAD: Record<SiteSpacing, string> = { none: 'py-0', sm: 'py-4', md: 'py-8', lg: 'py-14 csm:py-24' };
const ITEM_PAD: Record<SiteSpacing, string> = { none: '', sm: 'p-3', md: 'p-5', lg: 'p-8' };
const ITEM_RADIUS: Record<NonNullable<SiteItemStyle['radius']>, string> = { none: 'rounded-none', sm: 'rounded-lg', lg: 'rounded-3xl' };

/** Faixa da pagina: largura, espaco em cima/embaixo, cor ou foto de fundo. */
export function SectionShell({ section, brand, scrap, children, className, editing }: {
  section: SiteSection; brand: string; scrap: boolean; children: ReactNode; className?: string; editing?: boolean;
}) {
  const style: CSSProperties = {};
  if (section.bgImage) {
    style.backgroundImage = `${section.overlay ? 'linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), ' : ''}url(${section.bgImage})`;
    style.backgroundSize = 'cover';
    style.backgroundPosition = 'center';
  }
  if (section.bg) style.backgroundColor = section.bg;
  if (section.light) style.color = '#fff';
  return (
    <section
      id={section.id}
      data-scrap={scrap || undefined}
      className={cn('relative scroll-mt-4', SECTION_PAD[section.padding], section.light && 'site-ink-light', !editing && section.hide && `site-hide-${section.hide}`, className)}
      style={{ ...style, '--site-brand': brand } as CSSProperties}
    >
      <div className={cn('mx-auto px-4', SECTION_WIDTH[section.width], section.width === 'full' && section.padding === 'none' && 'px-0 csm:px-0')}>
        {children}
      </div>
    </section>
  );
}

/** Aparencia de um elemento na grade: fundo, espaco interno, cantos, sombra, alinhamento. */
export function itemVisual(item: SiteLayoutItem): { className: string; style: CSSProperties } {
  const st = item.style || {};
  return {
    className: cn(
      st.padding && ITEM_PAD[st.padding],
      st.radius && ITEM_RADIUS[st.radius],
      st.shadow && 'shadow-lg',
      st.align === 'center' ? 'text-center' : st.align === 'right' ? 'text-right' : st.align === 'left' ? 'text-left' : '',
      st.vAlign && st.vAlign !== 'top' && cn('flex flex-col', st.vAlign === 'center' ? 'justify-center' : 'justify-end'),
      st.light && 'site-ink-light',
    ),
    style: { ...(st.bg ? { backgroundColor: st.bg } : {}), ...(st.light ? { color: '#fff' } : {}) },
  };
}

/**
 * Menu entre as paginas do site. Links relativos (so o endereco da pagina): funcionam
 * em /p/<empresa>/<pagina> e no subdominio da empresa. Na previa nao navega.
 */
function SiteMenu({ data, brand, scrap, preview, width }: { data: SitePageData; brand: string; scrap: boolean; preview?: boolean; width: string }) {
  const menu = data.site?.menu || [];
  if (menu.length < 2) return null;
  return (
    <nav aria-label="Páginas do site" data-testid="site-menu"
      className={cn(scrap ? 'mx-auto max-w-3xl px-4 pt-6' : 'sticky top-0 z-20 border-b bg-white/95 backdrop-blur')}>
      <ul className={cn('flex gap-2', scrap ? 'flex-wrap justify-center' : cn('mx-auto overflow-x-auto px-4 py-2', width))}>
        {menu.map((m) => {
          const cls = scrap
            ? 'block whitespace-nowrap rounded-full border-2 px-4 py-1.5 text-[15px] font-semibold transition-colors'
            : 'block whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors';
          const style: CSSProperties = scrap
            ? (m.current ? { backgroundColor: brand, borderColor: brand, color: '#fff' } : { borderColor: tint(brand, 45), color: brand, backgroundColor: 'white' })
            : (m.current ? { backgroundColor: tint(brand, 12), color: brand } : { color: '#475569' });
          return (
            <li key={m.slug} className="shrink-0">
              {preview
                ? <span className={cls} style={style}>{m.label}</span>
                : <a href={m.slug} className={cls} style={style} aria-current={m.current ? 'page' : undefined}>{m.label}</a>}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Link do WhatsApp: numero com DDI (sem ele, assume Brasil). */
function waLink(raw: string) {
  const digits = raw.replace(/\D/g, '');
  return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`;
}

/** Contato e horarios no fim de todas as paginas do site. */
function SiteFooterInfo({ footer, brand, scrap, width }: { footer?: SiteFooter; brand: string; scrap: boolean; width: string }) {
  if (!footer || Object.keys(footer).length === 0) return null;
  const rows = [
    footer.address ? { icon: MapPin, text: footer.address, href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(footer.address)}` } : null,
    footer.hours ? { icon: Clock, text: footer.hours } : null,
    footer.whatsapp ? { icon: MessageCircle, text: 'WhatsApp', href: waLink(footer.whatsapp) } : null,
    footer.phone ? { icon: Phone, text: footer.phone, href: `tel:${footer.phone.replace(/[^\d+]/g, '')}` } : null,
    footer.instagram ? { icon: AtSign, text: `@${footer.instagram}`, href: `https://instagram.com/${footer.instagram}` } : null,
    footer.email ? { icon: Mail, text: footer.email, href: `mailto:${footer.email}` } : null,
  ].filter((r): r is { icon: typeof MapPin; text: string; href?: string } => !!r);
  return (
    <section className={cn('mx-auto mt-6 px-4', width)} data-testid="site-footer">
      <div className={cn('bg-white p-5', scrap ? 'rounded-[2rem] border-2 border-dashed text-center' : 'rounded-2xl border')}
        style={scrap ? { borderColor: tint(brand, 40) } : undefined}>
        {footer.text && <p className={cn('mb-3 whitespace-pre-line text-slate-700', scrap && 'text-[16px]')} style={scrap ? { fontFamily: SERIF } : undefined}>{footer.text}</p>}
        <ul className={cn('flex flex-wrap gap-x-5 gap-y-2 text-sm', scrap && 'justify-center')}>
          {rows.map((r) => {
            const Icon = r.icon;
            const inner = <><Icon className="h-4 w-4 shrink-0" style={{ color: brand }} /><span>{r.text}</span></>;
            return (
              <li key={r.text}>
                {r.href
                  ? <a href={r.href} target={r.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-slate-700 hover:underline">{inner}</a>
                  : <span className="inline-flex items-center gap-1.5 text-slate-700">{inner}</span>}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Avatar({ data, brand, className }: { data: SitePageData; brand: string; className: string }) {
  return data.tenant.logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={data.tenant.logo} alt={data.tenant.name} className={cn('bg-white object-contain', className)} />
  ) : (
    <span className={cn('flex items-center justify-center font-bold text-white', className)} style={{ backgroundColor: brand }}>
      {data.tenant.name.charAt(0).toUpperCase()}
    </span>
  );
}

function ClassicHeader({ data, look, brand, width }: { data: SitePageData; look: SiteAppearance; brand: string; width: string }) {
  return (
    <header className="border-b bg-white">
      {look.coverUrl && <div className="h-36 w-full bg-cover bg-center csm:h-48" style={{ backgroundImage: `url(${look.coverUrl})` }} />}
      <div className={cn('mx-auto flex items-center gap-3 px-4 py-3', width)}>
        <Avatar data={data} brand={brand} className="h-9 w-9 rounded-lg text-sm" />
        <span className="min-w-0">
          <span className="block font-semibold">{data.tenant.name}</span>
          {look.tagline && <span className="block truncate text-xs text-slate-500">{look.tagline}</span>}
        </span>
      </div>
    </header>
  );
}

/** Topo estilo blog antigo: capa, avatar redondo, nome em serifa e frase manuscrita. */
function ScrapHeader({ data, look, brand }: { data: SitePageData; look: SiteAppearance; brand: string }) {
  return (
    <header className="relative">
      {look.coverUrl ? (
        <div className="h-52 w-full bg-cover bg-center csm:h-72" style={{ backgroundImage: `url(${look.coverUrl})` }} />
      ) : (
        <div className="h-28 w-full" style={{ background: `linear-gradient(135deg, ${brand}, ${tint(brand, 45)})` }} />
      )}
      <div className="mx-auto -mt-14 max-w-3xl px-4 text-center">
        <Avatar data={data} brand={brand} className="mx-auto h-28 w-28 rounded-full border-[5px] border-white text-4xl shadow-lg" />
        <h1 className="mt-3 text-4xl font-bold italic tracking-tight csm:text-5xl" style={{ fontFamily: SERIF }}>{data.tenant.name}</h1>
        {look.tagline && <p className="mt-1 text-2xl csm:text-3xl" style={{ fontFamily: SCRIPT, color: brand }}>{look.tagline}</p>}
        <p className="mt-3 text-sm tracking-[0.6em]" style={{ color: brand }} aria-hidden>✿ ♡ ✿</p>
      </div>
    </header>
  );
}

/** Fita adesiva das polaroides. */
function Tape({ brand, rotate = -4 }: { brand: string; rotate?: number }) {
  return (
    <span aria-hidden className="absolute -top-3 left-1/2 z-10 h-6 w-20 -translate-x-1/2 opacity-80 shadow-sm"
      style={{ backgroundColor: tint(brand, 40), transform: `translateX(-50%) rotate(${rotate}deg)` }} />
  );
}

const TILT = [-2.2, 1.6, -0.8, 2.4, -1.4, 0.9];
const COLS: Record<number, string> = { 1: '', 2: 'csm:grid-cols-2', 3: 'csm:grid-cols-3' };

function BlockTitle({ text, brand, scrap }: { text?: string; brand: string; scrap: boolean }) {
  if (!text) return null;
  return scrap
    ? <h2 className="mb-5 text-center text-4xl csm:text-5xl" style={{ fontFamily: SCRIPT, color: brand }}>{text}</h2>
    : <h2 className="mb-3 text-xl font-semibold">{text}</h2>;
}

export type BlockViewProps = { block: SiteBlockView; index: number; data: SitePageData; brand: string; scrap: boolean } & Omit<SitePageViewProps, 'data'>;

export function BlockView({ block, index, data, brand, scrap, tenantSlug, pageSlug, token, preview, onChanged }: BlockViewProps) {
  switch (block.type) {
    case 'heading':
      if (scrap) {
        return block.size === 'md'
          ? <h2 className="text-center text-2xl font-bold italic" style={{ fontFamily: SERIF }}><span style={{ color: brand }}>♡</span> <span data-edit="text">{block.text}</span> <span style={{ color: brand }}>♡</span></h2>
          : <h2 className="text-center text-5xl leading-tight csm:text-6xl" style={{ fontFamily: SCRIPT, color: brand }} data-edit="text">{block.text}</h2>;
      }
      return block.size === 'md'
        ? <h2 className="text-xl font-semibold" data-edit="text">{block.text}</h2>
        : <h1 className="text-2xl font-bold tracking-tight csm:text-3xl" data-edit="text">{block.text}</h1>;
    case 'text':
      return scrap ? (
        <div className="relative mx-auto max-w-2xl rounded-md border-2 border-dashed bg-white/90 px-6 py-5 shadow-sm" style={{ borderColor: tint(brand, 35) }}>
          <p className={cn('whitespace-pre-line text-[17px] leading-relaxed text-slate-700', block.text.length < 220 && 'text-center')} style={{ fontFamily: SERIF }} data-edit="text">{block.text}</p>
        </div>
      ) : <p className="whitespace-pre-line text-[15px] leading-relaxed text-slate-700" data-edit="text">{block.text}</p>;
    case 'image':
      return scrap ? (
        <figure className="relative mx-auto max-w-md bg-white p-3 pb-10 shadow-lg" style={{ transform: `rotate(${TILT[index % TILT.length]}deg)` }}>
          <Tape brand={brand} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.url} alt={block.alt || ''} className="w-full object-cover" />
          {block.alt && <figcaption className="absolute inset-x-0 bottom-2 text-center text-xl text-slate-600" style={{ fontFamily: SCRIPT }}>{block.alt}</figcaption>}
        </figure>
      // eslint-disable-next-line @next/next/no-img-element
      ) : <img src={block.url} alt={block.alt || ''} className="w-full rounded-xl object-cover" />;
    case 'button':
      return (
        <div className={scrap ? 'text-center' : undefined}>
          <a href={block.url} target={/^https?:/.test(block.url) ? '_blank' : undefined} rel="noopener noreferrer"
            className={cn('inline-flex items-center justify-center font-semibold text-white', scrap ? 'rounded-full px-8 py-3.5 text-base transition-transform hover:-translate-y-0.5' : 'h-11 rounded-lg px-5 text-sm shadow-sm')}
            style={{ backgroundColor: brand, ...(scrap ? { boxShadow: `0 5px 0 ${tint(brand, 70, 'black')}` } : {}) }}>
            {scrap && <span className="mr-2" aria-hidden>♡</span>}{block.label}
          </a>
        </div>
      );
    case 'divider':
      return scrap
        ? <p className="text-center text-lg tracking-[0.5em]" style={{ color: brand }} aria-hidden>· ✿ · ♡ · ✿ ·</p>
        : <hr className="border-slate-200" />;
    case 'hero':
      return <HeroView block={block} brand={brand} scrap={scrap} />;
    case 'gallery':
      return <GalleryView block={block} brand={brand} scrap={scrap} />;
    case 'cards':
      return <CardsView block={block} brand={brand} scrap={scrap} />;
    case 'quote':
      return scrap ? (
        <blockquote className="mx-auto max-w-2xl rounded-[2rem] px-6 py-8 text-center" style={{ backgroundColor: tint(brand, 14) }}>
          <span className="block text-7xl leading-[0.5]" style={{ fontFamily: SERIF, color: brand }} aria-hidden>“</span>
          <p className="mt-2 text-xl italic text-slate-800 csm:text-2xl" style={{ fontFamily: SERIF }} data-edit="text">{block.text}</p>
          {block.author && <footer className="mt-3 text-xl" style={{ fontFamily: SCRIPT, color: brand }}>— {block.author}</footer>}
        </blockquote>
      ) : (
        <blockquote className="border-l-4 pl-4" style={{ borderColor: brand }}>
          <p className="text-lg italic text-slate-700">“<span data-edit="text">{block.text}</span>”</p>
          {block.author && <footer className="mt-1 text-sm text-slate-500">— {block.author}</footer>}
        </blockquote>
      );
    case 'catalog':
      return <CatalogView block={block} brand={brand} scrap={scrap} preview={preview} />;
    case 'form':
      return <PublicForm block={block} brand={brand} scrap={scrap} tenantSlug={tenantSlug} pageSlug={pageSlug} preview={preview} />;
    case 'tracking':
      return (
        <TrackingView
          block={block} record={data.record} error={data.trackingError} brand={brand}
          tenantSlug={tenantSlug} pageSlug={pageSlug} token={token} preview={preview} onChanged={onChanged}
        />
      );
    default:
      return null;
  }
}

function HeroView({ block, brand, scrap }: { block: Extract<SiteBlockView, { type: 'hero' }>; brand: string; scrap: boolean }) {
  const bg: CSSProperties = block.imageUrl
    ? { backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.62), rgba(0,0,0,0.08) 65%), url(${block.imageUrl})` }
    : { background: `linear-gradient(135deg, ${brand}, ${tint(brand, 55, 'black')})` };
  return (
    <section
      className={cn('relative flex min-h-[300px] flex-col justify-end overflow-hidden bg-cover bg-center p-6 text-white csm:min-h-[380px] csm:p-10',
        scrap ? 'rounded-[2rem] border-[6px] border-white text-center shadow-xl' : 'rounded-2xl')}
      style={bg}
      data-testid="site-hero"
    >
      <h2 className={scrap ? 'text-5xl leading-tight drop-shadow csm:text-6xl' : 'text-3xl font-bold tracking-tight csm:text-4xl'}
        style={scrap ? { fontFamily: SCRIPT } : undefined}>{block.title}</h2>
      {block.text && <p className={cn('mt-2 max-w-xl text-white/90', scrap ? 'mx-auto text-lg italic' : 'text-base')} style={scrap ? { fontFamily: SERIF } : undefined}>{block.text}</p>}
      {block.buttonLabel && block.buttonUrl && (
        <div className="mt-5">
          <a href={block.buttonUrl} target={/^https?:/.test(block.buttonUrl) ? '_blank' : undefined} rel="noopener noreferrer"
            className={cn('inline-flex items-center justify-center font-semibold', scrap ? 'rounded-full bg-white px-7 py-3' : 'h-11 rounded-lg px-5 text-sm text-white')}
            style={scrap ? { color: brand } : { backgroundColor: brand }}>
            {block.buttonLabel}
          </a>
        </div>
      )}
    </section>
  );
}

function GalleryView({ block, brand, scrap }: { block: Extract<SiteBlockView, { type: 'gallery' }>; brand: string; scrap: boolean }) {
  return (
    <section data-testid="site-gallery">
      <BlockTitle text={block.title} brand={brand} scrap={scrap} />
      {block.layout === 'polaroid' ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 csm:grid-cols-3 csm:gap-x-6">
          {block.images.map((img, i) => (
            <figure key={`${img.url}-${i}`} className="relative bg-white p-2 pb-9 shadow-md transition-transform hover:z-20 hover:scale-105 csm:p-2.5 csm:pb-10"
              style={{ transform: `rotate(${TILT[i % TILT.length]}deg)` }}>
              {i % 2 === 0 && <Tape brand={brand} rotate={TILT[(i + 2) % TILT.length] * 2} />}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.caption || ''} className="aspect-square w-full object-cover" loading="lazy" />
              {img.caption && <figcaption className="absolute inset-x-1 bottom-1.5 truncate text-center text-lg text-slate-600 csm:text-xl" style={{ fontFamily: SCRIPT }}>{img.caption}</figcaption>}
            </figure>
          ))}
        </div>
      ) : block.layout === 'mosaic' ? (
        <div className="columns-2 gap-3 csm:columns-3">
          {block.images.map((img, i) => (
            <figure key={`${img.url}-${i}`} className={cn('relative mb-3 break-inside-avoid overflow-hidden', scrap ? 'rounded-2xl border-4 border-white shadow-md' : 'rounded-xl')}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.caption || ''} className="w-full" loading="lazy" />
              {img.caption && <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-2 pt-6 text-sm text-white">{img.caption}</figcaption>}
            </figure>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 csm:grid-cols-3">
          {block.images.map((img, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={`${img.url}-${i}`} src={img.url} alt={img.caption || ''} title={img.caption} className={cn('aspect-square w-full object-cover', scrap ? 'rounded-2xl' : 'rounded-lg')} loading="lazy" />
          ))}
        </div>
      )}
    </section>
  );
}

function CardsView({ block, brand, scrap }: { block: Extract<SiteBlockView, { type: 'cards' }>; brand: string; scrap: boolean }) {
  return (
    <section data-testid="site-cards">
      <BlockTitle text={block.title} brand={brand} scrap={scrap} />
      <div className={cn('grid gap-5', COLS[block.columns])}>
        {block.items.map((item, i) => (
          <article key={`${item.title}-${i}`}
            className={cn('relative overflow-visible', scrap ? 'rounded-3xl border-2 border-dashed bg-white p-3 shadow-sm' : 'overflow-hidden rounded-xl border bg-white shadow-sm')}
            style={scrap ? { borderColor: tint(brand, 40) } : undefined}>
            {item.badge && (
              <span className={cn('absolute z-10 text-xs font-bold text-white shadow', scrap ? '-right-2 -top-3 rotate-6 rounded-full px-3 py-1.5' : 'right-2 top-2 rounded-full px-2.5 py-1')}
                style={{ backgroundColor: brand }}>{item.badge}</span>
            )}
            {item.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt="" className={cn('aspect-[4/3] w-full object-cover', scrap && 'rounded-2xl')} loading="lazy" />
            )}
            <div className={scrap ? 'px-2 pb-2 pt-3 text-center' : 'p-4'}>
              <h3 className={scrap ? 'text-xl font-bold italic' : 'font-semibold'} style={scrap ? { fontFamily: SERIF } : undefined}>{item.title}</h3>
              {item.text && <p className={cn('mt-1 whitespace-pre-line text-slate-600', scrap ? 'text-[15px]' : 'text-sm')} style={scrap ? { fontFamily: SERIF } : undefined}>{item.text}</p>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function money(value: number, type?: string) {
  return type === 'currency' ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : value.toLocaleString('pt-BR');
}

function CatalogView({ block, brand, scrap, preview }: { block: Extract<SiteBlockView, { type: 'catalog' }>; brand: string; scrap: boolean; preview?: boolean }) {
  if (block.items.length === 0) {
    return preview
      ? <p className="rounded-xl border-2 border-dashed bg-white/70 p-5 text-center text-sm text-slate-500">Os itens de {block.entityName} aparecem aqui assim que forem cadastrados.</p>
      : null;
  }
  const groups: Array<{ name: string; items: SiteCatalogItem[] }> = [];
  for (const item of block.items) {
    const name = item.group || '';
    const g = groups.find((x) => x.name === name) ?? groups[groups.push({ name, items: [] }) - 1];
    g.items.push(item);
  }
  return (
    <section className={cn(scrap ? 'rounded-[2rem] border-2 border-dashed bg-white px-5 py-7 shadow-md csm:px-8' : 'rounded-2xl border bg-white p-5 shadow-sm')}
      style={scrap ? { borderColor: tint(brand, 40) } : undefined} data-testid="site-catalog">
      <BlockTitle text={block.title || block.entityName} brand={brand} scrap={scrap} />
      <div className="space-y-7">
        {groups.map((g) => (
          <div key={g.name || '-'}>
            {g.name && (
              <h3 className={cn('mb-3', scrap ? 'text-center text-xl font-bold italic' : 'text-xs font-semibold uppercase tracking-wider text-slate-500')} style={scrap ? { fontFamily: SERIF } : undefined}>
                {scrap && <span style={{ color: brand }}>✿ </span>}{g.name}{scrap && <span style={{ color: brand }}> ✿</span>}
              </h3>
            )}
            <ul className="space-y-4">
              {g.items.map((item) => (
                <li key={item.id} className="flex gap-3">
                  {item.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image} alt="" className={cn('h-16 w-16 shrink-0 object-cover', scrap ? 'rounded-full border-[3px] border-white shadow' : 'rounded-lg')} loading="lazy" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className={cn('font-semibold', scrap && 'text-[17px]')} style={scrap ? { fontFamily: SERIF } : undefined}>{item.title}</span>
                      {item.price !== undefined && (
                        <>
                          <span className="mb-1 min-w-4 flex-1 border-b-2 border-dotted" style={{ borderColor: tint(brand, 35) }} aria-hidden />
                          <span className="shrink-0 font-bold" style={{ color: brand }}>{money(item.price, item.priceType)}</span>
                        </>
                      )}
                    </div>
                    {item.description && <p className="mt-0.5 text-sm text-slate-500">{item.description}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Formulario ───────────────────────────────────────────────────────────

function PublicForm({ block, brand, scrap, tenantSlug, pageSlug, preview }: { block: Extract<SiteBlockView, { type: 'form' }>; brand: string; scrap?: boolean; tenantSlug: string; pageSlug: string; preview?: boolean }) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [parentValues, setParentValues] = useState<Record<string, unknown>>({});
  const [website, setWebsite] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ message: string; trackingUrl?: string } | null>(null);
  const set = (slug: string, v: unknown) => setValues((prev) => ({ ...prev, [slug]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const missing = [
      ...(block.parent?.fieldDefs || []).filter((f) => f.required && isEmpty(parentValues[f.slug])),
      ...block.fieldDefs.filter((f) => f.required && isEmpty(values[f.slug])),
    ];
    if (missing.length) {
      setError(`Preencha: ${missing.map((f) => f.label).join(', ')}.`);
      return;
    }
    if (preview) {
      setError('Na prévia o formulário não envia. Publique a página e teste pelo link.');
      return;
    }
    setSending(true);
    try {
      const res = await siteApi.submit(tenantSlug, pageSlug, block.id, values, website, block.parent ? parentValues : undefined);
      setDone({ message: res.message, trackingUrl: res.trackingUrl ? absoluteSiteUrl(res.trackingUrl) : undefined });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="space-y-4 rounded-2xl border bg-white p-6 text-center shadow-sm" data-testid="site-form-done">
        <CheckCircle2 className="mx-auto h-12 w-12" style={{ color: brand }} />
        <p className="text-lg font-semibold">{done.message}</p>
        {done.trackingUrl && (
          <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-left">
            <p className="text-sm font-medium">Guarde este link para acompanhar:</p>
            <p className="break-all rounded-md border bg-white px-3 py-2 text-xs" data-testid="site-tracking-url">{done.trackingUrl}</p>
            <div className="flex flex-wrap gap-2">
              <a href={done.trackingUrl} className="inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold text-white" style={{ backgroundColor: brand }}>
                <ExternalLink className="h-4 w-4" /> Acompanhar agora
              </a>
              <Button type="button" variant="outline" onClick={() => void navigator.clipboard?.writeText(done.trackingUrl!)}>
                <Copy className="mr-1.5 h-4 w-4" /> Copiar link
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={cn('space-y-4 bg-white p-5', scrap ? 'mx-auto max-w-2xl rounded-[2rem] border-2 border-dashed px-6 py-7 shadow-md' : 'rounded-2xl border shadow-sm')}
      style={scrap ? { borderColor: tint(brand, 45) } : undefined} data-testid={`site-form-${block.id}`} noValidate>
      {block.parent && (
        <>
          <p className="text-base font-semibold" data-testid="site-form-parent-title">{block.parent.title || 'Seus dados'}</p>
          {block.parent.fieldDefs.map((f) => (
            <div key={`p-${f.slug}`} className="space-y-1.5">
              <Label htmlFor={`f-${f.slug}`} className="text-sm font-medium">
                {f.label}{f.required && <span className="text-red-600"> *</span>}
              </Label>
              <FieldInput field={f} value={parentValues[f.slug]} onChange={(v) => setParentValues((prev) => ({ ...prev, [f.slug]: v }))} brand={brand}
                upload={(file) => (preview ? Promise.reject(new Error('Na prévia não dá para enviar arquivos.')) : siteApi.uploadForm(tenantSlug, pageSlug, block.id, f.slug, file, 'parent').then((r) => r.url))} />
              {f.helpText && <p className="text-xs text-slate-500">{f.helpText}</p>}
            </div>
          ))}
          <p className="border-t pt-4 text-base font-semibold">{block.entityName || 'Dados'}</p>
        </>
      )}
      {block.fieldDefs.map((f) => (
        <div key={f.slug} className="space-y-1.5">
          <Label htmlFor={`f-${f.slug}`} className="text-sm font-medium">
            {f.label}{f.required && <span className="text-red-600"> *</span>}
          </Label>
          <FieldInput field={f} value={values[f.slug]} onChange={(v) => set(f.slug, v)} brand={brand}
            upload={(file) => (preview ? Promise.reject(new Error('Na prévia não dá para enviar arquivos.')) : siteApi.uploadForm(tenantSlug, pageSlug, block.id, f.slug, file).then((r) => r.url))} />
          {f.helpText && <p className="text-xs text-slate-500">{f.helpText}</p>}
        </div>
      ))}
      {/* Campo escondido: pessoas nao veem; robos preenchem */}
      <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 opacity-0" />
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
      <button type="submit" disabled={sending}
        className={cn('inline-flex h-12 w-full items-center justify-center gap-2 text-base font-semibold text-white disabled:opacity-60', scrap ? 'rounded-full' : 'rounded-lg shadow-sm')}
        style={{ backgroundColor: brand, ...(scrap ? { boxShadow: `0 5px 0 ${tint(brand, 70, 'black')}` } : {}) }} data-testid="site-form-submit">
        {sending && <Loader2 className="h-4 w-4 animate-spin" />} {scrap && !sending && <span aria-hidden>♡</span>} {block.submitLabel || 'Enviar'}
      </button>
    </form>
  );
}

function isEmpty(v: unknown) {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
}

function FieldInput({ field, value, onChange, brand, upload }: { field: SiteFieldDef; value: unknown; onChange: (v: unknown) => void; brand: string; upload: (file: File) => Promise<string> }) {
  const id = `f-${field.slug}`;
  const str = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  const options = field.options || [];
  switch (field.type) {
    case 'textarea':
      return <Textarea id={id} rows={4} value={str} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} maxLength={5000} />;
    case 'number': case 'currency': case 'percentage':
      return <Input id={id} type="number" inputMode="decimal" step="any" value={str} placeholder={field.type === 'currency' ? 'R$' : field.placeholder} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />;
    case 'date':
      return <Input id={id} type="date" value={str} onChange={(e) => onChange(e.target.value)} />;
    case 'datetime':
      return <Input id={id} type="datetime-local" value={str} onChange={(e) => onChange(e.target.value)} />;
    case 'time':
      return <Input id={id} type="time" value={str} onChange={(e) => onChange(e.target.value)} />;
    case 'boolean':
      return (
        <label className="flex items-center gap-2 text-sm">
          <input id={id} type="checkbox" className="h-5 w-5" checked={value === true} onChange={(e) => onChange(e.target.checked)} /> Sim
        </label>
      );
    case 'rating':
      return (
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} estrelas`}>
              <Star className="h-7 w-7" style={{ color: brand }} fill={Number(value) >= n ? brand : 'transparent'} />
            </button>
          ))}
        </div>
      );
    case 'select': case 'radio-group':
      if (options.length <= 5) {
        return (
          <div className="flex flex-wrap gap-2">
            {options.map((o) => (
              <button key={o.value} type="button" onClick={() => onChange(o.value)}
                className={cn('rounded-full border px-4 py-2 text-sm', value === o.value ? 'font-semibold text-white' : 'bg-white')}
                style={value === o.value ? { backgroundColor: brand, borderColor: brand } : undefined}>
                {o.label}
              </button>
            ))}
          </div>
        );
      }
      return (
        <select id={id} value={str} onChange={(e) => onChange(e.target.value)} className="h-11 w-full rounded-md border bg-white px-3 text-sm">
          <option value="">Escolha…</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    case 'multiselect': case 'checkbox-group': {
      const list = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="space-y-2">
          {options.map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-5 w-5" checked={list.includes(o.value)}
                onChange={(e) => onChange(e.target.checked ? [...list, o.value] : list.filter((x) => x !== o.value))} />
              {o.label}
            </label>
          ))}
        </div>
      );
    }
    case 'tags':
      return <Input id={id} value={Array.isArray(value) ? (value as string[]).join(', ') : str} placeholder="Separe por vírgula" onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />;
    case 'image': case 'file':
      return <FileInput field={field} value={value} onChange={onChange} upload={upload} />;
    default: {
      const kind = { email: 'email', phone: 'tel', url: 'url' }[field.type] ?? 'text';
      const mode = ['cpf', 'cnpj', 'cep', 'phone'].includes(field.type) ? 'numeric' : undefined;
      const hint = { cpf: '000.000.000-00', cnpj: '00.000.000/0000-00', cep: '00000-000', phone: '(00) 00000-0000', email: 'seu@email.com' }[field.type];
      return <Input id={id} type={kind} inputMode={mode} value={str} placeholder={field.placeholder || hint} onChange={(e) => onChange(e.target.value)} maxLength={500} />;
    }
  }
}

function FileInput({ field, value, onChange, upload }: { field: SiteFieldDef; value: unknown; onChange: (v: unknown) => void; upload: (file: File) => Promise<string> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = (Array.isArray(value) ? value : value ? [value] : []) as string[];
  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, field.multiple ? 10 : 1)) urls.push(await upload(file));
      onChange(field.multiple ? [...list, ...urls] : urls[0]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      {list.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {list.map((u) => (
            <span key={u} className="relative">
              {field.type === 'image'
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={u} alt="" className="h-20 w-20 rounded-lg border object-cover" />
                : <span className="flex h-20 w-20 items-center justify-center rounded-lg border bg-slate-50"><FileText className="h-6 w-6 text-slate-400" /></span>}
              <button type="button" aria-label="Remover" onClick={() => onChange(field.multiple ? list.filter((x) => x !== u) : '')}
                className="absolute -right-2 -top-2 rounded-full border bg-white p-0.5 shadow"><X className="h-3.5 w-3.5" /></button>
            </span>
          ))}
        </div>
      )}
      <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-white text-sm text-slate-600">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {field.type === 'image' ? 'Tirar ou escolher foto' : 'Escolher arquivo'}
        <input type="file" className="hidden" multiple={!!field.multiple} accept={field.type === 'image' ? 'image/*' : undefined}
          onChange={(e) => void pick(e.target.files)} disabled={busy} />
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ── Acompanhamento ───────────────────────────────────────────────────────

function formatValue(type: string, value: SiteValue): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (type === 'currency' && typeof value === 'number') return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (type === 'percentage' && typeof value === 'number') return `${value.toLocaleString('pt-BR')}%`;
  if ((type === 'date' || type === 'datetime') && typeof value === 'string') {
    const d = new Date(type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
    if (!Number.isNaN(d.getTime())) return type === 'date' ? d.toLocaleDateString('pt-BR') : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }
  return String(value);
}

function TrackingView({ block, record, error, brand, tenantSlug, pageSlug, token, preview, onChanged }: {
  block: Extract<SiteBlockView, { type: 'tracking' }>; record: SiteRecordView | null; error: string | null; brand: string;
  tenantSlug: string; pageSlug: string; token?: string | null; preview?: boolean; onChanged?: () => void;
}) {
  if (!record) {
    return (
      <div className="rounded-2xl border bg-white p-6 text-center shadow-sm" data-testid="site-tracking-empty">
        <p className="font-medium">{error || 'Para acompanhar, abra o link que você recebeu.'}</p>
      </div>
    );
  }
  return (
    <div className="space-y-4" data-testid="site-tracking">
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            {block.entityName && <p className="text-xs uppercase tracking-wide text-slate-500">{block.entityName}</p>}
            <p className="text-xl font-bold">{formatValue('text', record.title)}</p>
          </div>
          {record.status && (
            <span className="rounded-full px-3 py-1 text-sm font-semibold text-white" style={{ backgroundColor: record.status.color || brand }} data-testid="site-status">
              {record.status.label}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-500">Atualizado em {formatValue('datetime', record.updatedAt)}</p>
        {record.fields.length > 0 && (
          <dl className="mt-4 grid gap-3 csm:grid-cols-2">
            {record.fields.map((f) => (
              <div key={f.slug}>
                <dt className="text-xs text-slate-500">{f.label}</dt>
                <dd className="text-sm font-medium">{formatValue(f.type, f.value)}</dd>
              </div>
            ))}
          </dl>
        )}
        {block.hasPdf && token && !preview && (
          <a href={siteApi.pdfUrl(tenantSlug, pageSlug, token)} target="_blank" rel="noopener noreferrer"
            className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-lg border px-4 text-sm font-semibold" style={{ color: brand, borderColor: brand }}>
            <Download className="h-4 w-4" /> Baixar documento (PDF)
          </a>
        )}
      </div>

      {record.timeline && (
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="mb-3 font-semibold">{record.timeline.label}</p>
          {record.timeline.rows.length === 0 ? (
            <p className="text-sm text-slate-500">Nada registrado ainda.</p>
          ) : (
            <ol className="space-y-3 border-l-2 pl-4" style={{ borderColor: brand }}>
              {record.timeline.rows.map((row, i) => (
                <li key={i} className="text-sm">
                  {record.timeline!.columns.map((c, ci) => (
                    <p key={c.slug} className={ci === 0 ? 'font-medium' : 'text-slate-600'}>
                      {ci === 0 ? '' : `${c.label}: `}{formatValue(c.type, row[c.slug])}
                    </p>
                  ))}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {record.uploads.length > 0 && (
        <div className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
          <p className="font-semibold">Enviar documentos e fotos</p>
          {record.uploads.map((u) => (
            <TrackingUpload key={u.slug} upload={u} preview={preview}
              send={(file) => siteApi.uploadTracking(tenantSlug, pageSlug, token || '', u.slug, file).then(() => onChanged?.())} />
          ))}
        </div>
      )}
    </div>
  );
}

function TrackingUpload({ upload, preview, send }: { upload: SiteRecordView['uploads'][number]; preview?: boolean; send: (file: File) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const files = Array.isArray(upload.value) ? upload.value : [];
  const pick = async (list: FileList | null) => {
    if (!list?.length) return;
    if (preview) {
      setMsg({ ok: false, text: 'Na prévia não dá para enviar arquivos.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      for (const file of Array.from(list).slice(0, upload.multiple ? 10 : 1)) await send(file);
      setMsg({ ok: true, text: 'Recebido! Obrigado.' });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{upload.label}</p>
      {files.length > 0 && (
        <p className="flex items-center gap-1 text-xs text-slate-500"><Paperclip className="h-3 w-3" /> {files.length} {files.length === 1 ? 'arquivo enviado' : 'arquivos enviados'}</p>
      )}
      <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed text-sm text-slate-600">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {upload.type === 'image' ? 'Tirar ou escolher foto' : 'Escolher arquivo'}
        <input type="file" className="hidden" multiple={upload.multiple} accept={upload.type === 'image' ? 'image/*' : undefined}
          onChange={(e) => void pick(e.target.files)} disabled={busy} data-testid={`site-upload-${upload.slug}`} />
      </label>
      {msg && <p className={cn('text-xs', msg.ok ? 'text-emerald-700' : 'text-red-600')}>{msg.text}</p>}
    </div>
  );
}

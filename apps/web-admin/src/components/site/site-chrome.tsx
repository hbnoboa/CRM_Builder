'use client';

import { useState, type CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Clock, Mail, MapPin, Menu, MessageCircle, Phone, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SOCIALS } from '@/lib/site-icons';
import type { SiteAppearance, SiteFooter, SiteHeader, SiteFooterStyle, SitePageData } from '@/lib/site-api';

const tint = (color: string, pct: number, base = 'white') => `color-mix(in srgb, ${color} ${pct}%, ${base})`;
const icon = (i: unknown) => i as LucideIcon;
const LOGO_SIZE = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg' };

/** Topo padrao: scrapbook usa a capa grande; os outros, a barra com menu embaixo. */
export function headerOf(data: SitePageData, scrap: boolean): Required<Pick<SiteHeader, 'layout' | 'menuStyle'>> & SiteHeader {
  const h = data.site?.header ?? {};
  return { ...h, layout: h.layout ?? (scrap ? 'cover' : 'bar'), menuStyle: h.menuStyle ?? (scrap ? 'buttons' : 'pills') };
}

function Avatar({ data, brand, className }: { data: SitePageData; brand: string; className: string }) {
  return data.tenant.logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={data.tenant.logo} alt={data.tenant.name} className={cn('bg-white object-contain', className)} />
  ) : (
    <span className={cn('flex items-center justify-center font-bold', className)} style={{ backgroundColor: brand, color: 'var(--site-on-accent)' }}>
      {data.tenant.name.charAt(0).toUpperCase()}
    </span>
  );
}

/** Links do menu no estilo escolhido (relativos: funcionam no /p/ e no dominio da empresa). */
function MenuLinks({ data, style, preview, vertical, onPick }: {
  data: SitePageData; style: SiteHeader['menuStyle']; preview?: boolean; vertical?: boolean; onPick?: () => void;
}) {
  const menu = data.site?.menu || [];
  return (
    <ul className={cn('flex gap-1.5', vertical ? 'flex-col' : 'flex-wrap items-center')}>
      {menu.map((m) => {
        const base = 'block whitespace-nowrap px-3 py-1.5 text-sm font-medium transition-colors';
        const cls = {
          pills: cn(base, 'rounded-full'),
          underline: cn(base, 'border-b-2 rounded-none'),
          plain: base,
          buttons: cn(base, 'rounded-full border-2 font-semibold'),
        }[style ?? 'pills'];
        const st: CSSProperties = {
          pills: m.current ? { backgroundColor: 'color-mix(in srgb, var(--site-accent) 14%, transparent)', color: 'var(--site-accent)' } : { color: 'var(--site-text-2)' },
          underline: { borderColor: m.current ? 'var(--site-accent)' : 'transparent', color: m.current ? 'var(--site-accent)' : 'var(--site-text-2)' },
          plain: { color: m.current ? 'var(--site-accent)' : 'var(--site-text-2)', fontWeight: m.current ? 700 : 500 },
          buttons: m.current
            ? { backgroundColor: 'var(--site-accent)', borderColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }
            : { borderColor: 'color-mix(in srgb, var(--site-accent) 45%, transparent)', color: 'var(--site-accent)', backgroundColor: 'var(--site-surface)' },
        }[style ?? 'pills'];
        return (
          <li key={m.slug} className="shrink-0">
            {preview
              ? <span className={cls} style={st}>{m.label}</span>
              : <a href={m.slug} className={cls} style={st} aria-current={m.current ? 'page' : undefined} onClick={onPick}>{m.label}</a>}
          </li>
        );
      })}
    </ul>
  );
}

function Cta({ header, preview, className }: { header: SiteHeader; preview?: boolean; className?: string }) {
  if (!header.cta) return null;
  return preview
    ? <span className={cn('site-btn !min-h-9 !px-4 !py-1.5 !text-sm', className)}>{header.cta.label}</span>
    : <a href={header.cta.url} target={/^https?:/.test(header.cta.url) ? '_blank' : undefined} rel="noopener noreferrer" className={cn('site-btn !min-h-9 !px-4 !py-1.5 !text-sm', className)}>{header.cta.label}</a>;
}

function Cover({ look, className }: { look: SiteAppearance; className: string }) {
  return look.coverUrl ? <div className={cn('w-full bg-cover bg-center', className)} style={{ backgroundImage: `url(${look.coverUrl})` }} /> : null;
}

/** Topo do site nos formatos: barra, linha unica, centralizado, capa grande e minimo. */
export function SiteHeaderView({ data, look, brand, scrap, width, preview }: {
  data: SitePageData; look: SiteAppearance; brand: string; scrap: boolean; width: string; preview?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const header = headerOf(data, scrap);
  const hasMenu = (data.site?.menu || []).length >= 2;
  const logo = header.hideLogo ? null : <Avatar data={data} brand={brand} className={cn('shrink-0 rounded-lg', LOGO_SIZE[header.logoSize ?? 'md'])} />;
  const name = header.hideName ? null : (
    <span className="min-w-0">
      <span className="site-h3 block !text-[1.05em] leading-tight" style={{ fontSize: undefined }}>{data.tenant.name}</span>
      {look.tagline && <span className="block truncate text-xs text-slate-500">{look.tagline}</span>}
    </span>
  );
  const sticky = header.sticky ?? header.layout === 'bar';
  const stickyCls = sticky && !preview ? 'sticky top-0 z-30' : '';

  if (header.layout === 'cover') {
    return (
      <header className="relative" data-testid="site-header" data-layout="cover">
        {look.coverUrl
          ? <Cover look={look} className="h-52 csm:h-72" />
          : <div className="h-28 w-full" style={{ background: `linear-gradient(135deg, ${brand}, ${tint(brand, 45)})` }} />}
        <div className="mx-auto -mt-14 max-w-3xl px-4 text-center">
          {!header.hideLogo && <Avatar data={data} brand={brand} className="mx-auto h-28 w-28 rounded-full border-[5px] border-white text-4xl shadow-lg" />}
          {!header.hideName && <h1 className="site-h1 mt-3" style={{ color: 'var(--site-text)' }}>{data.tenant.name}</h1>}
          {look.tagline && <p className="site-h3 mt-1" style={{ color: brand }}>{look.tagline}</p>}
          {scrap && <p className="mt-3 text-sm tracking-[0.6em]" style={{ color: brand }} aria-hidden>✿ ♡ ✿</p>}
        </div>
        {(hasMenu || header.cta) && (
          <nav aria-label="Páginas do site" data-testid="site-menu" className={cn('mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-3 px-4 pt-6', stickyCls)}>
            {hasMenu && <MenuLinks data={data} style={header.menuStyle} preview={preview} />}
            <Cta header={header} preview={preview} />
          </nav>
        )}
      </header>
    );
  }

  if (header.layout === 'centered') {
    return (
      <header className="border-b bg-white" data-testid="site-header" data-layout="centered">
        <Cover look={look} className="h-36 csm:h-56" />
        <div className={cn('mx-auto flex flex-col items-center gap-2 px-4 py-5 text-center', width)}>
          {logo}
          {name}
        </div>
        {(hasMenu || header.cta) && (
          <nav aria-label="Páginas do site" data-testid="site-menu" className={cn('border-t bg-white/95 backdrop-blur', stickyCls)}>
            <div className={cn('mx-auto flex flex-wrap items-center justify-center gap-3 px-4 py-2', width)}>
              {hasMenu && <MenuLinks data={data} style={header.menuStyle} preview={preview} />}
              <Cta header={header} preview={preview} />
            </div>
          </nav>
        )}
      </header>
    );
  }

  if (header.layout === 'inline' || header.layout === 'minimal') {
    const minimal = header.layout === 'minimal';
    return (
      <header className={cn(minimal ? '' : 'border-b bg-white', stickyCls, sticky && minimal && 'bg-white/95 backdrop-blur')} data-testid="site-header" data-layout={header.layout}>
        {!minimal && <Cover look={look} className="h-36 csm:h-48" />}
        <div className={cn('mx-auto flex items-center gap-3 px-4 py-3', width)}>
          {!minimal && logo}
          {minimal ? <span className="site-h3 !text-[1.15em]">{data.tenant.name}</span> : name}
          <span className="flex-1" />
          <nav aria-label="Páginas do site" data-testid="site-menu" className="site-nav-wide flex items-center gap-3">
            {hasMenu && <MenuLinks data={data} style={header.menuStyle} preview={preview} />}
            <Cta header={header} preview={preview} />
          </nav>
          {(hasMenu || header.cta) && (
            <button type="button" className="site-nav-burger rounded-md p-2" style={{ color: 'var(--site-text)' }} aria-label={open ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }} data-testid="site-menu-burger">
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          )}
        </div>
        {open && (
          <div className="site-nav-burger border-t px-4 py-3" data-testid="site-menu-mobile">
            {hasMenu && <MenuLinks data={data} style={header.menuStyle} preview={preview} vertical onPick={() => setOpen(false)} />}
            <Cta header={header} preview={preview} className="mt-3 w-full" />
          </div>
        )}
      </header>
    );
  }

  // bar: capa, logo e nome; menu numa faixa embaixo
  return (
    <>
      <header className="border-b bg-white" data-testid="site-header" data-layout="bar">
        <Cover look={look} className="h-36 csm:h-48" />
        <div className={cn('mx-auto flex items-center gap-3 px-4 py-3', width)}>
          {logo}
          {name}
          <span className="flex-1" />
          <Cta header={header} preview={preview} />
        </div>
      </header>
      {hasMenu && (
        <nav aria-label="Páginas do site" data-testid="site-menu" className={cn('border-b bg-white/95 backdrop-blur', stickyCls)}>
          <div className={cn('mx-auto overflow-x-auto px-4 py-2', width)}>
            <MenuLinks data={data} style={header.menuStyle} preview={preview} />
          </div>
        </nav>
      )}
    </>
  );
}

/** Link do WhatsApp: numero com DDI (sem ele, assume Brasil). */
function waLink(raw: string) {
  const digits = raw.replace(/\D/g, '');
  return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`;
}

type Row = { icon: LucideIcon; text: string; href?: string };

function contactRows(f: SiteFooter): Row[] {
  return [
    f.address ? { icon: MapPin, text: f.address, href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.address)}` } : null,
    f.hours ? { icon: Clock, text: f.hours } : null,
    f.whatsapp ? { icon: MessageCircle, text: 'WhatsApp', href: waLink(f.whatsapp) } : null,
    f.phone ? { icon: Phone, text: f.phone, href: `tel:${f.phone.replace(/[^\d+]/g, '')}` } : null,
    f.email ? { icon: Mail, text: f.email, href: `mailto:${f.email}` } : null,
  ].filter((r): r is Row => !!r);
}

function socialRows(f: SiteFooter): Row[] {
  const rows: Array<Row | null> = [
    f.instagram ? { icon: icon(SOCIALS.instagram.icon), text: `@${f.instagram}`, href: `https://instagram.com/${f.instagram}` } : null,
    f.facebook ? { icon: icon(SOCIALS.facebook.icon), text: 'Facebook', href: f.facebook } : null,
    f.tiktok ? { icon: icon(SOCIALS.tiktok.icon), text: 'TikTok', href: f.tiktok } : null,
    f.youtube ? { icon: icon(SOCIALS.youtube.icon), text: 'YouTube', href: f.youtube } : null,
    f.linkedin ? { icon: icon(SOCIALS.linkedin.icon), text: 'LinkedIn', href: f.linkedin } : null,
  ];
  return rows.filter((r): r is Row => !!r);
}

function RowList({ rows, brand, className, iconsOnly }: { rows: Row[]; brand: string; className?: string; iconsOnly?: boolean }) {
  return (
    <ul className={cn('flex flex-wrap gap-x-5 gap-y-2 text-sm', className)}>
      {rows.map((r) => {
        const Icon = r.icon;
        const inner = <><Icon className="h-4 w-4 shrink-0" style={{ color: brand }} />{iconsOnly ? <span className="sr-only">{r.text}</span> : <span>{r.text}</span>}</>;
        return (
          <li key={r.text}>
            {r.href
              ? <a href={r.href} target={r.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-slate-700 hover:underline" title={r.text}>{inner}</a>
              : <span className="inline-flex items-center gap-1.5 text-slate-700">{inner}</span>}
          </li>
        );
      })}
    </ul>
  );
}

/** Rodape do site nos formatos: cartao, colunas, centralizado e minimo. */
export function SiteFooterView({ data, brand, scrap, width, editing }: { data: SitePageData; brand: string; scrap: boolean; width: string; editing?: boolean }) {
  const f = data.site?.footer ?? {};
  const st: SiteFooterStyle = data.site?.footerStyle ?? {};
  const layout = st.layout ?? 'card';
  const tone = st.tone && st.tone !== 'page' ? `site-tone-${st.tone}` : '';
  const contacts = contactRows(f);
  const socials = socialRows(f);
  const empty = !f.text && !contacts.length && !socials.length;
  const credit = scrap
    ? <p className="pb-10 pt-4 text-center text-xs text-slate-500"><span className="site-h3 block !text-2xl" style={{ color: brand }}>feito com ♡</span>{data.tenant.name} · CRM Builder</p>
    : <p className="px-4 pb-8 pt-3 text-center text-xs text-slate-400">{data.tenant.name} · feito com CRM Builder</p>;

  if (empty) {
    return (
      <>
        {editing && (
          <div className={cn('mx-auto mt-6 px-4', width)}>
            <p className="rounded-2xl border-2 border-dashed border-slate-300 bg-white/70 p-4 text-center text-sm text-slate-500">Rodapé do site: clique para colocar endereço, horários e contato</p>
          </div>
        )}
        {credit}
      </>
    );
  }

  if (layout === 'columns') {
    return (
      <footer className={cn('mt-8 border-t', tone || 'bg-white')} data-testid="site-footer" data-layout="columns">
        <div className={cn('mx-auto grid gap-8 px-4 py-10 csm:grid-cols-3', width)}>
          <div>
            <p className="site-h3">{data.tenant.name}</p>
            {f.text && <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{f.text}</p>}
          </div>
          {contacts.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold">Contato</p>
              <RowList rows={contacts} brand={brand} className="flex-col" />
            </div>
          )}
          {socials.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold">Redes sociais</p>
              <RowList rows={socials} brand={brand} className="flex-col" />
            </div>
          )}
        </div>
        {credit}
      </footer>
    );
  }

  if (layout === 'centered' || layout === 'minimal') {
    const minimal = layout === 'minimal';
    return (
      <footer className={cn('mt-8', tone)} data-testid="site-footer" data-layout={layout}>
        <div className={cn('mx-auto flex flex-col items-center gap-3 px-4 text-center', minimal ? 'py-5' : 'py-10', width)}>
          {!minimal && <p className="site-h3">{data.tenant.name}</p>}
          {!minimal && f.text && <p className="max-w-xl whitespace-pre-line text-sm text-slate-600">{f.text}</p>}
          {contacts.length > 0 && <RowList rows={contacts} brand={brand} className="justify-center" iconsOnly={minimal} />}
          {socials.length > 0 && <RowList rows={socials} brand={brand} className="justify-center" iconsOnly />}
        </div>
        {credit}
      </footer>
    );
  }

  // card (padrao): caixa com a frase e os contatos
  return (
    <footer className={cn(tone && cn(tone, 'pt-2'))} data-testid="site-footer" data-layout="card">
      <section className={cn('mx-auto mt-6 px-4', width)}>
        <div className={cn('bg-white p-5', scrap ? 'rounded-[2rem] border-2 border-dashed text-center' : 'rounded-2xl border')}
          style={scrap ? { borderColor: tint(brand, 40) } : undefined}>
          {f.text && <p className={cn('mb-3 whitespace-pre-line text-slate-700', scrap && 'text-[16px]')}>{f.text}</p>}
          <RowList rows={[...contacts, ...socials]} brand={brand} className={scrap ? 'justify-center' : undefined} />
        </div>
      </section>
      {credit}
    </footer>
  );
}

'use client';

import { Check, ChevronDown, MapPin, Play, Quote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SITE_ICON_MAP, SOCIALS, parseVideo } from '@/lib/site-icons';
import type { SiteBlockView } from '@/lib/site-api';

/**
 * Elementos a mais da pagina: video, mapa, perguntas frequentes, icones com texto,
 * redes sociais, espaco, numeros, precos, depoimentos e logos. Usam as variaveis
 * do tema (cores, fontes, cantos), como os outros blocos.
 */

type Of<T extends SiteBlockView['type']> = Extract<SiteBlockView, { type: T }>;

function Title({ text, center }: { text?: string; center?: boolean }) {
  return text ? <h2 className={cn('site-h2 mb-5', center && 'text-center')}>{text}</h2> : null;
}

const GRID: Record<number, string> = { 1: '', 2: 'csm:grid-cols-2', 3: 'csm:grid-cols-3', 4: 'csm:grid-cols-4' };

/**
 * Video: arquivo enviado toca na propria pagina; YouTube/Vimeo aparecem com a capa
 * e o botao de play, que abre o video (sem embutir player de outro site na pagina).
 */
export function VideoView({ block, preview }: { block: Of<'video'>; preview?: boolean }) {
  const v = parseVideo(block.url);
  if (!v) return null;
  return (
    <figure>
      {v.kind === 'file' ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-md">
          <video src={v.url} controls playsInline className="absolute inset-0 h-full w-full object-cover" />
        </div>
      ) : (
        <a href={preview ? undefined : v.watch} target="_blank" rel="noopener noreferrer" data-testid="site-video-link"
          className="group relative block aspect-video w-full overflow-hidden rounded-2xl bg-slate-900 shadow-md">
          {v.thumb
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={v.thumb} alt={block.caption || 'Vídeo'} className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
            : <span className="absolute inset-0" style={{ background: 'linear-gradient(135deg, var(--site-accent), #111)' }} />}
          <span className="absolute inset-0 bg-black/25" />
          <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-xl transition-transform group-hover:scale-110"
            style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
            <Play className="ml-1 h-7 w-7" fill="currentColor" />
          </span>
          <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white">
            Assistir no {v.kind === 'youtube' ? 'YouTube' : 'Vimeo'}
          </span>
        </a>
      )}
      {block.caption && <figcaption className="mt-2 text-center text-sm text-slate-500">{block.caption}</figcaption>}
    </figure>
  );
}

/** Mapa: endereco com os botoes do Google Maps (ver no mapa e como chegar). */
export function MapView({ block, preview }: { block: Of<'map'>; preview?: boolean }) {
  const q = encodeURIComponent(block.address);
  const links = [
    { label: 'Ver no mapa', href: `https://www.google.com/maps/search/?api=1&query=${q}` },
    { label: 'Como chegar', href: `https://www.google.com/maps/dir/?api=1&destination=${q}` },
  ];
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border p-6 text-center shadow-sm"
      style={{
        minHeight: Math.min(block.height, 360),
        backgroundColor: 'var(--site-surface)',
        backgroundImage: 'linear-gradient(color-mix(in srgb, var(--site-accent) 10%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--site-accent) 10%, transparent) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }} data-testid="site-map">
      <span className="flex h-14 w-14 items-center justify-center rounded-full shadow-md" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
        <MapPin className="h-7 w-7" />
      </span>
      <p className="mt-3 max-w-sm font-semibold">{block.address}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {links.map((l, i) => (
          preview
            ? <span key={l.label} className={cn('site-btn !min-h-9 !px-4 !py-1.5 !text-sm', i > 0 && 'site-btn-alt')}>{l.label}</span>
            : <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className={cn('site-btn !min-h-9 !px-4 !py-1.5 !text-sm', i > 0 && 'site-btn-alt')}>{l.label}</a>
        ))}
      </div>
    </div>
  );
}

export function FaqView({ block }: { block: Of<'faq'> }) {
  return (
    <div>
      <Title text={block.title} />
      <div className="divide-y rounded-2xl border bg-white">
        {block.items.map((it, i) => (
          <details key={i} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">
              <span>{it.q}</span>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" style={{ color: 'var(--site-accent)' }} />
            </summary>
            <p className="site-body mt-2 whitespace-pre-line">{it.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}

export function IconsView({ block }: { block: Of<'icons'> }) {
  const side = block.layout === 'side';
  return (
    <div>
      <Title text={block.title} center={!side} />
      <div className={cn('grid gap-6', GRID[block.columns])}>
        {block.items.map((it, i) => {
          const Icon = SITE_ICON_MAP[it.icon] ?? SITE_ICON_MAP.star;
          return (
            <div key={i} className={cn(side ? 'flex items-start gap-3' : 'text-center')}>
              <span className={cn('inline-flex shrink-0 items-center justify-center rounded-2xl', side ? 'h-11 w-11' : 'mb-3 h-14 w-14')}
                style={{ backgroundColor: 'color-mix(in srgb, var(--site-accent) 14%, transparent)', color: 'var(--site-accent)' }}>
                <Icon className={side ? 'h-5 w-5' : 'h-7 w-7'} />
              </span>
              <div className="min-w-0">
                <p className="site-h3 !text-[1.1em]">{it.title}</p>
                {it.text && <p className="site-body mt-1">{it.text}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SocialView({ block, preview }: { block: Of<'social'>; preview?: boolean }) {
  return (
    <ul className="flex flex-wrap gap-2.5" style={{ justifyContent: 'inherit' }}>
      {block.links.map((l, i) => {
        const s = SOCIALS[l.network] ?? SOCIALS.site;
        const Icon = s.icon;
        const content = <><Icon className="h-5 w-5" />{block.style === 'labels' && <span className="text-sm font-medium">{s.label}</span>}</>;
        const cls = cn('inline-flex items-center gap-2 rounded-full border-2 transition-transform hover:-translate-y-0.5', block.style === 'labels' ? 'px-4 py-2' : 'h-11 w-11 justify-center');
        const style = { borderColor: 'color-mix(in srgb, var(--site-accent) 40%, transparent)', color: 'var(--site-accent)' };
        return (
          <li key={i}>
            {preview
              ? <span className={cls} style={style} title={s.label}>{content}</span>
              : <a href={l.url} target={/^https?:/.test(l.url) ? '_blank' : undefined} rel="noopener noreferrer" className={cls} style={style} title={s.label} aria-label={s.label}>{content}</a>}
          </li>
        );
      })}
    </ul>
  );
}

export function StatsView({ block }: { block: Of<'stats'> }) {
  const cols = Math.min(4, Math.max(1, block.items.length));
  return (
    <div className={cn('grid gap-6 text-center', GRID[cols])}>
      {block.items.map((it, i) => (
        <div key={i}>
          <p className="site-h1 !leading-none" style={{ color: 'var(--site-accent)' }}>{it.value}</p>
          <p className="mt-2 text-sm font-medium text-slate-600">{it.label}</p>
        </div>
      ))}
    </div>
  );
}

export function PricingView({ block, preview }: { block: Of<'pricing'>; preview?: boolean }) {
  return (
    <div>
      <Title text={block.title} center />
      <div className={cn('grid items-stretch gap-5', GRID[Math.min(3, Math.max(1, block.plans.length))])}>
        {block.plans.map((p, i) => (
          <div key={i} className={cn('relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm', p.highlight && 'shadow-lg')}
            style={p.highlight ? { borderColor: 'var(--site-accent)', borderWidth: 2 } : undefined}>
            {p.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-xs font-semibold"
                style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>Mais escolhido</span>
            )}
            <p className="site-h3">{p.name}</p>
            <p className="mt-3"><span className="site-h1 !leading-none">{p.price}</span>{p.period && <span className="ml-1 text-sm text-slate-500">{p.period}</span>}</p>
            <ul className="mt-5 flex-1 space-y-2">
              {p.features.map((f, j) => (
                <li key={j} className="flex items-start gap-2 text-sm text-slate-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--site-accent)' }} />{f}
                </li>
              ))}
            </ul>
            {p.buttonLabel && p.buttonUrl && (
              preview
                ? <span className="site-btn mt-6 w-full">{p.buttonLabel}</span>
                : <a href={p.buttonUrl} target={/^https?:/.test(p.buttonUrl) ? '_blank' : undefined} rel="noopener noreferrer" className="site-btn mt-6 w-full">{p.buttonLabel}</a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TestimonialsView({ block }: { block: Of<'testimonials'> }) {
  return (
    <div>
      <Title text={block.title} center />
      <div className={cn('grid gap-5', GRID[Math.min(3, Math.max(1, block.items.length))])}>
        {block.items.map((t, i) => (
          <figure key={i} className="flex flex-col rounded-2xl border bg-white p-6 shadow-sm">
            <Quote className="h-6 w-6" style={{ color: 'var(--site-accent)' }} />
            <blockquote className="site-body mt-3 flex-1 italic">“{t.text}”</blockquote>
            <figcaption className="mt-5 flex items-center gap-3">
              {t.photo
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={t.photo} alt={t.author} className="h-11 w-11 rounded-full object-cover" />
                : <span className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold" style={{ backgroundColor: 'color-mix(in srgb, var(--site-accent) 16%, transparent)', color: 'var(--site-accent)' }}>{t.author.charAt(0).toUpperCase() || '★'}</span>}
              <span>
                <span className="block text-sm font-semibold">{t.author}</span>
                {t.role && <span className="block text-xs text-slate-500">{t.role}</span>}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

export function LogosView({ block }: { block: Of<'logos'> }) {
  return (
    <div>
      {block.title && <p className="mb-5 text-center text-sm font-semibold uppercase tracking-widest text-slate-500">{block.title}</p>}
      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
        {block.images.map((img, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={img.url} alt={img.alt || ''} className={cn('h-10 max-w-[140px] object-contain csm:h-12', block.gray && 'opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0')} />
        ))}
      </div>
    </div>
  );
}

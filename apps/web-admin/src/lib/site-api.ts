/**
 * Paginas para clientes (publicas, sem login): tipos e chamadas. Usa fetch puro,
 * sem o cliente autenticado da administracao.
 */
export const SITE_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export type SiteFieldDef = {
  slug: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  multiple?: boolean;
  options?: Array<{ value: string; label: string; color?: string }>;
};

export type SiteBlockView =
  | { id: string; type: 'heading'; text: string; size?: 'lg' | 'md' }
  | { id: string; type: 'text'; text: string }
  | { id: string; type: 'image'; url: string; alt?: string }
  | { id: string; type: 'button'; label: string; url: string }
  | { id: string; type: 'divider' }
  | {
    id: string; type: 'form'; entitySlug: string; entityName?: string; fields: string[]; submitLabel?: string; successMessage?: string;
    showTrackingLink?: boolean; fieldDefs: SiteFieldDef[];
    /** Tabela de dentro: o cliente tambem preenche o registro de cima (ex.: segurado). */
    parent?: { entitySlug: string; name: string; title?: string; matchField?: string; fields: string[]; fieldDefs: SiteFieldDef[] };
  }
  | {
    id: string; type: 'tracking'; entitySlug: string; entityName: string; fields: string[]; timelineField?: string;
    uploadFields?: string[]; hasPdf: boolean; uploadDefs: SiteFieldDef[];
  }
  | { id: string; type: 'hero'; title: string; text?: string; imageUrl?: string; buttonLabel?: string; buttonUrl?: string }
  | { id: string; type: 'gallery'; title?: string; layout: 'polaroid' | 'grid' | 'mosaic'; images: Array<{ url: string; caption?: string }> }
  | { id: string; type: 'cards'; title?: string; columns: 1 | 2 | 3; items: Array<{ title: string; text?: string; imageUrl?: string; badge?: string }> }
  | { id: string; type: 'quote'; text: string; author?: string }
  | { id: string; type: 'catalog'; title?: string; entityName: string; groupLabel?: string; items: SiteCatalogItem[] };

export type SiteCatalogItem = { id: string; title: string; image?: string; price?: number; priceType?: string; description?: string; group?: string };

export interface SiteFooter { text?: string; address?: string; hours?: string; phone?: string; whatsapp?: string; instagram?: string; email?: string }

/** Aparencia da pagina (estilo, fundo, cor, capa). */
export interface SiteAppearance {
  ownLook?: boolean;
  style: 'classic' | 'scrapbook';
  background: 'plain' | 'dots' | 'hearts' | 'stars' | 'stripes' | 'grid';
  accent?: string;
  coverUrl?: string;
  tagline?: string;
}

/** Secoes da pagina e posicao de cada bloco na grade (mesmo formato do servidor, site-blocks.ts). */
export type SiteSpacing = 'none' | 'sm' | 'md' | 'lg';
export type SiteHideOn = 'mobile' | 'desktop';
export interface SiteItemStyle {
  align?: 'left' | 'center' | 'right';
  vAlign?: 'top' | 'center' | 'bottom';
  bg?: string;
  padding?: SiteSpacing;
  radius?: 'none' | 'sm' | 'lg';
  shadow?: boolean;
  light?: boolean;
}
export interface SiteLayoutItem {
  id: string; x: number; y: number; w: number; h: number; hide?: SiteHideOn; style?: SiteItemStyle;
  /** Posicao no celular dentro da secao (sem: ordem de leitura). */
  order?: number;
  /** Altura escolhida, em linhas da grade (sem: a do conteudo). */
  minH?: number;
}
export interface SiteSection {
  id: string;
  name?: string;
  width: 'narrow' | 'normal' | 'full';
  padding: SiteSpacing;
  bg?: string;
  bgImage?: string;
  overlay?: boolean;
  light?: boolean;
  hide?: SiteHideOn;
  items: SiteLayoutItem[];
}
export interface SiteLayout { sections: SiteSection[] }

export type SiteValue = string | number | boolean | string[] | null;

export interface SiteRecordView {
  title: SiteValue;
  status: { label: string; color: string | null } | null;
  updatedAt: string;
  fields: Array<{ slug: string; label: string; type: string; value: SiteValue }>;
  uploads: Array<{ slug: string; label: string; type: string; multiple: boolean; value: SiteValue }>;
  timeline: { label: string; columns: Array<{ slug: string; label: string; type: string }>; rows: Array<Record<string, SiteValue>> } | null;
}

export interface SitePageData {
  tenant: { name: string; logo: string | null; brandColor: string | null };
  page: { title: string; description: string | null; slug: string; settings?: SiteAppearance };
  /** Menu entre as paginas (2+ paginas) e rodape comum do site. */
  site?: { menu: Array<{ slug: string; label: string; current: boolean }>; footer: SiteFooter; homeSlug: string | null };
  blocks: SiteBlockView[];
  /** Secoes e grade (paginas antigas: uma secao com os blocos em sequencia). */
  layout?: SiteLayout;
  record: SiteRecordView | null;
  trackingError: string | null;
}

async function parse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (body as { message?: string | string[] }).message;
    throw new Error(Array.isArray(message) ? message.join(' ') : message || 'Não foi possível completar. Tente de novo.');
  }
  return body as T;
}

export const siteApi = {
  page: (tenant: string, page: string, token?: string | null) =>
    fetch(`${SITE_API_URL}/site/${encodeURIComponent(tenant)}/${encodeURIComponent(page)}${token ? `?c=${encodeURIComponent(token)}` : ''}`, { cache: 'no-store' })
      .then((r) => parse<SitePageData>(r)),

  submit: (tenant: string, page: string, block: string, data: Record<string, unknown>, website: string, parentData?: Record<string, unknown>) =>
    fetch(`${SITE_API_URL}/site/${tenant}/${page}/forms/${block}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, website, ...(parentData ? { parentData } : {}) }),
    }).then((r) => parse<{ ok: boolean; message: string; trackingUrl?: string }>(r)),

  uploadForm: (tenant: string, page: string, block: string, field: string, file: File, target?: 'parent') => {
    const body = new FormData();
    body.append('file', file);
    return fetch(`${SITE_API_URL}/site/${tenant}/${page}/forms/${block}/upload?field=${encodeURIComponent(field)}${target ? `&target=${target}` : ''}`, { method: 'POST', body })
      .then((r) => parse<{ url: string; name: string }>(r));
  },

  uploadTracking: (tenant: string, page: string, token: string, field: string, file: File) => {
    const body = new FormData();
    body.append('file', file);
    return fetch(`${SITE_API_URL}/site/${tenant}/${page}/track/${encodeURIComponent(token)}/files?field=${encodeURIComponent(field)}`, { method: 'POST', body })
      .then((r) => parse<{ ok: boolean }>(r));
  },

  pdfUrl: (tenant: string, page: string, token: string) => `${SITE_API_URL}/site/${tenant}/${page}/track/${encodeURIComponent(token)}/pdf`,
};

/** Endereco completo: a API devolve o subdominio da empresa (absoluto) ou /p/... (relativo). */
export function absoluteSiteUrl(url: string): string {
  return /^https?:\/\//.test(url) ? url : `${typeof window !== 'undefined' ? window.location.origin : ''}${url}`;
}

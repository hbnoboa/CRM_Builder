import {
  normalizeBlocks, normalizeLayout, normalizeSettings, normalizeSiteConfig,
  type NormalizeContext, type SiteBlock, type SiteHeader, type SiteFooterStyle, type SiteLayout, type SitePageSettings,
} from '../site-pages/site-blocks';
import { SITE_FONT_IDS } from '../site-pages/site-theme';
import { SITE_ICONS, SOCIAL_NETWORKS } from '../site-pages/site-blocks-more';

/**
 * Assistente das paginas para clientes: a IA monta uma pagina inteira (secoes na
 * grade, elementos, tema, topo e rodape) a partir da conversa e, se houver, de
 * imagens de modelo. Tudo passa pelos mesmos conferidores do editor.
 */

const BLOCKS = [
  'hero', 'heading', 'text', 'image', 'button', 'divider', 'gallery', 'cards', 'quote', 'catalog', 'form',
  'video', 'map', 'faq', 'icons', 'social', 'spacer', 'stats', 'pricing', 'testimonials', 'logos',
];
const HEX = { type: 'string', description: 'cor #rrggbb' };
const TEXT_STYLE = {
  type: 'object',
  properties: { size: { type: 'integer' }, bold: { type: 'boolean' }, italic: { type: 'boolean' }, upper: { type: 'boolean' }, color: HEX, font: { type: 'string', enum: [...SITE_FONT_IDS] } },
};

export const AI_PAGE_JSON_SCHEMA = {
  type: 'object',
  required: ['reply', 'title', 'theme', 'sections'],
  properties: {
    reply: { type: 'string' },
    title: { type: 'string', description: 'Nome da página (aparece no menu)' },
    theme: {
      type: 'object',
      properties: {
        decor: { type: 'string', enum: ['classic', 'scrapbook'] },
        pattern: { type: 'string', enum: ['plain', 'dots', 'hearts', 'stars', 'stripes', 'grid'] },
        accent: HEX,
        colors: { type: 'object', properties: { bg: HEX, surface: HEX, text: HEX, muted: HEX, accent2: HEX } },
        fonts: { type: 'object', properties: { heading: { type: 'string', enum: [...SITE_FONT_IDS] }, body: { type: 'string', enum: [...SITE_FONT_IDS] } } },
        text: { type: 'object', properties: { h1: TEXT_STYLE, h2: TEXT_STYLE, h3: TEXT_STYLE, body: TEXT_STYLE } },
        buttons: { type: 'object', properties: { shape: { type: 'string', enum: ['square', 'rounded', 'pill'] }, fill: { type: 'string', enum: ['solid', 'outline', 'soft', 'shadow'] } } },
        radius: { type: 'string', enum: ['none', 'sm', 'md', 'lg', 'xl'] },
        shadow: { type: 'string', enum: ['none', 'soft', 'strong'] },
        spacing: { type: 'string', enum: ['compact', 'normal', 'airy'] },
        animation: { type: 'string', enum: ['none', 'fade', 'rise', 'zoom', 'slide'] },
        coverUrl: { type: 'string' },
        tagline: { type: 'string' },
      },
    },
    header: {
      type: 'object',
      properties: {
        layout: { type: 'string', enum: ['bar', 'inline', 'centered', 'cover', 'minimal'] },
        menuStyle: { type: 'string', enum: ['pills', 'underline', 'plain', 'buttons'] },
        sticky: { type: 'boolean' },
        cta: { type: 'object', properties: { label: { type: 'string' }, url: { type: 'string' } } },
      },
    },
    footer: {
      type: 'object',
      properties: { layout: { type: 'string', enum: ['card', 'columns', 'centered', 'minimal'] }, tone: { type: 'string', enum: ['page', 'surface', 'dark', 'accent'] } },
    },
    sections: {
      type: 'array',
      maxItems: 14,
      items: {
        type: 'object',
        required: ['items'],
        properties: {
          name: { type: 'string' },
          width: { type: 'string', enum: ['narrow', 'normal', 'full'] },
          padding: { type: 'string', enum: ['none', 'sm', 'md', 'lg'] },
          tone: { type: 'string', enum: ['page', 'surface', 'accent', 'accent2', 'dark'] },
          bg: HEX,
          gradient: { type: 'object', properties: { from: HEX, to: HEX, angle: { type: 'integer' } } },
          pattern: { type: 'string', enum: ['plain', 'dots', 'hearts', 'stars', 'stripes', 'grid'] },
          bgImage: { type: 'string' },
          items: {
            type: 'array',
            maxItems: 12,
            items: {
              type: 'object',
              required: ['w', 'block'],
              properties: {
                w: { type: 'integer', minimum: 1, maximum: 12, description: 'largura em colunas (12 = linha inteira)' },
                newRow: { type: 'boolean', description: 'começa numa linha nova (senão fica ao lado do anterior, se couber)' },
                align: { type: 'string', enum: ['left', 'center', 'right'] },
                block: {
                  type: 'object',
                  required: ['type'],
                  properties: { type: { type: 'string', enum: BLOCKS } },
                  additionalProperties: true,
                },
              },
            },
          },
        },
      },
    },
  },
};

export const AI_PAGE_SYSTEM_PROMPT = `Você é o assistente do CRM Builder que monta páginas de site para empresas brasileiras (estilo Wix). Quem conversa com você NÃO é programador.

Devolva SEMPRE a página completa no formato pedido: tema, topo, rodapé e seções (faixas de cima para baixo). Cada seção tem elementos numa grade de 12 colunas: "w" é a largura (12 = linha inteira, 6 = metade); elementos seguidos ficam lado a lado enquanto couberem; "newRow": true força uma linha nova. No celular tudo fica um embaixo do outro.

Elementos ("block.type" e seus campos):
- hero: title, text, buttonLabel, buttonUrl, imageUrl (foto grande com título por cima; use em seção width "full", padding "none")
- heading: text, size ("lg" ou "md") · text: text (parágrafos separados por linha em branco) · quote: text, author
- image: url, alt · button: label, url · divider · spacer: height (px)
- gallery: title, layout ("polaroid" | "grid" | "mosaic"), images [{url, caption}]
- cards: title, columns (1-3), items [{title, text, imageUrl, badge}] (serve para equipe, produtos, destaques)
- icons: title, columns (1-4), layout ("top" | "side"), items [{icon, title, text}]; icon um destes: ${SITE_ICONS.join(', ')}
- stats: items [{value, label}] (ex.: "+500", "clientes")
- pricing: title, plans [{name, price, period, features [texto], buttonLabel, buttonUrl, highlight}]
- testimonials: title, items [{text, author, role}]
- faq: title, items [{q, a}]
- logos: title, images [{url, alt}]
- social: style ("icons" | "labels"), links [{network, url}]; network um destes: ${SOCIAL_NETWORKS.join(', ')}
- video: url (YouTube, Vimeo) e caption · map: address
- catalog (vitrine de uma tabela da empresa): entitySlug, titleField, imageField, priceField, descriptionField, groupField
- form (formulário que vira registro numa tabela): entitySlug, fields [identificadores], submitLabel, successMessage

Regras:
- Português do Brasil, textos prontos para publicar, curtos e convidativos, com o jeito do negócio.
- Monte de 4 a 9 seções: um destaque no topo, o que a empresa faz, provas (números, depoimentos), e um fim com contato ou chamada para ação.
- NUNCA invente telefone, endereço, e-mail, preços ou números reais da empresa: se não foram dados, use textos de exemplo claros (ex.: "(11) 99999-0000", "Seu endereço aqui") e avise na "reply" para trocar.
- Fotos: não invente endereços de imagem. Deixe "url"/"imageUrl" vazios (a empresa envia depois) OU use uma das IMAGENS ENVIADAS listadas, mas só se a pessoa pedir para usar a foto na página.
- Imagens enviadas como MODELO servem de referência: copie o clima, as cores, o tipo de letra, a disposição e o estilo das seções.
- Tema: escolha cores (#rrggbb) com bom contraste, fontes da lista e o estilo dos botões combinando com o negócio. "decor": "scrapbook" só para visual fofo/artesanal.
- Formulário e vitrine só com tabelas da lista TABELAS DA EMPRESA (identificadores exatos); se não houver tabela que sirva, não use.
- Links: https://..., "#" + nome de seção, ou o endereço de outra página do site.
- A cada mensagem devolva a página COMPLETA atualizada; mantenha o que a pessoa não pediu para mudar.
- "reply": 1 a 4 frases dizendo o que montou ou mudou e o que a pessoa deve trocar (fotos, contatos).`;

export interface AiPageProposal {
  reply: string;
  title: string;
  theme?: Record<string, unknown>;
  header?: Record<string, unknown>;
  footer?: Record<string, unknown>;
  sections?: Array<Record<string, unknown>>;
}

export interface NormalizedPage {
  reply: string;
  warnings: string[];
  proposal: AiPageProposal;
  title: string;
  blocks: SiteBlock[];
  layout: SiteLayout;
  settings: SitePageSettings;
  header?: SiteHeader;
  footerStyle?: SiteFooterStyle;
}

interface PlacedItem { id: string; x: number; y: number; w: number; h: number; style?: Record<string, unknown> }

/** Elementos altos que costumam ter uma coluna de texto ao lado. */
const TALL = new Set(['image', 'video', 'map', 'form', 'gallery']);

/**
 * A IA descreve a pagina em linhas: "foto (6) + titulo (6)", depois "texto (6)" e
 * "botao (6)". Na grade isso deixaria o texto embaixo da foto. Quando uma linha tem
 * so um elemento alto e um do lado, e as linhas seguintes cabem na coluna livre, elas
 * vao para essa coluna, uma embaixo da outra, e o elemento alto ocupa essas linhas.
 */
export function stackBesideTall(items: PlacedItem[], typeOf: Map<string, string>): PlacedItem[] {
  const rows: PlacedItem[][] = [];
  for (const it of [...items].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const last = rows[rows.length - 1];
    if (last && last[0].y === it.y) last.push(it);
    else rows.push([it]);
  }
  const tall = (i: PlacedItem) => TALL.has(typeOf.get(i.id) ?? '');
  const out: PlacedItem[] = [];
  let y = 0;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const anchors = row.filter(tall);
    const side = row.filter((i) => !tall(i));
    if (anchors.length === 1 && side.length === 1 && anchors[0].w <= 8) {
      const a = anchors[0];
      const free = 12 - a.w;
      const col = [side[0]];
      while (rows[r + 1] && rows[r + 1].every((i) => !tall(i) && i.w <= free)) col.push(...rows[++r]);
      if (col.length > 1) {
        const x = a.x === 0 ? a.w : 0;
        out.push({ ...a, x: a.x === 0 ? 0 : free, y, h: col.length });
        col.forEach((it, k) => out.push({ ...it, x, w: free, y: y + k, h: 1 }));
        y += col.length;
        continue;
      }
    }
    for (const it of row) out.push({ ...it, y });
    y += 1;
  }
  return out;
}

const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Confere a pagina da IA com os mesmos conferidores do editor; elemento invalido sai com aviso. */
export function normalizePage(raw: unknown, ctx: NormalizeContext): NormalizedPage {
  const p = obj(raw);
  const warnings: string[] = [];
  const theme = obj(p.theme);
  const settings = normalizeSettings({
    style: theme.decor === 'scrapbook' ? 'scrapbook' : 'classic',
    background: theme.pattern,
    accent: theme.accent,
    coverUrl: theme.coverUrl,
    tagline: theme.tagline,
    theme: {
      colors: theme.colors, fonts: theme.fonts, text: theme.text, buttons: theme.buttons,
      radius: theme.radius, shadow: theme.shadow, spacing: theme.spacing, animation: theme.animation,
    },
  });
  const site = normalizeSiteConfig({ header: p.header, footerStyle: p.footer });

  const blocks: SiteBlock[] = [];
  const typeById = new Map<string, string>();
  let n = 0;
  const sections = (Array.isArray(p.sections) ? p.sections : []).slice(0, 14).map((rawSection, si) => {
    const s = obj(rawSection);
    let x = 0;
    let y = 0;
    const items = (Array.isArray(s.items) ? s.items : []).slice(0, 12).map((rawItem) => {
      const it = obj(rawItem);
      const block = obj(it.block);
      const id = `ia-${++n}`;
      let normalized: SiteBlock[];
      try {
        normalized = normalizeBlocks([{ ...block, id }], ctx);
      } catch (e) {
        warnings.push(`Tirei um elemento (${String(block.type)}): ${(e as Error).message}`);
        return null;
      }
      if (!normalized.length) return null;
      blocks.push(normalized[0]);
      typeById.set(normalized[0].id, normalized[0].type);
      const w = Math.min(12, Math.max(1, Math.round(Number(it.w)) || 12));
      if (it.newRow === true || x + w > 12) { x = 0; y += 1; }
      const item: PlacedItem = { id: normalized[0].id, x, y, w, h: 1, ...(it.align ? { style: { align: it.align } } : {}) };
      x += w;
      return item;
    }).filter((i): i is PlacedItem => !!i);
    return {
      id: `secao-${si + 1}`, name: s.name, width: s.width, padding: s.padding,
      tone: s.tone === 'page' ? undefined : s.tone, bg: s.bg, gradient: s.gradient, pattern: s.pattern, bgImage: s.bgImage,
      // Foto de fundo atras de texto: escurece e usa letra clara por padrao (texto legivel)
      ...(s.bgImage ? { overlay: s.overlay !== false, light: s.light !== false } : {}),
      items: stackBesideTall(items, typeById),
    };
  });
  const layout = normalizeLayout({ sections }, blocks);
  const title = String(p.title ?? '').trim().slice(0, 120) || 'Nova página';
  return {
    reply: String(p.reply ?? '').slice(0, 2000) || 'Montei uma proposta de página.',
    warnings,
    proposal: p as unknown as AiPageProposal,
    title, blocks, layout, settings,
    ...(site.header ? { header: site.header } : {}),
    ...(site.footerStyle ? { footerStyle: site.footerStyle } : {}),
  };
}

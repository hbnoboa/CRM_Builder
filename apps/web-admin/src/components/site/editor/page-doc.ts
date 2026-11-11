import type { SiteBlockDraft } from '@/hooks/use-site-pages';
import type { SiteItemStyle, SiteLayout, SiteLayoutItem, SiteSection } from '@/lib/site-api';
import type { SiteLookDraft } from '@/components/site/site-block-editor';

/** O que o editor de pagina edita (e desfaz/refaz): blocos, secoes/grade e aparencia. */
export interface PageDoc {
  blocks: SiteBlockDraft[];
  layout: SiteLayout;
  look: SiteLookDraft;
}

export type Selection = { kind: 'page' } | { kind: 'section'; id: string } | { kind: 'item'; id: string };

export const COLS = 12;

export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

/** Conteudo inicial de cada tipo de bloco (com texto, para nao sumir ao salvar). */
export const STARTERS: Record<string, Record<string, unknown>> = {
  heading: { text: 'Novo título' },
  text: { text: 'Escreva aqui o seu texto.' },
  hero: { title: 'Bem-vindo!' },
  button: { label: 'Fale com a gente', url: '' },
  gallery: { layout: 'polaroid', images: [] },
  cards: { columns: 3, items: [{ title: 'Destaque 1' }, { title: 'Destaque 2' }, { title: 'Destaque 3' }] },
  quote: { text: 'Uma frase marcante sobre a empresa.' },
  catalog: { limit: 30 },
};

/** Largura inicial (em colunas de 12) de cada tipo. */
export const DEFAULT_W: Record<string, number> = { image: 6, button: 4, quote: 8 };

export const sectionOf = (layout: SiteLayout, itemId: string) => layout.sections.find((s) => s.items.some((it) => it.id === itemId));
export const itemOf = (layout: SiteLayout, itemId: string) => sectionOf(layout, itemId)?.items.find((it) => it.id === itemId);
const bottom = (items: SiteLayoutItem[]) => items.reduce((max, it) => Math.max(max, it.y + it.h), 0);

const mapSection = (doc: PageDoc, sectionId: string, fn: (s: SiteSection) => SiteSection): PageDoc => ({
  ...doc,
  layout: { sections: doc.layout.sections.map((s) => (s.id === sectionId ? fn(s) : s)) },
});

export function emptySection(width: SiteSection['width'] = 'normal'): SiteSection {
  return { id: newId('secao'), width, padding: 'md', items: [] };
}

/** Bloco novo na secao (no fim, ou onde foi solto). */
export function addBlock(doc: PageDoc, type: string, sectionId: string | null, at?: { x: number; y: number; w?: number }): { doc: PageDoc; id: string } {
  const id = newId(type);
  const block: SiteBlockDraft = { id, type, ...(STARTERS[type] || {}) };
  let sections = doc.layout.sections;
  let target = sections.find((s) => s.id === sectionId) ?? sections[sections.length - 1];
  if (!target) {
    target = emptySection();
    sections = [target];
  }
  const w = Math.min(COLS, at?.w ?? DEFAULT_W[type] ?? COLS);
  const item: SiteLayoutItem = { id, x: Math.min(at?.x ?? 0, COLS - w), y: at?.y ?? bottom(target.items), w, h: 4 };
  const tid = target.id;
  return {
    id,
    doc: {
      ...doc,
      blocks: [...doc.blocks, block],
      layout: { sections: sections.map((s) => (s.id === tid ? { ...s, items: [...s.items, item] } : s)) },
    },
  };
}

export function removeItem(doc: PageDoc, id: string): PageDoc {
  return {
    ...doc,
    blocks: doc.blocks.filter((b) => b.id !== id),
    layout: { sections: doc.layout.sections.map((s) => ({ ...s, items: s.items.filter((it) => it.id !== id) })) },
  };
}

export function duplicateItem(doc: PageDoc, id: string): { doc: PageDoc; id: string } | null {
  const block = doc.blocks.find((b) => b.id === id);
  const section = sectionOf(doc.layout, id);
  const item = section?.items.find((it) => it.id === id);
  if (!block || !section || !item) return null;
  const copyId = newId(block.type);
  const copy: SiteBlockDraft = { ...structuredClone(block), id: copyId };
  const next = mapSection(doc, section.id, (s) => ({ ...s, items: [...s.items, { ...structuredClone(item), id: copyId, y: item.y + item.h }] }));
  const index = doc.blocks.findIndex((b) => b.id === id);
  return { id: copyId, doc: { ...next, blocks: [...doc.blocks.slice(0, index + 1), copy, ...doc.blocks.slice(index + 1)] } };
}

export function patchBlock(doc: PageDoc, id: string, patch: Record<string, unknown>): PageDoc {
  return { ...doc, blocks: doc.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) };
}

export function patchItem(doc: PageDoc, id: string, patch: Partial<Omit<SiteLayoutItem, 'style'>> & { style?: SiteItemStyle }): PageDoc {
  const section = sectionOf(doc.layout, id);
  if (!section) return doc;
  return mapSection(doc, section.id, (s) => ({ ...s, items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
}

/** Leva o elemento para o fim de outra secao. */
export function moveItemToSection(doc: PageDoc, id: string, sectionId: string): PageDoc {
  const item = itemOf(doc.layout, id);
  if (!item) return doc;
  const sections = doc.layout.sections.map((s) => ({ ...s, items: s.items.filter((it) => it.id !== id) }));
  return {
    ...doc,
    layout: { sections: sections.map((s) => (s.id === sectionId ? { ...s, items: [...s.items, { ...item, y: bottom(s.items) }] } : s)) },
  };
}

export function patchSection(doc: PageDoc, id: string, patch: Partial<Omit<SiteSection, 'id' | 'items'>>): PageDoc {
  return mapSection(doc, id, (s) => ({ ...s, ...patch }));
}

export function addSection(doc: PageDoc, afterId: string | null): { doc: PageDoc; id: string } {
  const section = emptySection();
  const list = [...doc.layout.sections];
  const index = afterId ? list.findIndex((s) => s.id === afterId) : list.length - 1;
  list.splice(index + 1, 0, section);
  return { id: section.id, doc: { ...doc, layout: { sections: list } } };
}

export function moveSection(doc: PageDoc, id: string, toIndex: number): PageDoc {
  const list = [...doc.layout.sections];
  const from = list.findIndex((s) => s.id === id);
  if (from < 0 || toIndex < 0 || toIndex >= list.length) return doc;
  const [s] = list.splice(from, 1);
  list.splice(toIndex, 0, s);
  return { ...doc, layout: { sections: list } };
}

/** Copia a secao inteira, com copias dos blocos. */
export function duplicateSection(doc: PageDoc, id: string): { doc: PageDoc; id: string } | null {
  const index = doc.layout.sections.findIndex((s) => s.id === id);
  const section = doc.layout.sections[index];
  if (!section) return null;
  const copies: SiteBlockDraft[] = [];
  const items = section.items.map((it) => {
    const block = doc.blocks.find((b) => b.id === it.id);
    if (!block) return null;
    const copyId = newId(block.type);
    copies.push({ ...structuredClone(block), id: copyId });
    return { ...structuredClone(it), id: copyId };
  }).filter((it): it is SiteLayoutItem => !!it);
  const copy: SiteSection = { ...structuredClone(section), id: newId('secao'), items };
  const list = [...doc.layout.sections];
  list.splice(index + 1, 0, copy);
  return { id: copy.id, doc: { ...doc, blocks: [...doc.blocks, ...copies], layout: { sections: list } } };
}

export function removeSection(doc: PageDoc, id: string): PageDoc {
  const section = doc.layout.sections.find((s) => s.id === id);
  if (!section) return doc;
  const gone = new Set(section.items.map((it) => it.id));
  return {
    ...doc,
    blocks: doc.blocks.filter((b) => !gone.has(b.id!)),
    layout: { sections: doc.layout.sections.filter((s) => s.id !== id) },
  };
}

/** Posicoes vindas da grade (arrastar, redimensionar, alturas medidas). */
export function applyGrid(doc: PageDoc, sectionId: string, grid: Array<{ i: string; x: number; y: number; w: number; h: number }>): PageDoc {
  const pos = new Map(grid.map((g) => [g.i, g]));
  let changed = false;
  const next = mapSection(doc, sectionId, (s) => ({
    ...s,
    items: s.items.map((it) => {
      const g = pos.get(it.id);
      if (!g || (g.x === it.x && g.y === it.y && g.w === it.w && g.h === it.h)) return it;
      changed = true;
      return { ...it, x: g.x, y: g.y, w: g.w, h: g.h };
    }),
  }));
  return changed ? next : doc;
}

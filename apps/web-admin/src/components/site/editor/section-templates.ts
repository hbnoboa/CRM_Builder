import {
  BadgeDollarSign, Building2, CircleHelp, Columns2, GalleryHorizontalEnd, Hash, Info, Megaphone, MessageSquareQuote, Phone,
  Shapes, Users, Video, Wallpaper, type LucideIcon,
} from 'lucide-react';
import type { SiteBlockDraft } from '@/hooks/use-site-pages';
import type { SiteItemStyle, SiteSection } from '@/lib/site-api';
import { STARTERS, newId, type PageDoc } from './page-doc';

/**
 * Secoes prontas: uma faixa ja montada (blocos na grade) para encaixar na pagina e
 * trocar o conteudo. Fotos ficam como rascunho ("escolha a foto") ate a empresa enviar.
 */
type Piece = { type: string; data?: Record<string, unknown>; x: number; y: number; w: number; style?: SiteItemStyle };
export interface SectionTemplate {
  id: string;
  name: string;
  hint: string;
  icon: LucideIcon;
  section: Partial<Omit<SiteSection, 'id' | 'items'>>;
  pieces: Piece[];
}

const center: SiteItemStyle = { align: 'center' };

export const SECTION_TEMPLATES: SectionTemplate[] = [
  {
    id: 'destaque', name: 'Destaque com foto', hint: 'Foto grande com título e botão', icon: Wallpaper,
    section: { width: 'full', padding: 'none' },
    pieces: [{ type: 'hero', data: { title: 'Um título que chama atenção', text: 'Uma frase curta sobre o que você faz de melhor.', buttonLabel: 'Fale com a gente', buttonUrl: '' }, x: 0, y: 0, w: 12 }],
  },
  {
    id: 'sobre', name: 'Sobre nós', hint: 'Foto de um lado, texto do outro', icon: Info,
    section: { width: 'normal', padding: 'lg' },
    pieces: [
      { type: 'image', data: { url: '' }, x: 0, y: 0, w: 6 },
      { type: 'heading', data: { text: 'Sobre nós' }, x: 6, y: 0, w: 6 },
      { type: 'text', data: { text: 'Conte a história da empresa: como começou, o que faz e por que os clientes gostam de voltar.' }, x: 6, y: 1, w: 6 },
      { type: 'button', data: { label: 'Conheça mais', url: '' }, x: 6, y: 2, w: 4 },
    ],
  },
  {
    id: 'servicos', name: 'Serviços', hint: 'Ícones com título e texto', icon: Shapes,
    section: { width: 'normal', padding: 'lg' },
    pieces: [
      { type: 'heading', data: { text: 'O que fazemos' }, x: 0, y: 0, w: 12, style: center },
      { type: 'icons', x: 0, y: 1, w: 12 },
    ],
  },
  {
    id: 'numeros', name: 'Números', hint: 'Resultados em destaque', icon: Hash,
    section: { width: 'normal', padding: 'md', tone: 'surface' },
    pieces: [{ type: 'stats', x: 0, y: 0, w: 12 }],
  },
  {
    id: 'depoimentos', name: 'Depoimentos', hint: 'O que os clientes dizem', icon: MessageSquareQuote,
    section: { width: 'normal', padding: 'lg' },
    pieces: [{ type: 'testimonials', x: 0, y: 0, w: 12 }],
  },
  {
    id: 'precos', name: 'Preços', hint: 'Planos lado a lado', icon: BadgeDollarSign,
    section: { width: 'normal', padding: 'lg' },
    pieces: [{ type: 'pricing', x: 0, y: 0, w: 12 }],
  },
  {
    id: 'perguntas', name: 'Perguntas frequentes', hint: 'Respostas que abrem e fecham', icon: CircleHelp,
    section: { width: 'narrow', padding: 'lg' },
    pieces: [{ type: 'faq', x: 0, y: 0, w: 12 }],
  },
  {
    id: 'equipe', name: 'Equipe', hint: 'Fotos, nomes e funções', icon: Users,
    section: { width: 'normal', padding: 'lg' },
    pieces: [
      { type: 'heading', data: { text: 'Nossa equipe' }, x: 0, y: 0, w: 12, style: center },
      { type: 'cards', data: { columns: 3, items: [{ title: 'Nome da pessoa', text: 'Função' }, { title: 'Nome da pessoa', text: 'Função' }, { title: 'Nome da pessoa', text: 'Função' }] }, x: 0, y: 1, w: 12 },
    ],
  },
  {
    id: 'contato', name: 'Contato com mapa', hint: 'Endereço, redes e mapa', icon: Phone,
    section: { width: 'normal', padding: 'lg' },
    pieces: [
      { type: 'heading', data: { text: 'Fale com a gente' }, x: 0, y: 0, w: 6 },
      { type: 'text', data: { text: 'Rua Exemplo, 123 - Centro\nSegunda a sexta, das 9h às 18h\n(11) 99999-0000' }, x: 0, y: 1, w: 6 },
      { type: 'social', x: 0, y: 2, w: 6 },
      { type: 'map', x: 6, y: 0, w: 6 },
    ],
  },
  {
    id: 'chamada', name: 'Chamada para ação', hint: 'Faixa colorida com botão', icon: Megaphone,
    section: { width: 'narrow', padding: 'lg', tone: 'accent' },
    pieces: [
      { type: 'heading', data: { text: 'Pronto para começar?' }, x: 0, y: 0, w: 12, style: center },
      { type: 'text', data: { text: 'Uma frase convidando a pessoa para o próximo passo.' }, x: 0, y: 1, w: 12, style: center },
      { type: 'button', data: { label: 'Quero agora', url: '' }, x: 0, y: 2, w: 12, style: center },
    ],
  },
  {
    id: 'galeria', name: 'Galeria', hint: 'Várias fotos juntas', icon: GalleryHorizontalEnd,
    section: { width: 'normal', padding: 'lg' },
    pieces: [{ type: 'gallery', data: { title: 'Galeria', layout: 'grid', images: [] }, x: 0, y: 0, w: 12 }],
  },
  {
    id: 'logos', name: 'Logos de clientes', hint: 'Marcas que confiam em você', icon: Building2,
    section: { width: 'normal', padding: 'md', tone: 'surface' },
    pieces: [{ type: 'logos', x: 0, y: 0, w: 12 }],
  },
  {
    id: 'video', name: 'Vídeo', hint: 'Título e um vídeo', icon: Video,
    section: { width: 'narrow', padding: 'lg' },
    pieces: [
      { type: 'heading', data: { text: 'Veja como funciona' }, x: 0, y: 0, w: 12, style: center },
      { type: 'video', x: 0, y: 1, w: 12 },
    ],
  },
  {
    id: 'duas-colunas', name: 'Texto em duas colunas', hint: 'Título e dois blocos de texto', icon: Columns2,
    section: { width: 'normal', padding: 'lg' },
    pieces: [
      { type: 'heading', data: { text: 'Um título para esta parte' }, x: 0, y: 0, w: 12 },
      { type: 'text', data: { text: 'Primeira coluna de texto.' }, x: 0, y: 1, w: 6 },
      { type: 'text', data: { text: 'Segunda coluna de texto.' }, x: 6, y: 1, w: 6 },
    ],
  },
];

/** Encaixa a secao pronta depois da secao escolhida (ou no fim). */
export function insertTemplate(doc: PageDoc, tpl: SectionTemplate, afterId: string | null): { doc: PageDoc; id: string } {
  const blocks: SiteBlockDraft[] = [];
  const items = tpl.pieces.map((p) => {
    const id = newId(p.type);
    blocks.push({ id, type: p.type, ...structuredClone(STARTERS[p.type] || {}), ...structuredClone(p.data || {}) });
    return { id, x: p.x, y: p.y, w: p.w, h: 4, ...(p.style ? { style: p.style } : {}) };
  });
  const section: SiteSection = { id: newId('secao'), width: 'normal', padding: 'md', ...tpl.section, items };
  const list = [...doc.layout.sections];
  const index = afterId ? list.findIndex((s) => s.id === afterId) : list.length - 1;
  list.splice(index + 1, 0, section);
  return { id: section.id, doc: { ...doc, blocks: [...doc.blocks, ...blocks], layout: { sections: list } } };
}

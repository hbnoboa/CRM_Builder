'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { EditorContent, Extension, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Color, FontSize, TextStyle } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Check, Highlighter, Italic, Link2, List, ListOrdered,
  Quote, RemoveFormatting, Strikethrough, Underline as UnderlineIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FONT_KINDS, SITE_FONTS, fontStack, type SiteCustomFont } from '@/lib/site-theme';
import type { RichNode } from '@/lib/site-api';

/**
 * Fonte de um trecho: guarda o id da fonte (lista ou "custom:<id>") e mostra com
 * a fonte de verdade. Mesmo formato que o servidor confere e a pagina monta.
 */
function siteFontFamily(fonts: SiteCustomFont[]) {
  return Extension.create({
    name: 'siteFontFamily',
    addGlobalAttributes() {
      return [{
        types: ['textStyle'],
        attributes: {
          fontFamily: {
            default: null,
            parseHTML: (el: HTMLElement) => el.getAttribute('data-font'),
            renderHTML: (attrs: { fontFamily?: string | null }) => {
              if (!attrs.fontFamily) return {};
              return { 'data-font': attrs.fontFamily, style: `font-family: ${fontStack(attrs.fontFamily, fonts) ?? 'inherit'}` };
            },
          },
        },
      }];
    },
  });
}

const SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 56, 64, 72];

interface Props {
  doc: RichNode;
  fonts: SiteCustomFont[];
  /** Onde a barra de formatacao aparece (em cima da pagina, como no Word). */
  toolbarSlot: HTMLElement | null;
  onChange: (doc: RichNode, text: string) => void;
  onDone: () => void;
}

/** Texto editavel na propria pagina, com barra de formatacao estilo Word. */
export function RichTextEditor({ doc, fonts, toolbarSlot, onChange, onDone }: Props) {
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        code: false, codeBlock: false, horizontalRule: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
      TextStyle, Color, FontSize, siteFontFamily(fonts),
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: doc as unknown as Record<string, unknown>,
    editorProps: { attributes: { class: 'site-rich outline-none cursor-text min-h-[1.5em]', 'data-testid': 'rich-editor' } },
    onUpdate: ({ editor: e }) => changeRef.current(e.getJSON() as RichNode, e.getText({ blockSeparator: '\n\n' })),
    autofocus: 'end',
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onDone(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  return (
    <>
      <EditorContent editor={editor} />
      {editor && toolbarSlot && createPortal(<Toolbar editor={editor} fonts={fonts} onDone={onDone} />, toolbarSlot)}
    </>
  );
}

function Btn({ on, title, onClick, children, testId }: { on?: boolean; title: string; onClick: () => void; children: ReactNode; testId?: string }) {
  return (
    <button type="button" title={title} aria-label={title} aria-pressed={on} data-testid={testId}
      onMouseDown={(e) => e.preventDefault()} onClick={onClick}
      className={cn('flex h-8 min-w-8 items-center justify-center rounded px-1.5 text-sm hover:bg-muted', on && 'bg-primary/15 text-primary')}>
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-1 h-6 w-px bg-border" />;

/** Barra de formatacao: estilo, fonte, tamanho, negrito..., cores, alinhamento, listas, link. */
function Toolbar({ editor, fonts, onDone }: { editor: Editor; fonts: SiteCustomFont[]; onDone: () => void }) {
  const st = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const ts = e.getAttributes('textStyle') as { fontFamily?: string; fontSize?: string; color?: string };
      return {
        block: e.isActive('heading', { level: 1 }) ? 'h1' : e.isActive('heading', { level: 2 }) ? 'h2' : e.isActive('heading', { level: 3 }) ? 'h3' : 'p',
        font: ts.fontFamily ?? '',
        size: ts.fontSize ? String(parseInt(ts.fontSize, 10)) : '',
        color: ts.color ?? '#000000',
        highlight: (e.getAttributes('highlight') as { color?: string }).color ?? '#fff176',
        bold: e.isActive('bold'), italic: e.isActive('italic'), underline: e.isActive('underline'), strike: e.isActive('strike'),
        align: (['left', 'center', 'right', 'justify'] as const).find((a) => e.isActive({ textAlign: a })) ?? 'left',
        bullet: e.isActive('bulletList'), ordered: e.isActive('orderedList'), quote: e.isActive('blockquote'), link: e.isActive('link'),
      };
    },
  });
  const run = () => editor.chain().focus();
  const select = 'h-8 rounded border bg-background px-1.5 text-sm';

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b bg-background px-3 py-1.5" data-testid="rich-toolbar" onMouseDown={(e) => { if ((e.target as HTMLElement).tagName !== 'SELECT' && (e.target as HTMLElement).tagName !== 'INPUT') e.preventDefault(); }}>
      <select className={cn(select, 'w-28')} value={st.block} aria-label="Estilo do texto" data-testid="rich-block"
        onChange={(e) => {
          const v = e.target.value;
          if (v === 'p') run().setParagraph().run();
          else run().setHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 }).run();
        }}>
        <option value="p">Parágrafo</option><option value="h1">Título 1</option><option value="h2">Título 2</option><option value="h3">Título 3</option>
      </select>
      <select className={cn(select, 'w-36')} value={st.font} aria-label="Fonte" data-testid="rich-font"
        onChange={(e) => (e.target.value ? run().setMark('textStyle', { fontFamily: e.target.value }).run() : run().setMark('textStyle', { fontFamily: null }).removeEmptyTextStyle().run())}>
        <option value="">Fonte do tema</option>
        {FONT_KINDS.map((k) => (
          <optgroup key={k.kind} label={k.label}>
            {SITE_FONTS.filter((f) => f.kind === k.kind).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </optgroup>
        ))}
        {fonts.length > 0 && (
          <optgroup label="Suas fontes">{fonts.map((f) => <option key={f.id} value={`custom:${f.id}`}>{f.name}</option>)}</optgroup>
        )}
      </select>
      <select className={cn(select, 'w-20')} value={st.size} aria-label="Tamanho" data-testid="rich-size"
        onChange={(e) => (e.target.value ? run().setFontSize(`${e.target.value}px`).run() : run().unsetFontSize().run())}>
        <option value="">Tam.</option>
        {SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      <Sep />
      <Btn on={st.bold} title="Negrito (Ctrl+B)" onClick={() => run().toggleBold().run()} testId="rich-bold"><Bold className="h-4 w-4" /></Btn>
      <Btn on={st.italic} title="Itálico (Ctrl+I)" onClick={() => run().toggleItalic().run()}><Italic className="h-4 w-4" /></Btn>
      <Btn on={st.underline} title="Sublinhado (Ctrl+U)" onClick={() => run().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></Btn>
      <Btn on={st.strike} title="Tachado" onClick={() => run().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></Btn>
      <Sep />
      <label className="flex h-8 cursor-pointer items-center gap-1 rounded px-1.5 hover:bg-muted" title="Cor da letra">
        <span className="text-sm font-bold underline decoration-4" style={{ textDecorationColor: st.color }}>A</span>
        <input type="color" className="sr-only" value={st.color} onChange={(e) => run().setColor(e.target.value).run()} data-testid="rich-color" />
      </label>
      <label className="flex h-8 cursor-pointer items-center gap-1 rounded px-1.5 hover:bg-muted" title="Marca-texto">
        <Highlighter className="h-4 w-4" style={{ color: st.highlight }} />
        <input type="color" className="sr-only" value={st.highlight} onChange={(e) => run().setHighlight({ color: e.target.value }).run()} />
      </label>
      <Sep />
      <Btn on={st.align === 'left'} title="Alinhar à esquerda" onClick={() => run().setTextAlign('left').run()}><AlignLeft className="h-4 w-4" /></Btn>
      <Btn on={st.align === 'center'} title="Centralizar" onClick={() => run().setTextAlign('center').run()} testId="rich-center"><AlignCenter className="h-4 w-4" /></Btn>
      <Btn on={st.align === 'right'} title="Alinhar à direita" onClick={() => run().setTextAlign('right').run()}><AlignRight className="h-4 w-4" /></Btn>
      <Btn on={st.align === 'justify'} title="Justificar" onClick={() => run().setTextAlign('justify').run()}><AlignJustify className="h-4 w-4" /></Btn>
      <Sep />
      <Btn on={st.bullet} title="Lista com marcadores" onClick={() => run().toggleBulletList().run()}><List className="h-4 w-4" /></Btn>
      <Btn on={st.ordered} title="Lista numerada" onClick={() => run().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></Btn>
      <Btn on={st.quote} title="Citação" onClick={() => run().toggleBlockquote().run()}><Quote className="h-4 w-4" /></Btn>
      <Btn on={st.link} title="Link" onClick={() => {
        if (st.link) { run().unsetLink().run(); return; }
        const href = window.prompt('Link (https://…, WhatsApp, ou o endereço de outra página do site):');
        if (href) run().setLink({ href: href.trim() }).run();
      }}><Link2 className="h-4 w-4" /></Btn>
      <Btn title="Limpar formatação" onClick={() => run().unsetAllMarks().clearNodes().run()}><RemoveFormatting className="h-4 w-4" /></Btn>
      <span className="flex-1" />
      <button type="button" onClick={onDone} className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" data-testid="rich-done">
        <Check className="h-4 w-4" /> Concluir
      </button>
    </div>
  );
}

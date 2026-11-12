import type { CSSProperties, ReactNode } from 'react';
import { fontStack, type SiteCustomFont } from '@/lib/site-theme';
import type { RichNode } from '@/lib/site-api';

/**
 * Texto formatado (estilo Word) na pagina: monta os elementos a partir do
 * documento conferido no servidor. Nunca usa HTML vindo de fora.
 */
export function RichTextView({ doc, fonts, className }: { doc: RichNode; fonts?: SiteCustomFont[]; className?: string }) {
  return <div className={className ? `site-rich ${className}` : 'site-rich'}>{(doc.content || []).map((n, i) => renderNode(n, i, fonts))}</div>;
}

/** Texto puro antigo (sem formatacao): paragrafos separados por linha em branco. */
export function plainToDoc(text: string): RichNode {
  const paragraphs = text.split(/\n{2,}/).map((p) => {
    const lines = p.split('\n');
    const content: RichNode[] = [];
    lines.forEach((line, i) => {
      if (i > 0) content.push({ type: 'hardBreak' });
      if (line) content.push({ type: 'text', text: line });
    });
    return { type: 'paragraph', ...(content.length ? { content } : {}) };
  });
  return { type: 'doc', content: paragraphs };
}

function renderNode(n: RichNode, key: number, fonts?: SiteCustomFont[]): ReactNode {
  const children = (n.content || []).map((c, i) => renderNode(c, i, fonts));
  const align = n.attrs?.textAlign ? ({ textAlign: n.attrs.textAlign } as CSSProperties) : undefined;
  switch (n.type) {
    case 'paragraph': return <p key={key} style={align}>{children}</p>;
    case 'heading': {
      const level = Number(n.attrs?.level) || 2;
      if (level === 1) return <h1 key={key} style={align}>{children}</h1>;
      if (level === 3) return <h3 key={key} style={align}>{children}</h3>;
      return <h2 key={key} style={align}>{children}</h2>;
    }
    case 'bulletList': return <ul key={key}>{children}</ul>;
    case 'orderedList': return <ol key={key} start={Number(n.attrs?.start) || undefined}>{children}</ol>;
    case 'listItem': return <li key={key}>{children}</li>;
    case 'blockquote': return <blockquote key={key}>{children}</blockquote>;
    case 'hardBreak': return <br key={key} />;
    case 'text': return <span key={key}>{applyMarks(n.text || '', n.marks || [], fonts)}</span>;
    default: return null;
  }
}

function applyMarks(text: string, marks: NonNullable<RichNode['marks']>, fonts?: SiteCustomFont[]): ReactNode {
  return marks.reduce<ReactNode>((inner, m) => {
    switch (m.type) {
      case 'bold': return <strong>{inner}</strong>;
      case 'italic': return <em>{inner}</em>;
      case 'underline': return <u>{inner}</u>;
      case 'strike': return <s>{inner}</s>;
      case 'highlight': return <mark style={m.attrs?.color ? { backgroundColor: m.attrs.color } : undefined}>{inner}</mark>;
      case 'link': {
        const href = m.attrs?.href || '';
        return <a href={href} target={/^https?:/.test(href) ? '_blank' : undefined} rel="noopener noreferrer">{inner}</a>;
      }
      case 'textStyle': {
        const a = m.attrs || {};
        const style: CSSProperties = {
          ...(a.color ? { color: a.color } : {}),
          ...(a.fontSize ? { fontSize: a.fontSize } : {}),
          ...(a.backgroundColor ? { backgroundColor: a.backgroundColor } : {}),
          ...(a.fontFamily ? { fontFamily: fontStack(a.fontFamily, fonts) } : {}),
        };
        return <span style={style}>{inner}</span>;
      }
      default: return inner;
    }
  }, text);
}

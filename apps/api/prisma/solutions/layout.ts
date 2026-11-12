import type { FieldOption, FieldSpec } from './types';

/**
 * Monta o formulario por linhas: cada linha e um array de campos lado a lado
 * (gridColSpan soma ate 12). Preenche gridRow e gridColStart.
 */
export function rows(...lines: FieldSpec[][]): FieldSpec[] {
  const out: FieldSpec[] = [];
  lines.forEach((line, index) => {
    let start = 1;
    for (const field of line) {
      const span = field.gridColSpan ?? 12;
      out.push({ ...field, gridRow: index + 1, gridColStart: start, gridColSpan: span });
      start += span;
    }
  });
  return out;
}

type Extra = Partial<FieldSpec>;

export function field(slug: string, label: string, type: string, span: number, extra: Extra = {}): FieldSpec {
  return { slug, name: slug, label, type, gridColSpan: span, ...extra };
}

export function section(slug: string, label: string): FieldSpec {
  return { slug, name: slug, label, type: 'section-title', gridColSpan: 12 };
}

export function opts(...items: Array<[string, string, string?]>): FieldOption[] {
  return items.map(([value, label, color]) => (color ? { value, label, color } : { value, label }));
}

/** Paleta das opcoes (status, gravidade...). */
export const C = {
  green: '#16a34a',
  amber: '#d97706',
  red: '#dc2626',
  blue: '#2563eb',
  gray: '#64748b',
  violet: '#7c3aed',
  orange: '#ea580c',
  teal: '#0d9488',
} as const;

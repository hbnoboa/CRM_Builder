import type { PrismaService } from '../../prisma/prisma.service';

/**
 * Estrutura das tabelas da empresa para os assistentes (nomes, campos, opcoes).
 * Nunca inclui registros: so isto vai para a IA.
 */
export interface SchemaField {
  slug: string;
  label: string;
  type: string;
  options: Array<{ value: string; label: string; color?: string }>;
  subEntitySlug?: string;
  relatedEntitySlug?: string;
}

export interface SchemaTable {
  id: string;
  slug: string;
  name: string;
  namePlural: string;
  titleField?: string;
  statusField?: string;
  deadlineField?: string;
  assigneeField?: string;
  fields: SchemaField[];
  /** Tabela "de cima" quando esta e uma lista dentro de outra. */
  parentSlug?: string;
}

type RawField = {
  slug?: string; name?: string; label?: string; type?: string;
  options?: Array<string | { value: string; label: string; color?: string }>;
  subEntitySlug?: string; subEntityId?: string; relatedEntitySlug?: string;
};

export async function loadTenantSchema(prisma: PrismaService, tenantId: string): Promise<SchemaTable[]> {
  const rows = await prisma.entity.findMany({
    where: { tenantId },
    select: { id: true, slug: true, name: true, namePlural: true, fields: true, settings: true },
    orderBy: { name: 'asc' },
    take: 200,
  });
  const slugById = new Map(rows.map((r) => [r.id, r.slug]));
  const tables: SchemaTable[] = rows.map((e) => {
    const raw = (Array.isArray(e.fields) ? e.fields : []) as RawField[];
    const settings = (e.settings || {}) as { titleField?: string; statusField?: string; deadlineField?: string; assigneeField?: string };
    const fields: SchemaField[] = raw
      .filter((f) => f.slug && f.type)
      .map((f) => ({
        slug: String(f.slug),
        label: String(f.label || f.name || f.slug),
        type: String(f.type),
        options: (f.options || []).map((o) => (typeof o === 'string' ? { value: o, label: o } : { value: o.value, label: o.label, ...(o.color ? { color: o.color } : {}) })),
        ...(f.type === 'sub-entity' ? { subEntitySlug: f.subEntitySlug || (f.subEntityId ? slugById.get(f.subEntityId) : undefined) } : {}),
        ...(f.type === 'relation' && f.relatedEntitySlug ? { relatedEntitySlug: f.relatedEntitySlug } : {}),
      }));
    return {
      id: e.id,
      slug: e.slug,
      name: e.name,
      namePlural: e.namePlural || e.name,
      titleField: settings.titleField ?? fields.find((f) => f.type === 'text')?.slug,
      statusField: settings.statusField,
      deadlineField: settings.deadlineField,
      assigneeField: settings.assigneeField,
      fields,
    };
  });
  const bySlug = new Map(tables.map((t) => [t.slug, t]));
  for (const t of tables) {
    for (const f of t.fields) {
      const child = f.subEntitySlug ? bySlug.get(f.subEntitySlug) : undefined;
      if (child && !child.parentSlug) child.parentSlug = t.slug;
    }
  }
  return tables;
}

/** Texto curto da estrutura para o pedido da IA (identificadores entre colchetes). */
export function describeSchema(tables: SchemaTable[], detailed: boolean): string {
  if (tables.length === 0) return '(nenhuma)';
  return tables
    .slice(0, 60)
    .map((t) => {
      const head = `- [${t.slug}] ${t.namePlural}${t.parentSlug ? ` (lista dentro de [${t.parentSlug}])` : ''}`;
      if (!detailed) return `${head}: ${t.fields.filter((f) => f.type !== 'section-title').slice(0, 15).map((f) => f.label).join(', ')}`;
      const extras = [
        t.titleField && `título=${t.titleField}`,
        t.statusField && `situação=${t.statusField}`,
        t.deadlineField && `prazo=${t.deadlineField}`,
      ].filter(Boolean);
      const fields = t.fields
        .filter((f) => f.type !== 'section-title')
        .slice(0, 40)
        .map((f) => {
          const opts = f.options.length ? ` opções: ${f.options.slice(0, 12).map((o) => o.label).join(' | ')}` : '';
          const link = f.subEntitySlug ? ` -> lista [${f.subEntitySlug}]` : f.relatedEntitySlug ? ` -> liga a [${f.relatedEntitySlug}]` : '';
          return `    • ${f.slug} (${f.type}) "${f.label}"${opts}${link}`;
        });
      return [`${head}${extras.length ? ` {${extras.join(', ')}}` : ''}`, ...fields].join('\n');
    })
    .join('\n');
}

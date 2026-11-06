import {
  AI_COLORS,
  AI_FIELD_TYPES,
  AI_ICONS,
  AI_WIDTHS,
  type AiColor,
  type AiFieldProposal,
  type AiFieldType,
  type AiProposal,
  type AiTableProposal,
  type AiWidth,
} from './ai-builder.schema';

/** Tabela que ja existe na empresa (so estrutura, nunca registros). */
export interface ExistingTable {
  id: string;
  slug: string;
  name: string;
  titleField?: string;
  fieldLabels: string[];
}

export interface NormalizedField {
  slug: string;
  name: string;
  label: string;
  type: string;
  required?: boolean;
  options?: Array<{ value: string; label: string; color?: string }>;
  helpText?: string;
  placeholder?: string;
  prefix?: string;
  relatedEntitySlug?: string;
  relatedEntityId?: string;
  relatedDisplayField?: string;
  subEntitySlug?: string;
  subEntityDisplayFields?: string[];
  parentDisplayField?: string;
  gridRow: number;
  gridColStart: number;
  gridColSpan: number;
}

/** Ligacao a uma tabela NOVA da proposta (o id so existe depois de criar). */
export interface PendingRef {
  fieldSlug: string;
  kind: 'relation' | 'sub-entity';
  targetKey: string;
}

export interface NormalizedTable {
  key: string;
  name: string;
  namePlural: string;
  description: string;
  icon: string;
  color: string;
  parentKey: string | null;
  fields: NormalizedField[];
  settings: Record<string, unknown>;
  refs: PendingRef[];
}

export interface NormalizedProposal {
  reply: string;
  group: string | null;
  tables: NormalizedTable[];
  warnings: string[];
  /** Proposta ja corrigida, no formato da IA: volta como "proposta atual" e para aplicar. */
  proposal: AiProposal;
}

export const MAX_TABLES = 8;
export const MAX_FIELDS = 40;
const RESERVED = new Set(['id', 'createdat', 'updatedat', 'deletedat', 'tenantid']);
const FULL_WIDTH: ReadonlySet<string> = new Set(['textarea', 'section-title', 'signature', 'map', 'sub-entity']);
const CHOICE: ReadonlySet<string> = new Set(['select', 'multiselect']);

export function slugify(text: string, sep: '-' | '_'): string {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, sep)
    .replace(new RegExp(`^\\${sep}+|\\${sep}+$`, 'g'), '')
    .slice(0, 40);
}

function uniqueKey(base: string, taken: Set<string>, sep: string): string {
  let key = base;
  for (let i = 2; taken.has(key) || RESERVED.has(key.toLowerCase()); i++) key = `${base}${sep}${i}`;
  taken.add(key);
  return key;
}

const clip = (s: unknown, max: number): string => String(s ?? '').trim().slice(0, max);
const isColor = (c: unknown): c is AiColor => typeof c === 'string' && c in AI_COLORS;
const isType = (t: unknown): t is AiFieldType => (AI_FIELD_TYPES as readonly string[]).includes(String(t));

/** Distribui os campos em linhas de 12 colunas, na ordem. */
function layout(fields: Array<Omit<NormalizedField, 'gridRow' | 'gridColStart' | 'gridColSpan'> & { span: number }>): NormalizedField[] {
  const out: NormalizedField[] = [];
  let row = 1;
  let used = 0;
  for (const { span, ...f } of fields) {
    if (used > 0 && used + span > 12) {
      row += 1;
      used = 0;
    }
    out.push({ ...f, gridRow: row, gridColStart: used + 1, gridColSpan: span });
    used += span;
    if (used >= 12) {
      row += 1;
      used = 0;
    }
  }
  return out;
}

/**
 * Valida e corrige a resposta da IA: so tipos conhecidos, chaves unicas, ligacoes
 * que existem, configuracoes que apontam para campos certos. Nunca confia no que veio.
 */
export function normalizeProposal(raw: unknown, existing: ExistingTable[]): NormalizedProposal {
  const warnings: string[] = [];
  const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<AiProposal>;
  const rawTables = (Array.isArray(input.tables) ? input.tables : []).slice(0, MAX_TABLES) as Partial<AiTableProposal>[];
  if (Array.isArray(input.tables) && input.tables.length > MAX_TABLES) warnings.push(`Só as ${MAX_TABLES} primeiras tabelas foram usadas.`);

  // 1. Chaves das tabelas (unicas na proposta)
  const tableKeys = new Set<string>();
  const keyMap = new Map<string, string>(); // chave original -> chave final
  const tables = rawTables.map((t) => {
    const name = clip(t.name, 60) || 'Tabela';
    const original = clip(t.key, 60);
    const key = uniqueKey(slugify(original || name, '-') || 'tabela', tableKeys, '-');
    if (original) keyMap.set(original, key);
    keyMap.set(key, key);
    return { t, key, name };
  });
  const existingBySlug = new Map(existing.map((e) => [e.slug, e]));

  // 2. Pai (lista dentro de outra tabela): precisa ser tabela nova e sem ciclo
  const parentOf = new Map<string, string | null>();
  for (const { t, key, name } of tables) {
    const parent = t.parentKey ? keyMap.get(clip(t.parentKey, 60)) : undefined;
    if (t.parentKey && (!parent || parent === key)) {
      warnings.push(`${name}: a tabela de cima não foi encontrada; ficou como tabela independente.`);
    }
    parentOf.set(key, parent && parent !== key ? parent : null);
  }
  for (const key of parentOf.keys()) {
    const seen = new Set<string>([key]);
    let cur = parentOf.get(key);
    while (cur) {
      if (seen.has(cur)) {
        parentOf.set(key, null);
        warnings.push('Duas tabelas estavam uma dentro da outra; uma delas ficou independente.');
        break;
      }
      seen.add(cur);
      cur = parentOf.get(cur) ?? null;
    }
  }

  // 3. Campos de cada tabela
  const cleanTables: AiTableProposal[] = [];
  const built = tables.map(({ t, key, name }) => {
    const fieldKeys = new Set<string>();
    const rawFields = (Array.isArray(t.fields) ? t.fields : []).slice(0, MAX_FIELDS) as Partial<AiFieldProposal>[];
    const cleanFields: AiFieldProposal[] = [];
    const fieldKeyMap = new Map<string, string>();
    const refs: PendingRef[] = [];
    const pre: Array<Omit<NormalizedField, 'gridRow' | 'gridColStart' | 'gridColSpan'> & { span: number }> = [];

    for (const f of rawFields) {
      const label = clip(f.label, 80);
      if (!label) continue;
      const originalKey = clip(f.key, 60);
      if (RESERVED.has(slugify(originalKey || label, '_').replace(/_/g, ''))) {
        warnings.push(`${name} › ${label}: o sistema já guarda isso sozinho; campo removido.`);
        continue;
      }
      const slug = uniqueKey(slugify(originalKey || label, '_') || 'campo', fieldKeys, '_');
      if (originalKey) fieldKeyMap.set(originalKey, slug);
      fieldKeyMap.set(slug, slug);
      fieldKeyMap.set(label.toLowerCase(), slug);

      let type: AiFieldType = isType(f.type) ? f.type : 'text';
      if (!isType(f.type)) warnings.push(`${name} › ${label}: tipo desconhecido, virou texto.`);

      const out: Omit<NormalizedField, 'gridRow' | 'gridColStart' | 'gridColSpan'> = { slug, name: slug, label, type };
      const clean: AiFieldProposal = { key: slug, label, type };

      let options: Array<{ label: string; color?: AiColor }> = [];
      if (CHOICE.has(type)) {
        const values = new Set<string>();
        options = (Array.isArray(f.options) ? f.options : [])
          .map((o) => ({ label: clip(o?.label, 60), color: isColor(o?.color) ? o.color : undefined }))
          .filter((o) => o.label)
          .slice(0, 30);
        if (options.length === 0) {
          type = 'text';
          out.type = 'text';
          clean.type = 'text';
          warnings.push(`${name} › ${label}: lista sem opções, virou texto.`);
        } else {
          out.options = options.map((o) => ({
            value: uniqueKey(slugify(o.label, '_') || 'opcao', values, '_'),
            label: o.label,
            ...(o.color ? { color: AI_COLORS[o.color] } : {}),
          }));
          clean.options = options.map((o) => (o.color ? { label: o.label, color: o.color } : { label: o.label }));
        }
      }

      if (type === 'relation') {
        const target = clip(f.relatedTable, 60);
        const newKey = keyMap.get(target);
        const ext = existingBySlug.get(target);
        if (newKey && newKey !== key) {
          out.relatedEntitySlug = newKey;
          refs.push({ fieldSlug: slug, kind: 'relation', targetKey: newKey });
          clean.relatedTable = newKey;
        } else if (ext) {
          out.relatedEntitySlug = ext.slug;
          out.relatedEntityId = ext.id;
          if (ext.titleField) out.relatedDisplayField = ext.titleField;
          clean.relatedTable = ext.slug;
        } else {
          type = 'text';
          out.type = 'text';
          clean.type = 'text';
          warnings.push(`${name} › ${label}: a tabela ligada não foi encontrada, virou texto.`);
        }
      }

      if (f.required === true && type !== 'section-title') {
        out.required = true;
        clean.required = true;
      }
      const help = clip(f.helpText, 200);
      if (help) out.helpText = clean.helpText = help;
      const placeholder = clip(f.placeholder, 100);
      if (placeholder) out.placeholder = clean.placeholder = placeholder;
      if (type === 'currency') out.prefix = 'R$';

      const width: AiWidth | undefined = f.width && f.width in AI_WIDTHS ? f.width : undefined;
      if (width) clean.width = width;
      const span = FULL_WIDTH.has(type) ? 12 : width ? AI_WIDTHS[width] : 6;
      pre.push({ ...out, span });
      cleanFields.push(clean);
    }

    if (pre.length === 0) {
      pre.push({ slug: 'nome', name: 'nome', label: 'Nome', type: 'text', required: true, span: 12 });
      cleanFields.push({ key: 'nome', label: 'Nome', type: 'text', required: true });
      warnings.push(`${name}: estava sem campos; ganhou o campo Nome.`);
    }

    // Configuracoes: so valem se apontarem para o campo do tipo certo
    const pick = (ref: unknown, ok: (f: (typeof pre)[number]) => boolean) => {
      const slug = typeof ref === 'string' ? fieldKeyMap.get(ref) ?? fieldKeyMap.get(ref.toLowerCase()) : undefined;
      const field = slug ? pre.find((p) => p.slug === slug) : undefined;
      return field && ok(field) ? field : undefined;
    };
    const textish = (p: (typeof pre)[number]) => ['text', 'cpf', 'cnpj', 'email', 'phone', 'number'].includes(p.type);
    const title = pick(t.titleField, textish) ?? pre.find((p) => p.type === 'text') ?? pre.find(textish);
    const status = pick(t.statusField, (p) => p.type === 'select');
    const deadline = pick(t.deadlineField, (p) => p.type === 'date' || p.type === 'datetime');
    const assignee = pick(t.assigneeField, (p) => p.type === 'user-select');
    const settings: Record<string, unknown> = {};
    const clean: AiTableProposal = {
      key,
      name,
      namePlural: clip(t.namePlural, 60) || name,
      description: clip(t.description, 240),
      fields: cleanFields,
    };
    if (title) settings.titleField = clean.titleField = title.slug;
    if (status) {
      settings.statusField = clean.statusField = status.slug;
      const wanted = new Set((Array.isArray(t.doneOptions) ? t.doneOptions : []).map((d) => clip(d, 60).toLowerCase()));
      const done = (status.options || []).filter((o) => wanted.has(o.label.toLowerCase()) || wanted.has(o.value));
      if (done.length) {
        settings.doneValues = done.map((o) => o.value);
        clean.doneOptions = done.map((o) => o.label);
      }
    }
    if (deadline) settings.deadlineField = clean.deadlineField = deadline.slug;
    if (assignee) settings.assigneeField = clean.assigneeField = assignee.slug;

    const icon = (AI_ICONS as readonly string[]).includes(String(t.icon)) ? String(t.icon) : 'ClipboardList';
    const color: AiColor = isColor(t.color) ? t.color : 'blue';
    clean.icon = icon;
    clean.color = color;
    const parentKey = parentOf.get(key) ?? null;
    if (parentKey) clean.parentKey = parentKey;
    cleanTables.push(clean);

    return {
      key, name, namePlural: clean.namePlural, description: clean.description, icon, color: AI_COLORS[color],
      parentKey, pre, settings, refs, titleSlug: title?.slug,
    };
  });

  // 4. Relacoes para tabelas novas mostram o campo-titulo delas
  const byKey = new Map(built.map((b) => [b.key, b]));
  for (const b of built) {
    for (const r of b.refs) {
      const field = b.pre.find((p) => p.slug === r.fieldSlug);
      const target = byKey.get(r.targetKey);
      if (field && target?.titleSlug) field.relatedDisplayField = target.titleSlug;
    }
  }

  // 5. Lista dentro do pai: o campo de sub-tabela entra no fim do formulario do pai
  for (const child of built) {
    if (!child.parentKey) continue;
    const parent = byKey.get(child.parentKey);
    if (!parent) continue;
    const taken = new Set(parent.pre.map((p) => p.slug));
    const slug = uniqueKey(slugify(child.key, '_') || 'itens', taken, '_');
    parent.pre.push({
      slug, name: slug, label: child.namePlural, type: 'sub-entity', span: 12,
      subEntitySlug: child.key,
      subEntityDisplayFields: child.pre.filter((p) => p.type !== 'section-title').slice(0, 4).map((p) => p.slug),
      ...(parent.titleSlug ? { parentDisplayField: parent.titleSlug } : {}),
    });
    parent.refs.push({ fieldSlug: slug, kind: 'sub-entity', targetKey: child.key });
  }

  const group = clip(input.group, 40) || null;
  return {
    reply: clip(input.reply, 1500) || 'Pronto, veja a proposta ao lado.',
    group,
    warnings,
    tables: built.map((b) => ({
      key: b.key, name: b.name, namePlural: b.namePlural, description: b.description, icon: b.icon, color: b.color,
      parentKey: b.parentKey, fields: layout(b.pre), settings: b.settings, refs: b.refs,
    })),
    proposal: { reply: clip(input.reply, 1500), ...(group ? { group } : {}), tables: cleanTables },
  };
}

/**
 * Ordem de criacao: a tabela de dentro antes da de cima (o campo de lista precisa
 * do id dela) e a ligada antes de quem liga. Relacao em ciclo vira texto.
 */
export function creationOrder(tables: NormalizedTable[], warnings: string[]): NormalizedTable[] {
  const byKey = new Map(tables.map((t) => [t.key, t]));
  type Edge = { table: NormalizedTable; ref: PendingRef };
  for (;;) {
    const order: NormalizedTable[] = [];
    const state = new Map<string, 'visiting' | 'done'>();
    const path: Edge[] = [];
    let cycle: Edge[] | null = null;
    const visit = (t: NormalizedTable): void => {
      if (cycle || state.get(t.key) === 'done') return;
      state.set(t.key, 'visiting');
      for (const ref of t.refs) {
        const dep = byKey.get(ref.targetKey);
        if (!dep) continue;
        path.push({ table: t, ref });
        if (state.get(dep.key) === 'visiting') {
          const from = path.findIndex((e) => e.table.key === dep.key);
          cycle = path.slice(from);
          return;
        }
        visit(dep);
        if (cycle) return;
        path.pop();
      }
      state.set(t.key, 'done');
      order.push(t);
    };
    tables.forEach(visit);
    if (!cycle) return order;
    // Quebra o ciclo desfazendo a relacao que o fecha (a ultima; a da tabela principal fica).
    // Listas dentro do pai nunca fecham ciclo sozinhas.
    const edges = cycle as Edge[];
    const victim = [...edges].reverse().find((e) => e.ref.kind === 'relation') ?? edges[edges.length - 1];
    const field = victim.table.fields.find((f) => f.slug === victim.ref.fieldSlug);
    if (field) {
      if (victim.ref.kind === 'relation') {
        field.type = 'text';
        delete field.relatedEntitySlug;
        delete field.relatedDisplayField;
      } else {
        victim.table.fields = victim.table.fields.filter((f) => f !== field);
      }
      warnings.push(`${victim.table.name} › ${field.label}: ligação circular desfeita.`);
    }
    victim.table.refs = victim.table.refs.filter((r) => r !== victim.ref);
  }
}

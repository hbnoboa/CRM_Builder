import { AI_COLORS, AI_FIELD_TYPES, AI_ICONS, AI_WIDTHS, type AiFieldType, type AiProposal, type AiTableProposal } from './ai-builder.schema';
import {
  CHOICE, FULL_WIDTH, RESERVED, clip, layout, normalizeProposal, slugify, uniqueKey,
  type ExistingTable, type NormalizedTable, type PendingRef,
} from './ai-proposal-normalizer';
import {
  AI_WIDGET_TYPES, normalizeDashboard, widgetSignature,
  type AiDashboardProposal, type AiWidgetProposal, type DashboardPayload, type DashboardRole, type KeptWidget,
} from './dashboard-proposal';
import { normalizePdf, type AiPdfSection } from './pdf-proposal';
import type { SchemaField, SchemaTable } from './tenant-schema';
import { normalizeRoles, type BaseRole, type RolePlan, type WsRole } from './workspace-roles';

/**
 * Construtor da tela inicial: um rascunho so para tabelas, paineis e PDFs, novos ou
 * que ja existem. O rascunho guarda SO o que mudou (o resto fica como esta); quem ja
 * existe vem com existing=true e a chave dele (slug da tabela, id do painel/PDF).
 * Mudanca que a IA nao mandou (campo omitido, "required" ausente...) = sem mudanca.
 */

export interface WsOption { label: string; color?: string; value?: string }

export interface WsField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  width?: keyof typeof AI_WIDTHS;
  options?: WsOption[];
  relatedTable?: string;
  helpText?: string;
  placeholder?: string;
  /** Regras do campo: aparece / obrigatorio / so leitura quando outro campo tem um valor (null = tirar). */
  visibleIf?: WsCondition | null;
  requiredIf?: WsCondition | null;
  readOnlyIf?: WsCondition | null;
  removed?: boolean;
}

export interface WsCondition { field: string; operator: string; value?: unknown }

export interface WsTable {
  key: string;
  existing?: boolean;
  removed?: boolean;
  name: string;
  namePlural: string;
  description: string;
  icon?: string;
  color?: string;
  parentKey?: string;
  fields: WsField[];
  titleField?: string;
  statusField?: string;
  doneOptions?: string[];
  deadlineField?: string;
  assigneeField?: string;
}

export interface WsDashboard extends Omit<AiDashboardProposal, 'reply'> {
  key: string;
  existing?: boolean;
  removed?: boolean;
}

export interface WsPdf {
  key: string;
  existing?: boolean;
  removed?: boolean;
  name: string;
  description: string;
  table: string;
  title?: string;
  fileName?: string;
  /** Num PDF que ja existe: so quando o conteudo e refeito (sem = conteudo igual). */
  sections?: AiPdfSection[];
}

export interface WorkspaceDraft {
  reply: string;
  group?: string;
  tables: WsTable[];
  dashboards: WsDashboard[];
  pdfs: WsPdf[];
  roles?: WsRole[];
}

// ── O que ja existe ─────────────────────────────────────────────────────

export type RawField = Record<string, unknown> & { slug: string; type: string; label?: string };

export interface BaseEntity {
  id: string;
  slug: string;
  name: string;
  namePlural: string;
  description: string;
  icon: string | null;
  color: string | null;
  fields: RawField[];
  settings: Record<string, unknown>;
  parentSlug?: string;
}

export interface BaseDashboard {
  id: string;
  name: string;
  description: string;
  entitySlug: string | null;
  layout: Array<{ i: string; x: number; y: number; w: number; h: number }>;
  widgets: Record<string, { type: string; title: string; config: Record<string, unknown> }>;
  tabs: Array<{ id: string; label: string; widgetIds: string[] }>;
  roleIds: string[];
}

export interface BasePdf {
  id: string;
  name: string;
  description: string;
  tableSlug: string | null;
}

export interface WorkspaceBase {
  entities: BaseEntity[];
  schema: SchemaTable[];
  dashboards: BaseDashboard[];
  pdfs: BasePdf[];
  roles: DashboardRole[];
  /** Nomes de painel ja usados (inclusive os automaticos e os excluidos: o nome e unico). */
  takenDashboardNames: string[];
  /** Cargos com tudo o que o construtor mexe (roles acima e so id e nome, para os paineis). */
  roleList: BaseRole[];
  /** Nivel de quem mexe (menor = mais poder) e se tem acesso total. */
  actorRank: number;
  actorAll: boolean;
}

export type ChangeKind = 'create' | 'update' | 'delete';
export type ChangeModule = 'table' | 'dashboard' | 'pdf' | 'role';
export type Mark = 'new' | 'changed' | 'removed';

export interface WsChange {
  module: ChangeModule;
  kind: ChangeKind;
  key: string;
  name: string;
  details: string[];
  /** Numa alteracao: o que sai (campos excluidos). Pede confirmacao e permissao de excluir. */
  removals?: string[];
}

export interface WsMarks {
  tables: Record<string, { status: Mark; fields: Record<string, Mark> }>;
  dashboards: Record<string, Mark>;
  pdfs: Record<string, Mark>;
  roles: Record<string, Mark>;
}

/** Tabela como o formulario a desenha (previa do "Ver formulario"). */
export interface WsPreviewTable {
  key: string;
  name: string;
  namePlural: string;
  description: string;
  icon: string;
  color: string;
  parentKey: string | null;
  fields: Array<Record<string, unknown>>;
  settings: Record<string, unknown>;
}

const MAX_DASHBOARDS = 10;
const MAX_PDFS = 10;
const WIDTH_BY_SPAN: Record<number, keyof typeof AI_WIDTHS> = { 12: 'full', 6: 'half', 4: 'third', 3: 'quarter' };
const SWAP_TYPES = new Set(['text|textarea', 'textarea|text']);
const TEXTISH = ['text', 'cpf', 'cnpj', 'email', 'phone', 'number'];
const HEX = /^#[0-9a-f]{6}$/i;
const isAiType = (t: unknown): t is AiFieldType => (AI_FIELD_TYPES as readonly string[]).includes(String(t));

const hexToName = (hex: unknown): string | undefined => {
  if (typeof hex !== 'string') return undefined;
  const found = Object.entries(AI_COLORS).find(([, v]) => v.toLowerCase() === hex.toLowerCase());
  return found ? found[0] : HEX.test(hex) ? hex : undefined;
};
/** Nome da paleta ou cor ja gravada (#rrggbb). */
const toHex = (c: unknown): string | undefined =>
  typeof c === 'string' ? (c in AI_COLORS ? AI_COLORS[c as keyof typeof AI_COLORS] : HEX.test(c) ? c : undefined) : undefined;

const fieldLabel = (f: RawField) => String(f.label || f.name || f.slug);
const optionsOf = (f: RawField): Array<{ value: string; label: string; color?: string }> =>
  (Array.isArray(f.options) ? f.options : []).map((o: unknown) =>
    typeof o === 'string' ? { value: o, label: o } : (o as { value: string; label: string; color?: string }));

// ── Conversao do que existe para o rascunho ─────────────────────────────

export function entityToDraft(e: BaseEntity): WsTable {
  const s = e.settings as { titleField?: string; statusField?: string; doneValues?: string[]; deadlineField?: string; assigneeField?: string };
  const fields = e.fields.map((f): WsField => {
    const span = Number(f.gridColSpan);
    const opts = optionsOf(f);
    return JSON.parse(JSON.stringify({
      key: f.slug,
      label: fieldLabel(f),
      type: f.type,
      required: f.type === 'section-title' ? undefined : f.required === true,
      width: FULL_WIDTH.has(f.type) ? undefined : WIDTH_BY_SPAN[span],
      options: CHOICE.has(f.type) ? opts.map((o) => ({ label: o.label, value: o.value, ...(o.color ? { color: hexToName(o.color) } : {}) })) : undefined,
      relatedTable: f.type === 'relation' ? f.relatedEntitySlug : undefined,
      helpText: f.helpText || undefined,
      placeholder: f.placeholder || undefined,
      visibleIf: f.visibleIf || undefined,
      requiredIf: f.requiredIf || undefined,
      readOnlyIf: f.readOnlyIf || undefined,
    })) as WsField;
  });
  const status = e.fields.find((f) => f.slug === s.statusField);
  const done = status ? optionsOf(status).filter((o) => (s.doneValues || []).includes(o.value)).map((o) => o.label) : [];
  return JSON.parse(JSON.stringify({
    key: e.slug,
    existing: true,
    name: e.name,
    namePlural: e.namePlural || e.name,
    description: e.description || '',
    icon: e.icon || undefined,
    color: hexToName(e.color),
    parentKey: e.parentSlug,
    fields,
    titleField: s.titleField ?? '',
    statusField: s.statusField ?? '',
    doneOptions: done,
    deadlineField: s.deadlineField ?? '',
    assigneeField: s.assigneeField ?? '',
  })) as WsTable;
}

/** Bloco salvo -> bloco no formato da IA ('keep' quando a IA nao sabe montar o tipo). */
function widgetToDraft(id: string, widget: BaseDashboard['widgets'][string], w: number, defaultTable: string): AiWidgetProposal {
  const c = (widget.config || {}) as Record<string, unknown>;
  const table = String(c.entitySlugOverride || c.entitySlug || defaultTable || '');
  const base = { title: widget.title || 'Bloco', table, width: w, ref: id };
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined);
  const type = widget.type as AiWidgetProposal['type'];
  if (!(AI_WIDGET_TYPES as readonly string[]).includes(widget.type)) return { ...base, type: 'keep' };
  const draft = (extra: Partial<AiWidgetProposal>) => JSON.parse(JSON.stringify({ ...base, type, ...extra })) as AiWidgetProposal;
  switch (widget.type) {
    case 'kpi-card': {
      const agg = c.aggregation === 'sum' || c.aggregation === 'avg' ? c.aggregation : 'count';
      return draft({ aggregation: agg, ...(agg !== 'count' ? { field: str(c.fieldSlug) } : {}) });
    }
    case 'line-chart': return draft({ days: typeof c.days === 'number' ? c.days : 30, dateField: str(c.dateField) });
    case 'bar-chart': case 'donut-chart': case 'pie-chart': case 'stat-list': case 'funnel-chart':
      return draft({ groupBy: str(c.groupByField) });
    case 'kanban-board': return draft({ groupBy: str(c.groupByField), columns: list(c.cardSubtitleFields) });
    case 'mini-table': return draft({ columns: list(c.displayFields), sortBy: str(c.sortBy), sortOrder: c.sortOrder === 'asc' ? 'asc' : 'desc' });
    case 'data-table': return draft({
      columns: list(c.displayFields),
      ...(str(c.defaultSortField) ? { sortBy: str(c.defaultSortField), sortOrder: c.defaultSortOrder === 'desc' ? 'desc' : 'asc' } : {}),
    });
    default: return draft({});
  }
}

/** Painel salvo -> rascunho (abas e linhas pela posicao) + blocos originais por id. */
export function dashboardToDraft(d: BaseDashboard, roles: DashboardRole[], tables: SchemaTable[]): { draft: WsDashboard; kept: Map<string, KeptWidget> } {
  const main = d.entitySlug || tables.find((t) => !t.parentSlug)?.slug || '';
  const pos = new Map(d.layout.map((l) => [l.i, l]));
  const kept = new Map<string, KeptWidget>();
  const tabs = d.tabs.length ? d.tabs : [{ id: 'aba-1', label: 'Visão geral', widgetIds: d.layout.map((l) => l.i) }];
  const draftTabs = tabs.map((tab) => {
    const items = tab.widgetIds
      .filter((id) => d.widgets[id] && pos.has(id))
      .map((id) => ({ id, l: pos.get(id)! }))
      .sort((a, b) => a.l.y - b.l.y || a.l.x - b.l.x);
    const rows: AiWidgetProposal[][] = [];
    let lastY: number | null = null;
    for (const { id, l } of items) {
      const draft = widgetToDraft(id, d.widgets[id], l.w, main);
      kept.set(id, { type: d.widgets[id].type, title: d.widgets[id].title, config: d.widgets[id].config || {}, w: l.w, h: l.h, signature: widgetSignature(draft) });
      if (lastY === l.y && rows.length) rows[rows.length - 1].push(draft);
      else rows.push([draft]);
      lastY = l.y;
    }
    return { label: tab.label, rows };
  }).filter((t) => t.rows.length > 0);
  const roleNames = d.roleIds.map((id) => roles.find((r) => r.id === id)?.name).filter((n): n is string => !!n);
  return {
    draft: {
      key: d.id, existing: true, name: d.name, description: d.description || '', mainTable: main,
      ...(roleNames.length ? { roles: roleNames } : {}),
      tabs: draftTabs,
    },
    kept,
  };
}

export function pdfToDraft(p: BasePdf): WsPdf {
  return { key: p.id, existing: true, name: p.name, description: p.description || '', table: p.tableSlug || '' };
}

// ── Normalizacao do rascunho ────────────────────────────────────────────

/** Mudanca de tabela pronta para aplicar (tudo ja conferido). */
export interface TablePlan {
  key: string;
  kind: ChangeKind;
  name: string;
  /** Tabela que ja existe. */
  entity?: BaseEntity;
  /** create: tabela normalizada (campos e ligacoes com tabelas novas). */
  created?: NormalizedTable;
  /** Lista dentro de uma tabela que ja existe (o pai ganha o campo na hora de aplicar). */
  existingParent?: string;
  /** update: campos finais, ajustes e o resto da tabela. */
  update?: {
    name: string; namePlural: string; description: string; icon: string | null; color: string | null;
    fields: RawField[]; settings: Record<string, unknown>;
    /** Campos novos ligados a tabelas novas (o id so existe depois de criar). */
    refs: PendingRef[];
    /** Listas novas (tabela nova dentro desta). */
    children: string[];
  };
}

export interface DashboardPlan {
  key: string;
  kind: ChangeKind;
  name: string;
  base?: BaseDashboard;
  /** Rascunho conferido (refeito na hora de aplicar, com os nomes reais das tabelas novas). */
  draft?: WsDashboard;
  payload?: DashboardPayload;
  roleNames: string[];
}

export interface PdfPlan {
  key: string;
  kind: ChangeKind;
  name: string;
  base?: BasePdf;
  draft?: WsPdf;
  /** Conteudo novo (PDF novo ou refeito). */
  content?: Record<string, unknown>;
  description: string;
  table: string;
}

export interface NormalizedWorkspace {
  reply: string;
  warnings: string[];
  draft: WorkspaceDraft;
  changes: WsChange[];
  marks: WsMarks;
  preview: {
    tables: WsPreviewTable[];
    dashboards: Record<string, DashboardPayload>;
    /** PDF que da para ver com dados de exemplo (a tabela ja existe). */
    pdfs: Record<string, { previewable: boolean }>;
  };
  plan: { tables: TablePlan[]; dashboards: DashboardPlan[]; pdfs: PdfPlan[]; roles: RolePlan[]; group: string | null };
}

interface TableCtx {
  warnings: string[];
  /** chave original da tabela nova -> chave final */
  newKeys: Map<string, string>;
  existingBySlug: Map<string, BaseEntity>;
}

/** Campo novo numa tabela que ja existe (mesma regra dos campos de tabela nova). */
function newFieldRaw(f: Partial<WsField>, taken: Set<string>, tableName: string, ctx: TableCtx): { raw: RawField; span: number; ref?: PendingRef } | null {
  const label = clip(f.label, 80);
  if (!label) return null;
  const base = slugify(clip(f.key, 60) || label, '_') || 'campo';
  if (RESERVED.has(base.replace(/_/g, ''))) {
    ctx.warnings.push(`${tableName} › ${label}: o sistema já guarda isso sozinho; campo removido.`);
    return null;
  }
  const slug = uniqueKey(base, taken, '_');
  let type: AiFieldType = isAiType(f.type) ? f.type : 'text';
  if (!isAiType(f.type)) ctx.warnings.push(`${tableName} › ${label}: tipo desconhecido, virou texto.`);
  const raw: RawField = { slug, name: slug, label, type };
  let ref: PendingRef | undefined;
  if (CHOICE.has(type)) {
    const values = new Set<string>();
    const opts = (Array.isArray(f.options) ? f.options : []).map((o) => ({ label: clip(o?.label, 60), color: toHex(o?.color) })).filter((o) => o.label).slice(0, 30);
    if (opts.length === 0) {
      type = 'text';
      ctx.warnings.push(`${tableName} › ${label}: lista sem opções, virou texto.`);
    } else {
      raw.options = opts.map((o) => ({ value: uniqueKey(slugify(o.label, '_') || 'opcao', values, '_'), label: o.label, ...(o.color ? { color: o.color } : {}) }));
    }
  }
  if (type === 'relation') {
    const target = clip(f.relatedTable, 60);
    const newKey = ctx.newKeys.get(target);
    const ext = ctx.existingBySlug.get(target);
    if (newKey) {
      raw.relatedEntitySlug = newKey;
      ref = { fieldSlug: slug, kind: 'relation', targetKey: newKey };
    } else if (ext) {
      raw.relatedEntitySlug = ext.slug;
      raw.relatedEntityId = ext.id;
      const title = (ext.settings as { titleField?: string }).titleField;
      if (title) raw.relatedDisplayField = title;
    } else {
      type = 'text';
      ctx.warnings.push(`${tableName} › ${label}: a tabela ligada não foi encontrada, virou texto.`);
    }
  }
  raw.type = type;
  if (f.required === true && type !== 'section-title') raw.required = true;
  const help = clip(f.helpText, 200);
  if (help) raw.helpText = help;
  const placeholder = clip(f.placeholder, 100);
  if (placeholder) raw.placeholder = placeholder;
  if (type === 'currency') raw.prefix = 'R$';
  const span = FULL_WIDTH.has(type) ? 12 : f.width && f.width in AI_WIDTHS ? AI_WIDTHS[f.width] : 6;
  return { raw, span, ref };
}

/** Opcoes de um campo que ja existe: o valor gravado de cada opcao nunca muda. */
function mergeOptions(o: RawField, wanted: WsOption[], notes: string[]): unknown[] | null {
  const orig = optionsOf(o);
  const stringStyle = (Array.isArray(o.options) ? o.options : []).every((x) => typeof x === 'string');
  const used = new Set(orig.map((x) => x.value));
  const taken = new Set<string>();
  const out: Array<{ value: string; label: string; color?: string }> = [];
  for (const w of wanted.slice(0, 30)) {
    const label = clip(w?.label, 60);
    if (!label) continue;
    const match = (w.value ? orig.find((x) => x.value === w.value && !taken.has(x.value)) : undefined)
      ?? orig.find((x) => !taken.has(x.value) && x.label.toLowerCase() === label.toLowerCase());
    const color = toHex(w.color) ?? match?.color;
    if (match) {
      taken.add(match.value);
      if (match.label !== label) notes.push(`opção "${match.label}" virou "${label}"`);
      out.push({ value: match.value, label, ...(color ? { color } : {}) });
    } else {
      const value = stringStyle ? uniqueKey(label, used, ' ') : uniqueKey(slugify(label, '_') || 'opcao', used, '_');
      used.add(value);
      notes.push(`opção nova "${label}"`);
      out.push({ value, label, ...(color ? { color } : {}) });
    }
  }
  for (const x of orig) if (!taken.has(x.value)) notes.push(`opção "${x.label}" removida`);
  if (out.length === 0) return null;
  return stringStyle && out.every((x) => !x.color && x.value === x.label) ? out.map((x) => x.label) : out;
}

const COND_OPS = ['equals', 'not_equals', 'contains', 'gt', 'lt', 'is_empty', 'is_not_empty'];
const COND_OP_LABEL: Record<string, string> = {
  equals: 'for', not_equals: 'não for', contains: 'contiver', gt: 'for maior que', lt: 'for menor que', is_empty: 'estiver vazio', is_not_empty: 'estiver preenchido',
};
const NUMERIC_TYPES = new Set(['number', 'currency', 'percentage', 'rating', 'slider']);
export const RULE_PROPS = ['visibleIf', 'requiredIf', 'readOnlyIf'] as const;
type RuleProp = (typeof RULE_PROPS)[number];
const RULE_LABEL: Record<RuleProp, string> = { visibleIf: 'aparece só', requiredIf: 'obrigatório', readOnlyIf: 'só leitura' };

/** Condicao valida contra os campos da tabela (valor no tipo que o formulario compara). */
function normalizeCondition(c: unknown, fields: RawField[], self: string, where: string, warnings: string[]): WsCondition | null {
  const cond = (c && typeof c === 'object' ? c : {}) as Partial<WsCondition>;
  const ref = clip(cond.field, 80);
  const target = fields.find((f) => f.slug === ref) ?? fields.find((f) => fieldLabel(f).toLowerCase() === ref.toLowerCase());
  if (!target || target.slug === self) {
    warnings.push(`${where}: a regra usa um campo que não existe nesta tabela; ficou de fora.`);
    return null;
  }
  const operator = COND_OPS.includes(String(cond.operator)) ? String(cond.operator) : null;
  if (!operator) {
    warnings.push(`${where}: condição da regra desconhecida; ficou de fora.`);
    return null;
  }
  if (operator === 'is_empty' || operator === 'is_not_empty') return { field: target.slug, operator };
  let value: unknown = cond.value;
  if (target.type === 'boolean') value = value === true || /^(true|sim|1)$/i.test(String(value));
  else if (NUMERIC_TYPES.has(target.type)) value = Number(value);
  else {
    const text = clip(value, 120);
    const options = optionsOf(target);
    const opt = options.find((o) => o.value === text || o.label.toLowerCase() === text.toLowerCase());
    if (options.length && !opt) warnings.push(`${where}: "${fieldLabel(target)}" não tem a opção "${text}".`);
    value = opt ? opt.value : text;
  }
  return { field: target.slug, operator, value };
}

function describeCondition(prop: RuleProp, c: WsCondition, fields: RawField[]): string {
  const target = fields.find((f) => f.slug === c.field);
  const name = target ? fieldLabel(target) : c.field;
  const opt = target ? optionsOf(target).find((o) => o.value === c.value) : undefined;
  const shown = c.value === true ? 'Sim' : c.value === false ? 'Não' : opt?.label ?? (c.value === undefined ? '' : String(c.value));
  return `${RULE_LABEL[prop]} quando "${name}" ${COND_OP_LABEL[c.operator] ?? c.operator}${shown ? ` "${shown}"` : ''}`;
}

/** Aplica as regras pedidas (undefined = igual, null = tirar). Devolve as frases do que mudou. */
function applyRules(next: RawField, want: Partial<WsField>, fields: RawField[], where: string, warnings: string[]): string[] {
  const notes: string[] = [];
  for (const prop of RULE_PROPS) {
    const asked = want[prop];
    if (asked === undefined) continue;
    const before = next[prop] as WsCondition | undefined;
    if (asked === null) {
      if (before) { delete next[prop]; notes.push(`sem a regra "${RULE_LABEL[prop]}"`); }
      continue;
    }
    const cond = normalizeCondition(asked, fields, next.slug, where, warnings);
    // O banco devolve as chaves em outra ordem: compara campo, condicao e valor
    if (!cond || (before && before.field === cond.field && before.operator === cond.operator && before.value === cond.value)) continue;
    next[prop] = cond;
    notes.push(describeCondition(prop, cond, fields));
  }
  return notes;
}

/** Tabela que ja existe: aplica so o que veio no rascunho, mantendo o resto. */
function normalizeExisting(t: Partial<WsTable>, e: BaseEntity, ctx: TableCtx) {
  const name = clip(t.name, 60) || e.name;
  const details: string[] = [];
  const fieldMarks: Record<string, Mark> = {};
  const origIndex = new Map(e.fields.map((f, i) => [f.slug, i]));
  const taken = new Set(e.fields.map((f) => f.slug));
  const seen = new Set<string>();
  const refs: PendingRef[] = [];
  type Item = { raw: RawField; span: number; orig?: number; isNew?: boolean; want?: Partial<WsField>; notes?: string[] };
  const items: Item[] = [];
  const removed: RawField[] = [];
  let widthChanged = false;

  for (const f of (Array.isArray(t.fields) ? t.fields : []) as Partial<WsField>[]) {
    const key = clip(f?.key, 60);
    const idx = origIndex.get(key);
    if (idx !== undefined && !seen.has(key)) {
      seen.add(key);
      const o = e.fields[idx];
      if (f.removed === true) {
        if (o.type === 'sub-entity') {
          ctx.warnings.push(`${name} › ${fieldLabel(o)}: para tirar essa lista, exclua a tabela de dentro.`);
        } else {
          removed.push(o);
          fieldMarks[o.slug] = 'removed';
          details.push(`campo "${fieldLabel(o)}" excluído`);
          continue;
        }
      }
      const next: RawField = { ...o };
      const notes: string[] = [];
      const label = clip(f.label, 80);
      if (label && label !== fieldLabel(o)) {
        next.label = label;
        notes.push(`nome "${fieldLabel(o)}" → "${label}"`);
      }
      if (f.type && f.type !== o.type) {
        if (SWAP_TYPES.has(`${o.type}|${f.type}`)) {
          next.type = f.type;
          notes.push(f.type === 'textarea' ? 'virou texto longo' : 'virou texto curto');
        } else {
          ctx.warnings.push(`${name} › ${fieldLabel(o)}: o tipo de um campo que já tem dados não muda aqui; crie outro campo.`);
        }
      }
      if (typeof f.required === 'boolean' && o.type !== 'section-title' && f.required !== (o.required === true)) {
        next.required = f.required;
        notes.push(f.required ? 'ficou obrigatório' : 'ficou opcional');
      }
      if (f.helpText !== undefined && clip(f.helpText, 200) !== String(o.helpText || '')) {
        const help = clip(f.helpText, 200);
        if (help) next.helpText = help; else delete next.helpText;
        notes.push('explicação mudou');
      }
      if (f.placeholder !== undefined && clip(f.placeholder, 100) !== String(o.placeholder || '')) {
        const ph = clip(f.placeholder, 100);
        if (ph) next.placeholder = ph; else delete next.placeholder;
        notes.push('exemplo mudou');
      }
      if (CHOICE.has(String(next.type)) && Array.isArray(f.options)) {
        const merged = mergeOptions(o, f.options, notes);
        if (merged) next.options = merged;
        else ctx.warnings.push(`${name} › ${fieldLabel(o)}: a lista precisa de pelo menos uma opção; ficou como estava.`);
      }
      let span = Number(o.gridColSpan) || 6;
      if (!FULL_WIDTH.has(String(next.type)) && f.width && f.width in AI_WIDTHS && AI_WIDTHS[f.width] !== span) {
        span = AI_WIDTHS[f.width];
        next.gridColSpan = span;
        widthChanged = true;
        notes.push('largura mudou');
      }
      items.push({ raw: next, span, orig: idx, want: f, notes });
      continue;
    }
    if (idx !== undefined || f?.removed === true) continue; // repetido ou excluir campo que nao existe
    const built = newFieldRaw(f ?? {}, taken, name, ctx);
    if (!built) continue;
    if (built.ref) refs.push(built.ref);
    fieldMarks[built.raw.slug] = 'new';
    details.push(`campo novo "${fieldLabel(built.raw)}"`);
    items.push({ raw: built.raw, span: built.span, isNew: true, want: f });
  }

  // Campos que o rascunho nao citou ficam onde estavam (depois do campo anterior a eles)
  e.fields.forEach((o, i) => {
    if (seen.has(o.slug)) return;
    const item: Item = { raw: o, span: Number(o.gridColSpan) || 6, orig: i };
    let at = -1;
    items.forEach((it, j) => { if (it.orig !== undefined && it.orig < i) at = j; });
    items.splice(at + 1, 0, item);
  });

  // Lista parcial (a IA manda so o que muda): a ordem dos que ja existem nao muda e os
  // novos vao para o fim. So a lista inteira (a tela) reordena.
  if (!e.fields.every((f) => seen.has(f.slug))) {
    const originals = items.filter((it) => it.orig !== undefined).sort((a, b) => a.orig! - b.orig!);
    items.splice(0, items.length, ...originals, ...items.filter((it) => it.orig === undefined));
  }

  // Regras dos campos (precisam da lista final: podem apontar para um campo novo)
  const finalFields = items.map((it) => it.raw);
  for (const it of items) {
    if (!it.want) continue;
    const ruleNotes = applyRules(it.raw, it.want, finalFields, `${name} › ${fieldLabel(it.raw)}`, ctx.warnings);
    if (it.isNew) {
      if (ruleNotes.length) details.push(`campo "${fieldLabel(it.raw)}": ${ruleNotes.join(', ')}`);
      continue;
    }
    const o = e.fields[it.orig!];
    const notes = [...(it.notes ?? []), ...ruleNotes];
    if (JSON.stringify(it.raw) !== JSON.stringify(o)) {
      fieldMarks[o.slug] = 'changed';
      details.push(`campo "${fieldLabel(it.raw)}": ${notes.join(', ') || 'ajustado'}`);
    }
  }
  // Regra que apontava para um campo excluido sai junto
  for (const it of items) {
    for (const prop of RULE_PROPS) {
      const c = it.raw[prop] as WsCondition | undefined;
      if (c && !items.some((x) => x.raw.slug === c.field)) {
        it.raw = { ...it.raw };
        delete it.raw[prop];
        details.push(`campo "${fieldLabel(it.raw)}": sem a regra "${RULE_LABEL[prop]}" (o campo dela foi excluído)`);
        if (it.orig !== undefined) fieldMarks[it.raw.slug] = 'changed';
      }
    }
  }

  const kept = items.filter((it) => it.orig !== undefined).map((it) => it.orig!);
  const reordered = kept.some((v, i) => i > 0 && v < kept[i - 1]);
  if (reordered) details.push('ordem dos campos mudou');
  let fields: RawField[];
  if (!reordered && !widthChanged && removed.length === 0) {
    // Mantem a grade como esta e poe os campos novos embaixo
    const maxRow = Math.max(0, ...items.filter((it) => !it.isNew).map((it) => Number(it.raw.gridRow) || 0));
    const fresh = layout(items.filter((it) => it.isNew).map((it) => ({ ...it.raw, span: it.span })), maxRow + 1);
    let k = 0;
    fields = items.map((it) => (it.isNew ? (fresh[k++] as unknown as RawField) : it.raw));
  } else {
    fields = layout(items.map((it) => ({ ...it.raw, span: FULL_WIDTH.has(String(it.raw.type)) ? 12 : it.span }))) as unknown as RawField[];
  }

  // Ajustes: valem se apontarem para o campo do tipo certo ('' = tirar)
  const settings: Record<string, unknown> = { ...e.settings };
  const setting = (prop: 'titleField' | 'statusField' | 'deadlineField' | 'assigneeField', label: string, ok: (f: RawField) => boolean) => {
    const v = t[prop];
    if (v === undefined) return;
    const current = settings[prop];
    const field = v ? fields.find((f) => f.slug === v || fieldLabel(f).toLowerCase() === String(v).toLowerCase()) : undefined;
    if (v && (!field || !ok(field))) return;
    const next = field?.slug;
    if ((next ?? '') === (current ?? '')) return;
    if (next) settings[prop] = next; else delete settings[prop];
    details.push(next ? `${label}: ${fieldLabel(field!)}` : `sem ${label}`);
  };
  setting('titleField', 'identifica pelo', (f) => TEXTISH.includes(f.type));
  setting('statusField', 'situação', (f) => f.type === 'select');
  setting('deadlineField', 'prazo', (f) => f.type === 'date' || f.type === 'datetime');
  setting('assigneeField', 'responsável', (f) => f.type === 'user-select');
  const status = fields.find((f) => f.slug === settings.statusField);
  if (Array.isArray(t.doneOptions) && status) {
    const wanted = new Set(t.doneOptions.map((d) => clip(d, 60).toLowerCase()));
    const done = optionsOf(status).filter((o) => wanted.has(o.label.toLowerCase()) || wanted.has(o.value)).map((o) => o.value);
    const before = Array.isArray(settings.doneValues) ? (settings.doneValues as string[]) : [];
    if (JSON.stringify([...done].sort()) !== JSON.stringify([...before].sort())) {
      if (done.length) settings.doneValues = done; else delete settings.doneValues;
      details.push('o que conta como terminado mudou');
    }
  }
  // Campos excluidos nao ficam apontados nos ajustes
  for (const prop of ['titleField', 'statusField', 'deadlineField', 'assigneeField'] as const) {
    if (settings[prop] && !fields.some((f) => f.slug === settings[prop])) delete settings[prop];
  }

  const namePlural = clip(t.namePlural, 60) || e.namePlural;
  // Sem descricao = continua a mesma (a IA nem sempre repete)
  const description = clip(t.description, 240) || e.description;
  if (name !== e.name) details.unshift(`nome de um registro: "${e.name}" → "${name}"`);
  if (namePlural !== e.namePlural) details.unshift(`nome: "${e.namePlural}" → "${namePlural}"`);
  if (description !== (e.description || '')) details.push('descrição mudou');
  const icon = (AI_ICONS as readonly string[]).includes(String(t.icon)) ? String(t.icon) : e.icon;
  if (icon !== e.icon) details.push('ícone mudou');
  const color = toHex(t.color) ?? e.color;
  if ((color || '').toLowerCase() !== (e.color || '').toLowerCase()) details.push('cor mudou');

  return {
    name: namePlural, details, fieldMarks, removed,
    update: { name, namePlural, description, icon, color, fields, settings, refs, children: [] as string[] },
  };
}

/** Rascunho da tabela que ja existe, depois de aplicar as mudancas (para a tela e a IA). */
function existingDraftAfter(e: BaseEntity, fields: RawField[], removed: RawField[], settings: Record<string, unknown>, u: { name: string; namePlural: string; description: string; icon: string | null; color: string | null }): WsTable {
  const base = entityToDraft({ ...e, ...u, fields, settings });
  const removedDraft = entityToDraft({ ...e, fields: removed }).fields.map((f) => ({ ...f, removed: true }));
  // Excluidos aparecem riscados no lugar em que estavam
  const order = new Map(e.fields.map((f, i) => [f.slug, i]));
  const out = [...base.fields];
  for (const r of removedDraft) {
    const i = order.get(r.key) ?? 0;
    let at = 0;
    out.forEach((f, j) => { const k = order.get(f.key); if (k !== undefined && k < i) at = j + 1; });
    out.splice(at, 0, r);
  }
  return { ...base, fields: out };
}

function previewOfEntity(e: BaseEntity, fields: RawField[], settings: Record<string, unknown>, u?: { name: string; namePlural: string; description: string; icon: string | null; color: string | null }): WsPreviewTable {
  return {
    key: e.slug, name: u?.name ?? e.name, namePlural: u?.namePlural ?? e.namePlural, description: u?.description ?? e.description,
    icon: u?.icon ?? e.icon ?? 'Database', color: u?.color ?? e.color ?? AI_COLORS.blue, parentKey: e.parentSlug ?? null,
    fields: fields as Array<Record<string, unknown>>, settings,
  };
}

/** Estrutura das tabelas como fica depois do rascunho (para conferir paineis e PDFs). */
function virtualSchema(base: WorkspaceBase, plans: TablePlan[]): SchemaTable[] {
  const removed = new Set(plans.filter((p) => p.kind === 'delete').map((p) => p.key));
  const updates = new Map(plans.filter((p) => p.kind === 'update').map((p) => [p.key, p.update!]));
  const toSchemaField = (f: Record<string, unknown>): SchemaField => ({
    slug: String(f.slug), label: String(f.label || f.slug), type: String(f.type),
    options: optionsOf(f as RawField),
    ...(f.subEntitySlug ? { subEntitySlug: String(f.subEntitySlug) } : {}),
    ...(f.relatedEntitySlug ? { relatedEntitySlug: String(f.relatedEntitySlug) } : {}),
  });
  const out: SchemaTable[] = base.schema
    .filter((t) => !removed.has(t.slug))
    .map((t) => {
      const u = updates.get(t.slug);
      if (!u) return t;
      const s = u.settings as { titleField?: string; statusField?: string; deadlineField?: string; assigneeField?: string };
      return { ...t, name: u.name, namePlural: u.namePlural, fields: u.fields.map(toSchemaField), titleField: s.titleField, statusField: s.statusField, deadlineField: s.deadlineField, assigneeField: s.assigneeField };
    });
  for (const p of plans) {
    if (p.kind !== 'create' || !p.created) continue;
    const c = p.created;
    const s = c.settings as { titleField?: string; statusField?: string; deadlineField?: string; assigneeField?: string };
    out.push({
      id: '', slug: c.key, name: c.name, namePlural: c.namePlural,
      fields: c.fields.map((f) => toSchemaField(f as unknown as Record<string, unknown>)),
      titleField: s.titleField, statusField: s.statusField, deadlineField: s.deadlineField, assigneeField: s.assigneeField,
      ...(c.parentKey || p.existingParent ? { parentSlug: c.parentKey ?? p.existingParent } : {}),
    });
  }
  return out;
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Confere o rascunho inteiro (da IA ou mexido a mao) contra o que existe: devolve o
 * rascunho limpo, a lista do que muda, as marcas da tela e o plano para aplicar.
 */
export function normalizeWorkspace(raw: unknown, base: WorkspaceBase, keptByDashboard: Map<string, Map<string, KeptWidget>>): NormalizedWorkspace {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<WorkspaceDraft>;
  const warnings: string[] = [];
  const changes: WsChange[] = [];
  const marks: WsMarks = { tables: {}, dashboards: {}, pdfs: {}, roles: {} };
  const existingBySlug = new Map(base.entities.map((e) => [e.slug, e]));
  const rawTables = (Array.isArray(input.tables) ? input.tables : []) as Partial<WsTable>[];

  // 1. Tabelas novas (mesma regra do assistente de tabelas). Chave igual a de uma tabela
  // que ja existe ganha "-nova" para as ligacoes nao confundirem as duas.
  const newRaw = rawTables.filter((t) => t && t.existing !== true);
  const fresh = newRaw.map((t) => {
    const original = clip(t.key, 60) || slugify(clip(t.name, 60), '-') || 'tabela';
    const key = existingBySlug.has(original) ? `${original}-nova` : original;
    const parent = clip(t.parentKey, 60);
    const existingParent = parent && existingBySlug.has(parent) && !newRaw.some((x) => clip(x.key, 60) === parent) ? parent : undefined;
    return { original, t: { ...t, key, ...(existingParent ? { parentKey: undefined } : {}), removed: undefined, existing: undefined }, existingParent };
  });
  const remap = new Map(fresh.map((f) => [f.original, f.t.key!]));
  const proposalTables = fresh.map(({ t }) => ({
    ...t,
    ...(t.parentKey ? { parentKey: remap.get(clip(t.parentKey, 60)) ?? t.parentKey } : {}),
    fields: (Array.isArray(t.fields) ? t.fields : []).map((f) => (f?.relatedTable && remap.has(f.relatedTable) ? { ...f, relatedTable: remap.get(f.relatedTable) } : f)),
  }));
  const existingForNew: ExistingTable[] = base.entities.map((e) => ({
    id: e.id, slug: e.slug, name: e.name, titleField: (e.settings as { titleField?: string }).titleField,
    fieldLabels: e.fields.map(fieldLabel),
  }));
  const np = normalizeProposal({ reply: '', group: input.group, tables: proposalTables } as unknown as AiProposal, existingForNew);
  warnings.push(...np.warnings);
  const newKeys = new Map<string, string>();
  fresh.forEach((f, i) => { if (np.tables[i]) { newKeys.set(f.original, np.tables[i].key); newKeys.set(f.t.key!, np.tables[i].key); } });

  const tablePlans: TablePlan[] = [];
  const draftTables: WsTable[] = [];
  const previewTables: WsPreviewTable[] = [];
  np.tables.forEach((nt, i) => {
    const existingParent = fresh[i]?.existingParent;
    const clean = np.proposal.tables[i] as AiTableProposal;
    // Regras dos campos da tabela nova (o normalizador de tabelas nao as conhece)
    const rawFields = (Array.isArray(proposalTables[i]?.fields) ? proposalTables[i].fields : []) as Partial<WsField>[];
    const ntFields = nt.fields as unknown as RawField[];
    for (const f of rawFields) {
      if (!f || !RULE_PROPS.some((p) => f[p])) continue;
      const slug = slugify(clip(f.key, 60) || clip(f.label, 80), '_');
      const target = ntFields.find((x) => x.slug === slug);
      if (!target) continue;
      applyRules(target, f, ntFields, `${nt.namePlural} › ${fieldLabel(target)}`, warnings);
      const cf = (clean.fields as unknown as WsField[]).find((x) => x.key === target.slug);
      if (cf) for (const p of RULE_PROPS) if (target[p]) cf[p] = target[p] as WsCondition;
    }
    tablePlans.push({ key: nt.key, kind: 'create', name: nt.namePlural, created: nt, ...(existingParent ? { existingParent } : {}) });
    draftTables.push({ ...(clean as unknown as WsTable), ...(existingParent ? { parentKey: existingParent } : {}) });
    previewTables.push({ ...nt, parentKey: nt.parentKey ?? existingParent ?? null, fields: nt.fields as unknown as Array<Record<string, unknown>> });
    marks.tables[nt.key] = { status: 'new', fields: Object.fromEntries(nt.fields.filter((f) => f.type !== 'sub-entity').map((f) => [f.slug, 'new' as Mark])) };
    changes.push({
      module: 'table', kind: 'create', key: nt.key, name: nt.namePlural,
      details: [
        `${nt.fields.filter((f) => f.type !== 'sub-entity').length} campos: ${nt.fields.filter((f) => f.type !== 'sub-entity').slice(0, 6).map((f) => f.label).join(', ')}${nt.fields.length > 6 ? '…' : ''}`,
        ...(existingParent ? [`fica dentro de ${existingBySlug.get(existingParent)!.namePlural}`] : []),
      ],
    });
  });

  // 2. Tabelas que ja existem
  const ctx: TableCtx = { warnings, newKeys, existingBySlug };
  const seenExisting = new Set<string>();
  for (const t of rawTables) {
    if (!t || t.existing !== true) continue;
    const key = clip(t.key, 60);
    const e = existingBySlug.get(key);
    if (!e || seenExisting.has(key)) {
      if (!e) warnings.push(`A tabela "${clip(t.namePlural || t.name, 60)}" não foi encontrada.`);
      continue;
    }
    seenExisting.add(key);
    if (t.removed === true) {
      const children = base.schema.filter((s) => s.parentSlug === e.slug).map((s) => s.namePlural);
      tablePlans.push({ key, kind: 'delete', name: e.namePlural, entity: e });
      draftTables.push({ ...entityToDraft(e), removed: true });
      marks.tables[key] = { status: 'removed', fields: {} };
      changes.push({
        module: 'table', kind: 'delete', key, name: e.namePlural,
        details: [
          'a tabela e os registros vão para a lixeira',
          ...(children.length ? [`junto com as listas de dentro: ${children.join(', ')}`] : []),
        ],
      });
      continue;
    }
    const r = normalizeExisting(t, e, ctx);
    if (r.details.length === 0) continue; // nada mudou
    tablePlans.push({ key, kind: 'update', name: e.namePlural, entity: e, update: r.update });
    draftTables.push(existingDraftAfter(e, r.update.fields, r.removed, r.update.settings, r.update));
    previewTables.push(previewOfEntity(e, r.update.fields, r.update.settings, r.update));
    marks.tables[key] = { status: 'changed', fields: r.fieldMarks };
    changes.push({
      module: 'table', kind: 'update', key, name: e.namePlural, details: r.details,
      ...(r.removed.length ? { removals: r.removed.map((f) => `campo "${fieldLabel(f)}"`) } : {}),
    });
  }

  // 3. Lista nova dentro de uma tabela que ja existe: o pai ganha o campo de lista
  for (const p of tablePlans) {
    if (p.kind !== 'create' || !p.existingParent) continue;
    let parent = tablePlans.find((x) => x.key === p.existingParent && x.kind !== 'create');
    if (parent?.kind === 'delete') {
      warnings.push(`${p.name}: a tabela de cima vai ser excluída; ficou como tabela independente.`);
      delete p.existingParent;
      continue;
    }
    if (!parent) {
      const e = existingBySlug.get(p.existingParent)!;
      parent = { key: e.slug, kind: 'update', name: e.namePlural, entity: e, update: { name: e.name, namePlural: e.namePlural, description: e.description, icon: e.icon, color: e.color, fields: [...e.fields], settings: { ...e.settings }, refs: [], children: [] } };
      tablePlans.push(parent);
      marks.tables[e.slug] = { status: 'changed', fields: {} };
      changes.push({ module: 'table', kind: 'update', key: e.slug, name: e.namePlural, details: [] });
    }
    parent.update!.children.push(p.key);
    changes.find((c) => c.module === 'table' && c.key === parent!.key)!.details.push(`lista nova: ${p.name}`);
  }

  // 4. Paineis
  const vschema = virtualSchema(base, tablePlans);
  const dashboardPlans: DashboardPlan[] = [];
  const draftDashboards: WsDashboard[] = [];
  const previewDashboards: Record<string, DashboardPayload> = {};
  const baseDashboards = new Map(base.dashboards.map((d) => [d.id, d]));
  const names = new Set([...base.dashboards.map((d) => d.name), ...base.takenDashboardNames].map((n) => n.toLowerCase()));
  const rawDashboards = (Array.isArray(input.dashboards) ? input.dashboards : []).slice(0, MAX_DASHBOARDS) as Partial<WsDashboard>[];
  const tableKeyOf = (ref: unknown) => (typeof ref === 'string' ? newKeys.get(ref) ?? ref : ref);
  let newDash = 0;
  for (const d of rawDashboards) {
    if (!d) continue;
    const existing = d.existing === true ? baseDashboards.get(clip(d.key, 60)) : undefined;
    if (d.existing === true && !existing) { warnings.push(`O painel "${clip(d.name, 60)}" não foi encontrado.`); continue; }
    if (existing && dashboardPlans.some((p) => p.key === existing.id)) continue;
    if (existing && d.removed === true) {
      dashboardPlans.push({ key: existing.id, kind: 'delete', name: existing.name, base: existing, roleNames: [] });
      draftDashboards.push({ ...dashboardToDraft(existing, base.roles, base.schema).draft, removed: true });
      marks.dashboards[existing.id] = 'removed';
      changes.push({ module: 'dashboard', kind: 'delete', key: existing.id, name: existing.name, details: ['o painel é apagado'] });
      continue;
    }
    if (d.removed === true) continue;
    const fixed = {
      ...d, mainTable: tableKeyOf(d.mainTable),
      tabs: (Array.isArray(d.tabs) ? d.tabs : []).map((tab) => ({ ...tab, rows: (Array.isArray(tab?.rows) ? tab.rows : []).map((row) => (Array.isArray(row) ? row : []).map((w) => ({ ...w, table: tableKeyOf(w?.table) as string }))) })),
    };
    let n;
    try {
      n = normalizeDashboard(fixed, vschema, base.roles, existing ? keptByDashboard.get(existing.id) : undefined);
    } catch {
      warnings.push(`Painel "${clip(d.name, 60)}": precisa de pelo menos uma tabela.`);
      continue;
    }
    warnings.push(...n.warnings);
    let name = n.proposal.name;
    if (!existing || name.toLowerCase() !== existing.name.toLowerCase()) {
      const baseName = name;
      for (let i = 2; names.has(name.toLowerCase()); i++) name = `${baseName} (${i})`;
    }
    names.add(name.toLowerCase());
    const clean: WsDashboard = { key: existing?.id ?? (clip(d.key, 60) || `painel-novo-${++newDash}`), ...(existing ? { existing: true } : {}), ...n.proposal, name };
    delete (clean as Partial<AiDashboardProposal>).reply;
    const payload = { ...n.dashboard, name };
    if (existing) {
      const before = normalizeDashboard(dashboardToDraft(existing, base.roles, base.schema).draft, base.schema, base.roles, keptByDashboard.get(existing.id));
      const details: string[] = [];
      if (name !== existing.name) details.push(`nome: "${existing.name}" → "${name}"`);
      if (clean.description !== (existing.description || '')) details.push('descrição mudou');
      if (!sameJson(n.roleNames, before.roleNames)) details.push(`quem vê: ${n.roleNames.length ? n.roleNames.join(', ') : 'todos os cargos'}`);
      if (!sameJson(n.proposal.tabs, before.proposal.tabs)) {
        const was = before.dashboard.widgets;
        const now = n.dashboard.widgets;
        const added = Object.keys(now).filter((id) => !was[id]);
        const gone = Object.keys(was).filter((id) => !now[id]);
        const changed = Object.keys(now).filter((id) => was[id] && !sameJson(was[id], now[id]));
        const tabsBefore = new Set(before.proposal.tabs.map((t) => t.label));
        const newTabs = n.proposal.tabs.filter((t) => !tabsBefore.has(t.label)).map((t) => `"${t.label}"`);
        const plural = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
        const parts = [
          added.length && plural(added.length, 'bloco novo', 'blocos novos'),
          gone.length && plural(gone.length, 'bloco tirado', 'blocos tirados'),
          changed.length && plural(changed.length, 'bloco mudado', 'blocos mudados'),
          newTabs.length && `aba nova ${newTabs.join(', ')}`,
        ].filter(Boolean) as string[];
        details.push(parts.length ? parts.join(', ') : 'ordem ou largura dos blocos mudou');
      }
      if (details.length === 0) continue;
      dashboardPlans.push({ key: existing.id, kind: 'update', name: existing.name, base: existing, draft: clean, payload, roleNames: n.roleNames });
      marks.dashboards[existing.id] = 'changed';
      changes.push({ module: 'dashboard', kind: 'update', key: existing.id, name: existing.name, details });
    } else {
      dashboardPlans.push({ key: clean.key, kind: 'create', name, draft: clean, payload, roleNames: n.roleNames });
      marks.dashboards[clean.key] = 'new';
      const blocks = n.proposal.tabs.reduce((s, t) => s + t.rows.flat().length, 0);
      changes.push({ module: 'dashboard', kind: 'create', key: clean.key, name, details: [`${blocks} blocos${n.proposal.tabs.length > 1 ? ` em ${n.proposal.tabs.length} abas` : ''}`] });
    }
    draftDashboards.push(clean);
    previewDashboards[clean.key] = payload;
  }

  // 5. PDFs
  const pdfPlans: PdfPlan[] = [];
  const draftPdfs: WsPdf[] = [];
  const previewPdfs: Record<string, { previewable: boolean }> = {};
  const basePdfs = new Map(base.pdfs.map((p) => [p.id, p]));
  const realTables = new Set(base.schema.map((t) => t.slug));
  let newPdf = 0;
  for (const p of (Array.isArray(input.pdfs) ? input.pdfs : []).slice(0, MAX_PDFS) as Partial<WsPdf>[]) {
    if (!p) continue;
    const existing = p.existing === true ? basePdfs.get(clip(p.key, 60)) : undefined;
    if (p.existing === true && !existing) { warnings.push(`O PDF "${clip(p.name, 60)}" não foi encontrado.`); continue; }
    if (existing && pdfPlans.some((x) => x.key === existing.id)) continue;
    if (existing && p.removed === true) {
      pdfPlans.push({ key: existing.id, kind: 'delete', name: existing.name, base: existing, description: existing.description, table: existing.tableSlug || '' });
      draftPdfs.push({ ...pdfToDraft(existing), removed: true });
      marks.pdfs[existing.id] = 'removed';
      changes.push({ module: 'pdf', kind: 'delete', key: existing.id, name: existing.name, details: ['o modelo de PDF é apagado'] });
      continue;
    }
    if (p.removed === true) continue;
    const table = existing ? existing.tableSlug || '' : String(tableKeyOf(clip(p.table, 60)) ?? '');
    if (existing && p.table && clip(p.table, 60) !== table) warnings.push(`${existing.name}: a tabela de um PDF que já existe não muda; crie outro PDF.`);
    const rewrite = !existing || (Array.isArray(p.sections) && p.sections.length > 0);
    let content: Record<string, unknown> | undefined;
    let clean: WsPdf;
    if (rewrite) {
      let n;
      try {
        n = normalizePdf({ ...p, table }, vschema, table);
      } catch {
        warnings.push(`PDF "${clip(p.name, 60) || existing?.name || ''}": escolha a tabela de onde ele tira os dados.`);
        continue;
      }
      warnings.push(...n.warnings);
      content = n.content;
      const { reply: _reply, ...rest } = n.proposal;
      clean = { key: existing?.id ?? (clip(p.key, 60) || `pdf-novo-${++newPdf}`), ...(existing ? { existing: true } : {}), ...rest, table, name: n.name, description: n.description };
    } else {
      clean = { ...pdfToDraft(existing!), name: clip(p.name, 100) || existing!.name, description: p.description === undefined ? existing!.description : clip(p.description, 240) };
    }
    if (existing) {
      const details: string[] = [];
      if (clean.name !== existing.name) details.push(`nome: "${existing.name}" → "${clean.name}"`);
      if (clean.description !== (existing.description || '')) details.push('descrição mudou');
      if (content) details.push('o conteúdo do modelo é refeito');
      if (details.length === 0) continue;
      pdfPlans.push({ key: existing.id, kind: 'update', name: existing.name, base: existing, draft: clean, content, description: clean.description, table });
      marks.pdfs[existing.id] = 'changed';
      changes.push({ module: 'pdf', kind: 'update', key: existing.id, name: existing.name, details });
    } else {
      pdfPlans.push({ key: clean.key, kind: 'create', name: clean.name, draft: clean, content, description: clean.description, table });
      marks.pdfs[clean.key] = 'new';
      changes.push({ module: 'pdf', kind: 'create', key: clean.key, name: clean.name, details: [`${(clean.sections || []).length} partes, tirando os dados de ${vschema.find((t) => t.slug === table)?.namePlural ?? table}`] });
    }
    draftPdfs.push(clean);
    previewPdfs[clean.key] = { previewable: realTables.has(table) };
  }

  // 6. Cargos (tabela nova entra pela chave dela; o nome real vem ao aplicar)
  const roles = normalizeRoles(input.roles, base.roleList, base.actorRank, base.actorAll, vschema, (ref) => newKeys.get(ref) ?? ref, []);
  warnings.push(...roles.warnings);
  for (const c of roles.changes) changes.push({ module: 'role', ...c });
  marks.roles = roles.marks;

  const group = clip(input.group, 40) || null;
  return {
    reply: clip(input.reply, 1500) || 'Pronto, veja as mudanças ao lado.',
    warnings: [...new Set(warnings)],
    draft: { reply: clip(input.reply, 1500), ...(group ? { group } : {}), tables: draftTables, dashboards: draftDashboards, pdfs: draftPdfs, roles: roles.draft },
    changes,
    marks,
    preview: { tables: previewTables, dashboards: previewDashboards, pdfs: previewPdfs },
    plan: { tables: tablePlans, dashboards: dashboardPlans, pdfs: pdfPlans, roles: roles.plans, group },
  };
}

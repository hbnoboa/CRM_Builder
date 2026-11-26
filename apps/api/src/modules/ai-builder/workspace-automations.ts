import { clip } from './ai-proposal-normalizer';
import type { SchemaField, SchemaTable } from './tenant-schema';

/**
 * Automacoes no construtor da tela inicial, em linguagem simples: "quando" (criado,
 * alterado, excluido, um campo mudou, botao) + condicoes + acoes (avisar, e-mail,
 * preencher campo, enviar para outro sistema). O que o construtor nao sabe montar
 * (agendamento, acoes avancadas) vem como "keep" e fica exatamente como esta.
 */

export const AUTOMATION_EVENTS = ['created', 'updated', 'deleted', 'field_changed', 'manual', 'keep'] as const;
type WsEvent = (typeof AUTOMATION_EVENTS)[number];
export const AUTOMATION_ACTIONS = ['notify', 'email', 'set_field', 'webhook', 'keep'] as const;
type WsActionType = (typeof AUTOMATION_ACTIONS)[number];
export const AUTOMATION_OPERATORS = ['equals', 'not_equals', 'contains', 'gt', 'lt', 'is_empty', 'is_not_empty'] as const;

export interface WsAutoAction {
  type: WsActionType;
  /** notify: id ou nome de alguem da equipe (vazio = quem fez a alteracao). */
  person?: string;
  title?: string;
  message?: string;
  /** email: endereco ou {{record.campo}}. */
  to?: string;
  subject?: string;
  body?: string;
  /** set_field: campo e valor ({{today}}, {{now}}, opcao, texto). */
  field?: string;
  value?: unknown;
  /** webhook: endereco https. */
  url?: string;
  /** Acao de uma automacao que ja existe (posicao dela): sem mudanca, volta igual. */
  ref?: number;
}

export interface WsAutomation {
  key: string;
  existing?: boolean;
  removed?: boolean;
  name: string;
  /** Identificador da tabela (ou a chave de uma tabela nova do rascunho). */
  table: string;
  active?: boolean;
  when: { event: string; field?: string; to?: unknown };
  conditions?: Array<{ field: string; operator: string; value?: unknown }>;
  actions: WsAutoAction[];
}

export interface BaseAutomation {
  id: string;
  name: string;
  description: string;
  entityId: string;
  tableSlug: string;
  isActive: boolean;
  trigger: string;
  triggerConfig: Record<string, unknown> | null;
  conditions: Array<Record<string, unknown>>;
  actions: Array<Record<string, unknown>>;
}

export interface AutomationPlan {
  key: string;
  kind: 'create' | 'update' | 'delete';
  name: string;
  base?: BaseAutomation;
  /** Tabela onde fica (identificador ou chave de tabela nova). */
  table: string;
  data?: {
    name: string;
    trigger: string;
    triggerConfig?: Record<string, unknown>;
    conditions: Array<Record<string, unknown>>;
    actions: Array<Record<string, unknown>>;
    isActive: boolean;
    errorHandling?: string;
  };
}

export interface Person { id: string; name: string }

const SKIP_SET = new Set(['sub-entity', 'section-title', 'image', 'file', 'signature', 'map', 'zone-diagram', 'json']);
const NUMERIC = new Set(['number', 'currency', 'percentage', 'rating', 'slider']);
const OP_LABEL: Record<string, string> = {
  equals: 'for', eq: 'for', not_equals: 'não for', neq: 'não for', contains: 'contiver', gt: 'for maior que', lt: 'for menor que',
  is_empty: 'estiver vazio', is_not_empty: 'estiver preenchido',
};

function stable(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable((v as Record<string, unknown>)[k])]));
  return v;
}
const same = (a: unknown, b: unknown) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
const findField = (t: SchemaTable | undefined, ref: unknown) => {
  const r = clip(ref, 80);
  return t?.fields.find((f) => f.slug === r) ?? t?.fields.find((f) => f.label.toLowerCase() === r.toLowerCase());
};

/** Valor no tipo que o campo guarda (opcao pelo nome vira o valor gravado). */
function typed(field: SchemaField, raw: unknown): unknown {
  if (typeof raw === 'string' && /^\{\{.+\}\}$/.test(raw.trim())) return raw.trim();
  if (field.type === 'boolean') return raw === true || /^(true|sim|1)$/i.test(String(raw));
  if (NUMERIC.has(field.type)) return Number(raw);
  const text = clip(raw, 300);
  const opt = field.options.find((o) => o.value === text || o.label.toLowerCase() === text.toLowerCase());
  return opt ? opt.value : text;
}

const valueLabel = (field: SchemaField | undefined, v: unknown) => {
  if (v === true) return 'Sim';
  if (v === false) return 'Não';
  if (v === '{{today}}') return 'a data de hoje';
  if (v === '{{now}}') return 'a data e hora do momento';
  return field?.options.find((o) => o.value === v)?.label ?? String(v ?? '');
};

/** Troca {{record.campo}} pelo nome do campo, para a frase ficar legivel. */
const humanize = (text: string, t: SchemaTable | undefined) =>
  text.replace(/\{\{\s*record\.([^}]+?)\s*\}\}/g, (_, s: string) => `[${findField(t, s)?.label ?? s}]`).replace(/\{\{\s*user\.name\s*\}\}/g, '[quem fez]');

// ── O que ja existe -> rascunho ─────────────────────────────────────────

export function automationToDraft(a: BaseAutomation): WsAutomation {
  const cfg = a.triggerConfig || {};
  const when: WsAutomation['when'] =
    a.trigger === 'ON_CREATE' ? { event: 'created' }
      : a.trigger === 'ON_UPDATE' ? { event: 'updated' }
      : a.trigger === 'ON_DELETE' ? { event: 'deleted' }
      : a.trigger === 'MANUAL' ? { event: 'manual' }
      : a.trigger === 'ON_FIELD_CHANGE' ? JSON.parse(JSON.stringify({ event: 'field_changed', field: cfg.fieldSlug, to: cfg.toValue }))
      : { event: 'keep' };
  const actions = [...a.actions]
    .sort((x, y) => Number(x.order ?? 0) - Number(y.order ?? 0))
    .map((x, ref): WsAutoAction => {
      const c = (x.config || {}) as Record<string, unknown>;
      switch (x.type) {
        case 'notify_user': return JSON.parse(JSON.stringify({ type: 'notify', person: c.userId || '', title: c.title, message: c.message, ref }));
        case 'send_email': return JSON.parse(JSON.stringify({ type: 'email', to: c.to, subject: c.subject, body: c.body, ref }));
        case 'update_field':
          if (!c.operation || c.operation === 'set') return JSON.parse(JSON.stringify({ type: 'set_field', field: c.fieldSlug, value: c.value, ref }));
          return { type: 'keep', ref };
        case 'call_webhook': return { type: 'webhook', url: String(c.url || ''), ref };
        default: return { type: 'keep', ref };
      }
    });
  return {
    key: a.id, existing: true, name: a.name, table: a.tableSlug, active: a.isActive, when,
    conditions: (a.conditions || []).map((c) => JSON.parse(JSON.stringify({ field: c.field, operator: c.operator, value: c.value }))),
    actions,
  };
}

/** Frase "quando ..., então ..." (lista de mudancas e historico). */
export function describeAutomation(
  d: { trigger: string; triggerConfig?: Record<string, unknown> | null; conditions?: Array<Record<string, unknown>>; actions: Array<Record<string, unknown>> },
  t: SchemaTable | undefined,
  people: Person[],
): string {
  const cfg = d.triggerConfig || {};
  const what = t ? t.name.toLowerCase() : 'registro';
  const field = findField(t, cfg.fieldSlug);
  const when =
    d.trigger === 'ON_CREATE' ? `quando um(a) ${what} for criado(a)`
      : d.trigger === 'ON_UPDATE' ? `quando um(a) ${what} for alterado(a)`
      : d.trigger === 'ON_DELETE' ? `quando um(a) ${what} for excluído(a)`
      : d.trigger === 'MANUAL' ? 'quando alguém clicar no botão'
      : d.trigger === 'ON_FIELD_CHANGE' ? `quando ${field?.label ?? cfg.fieldSlug} mudar${cfg.toValue !== undefined ? ` para "${valueLabel(field, cfg.toValue)}"` : ''}`
      : d.trigger === 'SCHEDULE' ? 'no horário agendado'
      : 'quando a situação mudar';
  const conds = (d.conditions || []).map((c) => {
    const f = findField(t, c.field);
    return `${f?.label ?? c.field} ${OP_LABEL[String(c.operator)] ?? c.operator}${c.value !== undefined && c.value !== '' ? ` "${valueLabel(f, c.value)}"` : ''}`;
  });
  const then = [...d.actions].sort((x, y) => Number(x.order ?? 0) - Number(y.order ?? 0)).map((x) => {
    const c = (x.config || {}) as Record<string, unknown>;
    switch (x.type) {
      case 'notify_user': return `avisar ${c.userId ? people.find((p) => p.id === c.userId)?.name ?? 'uma pessoa' : 'quem fez a alteração'}`;
      case 'send_email': return `mandar e-mail para ${humanize(String(c.to || ''), t)}`;
      case 'update_field': return `preencher ${findField(t, c.fieldSlug)?.label ?? c.fieldSlug} com ${humanize(String(valueLabel(findField(t, c.fieldSlug), c.value)), t)}`;
      case 'call_webhook': {
        let host = String(c.url || '');
        try { host = new URL(host).host; } catch { /* mantem o texto */ }
        return `enviar os dados para ${host}`;
      }
      default: return 'mais uma ação avançada';
    }
  });
  return `${when}${conds.length ? ` e ${conds.join(' e ')}` : ''}, ${then.join(', depois ') || 'nada'}`;
}

// ── Rascunho -> automacao conferida ─────────────────────────────────────

export function normalizeAutomations(
  raw: unknown,
  bases: BaseAutomation[],
  schema: SchemaTable[],
  people: Person[],
  newTableKey: (ref: string) => string,
) {
  const warnings: string[] = [];
  const plans: AutomationPlan[] = [];
  const draft: WsAutomation[] = [];
  const changes: Array<{ kind: 'create' | 'update' | 'delete'; key: string; name: string; details: string[] }> = [];
  const marks: Record<string, 'new' | 'changed' | 'removed'> = {};
  const byId = new Map(bases.map((b) => [b.id, b]));
  const tableOf = (slug: string) => schema.find((t) => t.slug === slug);
  const person = (ref: unknown): string | undefined => {
    const r = clip(ref, 120);
    if (!r) return '';
    const p = people.find((x) => x.id === r) ?? people.find((x) => x.name.toLowerCase() === r.toLowerCase())
      ?? people.find((x) => x.name.toLowerCase().includes(r.toLowerCase()));
    return p?.id;
  };
  let n = 0;

  for (const a of (Array.isArray(raw) ? raw : []).slice(0, 20) as Partial<WsAutomation>[]) {
    if (!a) continue;
    const base = a.existing === true ? byId.get(clip(a.key, 60)) : undefined;
    const label = clip(a.name, 100) || base?.name || 'Automação';
    if (a.existing === true && !base) { warnings.push(`A automação "${label}" não foi encontrada.`); continue; }
    if (base && plans.some((p) => p.key === base.id)) continue;
    if (base && a.removed === true) {
      plans.push({ key: base.id, kind: 'delete', name: base.name, base, table: base.tableSlug });
      draft.push({ ...automationToDraft(base), removed: true });
      marks[base.id] = 'removed';
      changes.push({ kind: 'delete', key: base.id, name: base.name, details: ['a automação para de funcionar e é apagada'] });
      continue;
    }
    if (a.removed === true) continue;

    // Tabela: a de uma automacao que ja existe nao muda
    const tableSlug = base ? base.tableSlug : newTableKey(clip(a.table, 60));
    if (base && a.table && newTableKey(clip(a.table, 60)) !== base.tableSlug) warnings.push(`${label}: a tabela de uma automação que já existe não muda; crie outra.`);
    const t = tableOf(tableSlug);
    if (!t) { warnings.push(`${label}: a tabela "${clip(a.table, 60)}" não foi encontrada.`); continue; }
    const where = `${label} (${t.namePlural})`;

    // Quando
    const event = String(a.when?.event ?? '') as WsEvent;
    let trigger: string;
    let triggerConfig: Record<string, unknown> | undefined;
    if (event === 'keep' && base) {
      trigger = base.trigger;
      triggerConfig = base.triggerConfig ?? undefined;
    } else if (event === 'created' || event === 'updated' || event === 'deleted' || event === 'manual') {
      trigger = { created: 'ON_CREATE', updated: 'ON_UPDATE', deleted: 'ON_DELETE', manual: 'MANUAL' }[event];
    } else if (event === 'field_changed') {
      const f = findField(t, a.when?.field);
      if (!f) { warnings.push(`${where}: o campo que dispara a automação não existe.`); continue; }
      trigger = 'ON_FIELD_CHANGE';
      triggerConfig = { fieldSlug: f.slug, ...(a.when?.to !== undefined && a.when.to !== '' ? { toValue: typed(f, a.when.to) } : {}) };
    } else {
      warnings.push(`${where}: diga quando a automação roda (criar, alterar, excluir, mudar um campo ou botão).`);
      continue;
    }

    // Condicoes
    const conditions: Array<Record<string, unknown>> = [];
    for (const c of (Array.isArray(a.conditions) ? a.conditions : []).slice(0, 10)) {
      const f = findField(t, c?.field);
      if (!f) { warnings.push(`${where}: a condição usa um campo que não existe; ficou de fora.`); continue; }
      const op = String(c.operator);
      if (!(AUTOMATION_OPERATORS as readonly string[]).includes(op) && !['eq', 'neq'].includes(op)) { warnings.push(`${where}: condição desconhecida; ficou de fora.`); continue; }
      conditions.push({ field: f.slug, operator: op, ...(op === 'is_empty' || op === 'is_not_empty' ? {} : { value: typed(f, c.value) }) });
    }

    // Acoes (a que nao mudou volta com a config original: tipo de aviso, tentativas...)
    const original = base ? [...base.actions].sort((x, y) => Number(x.order ?? 0) - Number(y.order ?? 0)) : [];
    const originalDraft = base ? automationToDraft(base).actions : [];
    const actions: Array<Record<string, unknown>> = [];
    for (const act of (Array.isArray(a.actions) ? a.actions : []).slice(0, 10)) {
      if (!act) continue;
      const ref = typeof act.ref === 'number' && original[act.ref] ? act.ref : undefined;
      if (act.type === 'keep' || (ref !== undefined && same({ ...act, ref }, originalDraft[ref]))) {
        if (ref === undefined) continue;
        actions.push({ ...original[ref], order: actions.length });
        continue;
      }
      const prev = ref !== undefined ? ((original[ref].config || {}) as Record<string, unknown>) : {};
      switch (act.type) {
        case 'notify': {
          const id = person(act.person);
          if (id === undefined) {
            warnings.push(`${where}: não achei "${clip(act.person, 60)}" na equipe; escolha a pessoa na tela (sem escolher, avisa quem fez a alteração).`);
          }
          const title = clip(act.title, 120) || `${t.name}`;
          const message = clip(act.message, 500) || (t.titleField ? `{{record.${t.titleField}}}` : t.name);
          actions.push({ order: actions.length, type: 'notify_user', config: { ...prev, ...(id ? { userId: id } : {}), title, message, type: prev.type ?? 'info' } });
          if (!id) delete (actions[actions.length - 1].config as Record<string, unknown>).userId;
          break;
        }
        case 'email': {
          const to = clip(act.to, 200);
          if (!to || !(/\S+@\S+\.\S+/.test(to) || /^\{\{\s*record\.[^}]+\}\}$/.test(to))) { warnings.push(`${where}: o e-mail precisa de um endereço ou de um campo de e-mail; ação ficou de fora.`); continue; }
          actions.push({ order: actions.length, type: 'send_email', config: { ...prev, to, subject: clip(act.subject, 200) || label, body: clip(act.body, 4000) || label } });
          break;
        }
        case 'set_field': {
          const f = findField(t, act.field);
          if (!f || SKIP_SET.has(f.type)) { warnings.push(`${where}: o campo a preencher não existe ou não dá para preencher sozinho; ação ficou de fora.`); continue; }
          actions.push({ order: actions.length, type: 'update_field', config: { fieldSlug: f.slug, value: typed(f, act.value) } });
          break;
        }
        case 'webhook': {
          const url = clip(act.url, 500);
          if (!/^https:\/\/\S+$/.test(url)) { warnings.push(`${where}: o endereço do outro sistema precisa começar com https://; ação ficou de fora.`); continue; }
          actions.push({
            order: actions.length, type: 'call_webhook',
            config: Object.keys(prev).length ? { ...prev, url } : { url, method: 'POST', retries: 2, body: { tabela: '{{entity.name}}', id: '{{recordId}}', por: '{{user.name}}', registro: '{{record}}' } },
          });
          break;
        }
        default:
          warnings.push(`${where}: ação desconhecida; ficou de fora.`);
      }
    }
    if (actions.length === 0) { warnings.push(`${where}: sem nenhuma ação, a automação ficou de fora.`); continue; }

    const isActive = typeof a.active === 'boolean' ? a.active : base ? base.isActive : true;
    const data = { name: label, trigger, ...(triggerConfig ? { triggerConfig } : {}), conditions, actions, isActive, ...(base ? {} : { errorHandling: 'stop' }) };
    const sentence = describeAutomation(data, t, people);
    if (base) {
      const before = { name: base.name, trigger: base.trigger, triggerConfig: base.triggerConfig ?? undefined, conditions: base.conditions || [], actions: original.map((x, i) => ({ ...x, order: i })), isActive: base.isActive };
      const after = { name: label, trigger, triggerConfig, conditions, actions, isActive };
      if (same(JSON.parse(JSON.stringify(before)), JSON.parse(JSON.stringify(after)))) continue;
      const details: string[] = [];
      if (label !== base.name) details.push(`nome: "${base.name}" → "${label}"`);
      if (isActive !== base.isActive) details.push(isActive ? 'ligada' : 'desligada');
      const was = describeAutomation(before, t, people);
      if (was !== sentence) details.push(`antes: ${was}`, `agora: ${sentence}`);
      plans.push({ key: base.id, kind: 'update', name: base.name, base, table: tableSlug, data });
      marks[base.id] = 'changed';
      changes.push({ kind: 'update', key: base.id, name: base.name, details: details.length ? details : ['ajustes nas ações'] });
      draft.push({ ...automationToDraft({ ...base, ...data, triggerConfig: triggerConfig ?? null }), key: base.id, existing: true });
    } else {
      const key = clip(a.key, 60) || `automacao-nova-${++n}`;
      plans.push({ key, kind: 'create', name: label, table: tableSlug, data });
      marks[key] = 'new';
      changes.push({ kind: 'create', key, name: label, details: [`${t.namePlural}: ${sentence}`, ...(isActive ? [] : ['fica desligada'])] });
      const clean = automationToDraft({ id: key, name: label, description: '', entityId: '', tableSlug, isActive, trigger, triggerConfig: triggerConfig ?? null, conditions, actions });
      draft.push({ ...clean, existing: undefined, actions: clean.actions.map(({ ref: _ref, ...x }) => x) });
    }
  }
  return { draft, plans, changes, marks, warnings };
}

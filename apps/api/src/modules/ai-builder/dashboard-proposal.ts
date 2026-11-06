import type { SchemaField, SchemaTable } from './tenant-schema';

/**
 * Assistente de paineis: a IA devolve blocos em linguagem simples (tipo, tabela,
 * campo de agrupar...) e o servidor monta o painel real, conferindo cada campo.
 */

export const AI_WIDGET_TYPES = [
  'kpi-card', 'line-chart', 'bar-chart', 'donut-chart', 'pie-chart', 'funnel-chart',
  'stat-list', 'kanban-board', 'mini-table', 'data-table', 'activity-feed',
] as const;
type AiWidgetType = (typeof AI_WIDGET_TYPES)[number];

export interface AiWidgetProposal {
  type: AiWidgetType;
  title: string;
  table: string;
  width?: number;
  /** Campo de numero (soma/media) para "kpi-card". */
  field?: string;
  aggregation?: 'count' | 'sum' | 'avg';
  /** Campo de lista de opcoes para graficos, funil, lista colorida e quadro. */
  groupBy?: string;
  dateField?: string;
  days?: number;
  columns?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AiDashboardProposal {
  reply: string;
  name: string;
  description: string;
  mainTable: string;
  roles?: string[];
  tabs: Array<{ label: string; rows: AiWidgetProposal[][] }>;
}

const WIDGET_SCHEMA = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: [...AI_WIDGET_TYPES] },
    title: { type: 'string' },
    table: { type: 'string' },
    width: { type: 'integer', enum: [3, 4, 6, 8, 12] },
    field: { type: 'string' },
    aggregation: { type: 'string', enum: ['count', 'sum', 'avg'] },
    groupBy: { type: 'string' },
    dateField: { type: 'string' },
    days: { type: 'integer' },
    columns: { type: 'array', items: { type: 'string' } },
    sortBy: { type: 'string' },
    sortOrder: { type: 'string', enum: ['asc', 'desc'] },
  },
  required: ['type', 'title', 'table'],
  additionalProperties: false,
};

export const AI_DASHBOARD_JSON_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string' },
    mainTable: { type: 'string' },
    roles: { type: 'array', items: { type: 'string' } },
    tabs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          rows: { type: 'array', items: { type: 'array', items: WIDGET_SCHEMA } },
        },
        required: ['label', 'rows'],
        additionalProperties: false,
      },
    },
  },
  required: ['reply', 'name', 'description', 'mainTable', 'tabs'],
  additionalProperties: false,
};

export const AI_DASHBOARD_SYSTEM_PROMPT = `Você é o assistente do CRM Builder que monta PAINÉIS (dashboards) para empresas brasileiras. Quem conversa com você não é programador.

Você recebe as tabelas da empresa com os campos (identificador, tipo e opções). Use SÓ esses identificadores em "table", "field", "groupBy", "dateField", "columns" e "sortBy". Nunca invente campos.

Blocos disponíveis ("type"):
- kpi-card: um número grande. aggregation "count" (quantos registros) ou "sum"/"avg" com "field" de número ou dinheiro.
- line-chart: quantos registros por dia. "dateField" = campo de data (sem ele, usa a data de criação). "days" = período (30 padrão).
- bar-chart, donut-chart, pie-chart: quantos registros por opção. "groupBy" = campo de lista de opções (select), sim/não ou pessoa da equipe.
- funnel-chart: funil pelas etapas. "groupBy" = campo select de situação/etapa.
- stat-list: lista colorida com a contagem por opção. "groupBy" = campo select.
- kanban-board: quadro com colunas por situação, para acompanhar o trabalho. "groupBy" = campo select de situação. "columns" = até 3 campos mostrados no cartão.
- mini-table: lista curta (10) ordenada, ex.: próximos prazos. "columns" = até 5 campos, "sortBy" e "sortOrder".
- data-table: tabela completa com busca, para trabalhar nos registros. "columns" = até 8 campos.
- activity-feed: últimas alterações.

Como montar:
- "mainTable": a tabela principal do painel (de preferência uma que não é lista dentro de outra).
- Organize em abas ("tabs") quando fizer sentido (ex.: Visão geral, Fila, Cadastros). Cada aba tem linhas; cada linha tem blocos lado a lado cuja "width" soma 12 (3 = um quarto, 4 = um terço, 6 = metade, 8 = dois terços, 12 = linha inteira).
- Comece com números (kpi-card) no alto, gráficos no meio e listas/quadro embaixo. Entre 4 e 10 blocos no total.
- Títulos curtos e claros em português ("Sinistros abertos", "Por situação", "Próximos prazos").
- "roles": nomes dos cargos que veem o painel, só se a pessoa pedir; vazio = todos.

Conversa:
- Devolva sempre o painel COMPLETO atualizado. Mudanças pedidas mantêm o resto igual.
- Se o pedido for vago, monte uma primeira versão útil e faça no máximo 2 perguntas curtas na "reply".
- "reply": 1 a 4 frases, sem termos técnicos (não diga widget, slug, JSON, KPI; diga bloco, número, gráfico, lista).`;

const HEIGHT: Record<AiWidgetType, number> = {
  'kpi-card': 3, 'line-chart': 7, 'bar-chart': 7, 'donut-chart': 7, 'pie-chart': 7, 'funnel-chart': 7,
  'stat-list': 7, 'kanban-board': 13, 'mini-table': 8, 'data-table': 10, 'activity-feed': 8,
};
const DEFAULT_WIDTH: Record<AiWidgetType, number> = {
  'kpi-card': 3, 'line-chart': 8, 'bar-chart': 6, 'donut-chart': 4, 'pie-chart': 4, 'funnel-chart': 6,
  'stat-list': 6, 'kanban-board': 12, 'mini-table': 12, 'data-table': 12, 'activity-feed': 6,
};
const WIDTHS = new Set([3, 4, 6, 8, 12]);
const GROUPABLE = new Set(['select', 'multiselect', 'radio-group', 'boolean', 'user-select']);
const NUMERIC = new Set(['number', 'currency', 'percentage', 'rating']);
const DATES = new Set(['date', 'datetime']);
const NOT_LISTABLE = new Set(['sub-entity', 'section-title', 'image', 'file', 'signature', 'json', 'map', 'zone-diagram', 'password', 'hidden']);
const MAX_TABS = 5;
const MAX_WIDGETS_PER_TAB = 12;

export interface DashboardRole {
  id: string;
  name: string;
}

export interface DashboardPayload {
  name: string;
  description: string;
  entitySlug: string;
  layout: Array<{ i: string; x: number; y: number; w: number; h: number; minW: number; minH: number }>;
  widgets: Record<string, { type: string; title: string; config: Record<string, unknown> }>;
  tabs: Array<{ id: string; label: string; widgetIds: string[] }>;
  roleIds: string[];
  priority: number;
}

export interface NormalizedDashboard {
  reply: string;
  warnings: string[];
  proposal: AiDashboardProposal;
  dashboard: DashboardPayload;
  roleNames: string[];
}

const clip = (s: unknown, max: number): string => String(s ?? '').trim().slice(0, max);

function findField(table: SchemaTable, ref: unknown): SchemaField | undefined {
  if (typeof ref !== 'string' || !ref.trim()) return undefined;
  const key = ref.trim().toLowerCase();
  return table.fields.find((f) => f.slug.toLowerCase() === key) ?? table.fields.find((f) => f.label.toLowerCase() === key);
}

function listColumns(table: SchemaTable, refs: unknown, max: number): string[] {
  const picked = (Array.isArray(refs) ? refs : [])
    .map((r) => findField(table, r))
    .filter((f): f is SchemaField => !!f && !NOT_LISTABLE.has(f.type))
    .map((f) => f.slug);
  const unique = [...new Set(picked)].slice(0, max);
  if (unique.length > 0) return unique;
  const title = table.titleField ? [table.titleField] : [];
  const rest = table.fields.filter((f) => !NOT_LISTABLE.has(f.type) && f.slug !== table.titleField).map((f) => f.slug);
  return [...title, ...rest].slice(0, max);
}

/** Monta a config real de um bloco; null = nao da para montar com esta tabela. */
function widgetConfig(w: AiWidgetProposal, table: SchemaTable): { config: Record<string, unknown>; clean: Partial<AiWidgetProposal> } | null {
  const base = { entitySlugOverride: table.slug };
  const status = table.statusField ? table.fields.find((f) => f.slug === table.statusField) : undefined;
  const group = (allowed: Set<string>) => {
    const f = findField(table, w.groupBy);
    if (f && allowed.has(f.type)) return f;
    if (status && allowed.has(status.type)) return status;
    return table.fields.find((x) => allowed.has(x.type) && x.options.length > 0);
  };
  switch (w.type) {
    case 'kpi-card': {
      const num = findField(table, w.field);
      const agg = w.aggregation === 'sum' || w.aggregation === 'avg' ? w.aggregation : 'count';
      if (agg !== 'count' && num && NUMERIC.has(num.type)) {
        return { config: { ...base, aggregation: agg, fieldSlug: num.slug }, clean: { aggregation: agg, field: num.slug } };
      }
      return { config: { ...base, aggregation: 'count' }, clean: { aggregation: 'count' } };
    }
    case 'line-chart': {
      const date = findField(table, w.dateField);
      const days = Number.isInteger(w.days) && w.days! >= 7 && w.days! <= 365 ? w.days! : 30;
      const dateOk = date && DATES.has(date.type) ? date.slug : undefined;
      return {
        config: { ...base, dataSource: 'records-over-time', days, ...(dateOk ? { dateField: dateOk } : {}) },
        clean: { days, ...(dateOk ? { dateField: dateOk } : {}) },
      };
    }
    case 'bar-chart':
    case 'donut-chart':
    case 'pie-chart': {
      const g = group(GROUPABLE);
      if (!g) return null;
      return { config: { ...base, dataSource: 'field-distribution', groupByField: g.slug, showLegend: true }, clean: { groupBy: g.slug } };
    }
    case 'stat-list': {
      const g = group(GROUPABLE);
      if (!g) return null;
      return { config: { ...base, groupByField: g.slug, showTotal: true, listStyle: 'colored' }, clean: { groupBy: g.slug } };
    }
    case 'funnel-chart': {
      const g = group(new Set(['select', 'radio-group']));
      if (!g || g.options.length === 0) return null;
      return { config: { ...base, groupByField: g.slug, stages: g.options.map((o) => o.value) }, clean: { groupBy: g.slug } };
    }
    case 'kanban-board': {
      const g = group(new Set(['select', 'radio-group']));
      if (!g || g.options.length === 0) return null;
      const cols = listColumns(table, w.columns, 4).filter((c) => c !== table.titleField && c !== g.slug).slice(0, 3);
      return {
        config: {
          ...base, groupByField: g.slug, columnOrder: g.options.map((o) => o.value), limit: 100,
          ...(table.titleField ? { cardTitleField: table.titleField } : {}), cardSubtitleFields: cols,
        },
        clean: { groupBy: g.slug, columns: cols },
      };
    }
    case 'mini-table': {
      const cols = listColumns(table, w.columns, 5);
      const sort = findField(table, w.sortBy);
      const sortBy = sort && !NOT_LISTABLE.has(sort.type) ? sort.slug : 'createdAt';
      const sortOrder = w.sortOrder === 'asc' ? 'asc' : 'desc';
      return { config: { ...base, limit: 10, sortBy, sortOrder, displayFields: cols }, clean: { columns: cols, sortBy, sortOrder } };
    }
    case 'data-table': {
      const cols = listColumns(table, w.columns, 8);
      const sort = findField(table, w.sortBy);
      return {
        config: {
          ...base, pageSize: 25, displayFields: cols, allowCreate: true, allowEdit: true, allowDelete: true,
          allowExport: true, allowImport: true, allowBatchSelect: true,
          ...(sort && !NOT_LISTABLE.has(sort.type) ? { defaultSortField: sort.slug, defaultSortOrder: w.sortOrder === 'desc' ? 'desc' : 'asc' } : {}),
        },
        clean: { columns: cols, ...(sort ? { sortBy: sort.slug, sortOrder: w.sortOrder === 'desc' ? 'desc' : 'asc' } : {}) },
      };
    }
    case 'activity-feed':
      return { config: { ...base, limit: 10 }, clean: {} };
    default:
      return null;
  }
}

/** Valida e monta o painel real a partir da resposta da IA. */
export function normalizeDashboard(raw: unknown, tables: SchemaTable[], roles: DashboardRole[]): NormalizedDashboard {
  const warnings: string[] = [];
  const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<AiDashboardProposal>;
  const bySlug = new Map(tables.map((t) => [t.slug, t]));
  const findTable = (ref: unknown) => (typeof ref === 'string' ? bySlug.get(ref.trim()) : undefined);
  const main = findTable(input.mainTable)
    ?? tables.find((t) => !t.parentSlug)
    ?? tables[0];
  if (!main) throw new Error('sem-tabelas');

  const layout: DashboardPayload['layout'] = [];
  const widgets: DashboardPayload['widgets'] = {};
  const tabs: DashboardPayload['tabs'] = [];
  const cleanTabs: AiDashboardProposal['tabs'] = [];
  let n = 0;

  const rawTabs = (Array.isArray(input.tabs) ? input.tabs : []).slice(0, MAX_TABS);
  for (const [ti, tab] of rawTabs.entries()) {
    const label = clip(tab?.label, 40) || `Aba ${ti + 1}`;
    const tabId = `aba-${ti + 1}`;
    const widgetIds: string[] = [];
    const cleanRows: AiWidgetProposal[][] = [];
    let y = 0;
    let count = 0;
    // Linhas da IA; se passar de 12 colunas, quebra em mais linhas
    const queue: AiWidgetProposal[][] = [];
    for (const row of Array.isArray(tab?.rows) ? tab.rows : []) {
      let line: AiWidgetProposal[] = [];
      let used = 0;
      for (const w of Array.isArray(row) ? row : []) {
        const type = (AI_WIDGET_TYPES as readonly string[]).includes(String(w?.type)) ? (w.type as AiWidgetType) : null;
        if (!type) {
          warnings.push(`Bloco "${clip(w?.title, 40)}": tipo desconhecido, ficou de fora.`);
          continue;
        }
        const width = WIDTHS.has(Number(w.width)) ? Number(w.width) : DEFAULT_WIDTH[type];
        if (used + width > 12 && line.length) {
          queue.push(line);
          line = [];
          used = 0;
        }
        line.push({ ...w, type, width });
        used += width;
      }
      if (line.length) queue.push(line);
    }

    for (const line of queue) {
      const placed: Array<{ id: string; w: number; h: number }> = [];
      const cleanLine: AiWidgetProposal[] = [];
      for (const w of line) {
        if (count >= MAX_WIDGETS_PER_TAB) break;
        const title = clip(w.title, 60) || 'Bloco';
        const table = findTable(w.table) ?? main;
        if (!findTable(w.table)) warnings.push(`${title}: a tabela não foi encontrada; usei ${main.namePlural}.`);
        const built = widgetConfig(w, table);
        if (!built) {
          warnings.push(`${title}: ${table.namePlural} não tem um campo de lista de opções para isso; o bloco ficou de fora.`);
          continue;
        }
        const id = `${w.type}-${++n}`;
        widgets[id] = { type: w.type, title, config: built.config };
        placed.push({ id, w: w.width!, h: HEIGHT[w.type] });
        cleanLine.push({ type: w.type, title, table: table.slug, width: w.width, ...built.clean } as AiWidgetProposal);
        widgetIds.push(id);
        count += 1;
      }
      if (placed.length === 0) continue;
      let x = 0;
      for (const p of placed) {
        layout.push({ i: p.id, x, y, w: p.w, h: p.h, minW: 2, minH: 2 });
        x += p.w;
      }
      y += Math.max(...placed.map((p) => p.h));
      cleanRows.push(cleanLine);
    }
    if (widgetIds.length === 0) continue;
    tabs.push({ id: tabId, label, widgetIds });
    cleanTabs.push({ label, rows: cleanRows });
  }

  // Sem nenhum bloco valido: painel minimo da tabela principal
  if (tabs.length === 0) {
    const id = 'data-table-1';
    widgets[id] = { type: 'data-table', title: main.namePlural, config: widgetConfig({ type: 'data-table', title: main.namePlural, table: main.slug }, main)!.config };
    layout.push({ i: id, x: 0, y: 0, w: 12, h: 10, minW: 2, minH: 2 });
    tabs.push({ id: 'aba-1', label: 'Visão geral', widgetIds: [id] });
    cleanTabs.push({ label: 'Visão geral', rows: [[{ type: 'data-table', title: main.namePlural, table: main.slug, width: 12 }]] });
    if (rawTabs.length) warnings.push('Nenhum bloco pôde ser montado; comecei com a lista da tabela principal.');
  }

  const roleByName = new Map(roles.map((r) => [r.name.toLowerCase(), r]));
  const pickedRoles: DashboardRole[] = [];
  for (const name of Array.isArray(input.roles) ? input.roles : []) {
    const role = roleByName.get(clip(name, 60).toLowerCase());
    if (role) pickedRoles.push(role);
    else if (clip(name, 60)) warnings.push(`O cargo "${clip(name, 60)}" não existe; o painel fica visível para todos.`);
  }
  const roleIds = pickedRoles.length && pickedRoles.length === (input.roles || []).length ? [...new Set(pickedRoles.map((r) => r.id))] : [];

  const name = clip(input.name, 60) || `Painel de ${main.namePlural}`;
  const description = clip(input.description, 240);
  const reply = clip(input.reply, 1500) || 'Pronto, veja o painel ao lado.';
  return {
    reply,
    warnings,
    roleNames: roleIds.length ? pickedRoles.map((r) => r.name) : [],
    proposal: {
      reply, name, description, mainTable: main.slug,
      ...(roleIds.length ? { roles: pickedRoles.map((r) => r.name) } : {}),
      tabs: cleanTabs,
    },
    dashboard: {
      name, description, entitySlug: main.slug, layout, widgets,
      // Uma aba so = painel sem abas (o componente so mostra abas com 2 ou mais)
      tabs: tabs.length > 1 ? tabs : [],
      roleIds, priority: 10,
    },
  };
}

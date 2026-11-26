import { clip } from './ai-proposal-normalizer';
import type { SchemaTable } from './tenant-schema';

/**
 * Cargos no construtor da tela inicial. O cargo aparece em linguagem simples:
 * um nivel por parte do sistema (nada, ver, editar, tudo) e, por tabela, o que
 * pode fazer, quais registros ve, campos escondidos ou so leitura e filtros.
 * Cargo que ja existe: so o que vem no rascunho muda; o resto (acoes avancadas,
 * avisos, exportar...) fica como esta.
 */

export const ROLE_MODULES = [
  'dashboard', 'data', 'entities', 'users', 'roles', 'settings',
  'automations', 'templates', 'logs', 'publicLinks', 'apis', 'archive', 'chat',
] as const;
export type RoleModule = (typeof ROLE_MODULES)[number];
export type Level = 'none' | 'read' | 'edit' | 'full';
const LEVELS: Level[] = ['none', 'read', 'edit', 'full'];

export const MODULE_LABEL: Record<RoleModule, string> = {
  dashboard: 'Painéis', data: 'Registros', entities: 'Montar tabelas', users: 'Usuários', roles: 'Cargos',
  settings: 'Configurações da empresa', automations: 'Automações', templates: 'Modelos de PDF', logs: 'Histórico de alterações',
  publicLinks: 'Páginas e links públicos', apis: 'Chaves de API', archive: 'Arquivo', chat: 'Gerenciar o chat',
};
const LEVEL_LABEL: Record<Level, string> = { none: 'nada', read: 'ver', edit: 'editar', full: 'tudo' };

export const FILTER_OPERATORS = ['equals', 'notEquals', 'contains', 'gt', 'lt', 'isEmpty', 'isNotEmpty'] as const;
type FilterOperator = (typeof FILTER_OPERATORS)[number];
const FILTER_LABEL: Record<FilterOperator, string> = {
  equals: 'for', notEquals: 'não for', contains: 'contiver', gt: 'for maior que', lt: 'for menor que', isEmpty: 'estiver vazio', isNotEmpty: 'estiver preenchido',
};
const SCOPES = ['all', 'own', 'team'] as const;
type Scope = (typeof SCOPES)[number];
const SCOPE_LABEL: Record<string, string> = { all: 'todos os registros', own: 'só os que a pessoa criou', team: 'os da equipe', client: 'os do cliente dela' };

export interface WsRoleFilter { field: string; operator: string; value?: string }

export interface WsRoleTable {
  /** Identificador da tabela ou '*' (todas as tabelas, inclusive as criadas depois). */
  table: string;
  read?: boolean;
  create?: boolean;
  update?: boolean;
  delete?: boolean;
  scope?: string;
  hiddenFields?: string[];
  readonlyFields?: string[];
  filters?: WsRoleFilter[];
  /** Tira a regra desta tabela (vale a de '*', se houver). */
  removed?: boolean;
}

export interface WsRole {
  key: string;
  existing?: boolean;
  removed?: boolean;
  name: string;
  description?: string;
  color?: string;
  /** Cargo dado a quem entra na empresa sem cargo escolhido. */
  isDefault?: boolean;
  /** Acesso total dentro da empresa (como o Administrador). */
  allAccess?: boolean;
  modules?: Partial<Record<RoleModule, Level>>;
  tables?: WsRoleTable[];
  /** So na tela: cargo do mesmo nivel ou acima de quem mexe (nao da para mudar). */
  locked?: boolean;
  /** So na tela: quantas pessoas tem o cargo. */
  people?: number;
  /** So na tela: cargo padrao do sistema (nao se exclui nem muda de nome). */
  system?: boolean;
}

export interface BaseRole {
  id: string;
  name: string;
  description: string;
  color: string | null;
  isSystem: boolean;
  isDefault: boolean;
  rank: number;
  modulePermissions: Record<string, unknown>;
  permissions: Array<Record<string, unknown>>;
  people: number;
}

export interface RolePlan {
  key: string;
  kind: 'create' | 'update' | 'delete';
  name: string;
  base?: BaseRole;
  /** O que vai para o CustomRoleService (create/update). */
  data?: {
    name: string;
    description?: string;
    color?: string;
    isDefault?: boolean;
    modulePermissions?: Record<string, unknown>;
    permissions?: Array<Record<string, unknown>>;
  };
}

export interface RoleChange { kind: 'create' | 'update' | 'delete'; key: string; name: string; details: string[]; removals?: string[] }

type ModulePerm = Record<string, boolean>;
const COLORS: Record<string, string> = {
  green: '#16a34a', amber: '#d97706', red: '#dc2626', blue: '#2563eb', gray: '#64748b', violet: '#7c3aed', orange: '#ea580c', teal: '#0d9488',
};

/** Nivel de uma parte do sistema a partir das chaves gravadas. */
function levelOf(module: RoleModule, p: unknown): Level {
  const m = (p && typeof p === 'object' ? p : {}) as ModulePerm;
  if (module === 'chat') return m.manage ? 'full' : 'none';
  if (module === 'publicLinks') return m.canManage || m.canUpdate ? 'full' : m.canRead ? 'read' : 'none';
  if (module === 'settings') return m.canUpdate ? 'edit' : m.canRead ? 'read' : 'none';
  if (module === 'archive') return m.canPermanentDelete ? 'full' : m.canRead ? 'read' : 'none';
  if (m.canDelete) return 'full';
  if (m.canCreate || m.canUpdate) return 'edit';
  return m.canRead ? 'read' : 'none';
}

/** Chaves de um nivel, mantendo as acoes avancadas que ja estavam (se ainda cabem). */
function permOf(module: RoleModule, level: Level, previous: unknown): ModulePerm {
  const prev = (previous && typeof previous === 'object' ? previous : {}) as ModulePerm;
  if (module === 'chat') return { manage: level === 'edit' || level === 'full' };
  const read = level !== 'none';
  const write = level === 'edit' || level === 'full';
  const del = level === 'full';
  if (level === 'none') return Object.fromEntries(Object.keys({ canRead: 1, canCreate: 1, canUpdate: 1, canDelete: 1, ...prev }).map((k) => [k, false]));
  const base: ModulePerm = { ...prev, canRead: read, canCreate: write, canUpdate: write, canDelete: del };
  if (module === 'publicLinks') return { ...base, canManage: write, canCreate: write, canUpdate: write, canDelete: write };
  if (module === 'settings') return { ...base, canCreate: false, canDelete: false };
  if (module === 'archive') return { ...base, canCreate: false, canUpdate: false, canDelete: false, canPermanentDelete: del };
  if (module === 'templates') return { ...base, canGenerate: true };
  return base;
}

const hasAll = (mp: Record<string, unknown>) => mp.allAccess === true;

export function roleToDraft(r: BaseRole, actorRank: number): WsRole {
  const mp = r.modulePermissions || {};
  const modules = Object.fromEntries(ROLE_MODULES.map((m) => [m, levelOf(m, mp[m])])) as Record<RoleModule, Level>;
  const tables: WsRoleTable[] = (r.permissions || [])
    .filter((p) => typeof p.entitySlug === 'string')
    .map((p) => {
      const fp = Array.isArray(p.fieldPermissions) ? (p.fieldPermissions as Array<{ fieldSlug: string; canView?: boolean; canEdit?: boolean }>) : [];
      const df = Array.isArray(p.dataFilters) ? (p.dataFilters as Array<{ fieldSlug: string; operator: string; value?: unknown }>) : [];
      return JSON.parse(JSON.stringify({
        table: p.entitySlug,
        read: p.canRead === true, create: p.canCreate === true, update: p.canUpdate === true, delete: p.canDelete === true,
        scope: typeof p.scope === 'string' ? p.scope : 'all',
        hiddenFields: fp.filter((f) => f.canView === false).map((f) => f.fieldSlug),
        readonlyFields: fp.filter((f) => f.canView !== false && f.canEdit === false).map((f) => f.fieldSlug),
        filters: df.map((f) => ({ field: f.fieldSlug, operator: f.operator, ...(f.value !== undefined && f.value !== null ? { value: String(f.value) } : {}) })),
      })) as WsRoleTable;
    });
  return JSON.parse(JSON.stringify({
    key: r.id, existing: true, name: r.name, description: r.description || '', color: r.color || undefined,
    isDefault: r.isDefault, allAccess: hasAll(mp), modules: hasAll(mp) ? undefined : modules, tables,
    locked: r.rank <= actorRank, people: r.people, system: r.isSystem || undefined,
  })) as WsRole;
}

/** Compara sem depender da ordem das chaves (o que foi gravado pela tela tem outra ordem). */
function stable(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable((v as Record<string, unknown>)[k])]));
  return v;
}
const sameJson = (a: unknown, b: unknown) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));

/** Regra de uma tabela: so o que veio muda; o resto da regra (avisos, exportar...) fica. */
function tableEntry(t: Partial<WsRoleTable>, previous: Record<string, unknown> | undefined, table: SchemaTable | undefined, label: string, warnings: string[]) {
  const next: Record<string, unknown> = { ...(previous ?? { entitySlug: t.table, canRead: false, canCreate: false, canUpdate: false, canDelete: false, scope: 'all' }) };
  const flag = (k: 'read' | 'create' | 'update' | 'delete', prop: string) => { if (typeof t[k] === 'boolean') next[prop] = t[k]; };
  flag('read', 'canRead'); flag('create', 'canCreate'); flag('update', 'canUpdate'); flag('delete', 'canDelete');
  // Quem cria, edita ou exclui precisa ver
  if (next.canCreate || next.canUpdate || next.canDelete) next.canRead = true;
  if (t.scope !== undefined) {
    if ((SCOPES as readonly string[]).includes(String(t.scope))) next.scope = t.scope as Scope;
    else warnings.push(`${label}: quais registros vê precisa ser todos, os próprios ou os da equipe.`);
  }
  const fieldOf = (ref: string) => table?.fields.find((f) => f.slug === ref || f.label.toLowerCase() === ref.toLowerCase());
  if (Array.isArray(t.hiddenFields) || Array.isArray(t.readonlyFields)) {
    const prevFp = Array.isArray(previous?.fieldPermissions) ? (previous!.fieldPermissions as Array<{ fieldSlug: string; canView?: boolean; canEdit?: boolean }>) : [];
    const hidden = Array.isArray(t.hiddenFields) ? t.hiddenFields : prevFp.filter((f) => f.canView === false).map((f) => f.fieldSlug);
    const readonly = Array.isArray(t.readonlyFields) ? t.readonlyFields : prevFp.filter((f) => f.canView !== false && f.canEdit === false).map((f) => f.fieldSlug);
    const fp: Array<{ fieldSlug: string; canView: boolean; canEdit: boolean }> = [];
    for (const ref of hidden) {
      const f = table ? fieldOf(String(ref)) : undefined;
      if (table && !f) { warnings.push(`${label}: o campo "${clip(ref, 60)}" não existe.`); continue; }
      fp.push({ fieldSlug: f?.slug ?? String(ref), canView: false, canEdit: false });
    }
    for (const ref of readonly) {
      const f = table ? fieldOf(String(ref)) : undefined;
      if (table && !f) { warnings.push(`${label}: o campo "${clip(ref, 60)}" não existe.`); continue; }
      const slug = f?.slug ?? String(ref);
      if (!fp.some((x) => x.fieldSlug === slug)) fp.push({ fieldSlug: slug, canView: true, canEdit: false });
    }
    if (fp.length) next.fieldPermissions = fp; else delete next.fieldPermissions;
  }
  if (Array.isArray(t.filters)) {
    const df: Array<Record<string, unknown>> = [];
    for (const f of t.filters.slice(0, 10)) {
      const field = table ? fieldOf(String(f?.field ?? '')) : undefined;
      if (!field) { warnings.push(`${label}: o filtro usa um campo que não existe ("${clip(f?.field, 60)}").`); continue; }
      const op = (FILTER_OPERATORS as readonly string[]).includes(String(f.operator)) ? (f.operator as FilterOperator) : null;
      if (!op) { warnings.push(`${label}: filtro de "${field.label}" com condição desconhecida.`); continue; }
      let value = f.value === undefined ? undefined : clip(f.value, 120);
      // Lista de opcoes: aceita o nome da opcao e grava o valor
      const opt = value !== undefined ? field.options.find((o) => o.value === value || o.label.toLowerCase() === value!.toLowerCase()) : undefined;
      if (opt) value = opt.value;
      if (field.type === 'boolean' && value !== undefined) value = /^(true|sim|1)$/i.test(value) ? 'true' : 'false';
      df.push({ fieldSlug: field.slug, fieldName: field.label, fieldType: field.type, operator: op, ...(op === 'isEmpty' || op === 'isNotEmpty' ? {} : { value: value ?? '' }) });
    }
    if (df.length) next.dataFilters = df; else delete next.dataFilters;
  }
  return next;
}

/** Frase do que a regra de uma tabela permite (para a lista de mudancas). */
function describeEntry(e: Record<string, unknown>, table: SchemaTable | undefined): string {
  const can = [e.canRead && 'ver', e.canCreate && 'criar', e.canUpdate && 'editar', e.canDelete && 'excluir'].filter(Boolean).join(', ') || 'nada';
  const name = e.entitySlug === '*' ? 'Todas as tabelas' : table?.namePlural ?? String(e.entitySlug);
  const parts = [`${name}: ${can}`];
  if (e.canRead && e.scope && e.scope !== 'all') parts.push(SCOPE_LABEL[String(e.scope)] ?? String(e.scope));
  const fieldName = (slug: string) => table?.fields.find((f) => f.slug === slug)?.label ?? slug;
  const fp = Array.isArray(e.fieldPermissions) ? (e.fieldPermissions as Array<{ fieldSlug: string; canView: boolean }>) : [];
  const hidden = fp.filter((f) => !f.canView).map((f) => fieldName(f.fieldSlug));
  const ro = fp.filter((f) => f.canView).map((f) => fieldName(f.fieldSlug));
  if (hidden.length) parts.push(`sem ver ${hidden.join(', ')}`);
  if (ro.length) parts.push(`só lê ${ro.join(', ')}`);
  const df = Array.isArray(e.dataFilters) ? (e.dataFilters as Array<{ fieldName: string; operator: FilterOperator; value?: string; fieldSlug: string }>) : [];
  for (const f of df) {
    const opt = table?.fields.find((x) => x.slug === f.fieldSlug)?.options.find((o) => o.value === f.value);
    const shown = f.value === 'true' ? 'Sim' : f.value === 'false' ? 'Não' : opt?.label ?? f.value;
    parts.push(`só quando ${f.fieldName} ${FILTER_LABEL[f.operator] ?? f.operator}${shown !== undefined ? ` "${shown}"` : ''}`);
  }
  return parts.join(' · ');
}

/**
 * Confere os cargos do rascunho contra os que existem e as tabelas (como ficam depois
 * do rascunho). Tabela nova da proposta entra pela chave dela (o nome real vem ao aplicar).
 */
export function normalizeRoles(
  raw: unknown,
  roles: BaseRole[],
  actorRank: number,
  actorAll: boolean,
  schema: SchemaTable[],
  newTableKey: (ref: string) => string,
  takenNames: string[],
) {
  const warnings: string[] = [];
  const plans: RolePlan[] = [];
  const draft: WsRole[] = [];
  const changes: RoleChange[] = [];
  const marks: Record<string, 'new' | 'changed' | 'removed'> = {};
  const byId = new Map(roles.map((r) => [r.id, r]));
  const names = new Set([...roles.map((r) => r.name.toLowerCase()), ...takenNames.map((n) => n.toLowerCase())]);
  const tableOf = (slug: string) => schema.find((t) => t.slug === slug);
  let n = 0;

  for (const r of (Array.isArray(raw) ? raw : []).slice(0, 15) as Partial<WsRole>[]) {
    if (!r) continue;
    const base = r.existing === true ? byId.get(clip(r.key, 60)) : undefined;
    const label = clip(r.name, 60) || base?.name || 'Cargo';
    if (r.existing === true && !base) { warnings.push(`O cargo "${label}" não foi encontrado.`); continue; }
    if (base && plans.some((p) => p.key === base.id)) continue;
    if (base && base.rank <= actorRank) {
      warnings.push(`${base.name}: é um cargo do seu nível ou acima; só quem está acima dele pode mudar.`);
      continue;
    }
    if (base && r.removed === true) {
      if (base.isSystem) { warnings.push(`${base.name}: cargo padrão do sistema não pode ser excluído.`); continue; }
      plans.push({ key: base.id, kind: 'delete', name: base.name, base });
      draft.push({ ...roleToDraft(base, actorRank), removed: true });
      marks[base.id] = 'removed';
      changes.push({
        kind: 'delete', key: base.id, name: base.name,
        details: [base.people ? `${base.people} ${base.people === 1 ? 'pessoa tem' : 'pessoas têm'} este cargo: troque o cargo delas antes, ou a exclusão para aqui` : 'ninguém tem este cargo'],
      });
      continue;
    }
    if (r.removed === true) continue;

    const details: string[] = [];
    const removals: string[] = [];
    // Nome
    let name = label;
    if (base?.isSystem && name !== base.name) {
      warnings.push(`${base.name}: o nome de um cargo padrão do sistema não muda.`);
      name = base.name;
    }
    if (!base || name.toLowerCase() !== base.name.toLowerCase()) {
      const wanted = name;
      for (let i = 2; names.has(name.toLowerCase()); i++) name = `${wanted} (${i})`;
    }
    names.add(name.toLowerCase());
    if (base && name !== base.name) details.push(`nome: "${base.name}" → "${name}"`);
    const description = r.description === undefined ? base?.description ?? '' : clip(r.description, 300);
    if (base && description !== (base.description || '')) details.push('descrição mudou');
    const color = typeof r.color === 'string' ? COLORS[r.color] ?? (/^#[0-9a-f]{6}$/i.test(r.color) ? r.color : undefined) : undefined;

    // Partes do sistema
    const prevMp = (base?.modulePermissions ?? {}) as Record<string, unknown>;
    let mp: Record<string, unknown> = { ...prevMp };
    if (r.allAccess === true && !hasAll(prevMp)) {
      if (!actorAll) warnings.push(`${name}: só quem tem acesso total pode dar acesso total.`);
      else { mp = { allAccess: true }; details.push('acesso total à empresa'); }
    } else if (r.allAccess === false && hasAll(prevMp)) {
      delete mp.allAccess;
      details.push('deixa de ter acesso total');
    }
    if (!hasAll(mp)) {
      for (const m of ROLE_MODULES) {
        const wanted = r.modules?.[m];
        const current = levelOf(m, mp[m]);
        if (wanted === undefined) {
          if (!base) mp[m] = permOf(m, m === 'dashboard' || m === 'data' ? 'read' : 'none', undefined);
          continue;
        }
        if (!LEVELS.includes(wanted)) { warnings.push(`${name} › ${MODULE_LABEL[m]}: nível desconhecido.`); continue; }
        if (wanted === current && base) continue;
        mp[m] = permOf(m, wanted, mp[m]);
        if (base) details.push(`${MODULE_LABEL[m]}: ${LEVEL_LABEL[current]} → ${LEVEL_LABEL[wanted]}`);
      }
    }

    // Tabelas
    const prevPerms = (base?.permissions ?? []).map((p) => ({ ...p }));
    const perms = [...prevPerms];
    for (const t of (Array.isArray(r.tables) ? r.tables : []).slice(0, 60)) {
      if (!t || typeof t.table !== 'string') continue;
      const slug = t.table === '*' ? '*' : newTableKey(clip(t.table, 60));
      const table = slug === '*' ? undefined : tableOf(slug);
      if (slug !== '*' && !table) { warnings.push(`${name}: a tabela "${clip(t.table, 60)}" não foi encontrada.`); continue; }
      const idx = perms.findIndex((p) => p.entitySlug === slug);
      const previous = idx >= 0 ? perms[idx] : undefined;
      const where = `${name} › ${slug === '*' ? 'Todas as tabelas' : table!.namePlural}`;
      if (t.removed === true) {
        if (idx >= 0) {
          perms.splice(idx, 1);
          details.push(`${slug === '*' ? 'Todas as tabelas' : table!.namePlural}: regra própria tirada`);
        }
        continue;
      }
      const entry = tableEntry({ ...t, table: slug }, previous, table, where, warnings);
      if (previous && sameJson(entry, previous)) continue;
      if (idx >= 0) perms[idx] = entry; else perms.push(entry);
      if (base) details.push(describeEntry(entry, table));
    }

    const data = {
      name, description, ...(color ? { color } : {}),
      ...(typeof r.isDefault === 'boolean' ? { isDefault: r.isDefault } : {}),
      modulePermissions: mp,
      permissions: perms,
    };
    if (base && typeof r.isDefault === 'boolean' && r.isDefault !== base.isDefault) details.push(r.isDefault ? 'vira o cargo padrão de quem entra' : 'deixa de ser o cargo padrão');
    if (base && color && color.toLowerCase() !== (base.color || '').toLowerCase()) details.push('cor mudou');

    const after: BaseRole = { ...(base ?? { id: '', isSystem: false, rank: actorRank + 10, people: 0, color: null }), name, description, isDefault: data.isDefault ?? base?.isDefault ?? false, modulePermissions: mp, permissions: perms } as BaseRole;
    const clean = roleToDraft(after, actorRank);
    if (base) {
      if (details.length === 0) continue;
      plans.push({ key: base.id, kind: 'update', name: base.name, base, data });
      marks[base.id] = 'changed';
      changes.push({ kind: 'update', key: base.id, name: base.name, details, ...(removals.length ? { removals } : {}) });
      draft.push({ ...clean, key: base.id, existing: true, locked: false });
    } else {
      const key = clip(r.key, 60) || `cargo-novo-${++n}`;
      plans.push({ key, kind: 'create', name, data });
      marks[key] = 'new';
      changes.push({
        kind: 'create', key, name,
        details: hasAll(mp) ? ['acesso total à empresa'] : [
          ROLE_MODULES.filter((m) => levelOf(m, mp[m]) !== 'none').map((m) => `${MODULE_LABEL[m]}: ${LEVEL_LABEL[levelOf(m, mp[m])]}`).join(', ') || 'sem acesso às partes do sistema',
          ...perms.map((p) => describeEntry(p, p.entitySlug === '*' ? undefined : tableOf(String(p.entitySlug)))),
        ],
      });
      draft.push({ ...clean, key, existing: undefined, locked: undefined, people: undefined });
    }
  }
  return { draft, plans, changes, marks, warnings };
}

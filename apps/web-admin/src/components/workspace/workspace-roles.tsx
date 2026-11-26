'use client';

import { Lock, Plus, ShieldCheck, Trash2, Undo2, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { ROLE_MODULES, type WsLevel, type WsMark, type WsRole, type WsRoleModule, type WsRoleTable } from '@/hooks/use-workspace';
import { ItemShell } from './workspace-parts';

const MODULE_LABEL: Record<WsRoleModule, string> = {
  dashboard: 'Painéis', data: 'Registros', entities: 'Montar tabelas', users: 'Usuários', roles: 'Cargos',
  settings: 'Configurações da empresa', automations: 'Automações', templates: 'Modelos de PDF', logs: 'Histórico de alterações',
  publicLinks: 'Páginas e links públicos', apis: 'Chaves de API', archive: 'Arquivo', chat: 'Gerenciar o chat',
};
const LEVELS: Array<{ value: WsLevel; label: string }> = [
  { value: 'none', label: 'Nada' }, { value: 'read', label: 'Ver' }, { value: 'edit', label: 'Editar' }, { value: 'full', label: 'Tudo' },
];
const SCOPES = [
  { value: 'all', label: 'Todos os registros' }, { value: 'own', label: 'Só os que criou' }, { value: 'team', label: 'Os da equipe' },
];
const OPERATORS = [
  { value: 'equals', label: 'for' }, { value: 'notEquals', label: 'não for' }, { value: 'contains', label: 'contiver' },
  { value: 'gt', label: 'maior que' }, { value: 'lt', label: 'menor que' }, { value: 'isEmpty', label: 'vazio' }, { value: 'isNotEmpty', label: 'preenchido' },
];
const ACTIONS = [['read', 'Ver'], ['create', 'Criar'], ['update', 'Editar'], ['delete', 'Excluir']] as const;
const selectCls = 'h-7 rounded border bg-background px-1.5 text-xs';

export type RoleTableInfo = {
  name: string;
  fields: Array<{ slug: string; label: string; type: string; options: Array<{ value: string; label: string }> }>;
};

/** Cargo no construtor: partes do sistema, regras por tabela, campos e filtros. */
export function RoleItem({ role, mark, open, onToggle, onChange, onRemove, onRestore, canRemove, tables }: {
  role: WsRole;
  mark?: WsMark;
  open: boolean;
  onToggle: () => void;
  onChange: (next: WsRole) => void;
  onRemove: () => void;
  onRestore: () => void;
  canRemove: boolean;
  /** Tabelas (que existem e novas do rascunho), pelo identificador. */
  tables: Record<string, RoleTableInfo>;
}) {
  const removed = mark === 'removed';
  const locked = !!role.locked;
  const rules = (role.tables || []).filter((t) => !t.removed);
  const setRule = (index: number, patch: Partial<WsRoleTable>) =>
    onChange({ ...role, tables: (role.tables || []).map((t, i) => (i === index ? { ...t, ...patch } : t)) });
  const freeTables = Object.keys(tables).filter((slug) => !(role.tables || []).some((t) => t.table === slug && !t.removed));
  const summary = role.allAccess
    ? 'Acesso total à empresa'
    : `${rules.length ? `${rules.length} ${rules.length === 1 ? 'regra de tabela' : 'regras de tabela'}` : 'sem regras por tabela'}`;

  return (
    <ItemShell
      testId={`ws-role-${role.key}`}
      icon={<ShieldCheck className="h-4 w-4 shrink-0 text-primary" />}
      title={role.name}
      subtitle={`${summary}${role.people !== undefined ? ` · ${role.people} ${role.people === 1 ? 'pessoa' : 'pessoas'}` : ''}${role.isDefault ? ' · cargo padrão' : ''}`}
      mark={mark}
      open={open && !removed}
      onToggle={onToggle}
      actions={removed ? (
        <Button size="sm" variant="ghost" className="h-7" onClick={onRestore}><Undo2 className="mr-1 h-3.5 w-3.5" /> Desfazer</Button>
      ) : locked ? (
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground" title="Cargo do seu nível ou acima: só quem está acima dele pode mudar"><Lock className="h-3.5 w-3.5" /> seu nível</span>
      ) : canRemove ? (
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onRemove} aria-label="Excluir cargo" data-testid="ws-role-remove"><Trash2 className="h-3.5 w-3.5" /></Button>
      ) : null}
    >
      <fieldset disabled={locked} className="space-y-3">
        {locked && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" /> Este cargo é do seu nível ou acima: dá para ver, mas só quem está acima dele pode mudar.</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={role.name} onChange={(e) => onChange({ ...role, name: e.target.value })} disabled={role.system} title={role.system ? 'O nome de um cargo padrão do sistema não muda' : undefined} className="h-9 rounded border bg-background px-2 text-sm font-medium disabled:opacity-70" aria-label="Nome do cargo" data-testid="ws-role-name" />
          <input value={role.description ?? ''} onChange={(e) => onChange({ ...role, description: e.target.value })} placeholder="Descrição" className="h-9 rounded border bg-background px-2 text-sm" aria-label="Descrição do cargo" />
        </div>
        <div className="flex flex-wrap gap-4 text-xs">
          <label className="flex items-center gap-2"><Switch checked={!!role.allAccess} onCheckedChange={(v) => onChange({ ...role, allAccess: v })} /> Acesso total à empresa</label>
          <label className="flex items-center gap-2"><Switch checked={!!role.isDefault} onCheckedChange={(v) => onChange({ ...role, isDefault: v })} /> Cargo padrão de quem entra</label>
        </div>

        {!role.allAccess && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Partes do sistema</p>
            <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2" data-testid="ws-role-modules">
              {ROLE_MODULES.map((m) => (
                <label key={m} className="flex items-center justify-between gap-2 text-xs">
                  <span>{MODULE_LABEL[m]}</span>
                  <select
                    className={selectCls}
                    value={role.modules?.[m] ?? 'none'}
                    onChange={(e) => onChange({ ...role, modules: { ...(role.modules || {}), [m]: e.target.value as WsLevel } })}
                    aria-label={MODULE_LABEL[m]}
                    data-testid={`ws-role-module-${m}`}
                  >
                    {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </div>
        )}

        {!role.allAccess && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Por tabela</p>
            {(role.tables || []).map((t, i) => {
              if (t.removed) return null;
              const info = t.table === '*' ? undefined : tables[t.table];
              const fields = info?.fields ?? [];
              const fieldName = (slug: string) => fields.find((f) => f.slug === slug)?.label ?? slug;
              return (
                <div key={`${t.table}-${i}`} className="space-y-2 rounded-lg border p-2" data-testid="ws-role-table">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-sm font-medium">{t.table === '*' ? 'Todas as tabelas' : info?.name ?? t.table}</span>
                    {ACTIONS.map(([k, label]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setRule(i, { [k]: !t[k] })}
                        className={cn('rounded-full border px-2 py-0.5 text-[11px]', t[k] ? 'border-primary bg-primary/10 font-medium text-primary' : 'bg-background text-muted-foreground')}
                        aria-pressed={!!t[k]}
                        data-testid={`ws-role-${k}`}
                      >
                        {label}
                      </button>
                    ))}
                    <select className={cn(selectCls, 'ml-auto')} value={t.scope ?? 'all'} onChange={(e) => setRule(i, { scope: e.target.value })} aria-label="Quais registros vê">
                      {SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      {t.scope === 'client' && <option value="client">Os do cliente dela</option>}
                    </select>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setRule(i, { removed: true })} aria-label="Tirar a regra desta tabela"><X className="h-3.5 w-3.5" /></Button>
                  </div>
                  {info && (
                    <>
                      <FieldChips
                        label="Não vê" values={t.hiddenFields || []} fields={fields} fieldName={fieldName}
                        onChange={(v) => setRule(i, { hiddenFields: v })} testId="ws-role-hidden"
                      />
                      <FieldChips
                        label="Vê mas não muda" values={t.readonlyFields || []} fields={fields} fieldName={fieldName}
                        onChange={(v) => setRule(i, { readonlyFields: v })} testId="ws-role-readonly"
                      />
                      <div className="space-y-1 text-xs">
                        {(t.filters || []).map((f, fi) => {
                          const field = fields.find((x) => x.slug === f.field);
                          const set = (patch: Partial<typeof f>) => setRule(i, { filters: (t.filters || []).map((x, xi) => (xi === fi ? { ...x, ...patch } : x)) });
                          const noValue = f.operator === 'isEmpty' || f.operator === 'isNotEmpty';
                          return (
                            <div key={fi} className="flex flex-wrap items-center gap-1" data-testid="ws-role-filter">
                              <span className="text-muted-foreground">Só vê quando</span>
                              <select className={selectCls} value={f.field} onChange={(e) => set({ field: e.target.value, value: '' })}>
                                {fields.map((x) => <option key={x.slug} value={x.slug}>{x.label}</option>)}
                              </select>
                              <select className={selectCls} value={f.operator} onChange={(e) => set({ operator: e.target.value })}>
                                {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                              {!noValue && (field?.type === 'boolean' ? (
                                <select className={selectCls} value={f.value ?? 'true'} onChange={(e) => set({ value: e.target.value })}>
                                  <option value="true">Sim</option><option value="false">Não</option>
                                </select>
                              ) : field?.options.length ? (
                                <select className={selectCls} value={f.value ?? ''} onChange={(e) => set({ value: e.target.value })}>
                                  <option value="" />
                                  {field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                              ) : (
                                <input className={cn(selectCls, 'w-28')} value={f.value ?? ''} onChange={(e) => set({ value: e.target.value })} placeholder="valor" />
                              ))}
                              <button type="button" onClick={() => setRule(i, { filters: (t.filters || []).filter((_, xi) => xi !== fi) })} aria-label="Tirar filtro">
                                <X className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                            </div>
                          );
                        })}
                        {fields.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setRule(i, { filters: [...(t.filters || []), { field: fields[0].slug, operator: 'equals', value: '' }] })}
                            className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                            data-testid="ws-role-add-filter"
                          >
                            <Plus className="h-3 w-3" /> filtro (só vê alguns registros)
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
            {freeTables.length > 0 && (
              <select
                className={cn(selectCls, 'h-8 w-full border-dashed')}
                value=""
                onChange={(e) => e.target.value && onChange({ ...role, tables: [...(role.tables || []).filter((t) => t.table !== e.target.value), { table: e.target.value, read: true, create: false, update: false, delete: false, scope: 'all' }] })}
                aria-label="Regra para mais uma tabela"
                data-testid="ws-role-add-table"
              >
                <option value="">+ Regra para mais uma tabela…</option>
                {!(role.tables || []).some((t) => t.table === '*' && !t.removed) && <option value="*">Todas as tabelas</option>}
                {freeTables.map((slug) => <option key={slug} value={slug}>{tables[slug].name}</option>)}
              </select>
            )}
          </div>
        )}
        {role.people !== undefined && role.people > 0 && (
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><Users className="h-3 w-3" /> {role.people} {role.people === 1 ? 'pessoa tem' : 'pessoas têm'} este cargo: as mudanças valem para elas logo depois de aplicar.</p>
        )}
      </fieldset>
    </ItemShell>
  );
}

/** Lista de campos escolhidos (chips) com um seletor para acrescentar. */
function FieldChips({ label, values, fields, fieldName, onChange, testId }: {
  label: string;
  values: string[];
  fields: RoleTableInfo['fields'];
  fieldName: (slug: string) => string;
  onChange: (next: string[]) => void;
  testId: string;
}) {
  const free = fields.filter((f) => !values.includes(f.slug));
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs" data-testid={testId}>
      <span className="text-muted-foreground">{label}:</span>
      {values.length === 0 && <span className="text-muted-foreground">nenhum campo</span>}
      {values.map((slug) => (
        <span key={slug} className="inline-flex items-center gap-0.5 rounded-full border bg-background px-2 py-0.5">
          {fieldName(slug)}
          <button type="button" onClick={() => onChange(values.filter((v) => v !== slug))} aria-label={`Tirar ${fieldName(slug)}`}><X className="h-3 w-3 text-muted-foreground" /></button>
        </span>
      ))}
      {free.length > 0 && (
        <select className={cn(selectCls, 'h-6 border-dashed text-[11px]')} value="" onChange={(e) => e.target.value && onChange([...values, e.target.value])} aria-label={`${label}: acrescentar campo`}>
          <option value="">+ campo</option>
          {free.map((f) => <option key={f.slug} value={f.slug}>{f.label}</option>)}
        </select>
      )}
    </div>
  );
}

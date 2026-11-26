'use client';

import { ArrowDown, ArrowUp, Plus, Trash2, Undo2, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { WsAutoAction, WsAutomation, WsMark } from '@/hooks/use-workspace';
import { ItemShell } from './workspace-parts';
import type { RoleTableInfo } from './workspace-roles';

type Field = RoleTableInfo['fields'][number];

const EVENTS = [
  { value: 'created', label: 'um registro for criado' },
  { value: 'updated', label: 'um registro for alterado' },
  { value: 'deleted', label: 'um registro for excluído' },
  { value: 'field_changed', label: 'um campo mudar' },
  { value: 'manual', label: 'alguém clicar no botão' },
];
const OPERATORS = [
  { value: 'equals', label: 'for' }, { value: 'not_equals', label: 'não for' }, { value: 'contains', label: 'contiver' },
  { value: 'gt', label: 'maior que' }, { value: 'lt', label: 'menor que' }, { value: 'is_empty', label: 'vazio' }, { value: 'is_not_empty', label: 'preenchido' },
];
const ACTIONS: Array<{ value: WsAutoAction['type']; label: string }> = [
  { value: 'notify', label: 'Avisar uma pessoa' },
  { value: 'email', label: 'Mandar e-mail' },
  { value: 'set_field', label: 'Preencher um campo' },
  { value: 'webhook', label: 'Enviar para outro sistema' },
];
const SKIP_SET = new Set(['image', 'file', 'signature', 'map', 'zone-diagram', 'json']);
const selectCls = 'h-8 rounded border bg-background px-1.5 text-xs';
const inputCls = 'h-8 w-full rounded border bg-background px-2 text-xs';

/** Valor de um campo: lista de opcoes e Sim/Nao em lista; o resto em texto. */
function ValueInput({ field, value, onChange, dates }: { field?: Field; value: unknown; onChange: (v: unknown) => void; dates?: boolean }) {
  const v = value === undefined || value === null ? '' : String(value);
  if (field?.type === 'boolean') {
    return (
      <select className={selectCls} value={v === 'true' || value === true ? 'true' : 'false'} onChange={(e) => onChange(e.target.value === 'true')}>
        <option value="true">Sim</option><option value="false">Não</option>
      </select>
    );
  }
  if (field && field.options.length) {
    return (
      <select className={selectCls} value={v} onChange={(e) => onChange(e.target.value)}>
        <option value="">Escolha…</option>
        {field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  if (dates && field && ['date', 'datetime'].includes(field.type)) {
    return (
      <select className={selectCls} value={v} onChange={(e) => onChange(e.target.value)}>
        <option value="">Escolha…</option>
        <option value="{{today}}">Data de hoje</option>
        <option value="{{now}}">Data e hora do momento</option>
      </select>
    );
  }
  return <input className={cn(inputCls, 'w-40')} value={v} onChange={(e) => onChange(e.target.value)} placeholder="valor" />;
}

/** "Quando ..., então ..." curto para o cabecalho. */
function sentence(a: WsAutomation, fields: Field[], tableName: string, people: Map<string, string>): string {
  const f = fields.find((x) => x.slug === a.when.field);
  const to = a.when.to === undefined || a.when.to === '' ? '' : ` para "${a.when.to === true ? 'Sim' : a.when.to === false ? 'Não' : f?.options.find((o) => o.value === a.when.to)?.label ?? String(a.when.to)}"`;
  const when = a.when.event === 'field_changed' ? `${f?.label ?? a.when.field} mudar${to}`
    : a.when.event === 'keep' ? 'no gatilho de antes'
    : EVENTS.find((e) => e.value === a.when.event)?.label ?? a.when.event;
  const then = a.actions.map((x) =>
    x.type === 'notify' ? `avisar ${x.person ? people.get(x.person) ?? x.person : 'quem fez'}`
      : x.type === 'email' ? 'mandar e-mail'
      : x.type === 'set_field' ? `preencher ${fields.find((y) => y.slug === x.field)?.label ?? x.field}`
      : x.type === 'webhook' ? 'enviar para outro sistema'
      : 'ação avançada').join(', ');
  return `${tableName}: quando ${when} → ${then || 'nada'}`;
}

/** Automacao no construtor: quando, condicoes e acoes, em frases. */
export function AutomationItem({ automation: a, mark, open, onToggle, onChange, onRemove, onRestore, canRemove, tables, people }: {
  automation: WsAutomation;
  mark?: WsMark;
  open: boolean;
  onToggle: () => void;
  onChange: (next: WsAutomation) => void;
  onRemove: () => void;
  onRestore: () => void;
  canRemove: boolean;
  tables: Record<string, RoleTableInfo>;
  people: Array<{ id: string; name: string }>;
}) {
  const removed = mark === 'removed';
  const table = tables[a.table];
  const fields = table?.fields ?? [];
  const peopleById = new Map(people.map((p) => [p.id, p.name]));
  const setAction = (i: number, patch: Partial<WsAutoAction>) => onChange({ ...a, actions: a.actions.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const moveAction = (from: number, to: number) => {
    if (to < 0 || to >= a.actions.length) return;
    const next = [...a.actions];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    onChange({ ...a, actions: next });
  };
  const fieldOf = (slug?: string) => fields.find((f) => f.slug === slug);

  return (
    <ItemShell
      testId={`ws-automation-${a.key}`}
      icon={<Zap className={cn('h-4 w-4 shrink-0', a.active === false ? 'text-muted-foreground' : 'text-primary')} />}
      title={a.name}
      subtitle={`${a.active === false ? 'Desligada · ' : ''}${sentence(a, fields, table?.name ?? a.table, peopleById)}`}
      mark={mark}
      open={open && !removed}
      onToggle={onToggle}
      actions={removed ? (
        <Button size="sm" variant="ghost" className="h-7" onClick={onRestore}><Undo2 className="mr-1 h-3.5 w-3.5" /> Desfazer</Button>
      ) : canRemove ? (
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onRemove} aria-label="Excluir automação" data-testid="ws-automation-remove"><Trash2 className="h-3.5 w-3.5" /></Button>
      ) : null}
    >
      <div className="space-y-3 text-xs">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input value={a.name} onChange={(e) => onChange({ ...a, name: e.target.value })} className="h-9 rounded border bg-background px-2 text-sm font-medium" aria-label="Nome da automação" />
          <label className="flex items-center gap-2"><Switch checked={a.active !== false} onCheckedChange={(v) => onChange({ ...a, active: v })} /> Ligada</label>
        </div>

        {/* Quando */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-muted/40 p-2" data-testid="ws-automation-when">
          <span className="font-medium">Quando, em</span>
          {a.existing ? (
            <span className="font-medium">{table?.name ?? a.table}</span>
          ) : (
            <select className={selectCls} value={a.table} onChange={(e) => onChange({ ...a, table: e.target.value, when: { event: a.when.event }, conditions: [], actions: a.actions.map((x) => (x.type === 'set_field' ? { ...x, field: undefined, value: undefined } : x)) })} aria-label="Tabela">
              {Object.entries(tables).map(([slug, t]) => <option key={slug} value={slug}>{t.name}</option>)}
            </select>
          )}
          <span>,</span>
          <select className={selectCls} value={a.when.event} onChange={(e) => onChange({ ...a, when: { event: e.target.value, ...(e.target.value === 'field_changed' ? { field: fields[0]?.slug } : {}) } })} aria-label="Quando" data-testid="ws-automation-event">
            {a.when.event === 'keep' && <option value="keep">o gatilho de antes (avançado)</option>}
            {EVENTS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
          {a.when.event === 'field_changed' && (
            <>
              <select className={selectCls} value={a.when.field ?? ''} onChange={(e) => onChange({ ...a, when: { event: 'field_changed', field: e.target.value } })} aria-label="Campo">
                {fields.map((f) => <option key={f.slug} value={f.slug}>{f.label}</option>)}
              </select>
              <span>para</span>
              <ValueInput field={fieldOf(a.when.field)} value={a.when.to ?? ''} onChange={(v) => onChange({ ...a, when: { ...a.when, to: v } })} />
              <span className="text-muted-foreground">(vazio = qualquer valor)</span>
            </>
          )}
        </div>

        {/* Condicoes */}
        <div className="space-y-1">
          {(a.conditions || []).map((c, i) => {
            const set = (patch: Partial<typeof c>) => onChange({ ...a, conditions: (a.conditions || []).map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            const noValue = c.operator === 'is_empty' || c.operator === 'is_not_empty';
            return (
              <div key={i} className="flex flex-wrap items-center gap-1" data-testid="ws-automation-condition">
                <span className="text-muted-foreground">e só se</span>
                <select className={selectCls} value={c.field} onChange={(e) => set({ field: e.target.value, value: '' })}>
                  {fields.map((f) => <option key={f.slug} value={f.slug}>{f.label}</option>)}
                </select>
                <select className={selectCls} value={c.operator} onChange={(e) => set({ operator: e.target.value })}>
                  {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {!noValue && <ValueInput field={fieldOf(c.field)} value={c.value} onChange={(v) => set({ value: v })} />}
                <button type="button" onClick={() => onChange({ ...a, conditions: (a.conditions || []).filter((_, j) => j !== i) })} aria-label="Tirar condição"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
              </div>
            );
          })}
          {fields.length > 0 && (
            <button type="button" className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => onChange({ ...a, conditions: [...(a.conditions || []), { field: fields[0].slug, operator: 'equals', value: '' }] })}>
              <Plus className="h-3 w-3" /> condição (só roda em alguns casos)
            </button>
          )}
        </div>

        {/* Acoes */}
        <div className="space-y-2">
          <p className="font-medium">Então:</p>
          {a.actions.map((x, i) => (
            <div key={i} className="space-y-1.5 rounded-lg border p-2" data-testid="ws-automation-action">
              <div className="flex items-center gap-1">
                <span className="w-5 text-muted-foreground">{i + 1}.</span>
                {x.type === 'keep' ? (
                  <span className="flex-1 text-muted-foreground">Ação avançada (mexa no editor da tabela)</span>
                ) : (
                  <select className={cn(selectCls, 'flex-1')} value={x.type} onChange={(e) => setAction(i, { type: e.target.value as WsAutoAction['type'] })} aria-label="O que fazer">
                    {ACTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                )}
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === 0} onClick={() => moveAction(i, i - 1)} aria-label="Subir"><ArrowUp className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === a.actions.length - 1} onClick={() => moveAction(i, i + 1)} aria-label="Descer"><ArrowDown className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onChange({ ...a, actions: a.actions.filter((_, j) => j !== i) })} aria-label="Tirar ação"><X className="h-3.5 w-3.5" /></Button>
              </div>
              {x.type === 'notify' && (
                <div className="grid gap-1.5 pl-6 sm:grid-cols-2">
                  <select className={selectCls} value={peopleById.has(x.person ?? '') ? x.person : ''} onChange={(e) => setAction(i, { person: e.target.value })} aria-label="Quem recebe" data-testid="ws-automation-person">
                    <option value="">Quem fez a alteração</option>
                    {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input className={inputCls} value={x.title ?? ''} onChange={(e) => setAction(i, { title: e.target.value })} placeholder="Título do aviso" />
                  <input className={cn(inputCls, 'sm:col-span-2')} value={x.message ?? ''} onChange={(e) => setAction(i, { message: e.target.value })} placeholder="Mensagem (use {{record.campo}} para valores do registro)" />
                  {x.person && !peopleById.has(x.person) && <p className="text-amber-700 sm:col-span-2">&quot;{x.person}&quot; não está na equipe: escolha a pessoa.</p>}
                </div>
              )}
              {x.type === 'email' && (
                <div className="grid gap-1.5 pl-6">
                  <input className={inputCls} value={x.to ?? ''} onChange={(e) => setAction(i, { to: e.target.value })} placeholder="Para: e-mail ou {{record.email}}" />
                  <input className={inputCls} value={x.subject ?? ''} onChange={(e) => setAction(i, { subject: e.target.value })} placeholder="Assunto" />
                  <textarea className="w-full rounded border bg-background px-2 py-1 text-xs" rows={3} value={x.body ?? ''} onChange={(e) => setAction(i, { body: e.target.value })} placeholder="Texto do e-mail" />
                </div>
              )}
              {x.type === 'set_field' && (
                <div className="flex flex-wrap items-center gap-1.5 pl-6">
                  <select className={selectCls} value={x.field ?? ''} onChange={(e) => setAction(i, { field: e.target.value, value: '' })} aria-label="Campo a preencher">
                    <option value="">Campo…</option>
                    {fields.filter((f) => !SKIP_SET.has(f.type)).map((f) => <option key={f.slug} value={f.slug}>{f.label}</option>)}
                  </select>
                  <span>com</span>
                  <ValueInput field={fieldOf(x.field)} value={x.value} onChange={(v) => setAction(i, { value: v })} dates />
                </div>
              )}
              {x.type === 'webhook' && (
                <div className="pl-6">
                  <input className={inputCls} value={x.url ?? ''} onChange={(e) => setAction(i, { url: e.target.value })} placeholder="https://… (o outro sistema recebe os dados do registro)" />
                </div>
              )}
            </div>
          ))}
          <button type="button" className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => onChange({ ...a, actions: [...a.actions, { type: 'notify', person: '', message: '' }] })} data-testid="ws-automation-add-action">
            <Plus className="h-3 w-3" /> ação
          </button>
        </div>
      </div>
    </ItemShell>
  );
}

'use client';

import { useState } from 'react';
import { CalendarClock, Filter, Loader2, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataFilterAdder } from '@/components/roles/role-form-dialog';
import { entitiesService } from '@/services/entities.service';
import { getErrorMessage } from '@/lib/get-error-message';
import { api } from '@/lib/api';
import { OptionBadge } from '@/components/ui/option-badge';
import { withoutSystemFields } from '@/lib/system-fields';
import { cn } from '@/lib/utils';
import type { DataFilter, Entity, EntityField } from '@/types';

const OPERATOR_LABELS: Record<string, string> = {
  contains: 'contém', equals: 'igual a', notEquals: 'diferente de', startsWith: 'começa com',
  endsWith: 'termina com', isEmpty: 'está vazio', isNotEmpty: 'não está vazio',
  gt: 'maior que', gte: 'maior ou igual', lt: 'menor que', lte: 'menor ou igual', between: 'entre',
};

function describeFilter(f: DataFilter): string {
  const op = OPERATOR_LABELS[f.operator] ?? f.operator;
  if (f.operator === 'isEmpty' || f.operator === 'isNotEmpty') return `${f.fieldName} ${op}`;
  const value = typeof f.value === 'boolean' ? (f.value ? 'Sim' : 'Não') : String(f.value ?? '');
  return f.operator === 'between'
    ? `${f.fieldName} ${op} ${value} e ${String(f.value2 ?? '')}`
    : `${f.fieldName} ${op} ${value}`;
}

/**
 * Filtro global da tabela: vale para TODO MUNDO (web, API e app), antes dos
 * filtros de cada cargo. Registros fora do filtro somem das listas.
 */
export function GlobalFiltersPanel({ entity, onSaved }: { entity: Entity; onSaved: (e: Entity) => void }) {
  const initial = ((entity.settings as Record<string, unknown> | undefined)?.globalFilters ?? []) as DataFilter[];
  const [filters, setFilters] = useState<DataFilter[]>(initial);
  const [saving, setSaving] = useState(false);
  const fields = ((entity.fields ?? []) as EntityField[]).filter((f) => !['sub-entity', 'section-title'].includes(f.type));
  const dirty = JSON.stringify(filters) !== JSON.stringify(initial);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await entitiesService.updateGlobalFilters(entity.id, filters);
      onSaved(updated);
      toast.success('Filtro global salvo');
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card data-testid="global-filters">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Filter className="h-4 w-4" /> Filtro global</CardTitle>
        <CardDescription>
          Vale para todas as pessoas da empresa, no web e no app: só os registros que passam em <b>todos</b> os filtros
          aparecem. Use para esconder, por exemplo, registros cancelados. Para restringir por cargo, use os filtros
          de dados em Cargos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {filters.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum filtro: todos os registros aparecem.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {filters.map((f, i) => (
              <Badge key={`${f.fieldSlug}-${i}`} variant="secondary" className="gap-1 py-1 text-sm" data-testid="global-filter-chip">
                {describeFilter(f)}
                <button type="button" aria-label="Remover filtro" onClick={() => setFilters((prev) => prev.filter((_, j) => j !== i))}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <DataFilterAdder fields={fields} onAdd={(f) => setFilters((prev) => [...prev, f])} />
        <div className="flex justify-end">
          <Button onClick={save} disabled={!dirty || saving} data-testid="global-filters-save">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar filtro
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Excluir a tabela: pede o nome para confirmar (os registros vão junto). */
export function DeleteEntityPanel({ entity, onDelete }: { entity: Entity; onDelete: () => Promise<void> }) {
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const matches = typed.trim().toLowerCase() === entity.name.trim().toLowerCase();

  const run = async () => {
    setDeleting(true);
    try {
      await onDelete();
    } catch (e) {
      toast.error(getErrorMessage(e));
      setDeleting(false);
    }
  };

  return (
    <Card className="border-destructive/50" data-testid="entity-delete">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-destructive"><Trash2 className="h-4 w-4" /> Excluir tabela</CardTitle>
        <CardDescription>
          A tabela some do sistema para todos, junto com os registros dela. Baixe os dados antes (Exportar ou
          Administração › Dados e privacidade).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="confirm-entity-name">Digite o nome da tabela ({entity.name}) para confirmar</Label>
          <Input id="confirm-entity-name" value={typed} onChange={(e) => setTyped(e.target.value)} data-testid="entity-delete-name" />
        </div>
        <Button variant="destructive" disabled={!matches || deleting} onClick={run} data-testid="entity-delete-confirm">
          {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Excluir tabela
        </Button>
      </CardContent>
    </Card>
  );
}

type TableSettings = {
  titleField?: string;
  statusField?: string;
  doneValues?: string[];
  deadlineField?: string;
  assigneeField?: string;
};

type FieldOption = { value: string; label: string; color?: string };

const toOptions = (f?: EntityField): FieldOption[] =>
  ((f?.options || []) as Array<string | FieldOption>).map((o) => (typeof o === 'string' ? { value: o, label: o } : o));

function SettingSelect({
  label, hint, value, onChange, fields, emptyLabel, testId,
}: {
  label: string; hint: string; value?: string; onChange: (v?: string) => void;
  fields: EntityField[]; emptyLabel: string; testId: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <select
        className="h-9 w-full rounded-md border bg-background px-2 text-sm"
        value={value || ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        data-testid={testId}
      >
        <option value="">{emptyLabel}</option>
        {fields.map((f) => <option key={f.slug} value={f.slug}>{f.label || f.name}</option>)}
      </select>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/**
 * Ajustes da tabela em linguagem simples: qual campo da nome ao registro, qual e
 * a situacao (e quais opcoes encerram), o prazo e o responsavel. Com isso a tela
 * inicial mostra "Minhas pendencias" e as listas ficam mais claras.
 */
export function TableSettingsPanel({ entity, onSaved }: { entity: Entity; onSaved: (e: Entity) => void }) {
  const current = (entity.settings || {}) as TableSettings & Record<string, unknown>;
  const initial: TableSettings = {
    titleField: current.titleField,
    statusField: current.statusField,
    doneValues: current.doneValues || [],
    deadlineField: current.deadlineField,
    assigneeField: current.assigneeField,
  };
  const [cfg, setCfg] = useState<TableSettings>(initial);
  const [saving, setSaving] = useState(false);
  const fields = withoutSystemFields((entity.fields ?? []) as EntityField[]);
  const dirty = JSON.stringify(cfg) !== JSON.stringify(initial);

  const titleFields = fields.filter((f) => ['text', 'email', 'phone', 'number', 'cpf', 'cnpj'].includes(f.type));
  const statusFields = fields.filter((f) => ['select', 'radio-group'].includes(f.type));
  const dateFields = fields.filter((f) => ['date', 'datetime'].includes(f.type));
  const personFields = fields.filter((f) => f.type === 'user-select');
  const statusOptions = toOptions(fields.find((f) => f.slug === cfg.statusField));
  const set = (patch: Partial<TableSettings>) => setCfg((prev) => ({ ...prev, ...patch }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.patch<Entity>(`/entities/${entity.id}`, { settings: { ...current, ...cfg } });
      onSaved(res.data);
      toast.success('Ajustes salvos');
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="table-settings">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><SlidersHorizontal className="h-4 w-4" /> Como mostrar os registros</CardTitle>
          <CardDescription>Ajuda a equipe a reconhecer cada registro nas listas, na tela inicial e no painel lateral.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <SettingSelect
            label="Nome do registro"
            hint="O que identifica o registro. Ex.: nome do cliente, placa, número da OS."
            value={cfg.titleField}
            onChange={(v) => set({ titleField: v })}
            fields={titleFields}
            emptyLabel="Automático (primeiro campo de texto)"
            testId="setting-title-field"
          />
          <SettingSelect
            label="Situação"
            hint="Lista que diz em que pé está. Ex.: Aberta, Em andamento, Concluída."
            value={cfg.statusField}
            onChange={(v) => set({ statusField: v, doneValues: [] })}
            fields={statusFields}
            emptyLabel={statusFields.length ? 'Nenhuma' : 'Crie antes um campo "Lista de opções"'}
            testId="setting-status-field"
          />
          {cfg.statusField && (
            <div className="space-y-2 md:col-span-2">
              <Label>Quais situações encerram o registro?</Label>
              <p className="text-xs text-muted-foreground">Registros nessas situações saem das pendências. Ex.: Concluída, Cancelada.</p>
              <div className="flex flex-wrap gap-2" data-testid="setting-done-values">
                {statusOptions.map((o) => {
                  const on = (cfg.doneValues || []).includes(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set({ doneValues: on ? (cfg.doneValues || []).filter((v) => v !== o.value) : [...(cfg.doneValues || []), o.value] })}
                      className={cn('rounded-full border p-0.5 pr-2.5 text-xs transition-colors', on ? 'border-primary bg-nav-active' : 'hover:bg-muted')}
                    >
                      <span className="flex items-center gap-1.5">
                        <OptionBadge label={o.label} color={o.color ?? null} />
                        {on ? 'encerra' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4" /> Prazos e pendências</CardTitle>
          <CardDescription>
            Com um prazo, a tela inicial de cada pessoa mostra o que está atrasado, vence hoje ou está chegando.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <SettingSelect
            label="Prazo"
            hint="Data limite do registro. Ex.: data agendada, vencimento."
            value={cfg.deadlineField}
            onChange={(v) => set({ deadlineField: v })}
            fields={dateFields}
            emptyLabel={dateFields.length ? 'Sem prazo' : 'Crie antes um campo "Data"'}
            testId="setting-deadline-field"
          />
          <SettingSelect
            label="Responsável"
            hint="Se escolher, cada pessoa vê só as pendências em que ela é a responsável."
            value={cfg.assigneeField}
            onChange={(v) => set({ assigneeField: v })}
            fields={personFields}
            emptyLabel={personFields.length ? 'Todos que veem a tabela' : 'Todos (crie um campo "Pessoa da equipe" para separar)'}
            testId="setting-assignee-field"
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={!dirty || saving} data-testid="table-settings-save">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar ajustes
        </Button>
      </div>
    </div>
  );
}

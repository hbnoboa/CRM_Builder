'use client';

import { useState } from 'react';
import { Filter, Loader2, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataFilterAdder } from '@/components/roles/role-form-dialog';
import { entitiesService } from '@/services/entities.service';
import { getErrorMessage } from '@/lib/get-error-message';
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

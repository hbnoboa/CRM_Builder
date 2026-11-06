'use client';

import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { EntityField } from '@crm-builder/shared';

type Condition = { field: string; operator: string; value: unknown };
type Option = { value: string; label: string };

const NUMERIC = new Set(['number', 'currency', 'percentage', 'slider', 'rating']);
const CHOICE = new Set(['select', 'radio-group', 'boolean']);
const MULTI = new Set(['multiselect', 'checkbox-group', 'tags']);
/** Campos que nao servem de referencia para uma regra. */
const SKIP = new Set(['section-title', 'sub-entity', 'zone-diagram', 'image', 'file', 'signature', 'json', 'map', 'action-button', 'timer', 'sla-status']);

const optionsOf = (f?: EntityField): Option[] =>
  f?.type === 'boolean'
    ? [{ value: 'true', label: 'Sim' }, { value: 'false', label: 'Não' }]
    : ((f?.options || []) as Array<string | Option>).map((o) => (typeof o === 'string' ? { value: o, label: o } : o));

function operatorsFor(f?: EntityField): Option[] {
  const filled = [{ value: 'is_not_empty', label: 'estiver preenchido' }, { value: 'is_empty', label: 'estiver vazio' }];
  if (!f) return filled;
  if (CHOICE.has(f.type)) return [{ value: 'equals', label: 'for' }, { value: 'not_equals', label: 'não for' }, ...filled];
  if (NUMERIC.has(f.type)) return [
    { value: 'gt', label: 'for maior que' }, { value: 'lt', label: 'for menor que' },
    { value: 'equals', label: 'for igual a' }, ...filled,
  ];
  if (MULTI.has(f.type)) return filled;
  return [{ value: 'equals', label: 'for igual a' }, { value: 'contains', label: 'contiver' }, ...filled];
}

/** Valor com o tipo certo (o formulario compara com ===: Sim/Nao vira booleano, numero vira numero). */
function typedValue(f: EntityField | undefined, raw: string): unknown {
  if (f?.type === 'boolean') return raw === 'true';
  if (f && NUMERIC.has(f.type)) return raw === '' ? '' : Number(raw);
  return raw;
}

const selectCls = 'h-8 w-full rounded-md border bg-background px-2 text-xs';

/**
 * Uma regra em forma de frase: "<titulo> quando [campo] [for] [valor]".
 * Liga/desliga num interruptor; grava { field, operator, value } como o formulario espera.
 */
function ConditionRow({
  title, hint, value, onChange, fields, testId,
}: {
  title: string;
  hint: string;
  value?: Condition;
  onChange: (c: Condition | undefined) => void;
  fields: EntityField[];
  testId: string;
}) {
  const on = !!value;
  const ref = fields.find((f) => f.slug === value?.field);
  const ops = operatorsFor(ref);
  const needsValue = value && !['is_empty', 'is_not_empty'].includes(value.operator);
  const opts = optionsOf(ref);

  const pickField = (slug: string) => {
    const f = fields.find((x) => x.slug === slug);
    const op = operatorsFor(f)[0].value;
    const first = optionsOf(f)[0]?.value;
    onChange({ field: slug, operator: op, value: first !== undefined && CHOICE.has(f?.type || '') ? typedValue(f, first) : '' });
  };

  return (
    <div className="space-y-2 rounded-lg border p-3" data-testid={testId}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <Label>{title}</Label>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <Switch
          checked={on}
          disabled={fields.length === 0}
          onCheckedChange={(v) => (v && fields[0] ? pickField(fields[0].slug) : onChange(undefined))}
        />
      </div>
      {on && value && (
        <div className="grid gap-1.5 text-xs">
          <span className="text-muted-foreground">quando o campo</span>
          <select className={selectCls} value={value.field} onChange={(e) => pickField(e.target.value)}>
            {fields.map((f) => <option key={f.slug} value={f.slug}>{f.label || f.name}</option>)}
          </select>
          <select className={selectCls} value={value.operator} onChange={(e) => onChange({ ...value, operator: e.target.value })}>
            {ops.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {needsValue && (opts.length > 0 && CHOICE.has(ref?.type || '') ? (
            <select className={selectCls} value={String(value.value ?? '')} onChange={(e) => onChange({ ...value, value: typedValue(ref, e.target.value) })}>
              {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <Input
              className="h-8 text-xs"
              type={ref && NUMERIC.has(ref.type) ? 'number' : 'text'}
              value={String(value.value ?? '')}
              placeholder="valor"
              onChange={(e) => onChange({ ...value, value: typedValue(ref, e.target.value) })}
            />
          ))}
        </div>
      )}
      {fields.length === 0 && <p className="text-xs text-muted-foreground">Crie outro campo antes (ex.: uma lista de opções).</p>}
    </div>
  );
}

/** As tres regras do campo (mostrar, obrigatorio, travar) sem JSON. */
export function FieldConditionsEditor({
  field, allFields, onChange,
}: {
  field: EntityField;
  allFields: EntityField[];
  onChange: (patch: Partial<EntityField>) => void;
}) {
  const refs = allFields.filter((f) => f.slug !== field.slug && !SKIP.has(f.type) && !['createdAt', 'updatedAt'].includes(f.slug));
  return (
    <div className="space-y-2">
      <ConditionRow
        title="Mostrar só em alguns casos"
        hint="Ex.: mostrar “CNPJ” só quando o Tipo for Empresa."
        value={field.visibleIf as Condition | undefined}
        onChange={(c) => onChange({ visibleIf: c as EntityField['visibleIf'] })}
        fields={refs}
        testId="rule-visible"
      />
      {!field.required && (
        <ConditionRow
          title="Obrigatório só em alguns casos"
          hint="Ex.: “Motivo” obrigatório quando a Situação for Cancelada."
          value={field.requiredIf as Condition | undefined}
          onChange={(c) => onChange({ requiredIf: c as EntityField['requiredIf'] })}
          fields={refs}
          testId="rule-required"
        />
      )}
      <ConditionRow
        title="Travar em alguns casos"
        hint="A pessoa vê mas não muda. Ex.: travar o valor quando a OS for Concluída."
        value={field.readOnlyIf as Condition | undefined}
        onChange={(c) => onChange({ readOnlyIf: c as EntityField['readOnlyIf'] })}
        fields={refs}
        testId="rule-readonly"
      />
    </div>
  );
}

/** Frase curta da regra, para lembrar o que esta ligado. */
export function describeCondition(c: Condition | undefined, fields: EntityField[]): string | null {
  if (!c) return null;
  const f = fields.find((x) => x.slug === c.field);
  const op = operatorsFor(f).find((o) => o.value === c.operator)?.label ?? c.operator;
  const val = ['is_empty', 'is_not_empty'].includes(c.operator)
    ? ''
    : ` ${optionsOf(f).find((o) => o.value === String(c.value))?.label ?? String(c.value ?? '')}`;
  return `${f?.label || f?.name || c.field} ${op}${val}`;
}

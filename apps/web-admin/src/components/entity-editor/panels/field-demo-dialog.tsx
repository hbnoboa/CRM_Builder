'use client';

import { useMemo } from 'react';
import { Info, MousePointerClick } from 'lucide-react';
import { formatFieldValue } from '@crm-builder/shared';
import type { Entity, FieldType } from '@crm-builder/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { OptionBadge } from '@/components/ui/option-badge';
import { RecordFormFields } from '@/components/data/record-form-dialog';
import { fieldKind } from '@/lib/field-catalog';
import { fieldDemo } from '@/lib/field-demo';
import { cn } from '@/lib/utils';

type Option = { value: string; label: string; color?: string };

/** Como o valor de exemplo aparece na coluna da lista de registros. */
function ListValue({ type, sample, options }: { type: string; sample: unknown; options?: Option[] }) {
  if (sample === null || sample === undefined) return <span className="text-muted-foreground">—</span>;
  const opt = (v: unknown) => options?.find((o) => o.value === v);
  if ((type === 'select' || type === 'radio-group') && opt(sample)) {
    const o = opt(sample)!;
    return <OptionBadge label={o.label} color={o.color ?? null} />;
  }
  if (Array.isArray(sample)) {
    return (
      <span className="flex flex-wrap gap-1">
        {sample.map((v) => <OptionBadge key={String(v)} label={opt(v)?.label ?? String(v)} color={opt(v)?.color ?? null} />)}
      </span>
    );
  }
  if (type === 'color') {
    return <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: String(sample) }} />{String(sample)}</span>;
  }
  if (type === 'rating') return <span>{'★'.repeat(Number(sample))}{'☆'.repeat(5 - Number(sample))}</span>;
  let text: string;
  try {
    text = formatFieldValue(sample, { type: type as FieldType });
  } catch {
    text = String(sample);
  }
  return <span>{text}</span>;
}

/**
 * "?" do seletor de tipos: mostra o campo REAL do formulario de registros, para a
 * pessoa testar (digitar, escolher, marcar), e como o valor aparece na lista.
 */
export function FieldDemoDialog({
  type, open, onOpenChange, onUse,
}: {
  type: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUse?: (type: string) => void;
}) {
  const kind = type ? fieldKind(type) : null;
  const demo = useMemo(() => (type ? fieldDemo(type) : null), [type]);
  const entity = useMemo(
    () => (demo ? ({ id: 'demo', slug: '__demo__', name: 'Exemplo', tenantId: '', fields: [demo.field], settings: {} } as unknown as Entity) : null),
    [demo],
  );
  if (!kind || !demo || !entity) return null;
  const Icon = kind.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto" data-testid="field-demo">
        <DialogTitle className="flex items-center gap-2 text-lg">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-nav-active text-nav-active-foreground"><Icon className="h-4 w-4" /></span>
          {kind.label}
        </DialogTitle>
        <DialogDescription>{kind.description} Ex.: {kind.example}.</DialogDescription>

        <section className="space-y-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <MousePointerClick className="h-4 w-4 text-primary" />
            {demo.interactive ? 'Experimente: é assim no formulário do registro' : 'É assim no formulário do registro'}
          </p>
          <div className={cn('rounded-lg border bg-card p-4', !demo.interactive && 'pointer-events-none select-none opacity-90')} data-testid="field-demo-form">
            <RecordFormFields key={type} entity={entity} hideFooter />
          </div>
          {demo.note && (
            <p className="flex gap-2 rounded-md bg-muted/60 p-2.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {demo.note}
            </p>
          )}
        </section>

        {type !== 'section-title' && (
          <section className="space-y-2">
            <p className="text-sm font-semibold">Exemplo: na lista de registros aparece assim</p>
            <div className="overflow-hidden rounded-lg border text-sm" data-testid="field-demo-list">
              <div className="grid grid-cols-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                <span>Nº da OS</span><span>{demo.field.label}</span>
              </div>
              <div className="grid grid-cols-2 items-center px-3 py-2.5">
                <span className="font-medium text-primary">OS-1024</span>
                <ListValue type={demo.field.type} sample={demo.sample} options={demo.field.options as Option[] | undefined} />
              </div>
            </div>
          </section>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Voltar</Button>
          {onUse && (
            <Button onClick={() => { onUse(type!); onOpenChange(false); }} data-testid="field-demo-use">
              Usar este tipo
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

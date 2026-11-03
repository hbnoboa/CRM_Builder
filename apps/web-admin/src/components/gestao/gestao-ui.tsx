'use client';

import type { ReactNode } from 'react';

/** Cabecalho padrao das telas da administracao da empresa. */
export function GestaoPageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground md:text-base">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Barra de uso x limite do plano. */
export function UsageMeter({ label, used, limit, unit, unlimited }: {
  label: string;
  used: number;
  limit?: number | null;
  unit?: string;
  unlimited: string;
}) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {used.toLocaleString()}
        {unit && <span className="text-base font-medium"> {unit}</span>}
        <span className="text-sm font-normal text-muted-foreground">
          {' / '}{limit == null ? unlimited : `${limit.toLocaleString()}${unit ? ` ${unit}` : ''}`}
        </span>
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        {limit != null && (
          <div
            className={pct >= 90 ? 'h-full bg-destructive' : pct >= 75 ? 'h-full bg-amber-500' : 'h-full bg-primary'}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  );
}

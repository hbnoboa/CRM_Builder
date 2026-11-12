'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import type { TenantLifecycle } from '@/types/platform';

const LIFECYCLE_VARIANT: Record<TenantLifecycle, 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'> = {
  TRIAL: 'secondary',
  ACTIVE: 'success',
  PAST_DUE: 'warning',
  SUSPENDED: 'destructive',
  CANCELED: 'outline',
};

export function LifecycleBadge({ lifecycle }: { lifecycle: TenantLifecycle }) {
  const t = useTranslations('platform.lifecycle');
  return (
    <Badge variant={LIFECYCLE_VARIANT[lifecycle]} data-testid={`lifecycle-${lifecycle}`}>
      {t(lifecycle)}
    </Badge>
  );
}

/** Data curta no idioma da tela; "—" quando vazia. */
export function useFormatDate() {
  const locale = useLocale();
  return (value: string | Date | null | undefined, withTime = false) => {
    if (!value) return '—';
    const date = typeof value === 'string' ? new Date(value) : value;
    return date.toLocaleString(locale, withTime
      ? { dateStyle: 'short', timeStyle: 'short' }
      : { dateStyle: 'short' });
  };
}

/** "120 / 500" ou "120 / ∞" quando o plano nao limita. */
export function UsageLine({ used, limit }: { used: number; limit?: number | null }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="text-sm tabular-nums">
        {used.toLocaleString()} / {limit == null ? '∞' : limit.toLocaleString()}
      </div>
      {limit != null && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={pct >= 90 ? 'h-full bg-destructive' : pct >= 75 ? 'h-full bg-amber-500' : 'h-full bg-primary'}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground md:text-base">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

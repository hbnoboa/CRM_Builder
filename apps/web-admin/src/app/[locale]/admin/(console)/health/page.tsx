'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/platform/platform-ui';
import { platformApi } from '@/lib/platform-api';
import { cn } from '@/lib/utils';

type Status = 'ok' | 'warning' | 'down' | 'off';

interface Health {
  checkedAt: string;
  status: Status;
  app: { status: Status; version: string | null; environment: string; scope: string; node: string; uptimeSec: number; memoryMb: { rss: number; heapUsed: number }; eventLoopLagP99Ms: number };
  components: Record<string, { status: Status; [k: string]: unknown }>;
  problems: {
    status: Status; errors24h: number; automationFailed24h: number; webhookFailed24h: number;
    errorsByHour: Array<{ hour: string; count: number }>;
    errors: Array<{ at: string; status: number; method: string; path: string; message: string }>;
    slowQueries: Array<{ at: string; ms: number; query: string }>;
  };
}

const DOT: Record<Status, string> = { ok: 'bg-emerald-500', warning: 'bg-amber-500', down: 'bg-red-500', off: 'bg-muted-foreground/40' };

function StatusPill({ status }: { status: Status }) {
  const t = useTranslations('health.status');
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium" data-testid={`status-${status}`}>
      <span className={cn('h-2 w-2 rounded-full', DOT[status])} aria-hidden />{t(status)}
    </span>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium tabular-nums">{value ?? '—'}</span>
    </div>
  );
}

function duration(sec: number) {
  const d = Math.floor(sec / 86400); const h = Math.floor((sec % 86400) / 3600); const m = Math.floor((sec % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}min` : `${m}min`;
}

export default function HealthPage() {
  const t = useTranslations('health');
  const locale = useLocale();
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['platform', 'health'],
    queryFn: async () => (await platformApi.get<Health>('/health')).data,
    refetchInterval: 30_000,
  });
  const when = (iso: string) => new Date(iso).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'medium' });

  if (isLoading || !data) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64" /></div>;
  const c = data.components;
  const db = c.database as Record<string, unknown> & { migrations?: { applied: number; failed: number; last: string | null } };
  const queues = (c.queues as { list?: Array<{ name: string; status: Status; waiting?: number; active?: number; failed?: number; delayed?: number; error?: string }> }).list ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('checkedAt', { when: when(data.checkedAt) })}
        actions={<Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} data-testid="health-refresh"><RefreshCw className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')} /> {t('refresh')}</Button>}
      />

      <Card data-testid="health-overall">
        <CardContent className="flex items-center gap-3 p-4">
          <span className={cn('h-3 w-3 rounded-full', DOT[data.status])} aria-hidden />
          <span className="font-semibold">{t(`overall.${data.status}`)}</span>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="health-components">
        <Card data-testid="health-database">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-base">{t('c.database')}</CardTitle><StatusPill status={c.database.status} /></CardHeader>
          <CardContent className="space-y-1">
            {db.error ? <p className="text-sm text-destructive">{String(db.error)}</p> : <>
              <Row label={t('latency')} value={`${db.latencyMs} ms`} />
              <Row label={t('size')} value={`${db.sizeMb} MB`} />
              <Row label={t('connections')} value={String(db.connections)} />
              <Row label={t('longestQuery')} value={db.longestQuerySec == null ? '—' : `${db.longestQuerySec}s`} />
              <Row label={t('migrations')} value={db.migrations ? `${db.migrations.applied}${db.migrations.failed ? ` · ${t('failedMigrations', { n: db.migrations.failed })}` : ''}` : '—'} />
              <Row label={t('lastMigration')} value={<span className="break-all text-xs">{db.migrations?.last ?? '—'}</span>} />
              <Row label={t('visibilityBacklog')} value={String(db.visibilityBacklog)} />
            </>}
          </CardContent>
        </Card>

        <Card data-testid="health-redis">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-base">Redis</CardTitle><StatusPill status={c.redis.status} /></CardHeader>
          <CardContent className="space-y-1">
            {c.redis.error ? <p className="text-sm text-destructive">{String(c.redis.error)}</p> : <>
              <Row label={t('latency')} value={`${c.redis.latencyMs} ms`} />
              <Row label={t('memory')} value={String(c.redis.memory ?? '—')} />
            </>}
          </CardContent>
        </Card>

        <Card data-testid="health-queues">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-base">{t('c.queues')}</CardTitle><StatusPill status={c.queues.status} /></CardHeader>
          <CardContent className="space-y-2">
            {queues.map((q) => (
              <div key={q.name} className="text-sm">
                <p className="flex items-center justify-between font-medium">{t(`queue.${q.name}`)} <StatusPill status={q.status} /></p>
                {q.error ? <p className="text-xs text-destructive">{q.error}</p> : (
                  <p className="text-xs text-muted-foreground tabular-nums">{t('queueCounts', { waiting: q.waiting ?? 0, active: q.active ?? 0, failed: q.failed ?? 0 })}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card data-testid="health-app">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-base">API</CardTitle><StatusPill status={data.app.status} /></CardHeader>
          <CardContent className="space-y-1">
            <Row label={t('version')} value={data.app.version ?? '—'} />
            <Row label={t('environment')} value={`${data.app.environment} · ${data.app.scope}`} />
            <Row label={t('uptime')} value={duration(data.app.uptimeSec)} />
            <Row label={t('memory')} value={`${data.app.memoryMb.rss} MB`} />
            <Row label={t('eventLoop')} value={`${data.app.eventLoopLagP99Ms} ms`} />
            <Row label="Node" value={data.app.node} />
          </CardContent>
        </Card>

        {(['powersync', 'email', 'push', 'storage'] as const).map((k) => {
          const comp = c[k];
          const detail = k === 'powersync' ? (comp.url ? `${comp.latencyMs ?? '—'} ms` : t('notConfigured'))
            : k === 'email' ? String(comp.provider)
              : k === 'push' ? (comp.configured ? t('configured') : t('notConfigured'))
                : `${comp.mode === 'gcs' ? 'Google Cloud Storage' : t('localDisk')}${comp.bucket ? ` · ${comp.bucket}` : ''}`;
          return (
            <Card key={k} data-testid={`health-${k}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-base">{t(`c.${k}`)}</CardTitle><StatusPill status={comp.status} /></CardHeader>
              <CardContent className="space-y-1">
                <p className="break-all text-sm text-muted-foreground">{detail}</p>
                {comp.error ? <p className="text-xs text-destructive">{String(comp.error)}</p> : null}
                {k === 'email' && comp.status === 'warning' && <p className="text-xs text-amber-700 dark:text-amber-400">{t('emailHint')}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card data-testid="health-problems">
        <CardHeader className="flex flex-row items-center justify-between space-y-0"><CardTitle className="text-base">{t('problems')}</CardTitle><StatusPill status={data.problems.status} /></CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div><p className="text-sm text-muted-foreground">{t('errors24h')}</p><p className="text-2xl font-bold tabular-nums" data-testid="errors-24h">{data.problems.errors24h}</p></div>
            <div><p className="text-sm text-muted-foreground">{t('automationFailed')}</p><p className="text-2xl font-bold tabular-nums">{data.problems.automationFailed24h}</p></div>
            <div><p className="text-sm text-muted-foreground">{t('webhookFailed')}</p><p className="text-2xl font-bold tabular-nums">{data.problems.webhookFailed24h}</p></div>
          </div>
          <div className="h-28" aria-label={t('errorsChart')}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.problems.errorsByHour} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="hour" tickFormatter={(h: string) => `${h.slice(11, 13)}h`} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} interval={3} />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))' }}
                  content={({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number | string }>; label?: string | number }) =>
                    active && payload?.length ? (
                      <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                        {new Date(`${label}:00:00Z`).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}: {t('errorsN', { n: Number(payload[0].value) })}
                      </div>
                    ) : null}
                />
                <Bar dataKey="count" fill="var(--viz-series-1)" radius={[4, 4, 0, 0]} maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium">{t('recentErrors')}</h3>
            {data.problems.errors.length === 0 ? <p className="text-sm text-muted-foreground">{t('noErrors')}</p> : (
              <div className="space-y-1 overflow-x-auto" data-testid="recent-errors">
                {data.problems.errors.map((e, i) => (
                  <div key={i} className="flex min-w-[32rem] gap-3 rounded border px-2 py-1 font-mono text-xs">
                    <span className="shrink-0 text-muted-foreground">{when(e.at)}</span>
                    <Badge variant="destructive" className="shrink-0">{e.status}</Badge>
                    <span className="shrink-0">{e.method} {e.path}</span>
                    <span className="truncate text-muted-foreground">{e.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium">{t('slowQueries')}</h3>
            {data.problems.slowQueries.length === 0 ? <p className="text-sm text-muted-foreground">{t('noSlow')}</p> : (
              <div className="space-y-1 overflow-x-auto" data-testid="slow-queries">
                {data.problems.slowQueries.map((q, i) => (
                  <div key={i} className="flex min-w-[32rem] gap-3 rounded border px-2 py-1 font-mono text-xs">
                    <span className="shrink-0 text-muted-foreground">{when(q.at)}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{q.ms} ms</span>
                    <span className="truncate">{q.query}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

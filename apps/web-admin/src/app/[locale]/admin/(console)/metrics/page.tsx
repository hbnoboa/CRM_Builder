'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LifecycleBadge, PageHeader, useFormatDate } from '@/components/platform/platform-ui';
import { usePlatformMetrics } from '@/hooks/use-platform';
import type { PlatformMetricsMonth } from '@/types/platform';
import { cn } from '@/lib/utils';

const PERIODS = [6, 12, 24] as const;
const SERIES = ['signups', 'conversions', 'cancellations', 'suspensions'] as const;
type SeriesKey = (typeof SERIES)[number];

/** "2026-11" -> "nov/26" no idioma da tela. */
function useMonthLabel() {
  const locale = useLocale();
  return (month: string, long = false) => {
    const [y, m] = month.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString(locale, long
      ? { month: 'long', year: 'numeric', timeZone: 'UTC' }
      : { month: 'short', year: '2-digit', timeZone: 'UTC' });
  };
}

function Delta({ current, previous }: { current: number; previous: number }) {
  const Icon = current > previous ? ArrowUpRight : current < previous ? ArrowDownRight : ArrowRight;
  return <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />;
}

function StatTile({ label, value, hint, delta, testId }: {
  label: string; value: string; hint?: string; delta?: { current: number; previous: number }; testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="p-5">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-1 text-3xl font-bold tabular-nums">{value}</div>
        {hint && (
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            {delta && <Delta {...delta} />}
            <span>{hint}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MonthChart({ data, series, title }: { data: PlatformMetricsMonth[]; series: SeriesKey; title: string }) {
  const monthLabel = useMonthLabel();
  const total = data.reduce((sum, m) => sum + m[series], 0);
  return (
    <div className="rounded-lg border p-4" data-testid={`chart-${series}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-sm tabular-nums text-muted-foreground">{total.toLocaleString()}</span>
      </div>
      <div className="mt-3 h-36">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: -24 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis
              dataKey="month"
              tickFormatter={(m: string) => monthLabel(m)}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              interval="preserveStartEnd"
              minTickGap={12}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip
              cursor={{ fill: 'hsl(var(--muted))' }}
              content={({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number | string }>; label?: string | number }) =>
                active && payload?.length ? (
                  <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                    <div className="font-medium">{monthLabel(String(label), true)}</div>
                    <div className="tabular-nums">{title}: {Number(payload[0].value).toLocaleString()}</div>
                  </div>
                ) : null
              }
            />
            <Bar dataKey={series} fill="var(--viz-series-1)" radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function PlatformMetricsPage() {
  const t = useTranslations('platform.metrics');
  const formatDate = useFormatDate();
  const monthLabel = useMonthLabel();
  const [months, setMonths] = useState<number>(12);
  const [asTable, setAsTable] = useState(false);
  const { data, isLoading, isError } = usePlatformMetrics(months);

  const periodPicker = (
    <div className="flex rounded-lg border p-0.5" role="group" aria-label={t('period')}>
      {PERIODS.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => setMonths(n)}
          className={cn('rounded-md px-3 py-1 text-sm', months === n ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground')}
          aria-pressed={months === n}
          data-testid={`metrics-period-${n}`}
        >
          {t('months', { n })}
        </button>
      ))}
    </div>
  );

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('title')} subtitle={t('subtitle')} />
        <p className="text-sm text-muted-foreground" data-testid="metrics-error">{t('loadError')}</p>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('title')} subtitle={t('subtitle')} actions={periodPicker} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  const { current, previous } = data.last30;
  const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`);
  const trialTotal = data.trialConversion.converted + data.trialConversion.lost;

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} actions={periodPicker} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="metrics-kpis">
        <StatTile testId="kpi-paying" label={t('paying')} value={data.tenants.paying.toLocaleString()} hint={t('payingHint')} />
        <StatTile testId="kpi-trials" label={t('trials')} value={data.tenants.byLifecycle.TRIAL.toLocaleString()} />
        <StatTile
          testId="kpi-trial-rate"
          label={t('trialRate')}
          value={pct(data.trialConversion.rate)}
          hint={trialTotal ? t('trialRateHint', { converted: data.trialConversion.converted, total: trialTotal, days: data.trialConversion.days }) : t('noData')}
        />
        <StatTile
          testId="kpi-signups"
          label={t('signups30')}
          value={current.signups.toLocaleString()}
          hint={`${t('vsPrev', { prev: previous.signups })} · ${t('selfService', { n: current.selfService })}`}
          delta={{ current: current.signups, previous: previous.signups }}
        />
        <StatTile
          testId="kpi-conversions"
          label={t('conversions30')}
          value={current.conversions.toLocaleString()}
          hint={t('vsPrev', { prev: previous.conversions })}
          delta={{ current: current.conversions, previous: previous.conversions }}
        />
        <StatTile
          testId="kpi-cancellations"
          label={t('cancellations30')}
          value={current.cancellations.toLocaleString()}
          hint={t('vsPrev', { prev: previous.cancellations })}
          delta={{ current: current.cancellations, previous: previous.cancellations }}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-base">{t('monthlyTitle')}</CardTitle>
            <CardDescription>{t('monthlyHint')}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setAsTable((v) => !v)} data-testid="metrics-toggle-table">
            {asTable ? t('hideTable') : t('showTable')}
          </Button>
        </CardHeader>
        <CardContent>
          {asTable ? (
            <div className="overflow-x-auto" data-testid="metrics-table">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">{t('month')}</th>
                    {SERIES.map((s) => <th key={s} className="py-2 pr-4 text-right font-medium">{t(`series.${s}`)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[...data.monthly].reverse().map((m) => (
                    <tr key={m.month} className="border-b last:border-0">
                      <td className="py-2 pr-4">{monthLabel(m.month, true)}</td>
                      {SERIES.map((s) => <td key={s} className="py-2 pr-4 text-right tabular-nums">{m[s]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {SERIES.map((s) => <MonthChart key={s} data={data.monthly} series={s} title={t(`series.${s}`)} />)}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('plansTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto" data-testid="metrics-plans">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">{t('plan')}</th>
                  <th className="py-2 pr-4 text-right font-medium">{t('payingCol')}</th>
                  <th className="py-2 pr-4 text-right font-medium">{t('trialCol')}</th>
                  <th className="py-2 pr-4 text-right font-medium">{t('otherCol')}</th>
                  <th className="py-2 pr-4 text-right font-medium">{t('total')}</th>
                  <th className="py-2 text-right font-medium">{t('members')}</th>
                </tr>
              </thead>
              <tbody>
                {data.byPlan.map((p) => (
                  <tr key={p.planId ?? 'none'} className="border-b last:border-0" data-testid={`plan-row-${p.planId ?? 'none'}`}>
                    <td className="py-2 pr-4">
                      {p.planId ? (
                        <Link href={`/admin/tenants?planId=${p.planId}`} className="font-medium hover:underline">{p.name}</Link>
                      ) : <span className="text-muted-foreground">{t('noPlan')}</span>}
                      {!p.isActive && <span className="ml-2 text-xs text-muted-foreground">({t('inactivePlan')})</span>}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{p.paying}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{p.byLifecycle.TRIAL}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{p.byLifecycle.SUSPENDED + p.byLifecycle.CANCELED}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{p.total}</td>
                    <td className="py-2 text-right tabular-nums">{p.members.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('usageTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3" data-testid="metrics-usage">
            <div>
              <div className="text-sm text-muted-foreground">{t('people')}</div>
              <div className="text-2xl font-bold tabular-nums">{data.engagement.members.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t('active30')}</div>
              <div className="text-2xl font-bold tabular-nums">
                {data.engagement.activeMembers30d.toLocaleString()}
                <span className="ml-1 text-sm font-normal text-muted-foreground">{pct(data.engagement.activeRate)}</span>
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t('records')}</div>
              <div className="text-2xl font-bold tabular-nums">{data.engagement.records.toLocaleString()}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('riskTitle')}</CardTitle>
            <CardDescription>{t('riskHint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1" data-testid="metrics-risk">
            {data.atRisk.length === 0 && <p className="text-sm text-muted-foreground">{t('none')}</p>}
            {data.atRisk.map((r) => (
              <Link key={r.id} href={`/admin/tenants/${r.id}`} className="flex items-center justify-between gap-2 rounded-md p-2 text-sm hover:bg-muted" data-testid={`risk-${r.slug}`}>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{r.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {r.lastLoginAt ? t('lastLogin', { date: formatDate(r.lastLoginAt) }) : t('never')} · {t('membersCount', { n: r.members })}
                  </span>
                </span>
                <LifecycleBadge lifecycle={r.lifecycle} />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

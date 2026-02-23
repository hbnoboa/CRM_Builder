'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  ScrollText, Search, Shield, ArrowLeft, Download,
  ChevronDown, ChevronRight, X, Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAuditLogs } from '@/hooks/use-audit-logs';
import { usePermissions } from '@/hooks/use-permissions';
import { useTenants } from '@/hooks/use-tenants';
import { auditLogsService, type AuditLog } from '@/services/audit-logs.service';
import { cn } from '@/lib/utils';

const ACTIONS = ['create', 'update', 'delete'] as const;
const RESOURCES = ['entity_data', 'user', 'entity', 'custom_role', 'custom_api', 'page'] as const;

const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  create: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
  update: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  delete: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
};

export default function AuditLogsPage() {
  const t = useTranslations('auditLogsPage');
  const tNav = useTranslations('navigation');
  const tAuth = useTranslations('auth');
  const { isPlatformAdmin } = usePermissions();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState<string>('');
  const [resource, setResource] = useState<string>('');
  const [tenantId, setTenantId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const { data: tenantsData } = useTenants({ limit: 100 });
  const tenants = tenantsData?.data ?? [];

  const queryParams = useMemo(() => ({
    page,
    limit: 50,
    ...(search && { search }),
    ...(action && { action }),
    ...(resource && { resource }),
    ...(tenantId && { tenantId }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
  }), [page, search, action, resource, tenantId, dateFrom, dateTo]);

  const { data, isLoading } = useAuditLogs(queryParams);
  const logs = data?.data ?? [];
  const meta = data?.meta;

  const hasFilters = !!(action || resource || tenantId || dateFrom || dateTo || search);

  if (!isPlatformAdmin) {
    return (
      <div className="max-w-3xl mx-auto mt-4 sm:mt-8 px-2 sm:px-0">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12">
            <Shield className="h-12 w-12 sm:h-16 sm:w-16 text-destructive mb-4" />
            <h2 className="text-lg sm:text-xl font-semibold mb-2">{tAuth('accessRestricted')}</h2>
            <p className="text-muted-foreground text-center mb-4 text-sm sm:text-base px-2">
              {tAuth('noPermission')}
            </p>
            <Link href="/dashboard">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {tAuth('backToDashboard')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const clearFilters = () => {
    setAction('');
    setResource('');
    setTenantId('');
    setDateFrom('');
    setDateTo('');
    setSearch('');
    setPage(1);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await auditLogsService.exportJson({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        tenantId: tenantId || undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString();
  };

  const getTenantName = (tid: string) => {
    const tenant = tenants.find((t: { id: string; name: string }) => t.id === tid);
    return tenant?.name || tid.slice(0, 8) + '...';
  };

  return (
    <div className="space-y-6">
      <nav className="mb-2 flex items-center gap-2 text-sm text-muted-foreground" aria-label="breadcrumb">
        <Link href="/dashboard" className="hover:underline">{tNav('dashboard')}</Link>
        <span>/</span>
        <span className="font-semibold text-foreground">{t('title')}</span>
      </nav>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">{t('subtitle')}</p>
        </div>
        <Button onClick={handleExport} disabled={exporting} variant="outline" className="w-full sm:w-auto">
          <Download className="h-4 w-4 mr-2" />
          {exporting ? t('exporting') : t('exportJson')}
        </Button>
      </div>

      {/* Stats */}
      {meta && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Card><CardContent className="p-3 sm:p-4">
            <div className="text-xl sm:text-2xl font-bold">{meta.total}</div>
            <p className="text-xs sm:text-sm text-muted-foreground">{t('stats.total')}</p>
          </CardContent></Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t('filters')}</span>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto h-7 text-xs">
                <X className="h-3 w-3 mr-1" />
                {t('clearFilters')}
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <Select value={action} onValueChange={(v) => { setAction(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder={t('allActions')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allActions')}</SelectItem>
                {ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>{t(`actions.${a}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={resource} onValueChange={(v) => { setResource(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder={t('allResources')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allResources')}</SelectItem>
                {RESOURCES.map((r) => (
                  <SelectItem key={r} value={r}>{t(`resources.${r}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={tenantId} onValueChange={(v) => { setTenantId(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder={t('allTenants')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allTenants')}</SelectItem>
                {tenants.map((tenant: { id: string; name: string }) => (
                  <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              placeholder={t('dateFrom')}
            />

            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              placeholder={t('dateTo')}
            />

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('searchPlaceholder')}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="animate-pulse"><CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="h-4 bg-muted rounded w-24" />
                <div className="h-4 bg-muted rounded w-32" />
                <div className="h-4 bg-muted rounded w-20" />
                <div className="h-4 bg-muted rounded w-28" />
                <div className="flex-1" />
                <div className="h-4 bg-muted rounded w-16" />
              </div>
            </CardContent></Card>
          ))}
        </div>
      ) : logs.length === 0 ? (
        <Card><CardContent className="p-6 sm:p-12 text-center">
          <ScrollText className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-base sm:text-lg font-semibold mb-2">{t('noLogs')}</h3>
          <p className="text-muted-foreground text-sm sm:text-base">{t('noLogsDescription')}</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-1">
          {/* Header */}
          <div className="hidden lg:grid grid-cols-[2fr_2fr_1fr_1.5fr_2fr_1fr] gap-3 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <span>{t('table.date')}</span>
            <span>{t('table.user')}</span>
            <span>{t('table.action')}</span>
            <span>{t('table.resource')}</span>
            <span>{t('table.resourceId')}</span>
            <span>{t('table.details')}</span>
          </div>

          {logs.map((log) => (
            <div key={log.id}>
              <Card
                className={cn(
                  'cursor-pointer hover:border-primary/40 transition-colors',
                  expandedRow === log.id && 'border-primary/40'
                )}
                onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
              >
                <CardContent className="p-3 sm:p-4">
                  {/* Desktop */}
                  <div className="hidden lg:grid grid-cols-[2fr_2fr_1fr_1.5fr_2fr_1fr] gap-3 items-center">
                    <span className="text-sm text-muted-foreground">{formatDate(log.createdAt)}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{log.userName || '-'}</p>
                      <p className="text-xs text-muted-foreground truncate">{log.userEmail || log.userId?.slice(0, 8)}</p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn('text-xs w-fit', ACTION_COLORS[log.action]?.bg, ACTION_COLORS[log.action]?.text)}
                    >
                      {t(`actions.${log.action}` as 'actions.create')}
                    </Badge>
                    <div>
                      <span className="text-sm">{t(`resources.${log.resource}` as 'resources.user')}</span>
                      {log.metadata && (log.metadata as Record<string, unknown>).entitySlug && (
                        <p className="text-xs text-muted-foreground">{(log.metadata as Record<string, unknown>).entitySlug as string}</p>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground font-mono truncate">{log.resourceId || '-'}</span>
                    <div className="flex items-center justify-end">
                      {expandedRow === log.id ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Mobile */}
                  <div className="lg:hidden space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant="secondary"
                        className={cn('text-xs', ACTION_COLORS[log.action]?.bg, ACTION_COLORS[log.action]?.text)}
                      >
                        {t(`actions.${log.action}` as 'actions.create')}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(log.createdAt)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{log.userName || log.userId?.slice(0, 8) || '-'}</span>
                      <span className="text-sm">{t(`resources.${log.resource}` as 'resources.user')}</span>
                    </div>
                    {log.resourceId && (
                      <p className="text-xs text-muted-foreground font-mono truncate">{log.resourceId}</p>
                    )}
                    <div className="flex justify-end">
                      {expandedRow === log.id ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Expanded details */}
              {expandedRow === log.id && (
                <Card className="border-t-0 rounded-t-none border-primary/20">
                  <CardContent className="p-4 space-y-4">
                    {/* Tenant */}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-muted-foreground">Tenant:</span>
                      <span>{getTenantName(log.tenantId)}</span>
                    </div>

                    {/* Metadata */}
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">{t('metadata')}</h4>
                        <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Changes diff */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {log.oldData && Object.keys(log.oldData).length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2 text-red-600 dark:text-red-400">{t('oldData')}</h4>
                          <pre className="text-xs bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 p-3 rounded-lg overflow-x-auto max-h-64">
                            {JSON.stringify(log.oldData, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.newData && Object.keys(log.newData).length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2 text-green-600 dark:text-green-400">{t('newData')}</h4>
                          <pre className="text-xs bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 p-3 rounded-lg overflow-x-auto max-h-64">
                            {JSON.stringify(log.newData, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>

                    {!log.oldData && !log.newData && (
                      <p className="text-sm text-muted-foreground italic">{t('noData')}</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {meta.total} {t('stats.total').toLowerCase()}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              &laquo;
            </Button>
            <span className="text-sm">
              {page} / {meta.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.totalPages}
              onClick={() => setPage(page + 1)}
            >
              &raquo;
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

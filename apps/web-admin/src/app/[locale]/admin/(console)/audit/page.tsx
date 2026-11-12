'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader, useFormatDate } from '@/components/platform/platform-ui';
import { usePlatformAudit } from '@/hooks/use-platform';

export default function PlatformAuditPage() {
  const t = useTranslations('platform.audit');
  const formatDate = useFormatDate();
  const [page, setPage] = useState(1);
  const { data, isLoading } = usePlatformAudit({ page, limit: 50 });

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('columns.when')}</TableHead>
                <TableHead>{t('columns.who')}</TableHead>
                <TableHead>{t('columns.action')}</TableHead>
                <TableHead>{t('columns.target')}</TableHead>
                <TableHead>{t('columns.ip')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              )}
              {data?.data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">{t('empty')}</TableCell>
                </TableRow>
              )}
              {data?.data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-sm">{formatDate(row.createdAt, true)}</TableCell>
                  <TableCell className="text-sm font-medium">{row.staffName}</TableCell>
                  <TableCell className="text-sm">
                    {t.has(`actions.${row.action}`) ? t(`actions.${row.action}`) : row.action}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.tenantId ? (
                      <Link href={`/admin/tenants/${row.tenantId}`} className="hover:underline">
                        {String((row.metadata as Record<string, unknown> | null)?.name ?? (row.metadata as Record<string, unknown> | null)?.email ?? row.targetType)}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">
                        {String((row.metadata as Record<string, unknown> | null)?.email ?? row.targetType)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.ip ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground">{t('page', { page: data.meta.page, total: data.meta.totalPages })}</span>
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('previous')}</Button>
          <Button variant="outline" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage((p) => p + 1)}>{t('next')}</Button>
        </div>
      )}
    </div>
  );
}

'use client';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LoadingPage } from '@/components/ui/loading-page';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { Link } from '@/i18n/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowLeft, Shield, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function PermissionsPage() {
  const t = useTranslations('permissions');
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');
  // Usa o endpoint de roles que existe no backend
  const { data, isLoading, isError } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await api.get('/roles');
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    },
  });

  return (
    <ErrorBoundary>
      <div className="max-w-3xl mx-auto mt-8">
        {/* Breadcrumbs */}
        <nav className="mb-4 flex items-center gap-2 text-sm text-muted-foreground" aria-label="breadcrumb" data-testid="breadcrumb">
          <Link href="/dashboard" className="hover:underline" data-testid="breadcrumb-dashboard">{tNav('dashboard')}</Link>
          <span>/</span>
          <span className="font-semibold text-foreground" data-testid="breadcrumb-permissions">{t('title')}</span>
        </nav>
        {/* Back */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/dashboard">
                <Button variant="ghost" size="icon" className="mb-2" aria-label={t('backToDashboard')} data-testid="voltar-dashboard-btn">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent>{t('backToDashboard')}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <h1 className="text-3xl font-bold mb-6" data-testid="page-title">{t('pageTitle')}</h1>

        {isLoading ? (
          <LoadingPage />
        ) : isError ? (
          <EmptyState message={t('loadError')} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle data-testid="permissions-heading" className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t('systemRoles')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data?.length === 0 ? (
                <EmptyState message={t('noRolesFound')} />
              ) : (
                <div className="space-y-4">
                  {data?.map((role: any) => (
                    <div key={role.id} className="border p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">{role.name}</span>
                        </div>
                        {role.isSystem && (
                          <Badge variant="secondary">{t('system')}</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {role.description || t('noDescription')}
                      </div>
                      {role.permissions && role.permissions.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {role.permissions.map((perm: string, idx: number) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {perm}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </ErrorBoundary>
  );
}

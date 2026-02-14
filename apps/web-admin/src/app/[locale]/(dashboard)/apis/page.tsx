'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { RequireRole } from '@/components/auth/require-role';
import { usePermissions } from '@/hooks/use-permissions';
import {
  Plus, Search, MoreVertical, Pencil, Trash2,
  Code, Play, Copy, Zap, PlayCircle, PauseCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useCustomApis, useActivateCustomApi, useDeactivateCustomApi } from '@/hooks/use-custom-apis';
import { CustomApiFormDialog, DeleteCustomApiDialog, TestApiDialog } from '@/components/custom-apis';
import { useTenant } from '@/stores/tenant-context';
import type { CustomApi } from '@/services/custom-apis.service';

const methodColors: Record<string, string> = {
  GET: 'bg-green-100 text-green-800',
  POST: 'bg-blue-100 text-blue-800',
  PUT: 'bg-yellow-100 text-yellow-800',
  PATCH: 'bg-orange-100 text-orange-800',
  DELETE: 'bg-red-100 text-red-800',
};

function ApisPageContent() {
  const t = useTranslations('apis');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');
  const { effectiveTenantId } = useTenant();
  const { hasModulePermission, hasModuleAction } = usePermissions();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [selectedApi, setSelectedApi] = useState<CustomApi | null>(null);

  const queryParams = effectiveTenantId ? { tenantId: effectiveTenantId } : undefined;
  const { data, isLoading, refetch } = useCustomApis(queryParams);
  const activateApi = useActivateCustomApi({ success: t('toast.activated') });
  const deactivateApi = useDeactivateCustomApi({ success: t('toast.deactivated') });

  // Garante que apis e sempre um array
  const apis: CustomApi[] = (() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.data && Array.isArray(data.data)) return data.data;
    return [];
  })();

  const filteredApis = apis.filter(
    (api) =>
      (api.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (api.path || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateApi = () => {
    setSelectedApi(null);
    setFormOpen(true);
  };

  const handleEditApi = (api: CustomApi) => {
    setSelectedApi(api);
    setFormOpen(true);
  };

  const handleDeleteApi = (api: CustomApi) => {
    setSelectedApi(api);
    setDeleteOpen(true);
  };

  const handleTestApi = (apiItem: CustomApi) => {
    setSelectedApi(apiItem);
    setTestOpen(true);
  };

  const handleToggleActive = async (api: CustomApi) => {
    try {
      if (api.isActive) {
        await deactivateApi.mutateAsync(api.id);
      } else {
        await activateApi.mutateAsync(api.id);
      }
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(`/api/x/[org]${path}`);
    toast.success(t('pathCopied'));
  };

  const handleSuccess = () => {
    refetch();
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumbs */}
      <nav className="mb-2 flex items-center gap-2 text-sm text-muted-foreground" aria-label="breadcrumb">
        <Link href="/dashboard" className="hover:underline">{tNav('dashboard')}</Link>
        <span>/</span>
        <span className="font-semibold text-foreground">{tNav('apis')}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            {t('subtitle')}
          </p>
        </div>
        {hasModulePermission('apis', 'canCreate') && (
        <Button onClick={handleCreateApi} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          {t('newApi')}
        </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-xl sm:text-2xl font-bold">{apis.length}</div>
            <p className="text-xs sm:text-sm text-muted-foreground">{t('stats.total')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-xl sm:text-2xl font-bold text-green-600">
              {apis.filter((a) => a.isActive).length}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">{t('stats.active')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-xl sm:text-2xl font-bold text-blue-600">
              {apis.filter((a) => a.method === 'GET').length}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">{t('stats.getEndpoints')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-xl sm:text-2xl font-bold text-purple-600">
              {apis.filter((a) => a.method === 'POST').length}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">{t('stats.postEndpoints')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* APIs List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-6 bg-muted rounded w-1/3 mb-4" />
                <div className="h-4 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredApis.length === 0 ? (
        <Card>
          <CardContent className="p-6 sm:p-12 text-center">
            <Code className="h-8 w-8 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-base sm:text-lg font-semibold mb-2">{t('noApisFound')}</h3>
            <p className="text-muted-foreground">
              {search
                ? t('noApisMatchSearch')
                : t('createFirstApi')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredApis.map((apiItem) => (
            <Card
              key={apiItem.id}
              className="hover:border-primary/50 transition-colors"
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                  <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <h3 className="font-semibold text-sm sm:text-base">{apiItem.name}</h3>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded whitespace-nowrap ${
                            methodColors[apiItem.method]
                          }`}
                        >
                          {apiItem.method}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full whitespace-nowrap ${
                            apiItem.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {apiItem.isActive ? tCommon('active') : tCommon('inactive')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 overflow-hidden">
                        <code className="text-xs sm:text-sm text-muted-foreground bg-muted px-1.5 sm:px-2 py-0.5 rounded truncate max-w-[140px] sm:max-w-none">
                          /api/x/[org]{apiItem.path}
                        </code>
                        <button
                          className="text-muted-foreground hover:text-foreground flex-shrink-0"
                          onClick={() => handleCopyPath(apiItem.path)}
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                      {apiItem.description && (
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-1">
                          {apiItem.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 justify-end sm:justify-start flex-shrink-0">
                    {hasModuleAction('apis', 'canTest') && (
                    <Button variant="ghost" size="sm" className="hidden md:flex" onClick={() => handleTestApi(apiItem)}>
                      <Play className="h-4 w-4 mr-1" />
                      {t('test')}
                    </Button>
                    )}
                    {hasModulePermission('apis', 'canUpdate') && (
                    <Button variant="outline" size="sm" onClick={() => handleEditApi(apiItem)} className="hidden sm:flex">
                      <Pencil className="h-4 w-4 mr-1" />
                      {tCommon('edit')}
                    </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {hasModuleAction('apis', 'canTest') && (
                        <DropdownMenuItem onClick={() => handleTestApi(apiItem)}>
                          <Play className="h-4 w-4 mr-2" />
                          {t('test')}
                        </DropdownMenuItem>
                        )}
                        {hasModulePermission('apis', 'canUpdate') && (
                        <DropdownMenuItem onClick={() => handleEditApi(apiItem)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          {tCommon('edit')}
                        </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleCopyPath(apiItem.path)}>
                          <Copy className="h-4 w-4 mr-2" />
                          {t('copyPath')}
                        </DropdownMenuItem>
                        {hasModuleAction('apis', 'canActivate') && (
                        <>
                        <DropdownMenuSeparator />
                        {apiItem.isActive ? (
                          <DropdownMenuItem
                            onClick={() => handleToggleActive(apiItem)}
                            className="text-yellow-600 focus:text-yellow-600"
                          >
                            <PauseCircle className="h-4 w-4 mr-2" />
                            {t('deactivate')}
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => handleToggleActive(apiItem)}
                            className="text-green-600 focus:text-green-600"
                          >
                            <PlayCircle className="h-4 w-4 mr-2" />
                            {t('activate')}
                          </DropdownMenuItem>
                        )}
                        </>
                        )}
                        {hasModulePermission('apis', 'canDelete') && (
                        <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteApi(apiItem)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {tCommon('delete')}
                        </DropdownMenuItem>
                        </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <CustomApiFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        customApi={selectedApi}
        onSuccess={handleSuccess}
      />
      <DeleteCustomApiDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        customApi={selectedApi}
        onSuccess={handleSuccess}
      />
      <TestApiDialog
        open={testOpen}
        onOpenChange={setTestOpen}
        customApi={selectedApi}
      />
    </div>
  );
}

export default function ApisPage() {
  return (
    <RequireRole module="apis">
      <ApisPageContent />
    </RequireRole>
  );
}

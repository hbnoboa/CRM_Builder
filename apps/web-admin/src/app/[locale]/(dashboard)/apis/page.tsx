'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { RequireRole } from '@/components/auth/require-role';
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Code,
  Play,
  Copy,
  Zap,
  PlayCircle,
  PauseCircle,
  Loader2,
  XCircle,
  Clock,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useCustomApis, useActivateCustomApi, useDeactivateCustomApi } from '@/hooks/use-custom-apis';
import { CustomApiFormDialog, DeleteCustomApiDialog } from '@/components/custom-apis';
import { useTenant } from '@/stores/tenant-context';
import { api } from '@/lib/api';
import type { CustomApi } from '@/services/custom-apis.service';

const methodColors: Record<string, string> = {
  GET: 'bg-green-100 text-green-800',
  POST: 'bg-blue-100 text-blue-800',
  PUT: 'bg-yellow-100 text-yellow-800',
  PATCH: 'bg-orange-100 text-orange-800',
  DELETE: 'bg-red-100 text-red-800',
};

// ── Test API Dialog (noob-friendly) ──────────────────────────────────────────

interface KeyValueRow {
  id: string;
  key: string;
  value: string;
}

const createRow = (): KeyValueRow => ({ id: Math.random().toString(36).slice(2), key: '', value: '' });

interface TestResult {
  status: number;
  statusText: string;
  data: unknown;
  duration: number;
}

function KeyValueFields({
  label,
  hint,
  rows,
  onChange,
}: {
  label: string;
  hint: string;
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
}) {
  const t = useTranslations('apis.keyValueFields');
  const updateRow = (id: string, field: 'key' | 'value', val: string) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, [field]: val } : r)));
  };
  const removeRow = (id: string) => {
    const next = rows.filter((r) => r.id !== id);
    onChange(next.length === 0 ? [createRow()] : next);
  };
  const addRow = () => onChange([...rows, createRow()]);

  return (
    <div className="space-y-2">
      <div>
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="space-y-1.5">
        {rows.map((row, idx) => (
          <div key={row.id} className="flex items-center gap-2">
            <Input
              placeholder={t('fieldName', { index: idx + 1 })}
              value={row.key}
              onChange={(e) => updateRow(row.id, 'key', e.target.value)}
              className="text-sm flex-1"
            />
            <Input
              placeholder={t('fieldValue', { index: idx + 1 })}
              value={row.value}
              onChange={(e) => updateRow(row.id, 'value', e.target.value)}
              className="text-sm flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => removeRow(row.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" className="w-full text-xs" onClick={addRow}>
        <Plus className="h-3 w-3 mr-1" />
        {t('addField')}
      </Button>
    </div>
  );
}

function TestApiDialog({
  open,
  onOpenChange,
  customApi,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customApi: CustomApi | null;
}) {
  const t = useTranslations('apis.testDialog');
  const tToast = useTranslations('apis.toast');
  const tCommon = useTranslations('common');
  const { tenantId } = useTenant();
  const [paramRows, setParamRows] = useState<KeyValueRow[]>([createRow()]);
  const [bodyRows, setBodyRows] = useState<KeyValueRow[]>([createRow()]);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens with a different API
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setResult(null);
      setError(null);
    }
    onOpenChange(isOpen);
  };

  const rowsToObject = (rows: KeyValueRow[]): Record<string, string> | undefined => {
    const obj: Record<string, string> = {};
    let hasValue = false;
    for (const row of rows) {
      if (row.key.trim()) {
        obj[row.key.trim()] = row.value;
        hasValue = true;
      }
    }
    return hasValue ? obj : undefined;
  };

  const handleTest = async () => {
    if (!customApi || !tenantId) {
      toast.error(tToast('tenantNotFound'));
      return;
    }

    setTesting(true);
    setResult(null);
    setError(null);

    const startTime = Date.now();

    try {
      const path = `/x/${tenantId}${customApi.path}`;
      const method = customApi.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';

      const params = rowsToObject(paramRows);
      const bodyData = ['post', 'put', 'patch'].includes(method) ? rowsToObject(bodyRows) : undefined;

      const response = await api.request({
        url: path,
        method,
        params,
        data: bodyData,
      });

      const duration = Date.now() - startTime;
      setResult({
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        duration,
      });
    } catch (err: any) {
      const duration = Date.now() - startTime;
      if (err.response) {
        setResult({
          status: err.response.status,
          statusText: err.response.statusText,
          data: err.response.data,
          duration,
        });
      } else {
        setError(err.message || t('connectionError'));
      }
    } finally {
      setTesting(false);
    }
  };

  const isSuccess = result && result.status >= 200 && result.status < 300;
  const needsBody = customApi && ['POST', 'PUT', 'PATCH'].includes(customApi.method);

  // Friendly status message
  const getStatusMessage = () => {
    if (!result) return '';
    if (isSuccess) return `✅ ${t('success')}`;
    if (result.status === 404) return `❌ ${t('errorNotFound')}`;
    if (result.status === 401 || result.status === 403) return `🔒 ${t('errorForbidden')}`;
    if (result.status >= 500) return `⚠️ ${t('errorServer')}`;
    return `⚠️ ${t('errorGeneric', { status: result.status })}`;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-primary" />
            {t('title')}
          </DialogTitle>
          {customApi && (
            <DialogDescription className="pt-1">
              {t('subtitle', { name: customApi.name })}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* API info card */}
        {customApi && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border">
            <Badge
              variant="outline"
              className={`text-xs font-semibold ${methodColors[customApi.method]}`}
            >
              {customApi.method}
            </Badge>
            <span className="text-sm text-muted-foreground truncate">
              /api/x/[org]{customApi.path}
            </span>
            <Badge
              variant={customApi.isActive ? 'default' : 'secondary'}
              className="ml-auto text-[10px]"
            >
              {customApi.isActive ? tCommon('active') : tCommon('inactive')}
            </Badge>
          </div>
        )}

        <ScrollArea className="flex-1 min-h-0 max-h-[calc(85vh-180px)]">
          <div className="flex flex-col gap-4 pr-3">
            {/* Filtros / Query Params */}
            <KeyValueFields
              label={`📋 ${t('filters')}`}
              hint={t('filtersHint')}
              rows={paramRows}
              onChange={setParamRows}
            />

            {/* Body data for POST/PUT/PATCH */}
            {needsBody && (
              <>
                <Separator />
                <KeyValueFields
                  label={`📝 ${t('dataToSend')}`}
                  hint={t('dataToSendHint')}
                  rows={bodyRows}
                  onChange={setBodyRows}
                />
              </>
            )}

            <Separator />

            {/* Send Button */}
            <Button
              onClick={handleTest}
              disabled={testing || !tenantId}
              size="lg"
              className="w-full text-base"
            >
              {testing ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  {tCommon('testing')}
                </>
              ) : (
                <>
                  <Send className="h-5 w-5 mr-2" />
                  {t('testNow')}
                </>
              )}
            </Button>

            {/* Result */}
            {result && (
              <div className="space-y-2">
                {/* Friendly status */}
                <div
                  className={`p-3 rounded-lg border text-sm font-medium ${
                    isSuccess
                      ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300'
                      : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{getStatusMessage()}</span>
                    <span className="flex items-center gap-1 text-xs opacity-70">
                      <Clock className="h-3 w-3" />
                      {result.duration < 1000
                        ? `${result.duration}ms`
                        : `${(result.duration / 1000).toFixed(1)}s`}
                    </span>
                  </div>
                </div>

                {/* Response data */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t('response')}</Label>
                  <ScrollArea className="max-h-[220px] border rounded-lg bg-muted/30">
                    <pre className="p-3 text-xs whitespace-pre-wrap break-all">
                      {typeof result.data === 'string'
                        ? result.data
                        : JSON.stringify(result.data, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 p-3 border border-destructive/50 bg-destructive/5 rounded-lg">
                <XCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">{t('connectionError')}</p>
                  <p className="text-xs text-destructive/80 mt-0.5">{error}</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function ApisPageContent() {
  const t = useTranslations('apis');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [selectedApi, setSelectedApi] = useState<CustomApi | null>(null);

  const { data, isLoading, refetch } = useCustomApis();
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
        <Button onClick={handleCreateApi} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          {t('newApi')}
        </Button>
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
            <p className="text-muted-foreground mb-4">
              {search
                ? t('noApisMatchSearch')
                : t('createFirstApi')}
            </p>
            {!search && (
              <Button onClick={handleCreateApi}>
                <Plus className="h-4 w-4 mr-2" />
                {t('createFirstApiButton')}
              </Button>
            )}
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
                    <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10 flex-shrink-0">
                      <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    </div>
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
                    <Button variant="ghost" size="sm" className="hidden md:flex" onClick={() => handleTestApi(apiItem)}>
                      <Play className="h-4 w-4 mr-1" />
                      {t('test')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEditApi(apiItem)} className="hidden sm:flex">
                      <Pencil className="h-4 w-4 mr-1" />
                      {tCommon('edit')}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleTestApi(apiItem)}>
                          <Play className="h-4 w-4 mr-2" />
                          {t('test')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditApi(apiItem)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          {tCommon('edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCopyPath(apiItem.path)}>
                          <Copy className="h-4 w-4 mr-2" />
                          {t('copyPath')}
                        </DropdownMenuItem>
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
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteApi(apiItem)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {tCommon('delete')}
                        </DropdownMenuItem>
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
    <RequireRole adminOnly>
      <ApisPageContent />
    </RequireRole>
  );
}

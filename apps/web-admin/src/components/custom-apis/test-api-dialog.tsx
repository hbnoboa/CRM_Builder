'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Plus, Trash2, Play, Loader2, XCircle, Clock, Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
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

interface TestApiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customApi: CustomApi | null;
}

export function TestApiDialog({ open, onOpenChange, customApi }: TestApiDialogProps) {
  const t = useTranslations('apis.testDialog');
  const tToast = useTranslations('apis.toast');
  const tCommon = useTranslations('common');
  const { tenantId, effectiveTenantId } = useTenant();
  const [paramRows, setParamRows] = useState<KeyValueRow[]>([createRow()]);
  const [bodyRows, setBodyRows] = useState<KeyValueRow[]>([createRow()]);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    const tid = effectiveTenantId || tenantId;
    if (!customApi || !tid) {
      toast.error(tToast('tenantNotFound'));
      return;
    }

    setTesting(true);
    setResult(null);
    setError(null);

    const startTime = Date.now();

    try {
      const path = `/x/${tid}${customApi.path}`;
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
            <KeyValueFields
              label={`📋 ${t('filters')}`}
              hint={t('filtersHint')}
              rows={paramRows}
              onChange={setParamRows}
            />

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

            {result && (
              <div className="space-y-2">
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

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { History, Loader2, Pencil, Plus, Send, Trash2, Webhook } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateWebhook, useDeleteWebhook, useTestWebhook, useUpdateWebhook, useWebhookRuns, useWebhooks } from '@/hooks/use-integrations';
import { useEntities } from '@/hooks/use-entities';
import { usePermissions } from '@/hooks/use-permissions';
import { useFormatDate } from '@/components/platform/platform-ui';
import { getErrorMessage } from '@/lib/get-error-message';
import type { WebhookEvent, WebhookRow } from '@/services/integrations.service';
import type { Entity } from '@/types';

const EVENTS: WebhookEvent[] = ['created', 'updated', 'deleted'];
const ALL = 'all';

export function WebhooksPanel() {
  const t = useTranslations('gestao.integrations.webhooks');
  const { hasModuleAction } = usePermissions();
  const { data, isLoading } = useWebhooks();
  const { data: entitiesData } = useEntities({ limit: 100 });
  const entities: Entity[] = Array.isArray(entitiesData?.data) ? entitiesData.data : [];
  const test = useTestWebhook();
  const remove = useDeleteWebhook();
  const [editing, setEditing] = useState<WebhookRow | 'new' | null>(null);
  const [runsOf, setRunsOf] = useState<WebhookRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const canCreate = hasModuleAction('automations', 'canCreate');
  const canUpdate = hasModuleAction('automations', 'canUpdate');
  const canDelete = hasModuleAction('automations', 'canDelete');
  const entityName = (id: string | null) => (id ? entities.find((e) => e.id === id)?.name ?? '—' : t('allTables'));

  const runTest = async (w: WebhookRow) => {
    setBusyId(w.id);
    try {
      const result = await test.mutateAsync(w.id);
      if (result?.status === 'success') toast.success(t('testOk', { code: result.responseStatus ?? 200 }));
      else toast.error(t('testFail', { error: result?.errorMessage ?? result?.status ?? '?' }));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const doDelete = async (id: string) => {
    try {
      await remove.mutateAsync(id);
      toast.success(t('deleted'));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setConfirmId(null);
    }
  };

  return (
    <Card data-testid="webhooks-panel">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-base">{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </div>
        {canCreate && (
          <Button size="sm" onClick={() => setEditing('new')} data-testid="new-webhook">
            <Plus className="mr-2 h-4 w-4" />
            {t('new')}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        {data?.length === 0 && <p className="text-sm text-muted-foreground">{t('empty')}</p>}
        {data?.map((w) => (
          <div key={w.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3" data-testid={`webhook-${w.name}`}>
            <Webhook className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {w.name}
                <Badge variant={w.status === 'ACTIVE' ? 'success' : 'outline'}>{t(`status.${w.status}`)}</Badge>
              </p>
              <p className="truncate font-mono text-xs text-muted-foreground">{w.url}</p>
              <p className="text-xs text-muted-foreground">
                {entityName(w.entityId)} · {w.events.map((e) => (t.has(`events.${e}`) ? t(`events.${e}`) : e)).join(', ')}
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              {canUpdate && (
                <Button size="sm" variant="ghost" disabled={busyId === w.id} onClick={() => runTest(w)} data-testid={`test-${w.name}`}>
                  {busyId === w.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
                  {t('test')}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setRunsOf(w)} data-testid={`runs-${w.name}`}>
                <History className="mr-1.5 h-4 w-4" />
                {t('runs')}
              </Button>
              {canUpdate && (
                <Button size="sm" variant="ghost" onClick={() => setEditing(w)} aria-label={t('edit')} data-testid={`edit-${w.name}`}>
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {canDelete && (
                confirmId === w.id ? (
                  <Button size="sm" variant="destructive" onClick={() => doDelete(w.id)} data-testid={`confirm-delete-${w.name}`}>{t('confirmDelete')}</Button>
                ) : (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmId(w.id)} aria-label={t('delete')} data-testid={`delete-${w.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )
              )}
            </div>
          </div>
        ))}
      </CardContent>
      <WebhookDialog webhook={editing} entities={entities} onClose={() => setEditing(null)} />
      <RunsDialog webhook={runsOf} onClose={() => setRunsOf(null)} />
    </Card>
  );
}

function randomSecret() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function WebhookDialog({ webhook, entities, onClose }: { webhook: WebhookRow | 'new' | null; entities: Entity[]; onClose: () => void }) {
  const t = useTranslations('gestao.integrations.webhooks');
  const create = useCreateWebhook();
  const update = useUpdateWebhook();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [entityId, setEntityId] = useState(ALL);
  const [events, setEvents] = useState<WebhookEvent[]>(['created']);
  const [secret, setSecret] = useState('');
  const [active, setActive] = useState(true);
  const existing = webhook && webhook !== 'new' ? webhook : null;

  useEffect(() => {
    if (!webhook) return;
    setName(existing?.name ?? '');
    setUrl(existing?.url ?? 'https://');
    setEntityId(existing?.entityId ?? ALL);
    setEvents((existing?.events.filter((e): e is WebhookEvent => EVENTS.includes(e as WebhookEvent))) ?? ['created']);
    setSecret(existing?.secret ?? randomSecret());
    setActive(existing ? existing.status === 'ACTIVE' : true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webhook]);

  const toggle = (e: WebhookEvent) => setEvents((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = {
      name: name.trim(),
      url: url.trim(),
      events,
      secret: secret.trim() || undefined,
      status: (active ? 'ACTIVE' : 'INACTIVE') as WebhookRow['status'],
      ...(entityId !== ALL && { entityId }),
    };
    try {
      if (existing) await update.mutateAsync({ id: existing.id, ...body, entityId: entityId === ALL ? undefined : entityId });
      else await create.mutateAsync(body);
      toast.success(t('saved'));
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const saving = create.isPending || update.isPending;

  return (
    <Dialog open={!!webhook} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{existing ? t('editTitle') : t('newTitle')}</DialogTitle>
            <DialogDescription>{t('dialogHint')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="wh-name">{t('name')}</Label>
            <Input id="wh-name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wh-url">{t('url')}</Label>
            <Input id="wh-url" required type="url" value={url} onChange={(e) => setUrl(e.target.value)} className="font-mono text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label>{t('table')}</Label>
            <Select value={entityId} onValueChange={setEntityId}>
              <SelectTrigger data-testid="wh-table"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('allTables')}</SelectItem>
                {entities.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('when')}</Label>
            <div className="flex flex-wrap gap-4">
              {EVENTS.map((e) => (
                <label key={e} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={events.includes(e)} onCheckedChange={() => toggle(e)} data-testid={`wh-event-${e}`} />
                  {t(`events.${e}`)}
                </label>
              ))}
            </div>
          </div>
          <details className="rounded-lg border px-3 py-2">
            <summary className="cursor-pointer select-none text-xs text-muted-foreground">{t('secret')}</summary>
            <div className="mt-2 space-y-1.5">
              <Input id="wh-secret" aria-label={t('secret')} value={secret} onChange={(e) => setSecret(e.target.value)} className="font-mono text-xs" />
              <p className="text-xs text-muted-foreground">{t('secretHint')}</p>
            </div>
          </details>
          <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
            {t('active')}
            <Switch checked={active} onCheckedChange={setActive} />
          </label>
          <DialogFooter>
            <Button type="submit" disabled={saving || !name.trim() || events.length === 0} data-testid="wh-save">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RunsDialog({ webhook, onClose }: { webhook: WebhookRow | null; onClose: () => void }) {
  const t = useTranslations('gestao.integrations.webhooks');
  const formatDate = useFormatDate();
  const { data, isLoading } = useWebhookRuns(webhook?.id ?? null);
  return (
    <Dialog open={!!webhook} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('runsTitle', { name: webhook?.name ?? '' })}</DialogTitle>
        </DialogHeader>
        <div className="max-h-80 space-y-2 overflow-y-auto" data-testid="webhook-runs">
          {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          {data?.length === 0 && <p className="text-sm text-muted-foreground">{t('noRuns')}</p>}
          {data?.map((r, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded border p-2 text-xs">
              <Badge variant={r.status === 'success' ? 'success' : 'destructive'}>{r.responseStatus ?? r.status}</Badge>
              <span className="text-muted-foreground">{formatDate(r.createdAt, true)}</span>
              {r.event && <span>· {r.event}</span>}
              {r.errorMessage && <span className="w-full truncate text-destructive">{r.errorMessage}</span>}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Copy, KeyRound, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '@/hooks/use-integrations';
import { useCustomRoles } from '@/hooks/use-custom-roles';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuthStore } from '@/stores/auth-store';
import { useTenant } from '@/stores/tenant-context';
import { useFormatDate } from '@/components/platform/platform-ui';
import { getErrorMessage } from '@/lib/get-error-message';
import type { CreatedApiKey } from '@/services/integrations.service';
import type { CustomRole } from '@/types';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').replace(/\/$/, '');

export function ApiKeysPanel() {
  const t = useTranslations('gestao.integrations.keys');
  const formatDate = useFormatDate();
  const { hasModulePermission } = usePermissions();
  const { data, isLoading } = useApiKeys();
  const revoke = useRevokeApiKey();
  const [open, setOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const doRevoke = async (id: string) => {
    try {
      await revoke.mutateAsync(id);
      toast.success(t('revoked'));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setConfirmId(null);
    }
  };

  return (
    <Card data-testid="api-keys-panel">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-base">{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </div>
        {hasModulePermission('apis', 'canCreate') && (
          <Button size="sm" onClick={() => setOpen(true)} data-testid="new-api-key">
            <Plus className="mr-2 h-4 w-4" />
            {t('new')}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        {data?.length === 0 && <p className="text-sm text-muted-foreground">{t('empty')}</p>}
        {data?.map((k) => (
          <div key={k.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3" data-testid={`api-key-${k.name}`}>
            <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{k.name} <span className="font-mono text-xs text-muted-foreground">{k.prefix}…</span></p>
              <p className="text-xs text-muted-foreground">
                {t('meta', { role: k.customRole.name, by: k.createdBy.name })}
                {' · '}
                {k.lastUsedAt ? t('lastUsed', { date: formatDate(k.lastUsedAt, true) }) : t('neverUsed')}
                {k.expiresAt && ` · ${t('expires', { date: formatDate(k.expiresAt) })}`}
              </p>
            </div>
            {hasModulePermission('apis', 'canDelete') && (
              confirmId === k.id ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" disabled={revoke.isPending} onClick={() => doRevoke(k.id)} data-testid={`confirm-revoke-${k.name}`}>{t('confirmRevoke')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>{t('cancel')}</Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmId(k.id)} data-testid={`revoke-${k.name}`}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('revoke')}
                </Button>
              )
            )}
          </div>
        ))}
        <div className="rounded-lg bg-muted/60 p-3 text-xs">
          <p className="mb-1 font-medium">{t('howTo')}</p>
          <code className="block overflow-x-auto whitespace-pre font-mono text-[11px]">
            {`curl -H "X-API-Key: crm_..." ${API_BASE}/data/<tabela>`}
          </code>
        </div>
      </CardContent>
      <NewApiKeyDialog open={open} onOpenChange={setOpen} />
    </Card>
  );
}

function NewApiKeyDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('gestao.integrations.keys');
  const me = useAuthStore((s) => s.user);
  const { tenant } = useTenant();
  const { data } = useCustomRoles();
  const create = useCreateApiKey();
  const [name, setName] = useState('');
  const [roleId, setRoleId] = useState('');
  const [validity, setValidity] = useState('365');
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [copied, setCopied] = useState(false);

  // Mesma regra do convite: so cargos abaixo do seu (o dono da qualquer um).
  const myRank = me?.customRole?.rank ?? Number.MAX_SAFE_INTEGER;
  const iAmOwner = !!me && me.id === tenant?.ownerId;
  const roles = (Array.isArray(data?.data) ? data.data : [])
    .filter((r: CustomRole) => iAmOwner || (r.rank ?? 100) > myRank)
    .sort((a: CustomRole, b: CustomRole) => (a.rank ?? 100) - (b.rank ?? 100));

  const close = (value: boolean) => {
    if (!value) {
      setName('');
      setRoleId('');
      setValidity('365');
      setCreated(null);
      setCopied(false);
    }
    onOpenChange(value);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setCreated(await create.mutateAsync({ name: name.trim(), customRoleId: roleId, expiresInDays: validity === 'never' ? null : Number(validity) }));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const copy = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(created.key);
    setCopied(true);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{created ? t('createdTitle') : t('newTitle')}</DialogTitle>
          <DialogDescription>{created ? t('createdHint') : t('newHint')}</DialogDescription>
        </DialogHeader>
        {created ? (
          <>
            <div className="flex gap-2" data-testid="api-key-created">
              <Input value={created.key} readOnly className="font-mono text-xs" data-testid="api-key-value" onFocus={(e) => e.target.select()} />
              <Button type="button" variant="outline" size="icon" onClick={copy} aria-label={t('copy')}>
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <DialogFooter><Button onClick={() => close(false)}>{t('done')}</Button></DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="api-key-name">{t('name')}</Label>
              <Input id="api-key-name" required minLength={2} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('namePlaceholder')} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('role')}</Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger data-testid="api-key-role"><SelectValue placeholder={t('chooseRole')} /></SelectTrigger>
                <SelectContent>
                  {roles.map((r: CustomRole) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t('roleHint')}</p>
            </div>
            <div className="space-y-1.5">
              <Label>{t('validity')}</Label>
              <Select value={validity} onValueChange={setValidity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['30', '90', '365', 'never'].map((v) => <SelectItem key={v} value={v}>{t(`validities.${v}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!name.trim() || !roleId || create.isPending} data-testid="api-key-submit">
                {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('create')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

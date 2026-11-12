'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, Megaphone, Pencil, Plus, Send, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/platform/platform-ui';
import { usePlatformCan, usePlatformPlans, usePlatformTenants } from '@/hooks/use-platform';
import { getErrorMessage } from '@/lib/get-error-message';
import { TENANT_LIFECYCLES } from '@/types/platform';
import {
  type AnnouncementForm, type AudienceType, type ConsoleAnnouncement, type Severity,
  useAnnouncementReach, useConsoleAnnouncements, useDeleteAnnouncement, usePublishAnnouncement, useSaveAnnouncement,
} from '@/components/announcements/console-announcements-api';

const STATE_VARIANT = { draft: 'outline', scheduled: 'secondary', active: 'success', ended: 'outline' } as const;
const SEVERITY_VARIANT = { INFO: 'secondary', WARNING: 'warning', CRITICAL: 'destructive' } as const;

/** datetime-local <-> ISO */
const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function ConsoleAnnouncementsPage() {
  const t = useTranslations('announcements.console');
  const locale = useLocale();
  const can = usePlatformCan();
  const canManage = can('announcements.manage');
  const { data, isLoading } = useConsoleAnnouncements();
  const publish = usePublishAnnouncement();
  const remove = useDeleteAnnouncement();
  const [editing, setEditing] = useState<ConsoleAnnouncement | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<ConsoleAnnouncement | null>(null);
  const when = (iso: string) => new Date(iso).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
  const onErr = (e: unknown) => toast.error(getErrorMessage(e));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={canManage && <Button onClick={() => setEditing('new')} data-testid="announcement-new"><Plus className="mr-2 h-4 w-4" /> {t('new')}</Button>}
      />
      {isLoading ? <Skeleton className="h-40" /> : !data?.length ? (
        <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground" data-testid="announcements-empty">
          <Megaphone className="h-8 w-8" />{t('empty')}
        </CardContent></Card>
      ) : (
        <div className="space-y-3" data-testid="announcements-list">
          {data.map((a) => (
            <Card key={a.id} data-testid={`console-announcement-${a.title}`}>
              <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-start">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {a.title}
                    <Badge variant={STATE_VARIANT[a.state]} data-testid={`state-${a.state}`}>{t(`state.${a.state}`)}</Badge>
                    <Badge variant={SEVERITY_VARIANT[a.severity]}>{t(`severity.${a.severity}`)}</Badge>
                  </p>
                  <p className="whitespace-pre-line text-sm text-muted-foreground">{a.body}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(`audience.${a.audience.type}`)}{a.audience.type !== 'all' && ` (${a.audience.ids.length})`}
                    {a.adminsOnly && ` · ${t('adminsOnlyShort')}`}
                    {' · '}{t('period', { start: when(a.startsAt), end: a.endsAt ? when(a.endsAt) : t('noEnd') })}
                    {' · '}<span data-testid="announcement-stats">{t('stats', { reach: a.reach, dismissed: a.dismissals })}</span>
                  </p>
                </div>
                {canManage && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {a.publishedAt ? (
                      <Button size="sm" variant="outline" onClick={() => publish.mutate({ id: a.id, published: false }, { onSuccess: () => toast.success(t('unpublished')), onError: onErr })} data-testid="announcement-unpublish">
                        <Undo2 className="mr-1 h-4 w-4" /> {t('unpublish')}
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => publish.mutate({ id: a.id, published: true }, { onSuccess: () => toast.success(t('published')), onError: onErr })} data-testid="announcement-publish">
                        <Send className="mr-1 h-4 w-4" /> {t('publish')}
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(a)} aria-label={t('edit')} data-testid="announcement-edit"><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label={t('delete')} data-testid="announcement-delete"
                      onClick={() => setToDelete(a)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {editing && <AnnouncementDialog item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteConfirmTitle', { title: toDelete?.title ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteConfirmText')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="announcement-delete-confirm"
              onClick={() => {
                if (!toDelete) return;
                remove.mutate(toDelete.id, { onSuccess: () => toast.success(t('deleted')), onError: onErr });
                setToDelete(null);
              }}
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AnnouncementDialog({ item, onClose }: { item: ConsoleAnnouncement | null; onClose: () => void }) {
  const t = useTranslations('announcements.console');
  const tLife = useTranslations('platform.lifecycle');
  const save = useSaveAnnouncement();
  const [form, setForm] = useState<AnnouncementForm>(() => item ? {
    title: item.title, body: item.body, severity: item.severity, audience: item.audience, adminsOnly: item.adminsOnly,
    dismissible: item.dismissible, linkUrl: item.linkUrl, linkLabel: item.linkLabel, startsAt: item.startsAt, endsAt: item.endsAt,
  } : {
    title: '', body: '', severity: 'INFO', audience: { type: 'all', ids: [] }, adminsOnly: false, dismissible: true,
    linkUrl: null, linkLabel: null, startsAt: new Date().toISOString(), endsAt: null,
  });
  const set = (patch: Partial<AnnouncementForm>) => setForm((f) => ({ ...f, ...patch }));
  const { data: reach } = useAnnouncementReach(form.audience);
  const { data: plans } = usePlatformPlans();
  const [tenantSearch, setTenantSearch] = useState('');
  const { data: tenants } = usePlatformTenants({ search: tenantSearch || undefined, limit: 20 });
  const toggleId = (id: string) => set({ audience: { ...form.audience, ids: form.audience.ids.includes(id) ? form.audience.ids.filter((x) => x !== id) : [...form.audience.ids, id] } });

  const options = useMemo(() => {
    if (form.audience.type === 'plans') return (plans ?? []).map((p) => ({ id: p.id, label: p.name }));
    if (form.audience.type === 'lifecycles') return TENANT_LIFECYCLES.filter((l) => l !== 'CANCELED').map((l) => ({ id: l, label: tLife(l) }));
    if (form.audience.type === 'tenants') return (tenants?.data ?? []).map((tn) => ({ id: tn.id, label: tn.name }));
    return [];
  }, [form.audience.type, plans, tenants, tLife]);

  const submit = () => save.mutate({ ...form, id: item?.id, linkUrl: form.linkUrl || null }, {
    onSuccess: () => { toast.success(t('saved')); onClose(); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>{item ? t('editTitle') : t('new')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="ann-title">{t('fields.title')}</Label>
            <Input id="ann-title" value={form.title} onChange={(e) => set({ title: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ann-body">{t('fields.body')}</Label>
            <Textarea id="ann-body" rows={3} value={form.body} onChange={(e) => set({ body: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>{t('fields.severity')}</Label>
              <Select value={form.severity} onValueChange={(v) => set({ severity: v as Severity })}>
                <SelectTrigger data-testid="ann-severity"><SelectValue /></SelectTrigger>
                <SelectContent>{(['INFO', 'WARNING', 'CRITICAL'] as const).map((s) => <SelectItem key={s} value={s}>{t(`severity.${s}`)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t('fields.audience')}</Label>
              <Select value={form.audience.type} onValueChange={(v) => set({ audience: { type: v as AudienceType, ids: [] } })}>
                <SelectTrigger data-testid="ann-audience"><SelectValue /></SelectTrigger>
                <SelectContent>{(['all', 'plans', 'lifecycles', 'tenants'] as const).map((a) => <SelectItem key={a} value={a}>{t(`audience.${a}`)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          {form.audience.type !== 'all' && (
            <div className="space-y-2 rounded-lg border p-3">
              {form.audience.type === 'tenants' && (
                <Input placeholder={t('searchTenant')} value={tenantSearch} onChange={(e) => setTenantSearch(e.target.value)} data-testid="ann-tenant-search" />
              )}
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {options.map((o) => (
                  <label key={o.id} className="flex cursor-pointer items-center gap-2 text-sm" data-testid={`ann-option-${o.label}`}>
                    <Checkbox checked={form.audience.ids.includes(o.id)} onCheckedChange={() => toggleId(o.id)} /> {o.label}
                  </label>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground" data-testid="ann-reach">{reach ? t('reach', { n: reach.tenants }) : t('reachPick')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="ann-start">{t('fields.startsAt')}</Label>
              <Input id="ann-start" type="datetime-local" value={toLocalInput(form.startsAt)} onChange={(e) => e.target.value && set({ startsAt: new Date(e.target.value).toISOString() })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ann-end">{t('fields.endsAt')}</Label>
              <Input id="ann-end" type="datetime-local" value={toLocalInput(form.endsAt)} onChange={(e) => set({ endsAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="ann-link">{t('fields.linkUrl')}</Label>
              <Input id="ann-link" placeholder="https://" value={form.linkUrl ?? ''} onChange={(e) => set({ linkUrl: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ann-link-label">{t('fields.linkLabel')}</Label>
              <Input id="ann-link-label" value={form.linkLabel ?? ''} onChange={(e) => set({ linkLabel: e.target.value || null })} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="ann-admins" className="text-sm">{t('fields.adminsOnly')}</Label>
            <Switch id="ann-admins" checked={form.adminsOnly} onCheckedChange={(v) => set({ adminsOnly: v })} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="ann-dismiss" className="text-sm">{t('fields.dismissible')}</Label>
            <Switch id="ann-dismiss" checked={form.dismissible} onCheckedChange={(v) => set({ dismissible: v })} data-testid="ann-dismissible" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
          <Button onClick={submit} disabled={form.title.trim().length < 3 || form.body.trim().length < 3 || save.isPending} data-testid="ann-save">
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

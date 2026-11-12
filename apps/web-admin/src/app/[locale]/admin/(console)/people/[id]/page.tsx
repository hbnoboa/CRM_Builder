'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, Crown, KeyRound, Loader2, LogIn, LogOut, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LifecycleBadge } from '@/components/platform/platform-ui';
import { usePerson, usePersonAction } from '@/components/platform/people-api';
import { describeDevice } from '@/components/security/security-api';
import { platformApi } from '@/lib/platform-api';
import { startPlatformImpersonation } from '@/lib/platform-impersonation';
import { usePlatformCan, type PlatformImpersonation } from '@/hooks/use-platform';
import { getErrorMessage } from '@/lib/get-error-message';

type Action = 'password-reset' | 'logout' | 'mfa-reset';

export default function PersonPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('people');
  const locale = useLocale();
  const can = usePlatformCan();
  const { data: p, isLoading } = usePerson(id);
  const action = usePersonAction(id);
  const [confirm, setConfirm] = useState<Action | null>(null);
  const [entering, setEntering] = useState<string | null>(null);
  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' }) : t('never'));

  if (isLoading || !p) return <Skeleton className="h-96" />;
  const canSupport = can('users.support');

  const enterAs = async (tenantId: string) => {
    setEntering(tenantId);
    try {
      const session = (await platformApi.post<PlatformImpersonation>(`/tenants/${tenantId}/users/${p.id}/impersonate`)).data;
      startPlatformImpersonation(session, locale);
    } catch (e) {
      toast.error(getErrorMessage(e));
      setEntering(null);
    }
  };

  const run = (a: Action) => action.mutate(a, {
    onSuccess: () => { toast.success(t(`done.${a}`)); setConfirm(null); },
    onError: (e) => { toast.error(getErrorMessage(e)); setConfirm(null); },
  });

  return (
    <div className="space-y-6">
      <Link href="/admin/people" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="h-4 w-4" /> {t('back')}
      </Link>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">{p.name}</h1>
          <p className="text-sm text-muted-foreground">{p.email}{p.phone ? ` · ${p.phone}` : ''}</p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {p.status !== 'ACTIVE' && <Badge variant="outline">{t(`status.${p.status}`)}</Badge>}
            <span>{t('since', { when: when(p.createdAt) })}</span>·<span>{t('lastLogin', { when: when(p.lastLoginAt) })}</span>·
            <span data-testid="person-mfa">{p.mfaEnabled ? t('mfaOn') : t('mfaOff')}</span>
          </p>
        </div>
        {canSupport && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirm('password-reset')} disabled={p.status !== 'ACTIVE'} data-testid="person-reset"><KeyRound className="mr-2 h-4 w-4" />{t('actions.password-reset')}</Button>
            <Button variant="outline" size="sm" onClick={() => setConfirm('logout')} disabled={p.activeSessions === 0} data-testid="person-logout"><LogOut className="mr-2 h-4 w-4" />{t('actions.logout')}</Button>
            <Button variant="outline" size="sm" className="text-destructive" onClick={() => setConfirm('mfa-reset')} disabled={!p.mfaEnabled} data-testid="person-mfa-reset"><ShieldOff className="mr-2 h-4 w-4" />{t('actions.mfa-reset')}</Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{t('companies')}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead>{t('company')}</TableHead><TableHead>{t('role')}</TableHead><TableHead>{t('situation')}</TableHead><TableHead /></TableRow>
              </TableHeader>
              <TableBody data-testid="person-memberships">
                {p.memberships.length === 0 && <TableRow><TableCell colSpan={4} className="text-muted-foreground">{t('noCompany')}</TableCell></TableRow>}
                {p.memberships.map((m) => (
                  <TableRow key={m.tenant.id} data-testid={`membership-${m.tenant.slug}`}>
                    <TableCell className="min-w-40">
                      <Link href={`/admin/tenants/${m.tenant.id}`} className="font-medium hover:underline">{m.tenant.name}</Link>
                      <div className="mt-1"><LifecycleBadge lifecycle={m.tenant.lifecycle} /></div>
                    </TableCell>
                    <TableCell>{m.isOwner && <Crown className="mr-1 inline h-3 w-3 text-amber-600" />}{m.role}</TableCell>
                    <TableCell>{t(`membership.${m.status}`)}</TableCell>
                    <TableCell className="text-right">
                      {can('tenants.impersonate') && m.status === 'ACTIVE' && (
                        <Button size="sm" variant="outline" disabled={entering !== null} onClick={() => enterAs(m.tenant.id)} data-testid={`enter-${m.tenant.slug}`}>
                          {entering === m.tenant.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}{t('enterAs')}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">{t('devicesTitle', { n: p.sessions.length })}</CardTitle></CardHeader>
          <CardContent className="space-y-2" data-testid="person-sessions">
            {p.sessions.length === 0 && <p className="text-sm text-muted-foreground">{t('noDevices')}</p>}
            {p.sessions.map((s) => {
              const d = describeDevice(s.userAgent);
              return (
                <div key={s.id} className="text-sm">
                  <p className="font-medium">{d.browser}{d.os ? ` · ${d.os}` : ''}{s.label ? ` · ${s.label}` : ''}</p>
                  <p className="text-xs text-muted-foreground">{s.ip ?? '—'} · {t('lastUsed', { when: when(s.lastUsedAt) })}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">{t('recentActions')}</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {p.recentActions.length === 0 && <p className="text-sm text-muted-foreground">{t('noActions')}</p>}
            {p.recentActions.map((a, i) => (
              <p key={i} className="text-xs"><span className="text-muted-foreground">{when(a.createdAt)}</span> · {a.action} · {a.resource}</p>
            ))}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm && t(`confirm.${confirm}.title`, { name: p.name })}</AlertDialogTitle>
            <AlertDialogDescription>{confirm && t(`confirm.${confirm}.body`, { email: p.email })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirm && run(confirm)} data-testid="person-confirm">
              {action.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('confirmButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

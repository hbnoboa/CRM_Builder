'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, LogOut, ShieldAlert, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { GestaoPageHeader } from '@/components/gestao/gestao-ui';
import { useFormatDate } from '@/components/platform/platform-ui';
import { securityApi } from '@/components/security/security-api';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuthStore } from '@/stores/auth-store';
import { getErrorMessage } from '@/lib/get-error-message';

export default function GestaoSecurityPage() {
  const t = useTranslations('gestao.security');
  const { hasModulePermission } = usePermissions();
  const canEditPolicy = hasModulePermission('settings', 'canUpdate');
  const canSeeTeam = hasModulePermission('users', 'canRead');

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <GestaoPageHeader title={t('title')} subtitle={t('subtitle')} />
      <PolicyCard editable={canEditPolicy} />
      {canSeeTeam && <TeamCard canLogout={hasModulePermission('users', 'canUpdate')} />}
    </div>
  );
}

function PolicyCard({ editable }: { editable: boolean }) {
  const t = useTranslations('gestao.security.policy');
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['security', 'policy'], queryFn: securityApi.policy });
  const [requireMfa, setRequireMfa] = useState(false);
  const [minLength, setMinLength] = useState(8);
  const [symbol, setSymbol] = useState(false);

  useEffect(() => {
    if (!data) return;
    setRequireMfa(data.requireMfa);
    setMinLength(data.passwordMinLength);
    setSymbol(data.passwordRequireSymbol);
  }, [data]);

  const save = useMutation({
    mutationFn: () => securityApi.updatePolicy({ requireMfa, passwordMinLength: minLength, passwordRequireSymbol: symbol }),
    onSuccess: () => {
      toast.success(t('saved'));
      qc.invalidateQueries({ queryKey: ['security'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <Card data-testid="security-policy">
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <label className="flex items-start justify-between gap-4 rounded-lg border p-3">
          <span>
            <span className="block text-sm font-medium">{t('requireMfa')}</span>
            <span className="block text-xs text-muted-foreground">{t('requireMfaHint')}</span>
          </span>
          <Switch checked={requireMfa} onCheckedChange={setRequireMfa} disabled={!editable} data-testid="policy-require-mfa" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="policy-min">{t('minLength')}</Label>
            <Input
              id="policy-min"
              type="number"
              min={8}
              max={64}
              value={minLength}
              disabled={!editable}
              onChange={(e) => setMinLength(Math.min(64, Math.max(8, Number(e.target.value) || 8)))}
              className="w-28"
            />
          </div>
          <label className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <span>
              <span className="block text-sm font-medium">{t('symbol')}</span>
              <span className="block text-xs text-muted-foreground">{t('symbolHint')}</span>
            </span>
            <Switch checked={symbol} onCheckedChange={setSymbol} disabled={!editable} data-testid="policy-symbol" />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">{t('baseRule')}</p>
        {editable && (
          <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="policy-save">
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('save')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function TeamCard({ canLogout }: { canLogout: boolean }) {
  const t = useTranslations('gestao.security.team');
  const formatDate = useFormatDate();
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['security', 'members'], queryFn: securityApi.members });
  const [busyId, setBusyId] = useState<string | null>(null);

  const logout = async (userId: string) => {
    setBusyId(userId);
    try {
      const r = await securityApi.logoutMember(userId);
      toast.success(t('loggedOut', { count: r.revoked }));
      qc.invalidateQueries({ queryKey: ['security', 'members'] });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const withMfa = data?.filter((m) => m.mfaEnabled).length ?? 0;

  return (
    <Card data-testid="security-team">
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <CardDescription>{data ? t('summary', { withMfa, total: data.length }) : t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        {data?.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3" data-testid={`security-member-${m.email}`}>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {m.name}
                {m.mfaEnabled
                  ? <Badge variant="success" className="gap-1"><ShieldCheck className="h-3 w-3" />{t('mfaOn')}</Badge>
                  : <Badge variant="outline" className="gap-1"><ShieldAlert className="h-3 w-3" />{t('mfaOff')}</Badge>}
                {!m.active && <Badge variant="outline">{t('inactive')}</Badge>}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {m.email} · {m.role} · {m.lastLoginAt ? t('lastLogin', { date: formatDate(m.lastLoginAt, true) }) : t('neverLogged')} · {t('devices', { count: m.activeSessions })}
              </p>
            </div>
            {canLogout && m.id !== me?.id && m.activeSessions > 0 && (
              <Button size="sm" variant="outline" disabled={busyId === m.id} onClick={() => logout(m.id)} data-testid={`logout-member-${m.email}`}>
                {busyId === m.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
                {t('logout')}
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

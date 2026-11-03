'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, RotateCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useInvitations, useResendInvitation, useRevokeInvitation } from '@/hooks/use-invitations';
import { useFormatDate } from '@/components/platform/platform-ui';
import { getErrorMessage } from '@/lib/get-error-message';
import { InviteLinkBox } from './invite-user-dialog';
import type { InvitationDelivery } from '@/services/invitations.service';

/** Convites ainda nao aceitos: reenviar (link novo) ou cancelar. */
export function PendingInvitations({ canManage }: { canManage: boolean }) {
  const t = useTranslations('users.invite');
  const formatDate = useFormatDate();
  const { data } = useInvitations();
  const resend = useResendInvitation();
  const revoke = useRevokeInvitation();
  const [delivery, setDelivery] = useState<InvitationDelivery | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!data?.length) return null;

  const run = async (id: string, action: 'resend' | 'revoke') => {
    setBusyId(id);
    try {
      if (action === 'resend') setDelivery(await resend.mutateAsync(id));
      else {
        await revoke.mutateAsync(id);
        toast.success(t('revoked'));
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card data-testid="pending-invitations">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('pendingTitle', { count: data.length })}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        {data.map((inv) => (
          <div key={inv.id} className="flex flex-wrap items-center gap-2 py-2.5" data-testid={`invitation-${inv.email}`}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{inv.name ? `${inv.name} · ${inv.email}` : inv.email}</p>
              <p className="text-xs text-muted-foreground">
                {inv.customRole.name}
                {inv.invitedBy && ` · ${t('by', { name: inv.invitedBy.name })}`}
                {' · '}
                {inv.expired ? t('expiredAt', { date: formatDate(inv.expiresAt) }) : t('expiresAt', { date: formatDate(inv.expiresAt) })}
              </p>
            </div>
            {inv.expired && <Badge variant="warning">{t('expired')}</Badge>}
            {canManage && (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" disabled={busyId === inv.id} onClick={() => run(inv.id, 'resend')} data-testid={`resend-${inv.email}`}>
                  {busyId === inv.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RotateCw className="mr-1.5 h-4 w-4" />}
                  {t('resend')}
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" disabled={busyId === inv.id} onClick={() => run(inv.id, 'revoke')} data-testid={`revoke-${inv.email}`}>
                  <X className="mr-1.5 h-4 w-4" />
                  {t('revoke')}
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
      <Dialog open={!!delivery} onOpenChange={(o) => !o && setDelivery(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('resentTitle')}</DialogTitle></DialogHeader>
          {delivery && <InviteLinkBox delivery={delivery} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

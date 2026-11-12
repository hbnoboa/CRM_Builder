'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Copy, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCustomRoles } from '@/hooks/use-custom-roles';
import { useCreateInvitation } from '@/hooks/use-invitations';
import { useAuthStore } from '@/stores/auth-store';
import { useTenant } from '@/stores/tenant-context';
import { getErrorMessage } from '@/lib/get-error-message';
import type { InvitationDelivery } from '@/services/invitations.service';
import type { CustomRole } from '@/types';

/** Campo com o link do convite e botao de copiar (para mandar por WhatsApp etc.). */
export function InviteLinkBox({ delivery }: { delivery: InvitationDelivery }) {
  const t = useTranslations('users.invite');
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(delivery.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="space-y-2" data-testid="invite-result">
      <p className="text-sm">
        {delivery.emailSent ? t('sent', { email: delivery.email }) : t('notSent', { email: delivery.email })}
      </p>
      <div className="flex gap-2">
        <Input value={delivery.link} readOnly className="font-mono text-xs" data-testid="invite-link" onFocus={(e) => e.target.select()} />
        <Button type="button" variant="outline" size="icon" onClick={copy} aria-label={t('copy')} data-testid="invite-copy">
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export function InviteUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('users.invite');
  const me = useAuthStore((s) => s.user);
  const { tenant } = useTenant();
  const { data } = useCustomRoles();
  const create = useCreateInvitation();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [roleId, setRoleId] = useState('');
  const [delivery, setDelivery] = useState<InvitationDelivery | null>(null);

  // So cargos que eu posso dar: abaixo do meu (o dono da empresa da qualquer um).
  const myRank = me?.customRole?.rank ?? Number.MAX_SAFE_INTEGER;
  const iAmOwner = !!me && me.id === tenant?.ownerId;
  const roles = (Array.isArray(data?.data) ? data.data : [])
    .filter((r: CustomRole) => iAmOwner || (r.rank ?? 100) > myRank)
    .sort((a: CustomRole, b: CustomRole) => (a.rank ?? 100) - (b.rank ?? 100));

  useEffect(() => {
    if (!open) return;
    setEmail('');
    setName('');
    setDelivery(null);
    setRoleId(roles.find((r: CustomRole) => r.isDefault)?.id ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setDelivery(await create.mutateAsync({ email: email.trim(), name: name.trim() || undefined, customRoleId: roleId }));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        {delivery ? (
          <>
            <InviteLinkBox delivery={delivery} />
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setDelivery(null)}>{t('another')}</Button>
              <Button onClick={() => onOpenChange(false)}>{t('done')}</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">{t('email')}</Label>
              <Input id="invite-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-name">{t('name')}</Label>
              <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('namePlaceholder')} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('role')}</Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger data-testid="invite-role"><SelectValue placeholder={t('chooseRole')} /></SelectTrigger>
                <SelectContent>
                  {roles.map((r: CustomRole) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!email || !roleId || create.isPending} data-testid="invite-submit">
                {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                {t('submit')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

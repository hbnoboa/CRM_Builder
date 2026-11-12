'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader, useFormatDate } from '@/components/platform/platform-ui';
import {
  useCreateStaff,
  usePlatformCan,
  usePlatformMe,
  usePlatformStaff,
  useRemoveStaff,
  useUpdateStaff,
} from '@/hooks/use-platform';
import { getErrorMessage } from '@/lib/get-error-message';
import { STAFF_ROLES, type PlatformStaffRole, type PlatformStaffRow } from '@/types/platform';

export default function PlatformStaffPage() {
  const t = useTranslations('platform.staff');
  const tRoles = useTranslations('platform.roles');
  const formatDate = useFormatDate();
  const can = usePlatformCan();
  const { data: me } = usePlatformMe();
  const { data: staff, isLoading } = usePlatformStaff(can('staff.read'));
  const update = useUpdateStaff();
  const [createOpen, setCreateOpen] = useState(false);
  const [removing, setRemoving] = useState<PlatformStaffRow | null>(null);
  const [resetting, setResetting] = useState<PlatformStaffRow | null>(null);
  const manage = can('staff.manage');

  const patch = async (id: string, body: { role?: PlatformStaffRole; status?: string }) => {
    try {
      await update.mutateAsync({ id, ...body });
      toast.success(t('saved'));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          manage && (
            <Button onClick={() => setCreateOpen(true)} data-testid="platform-new-staff">
              <Plus className="mr-2 h-4 w-4" />
              {t('new')}
            </Button>
          )
        }
      />

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('columns.name')}</TableHead>
                <TableHead className="min-w-40">{t('columns.role')}</TableHead>
                <TableHead>{t('columns.status')}</TableHead>
                <TableHead>{t('columns.lastLogin')}</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              )}
              {staff?.map((row) => {
                const isMe = row.id === me?.id;
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">
                        {row.name} {isMe && <span className="text-xs text-muted-foreground">({t('you')})</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{row.email}</div>
                    </TableCell>
                    <TableCell>
                      {manage && !isMe ? (
                        <Select value={row.role} onValueChange={(v) => patch(row.id, { role: v as PlatformStaffRole })}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STAFF_ROLES.map((r) => <SelectItem key={r} value={r}>{tRoles(r)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-sm">{tRoles(row.role)}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.status === 'ACTIVE' ? 'success' : 'outline'}>{t(`status.${row.status}`)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(row.lastLoginAt, true)}</TableCell>
                    <TableCell>
                      {manage && !isMe && (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => patch(row.id, { status: row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })}
                          >
                            {row.status === 'ACTIVE' ? t('deactivate') : t('activate')}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setResetting(row)}>{t('resetPassword')}</Button>
                          <Button size="icon" variant="ghost" title={t('remove')} onClick={() => setRemoving(row)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="rounded-lg border bg-background p-4 text-sm">
        <div className="mb-2 font-medium">{t('rolesTitle')}</div>
        <ul className="space-y-1 text-muted-foreground">
          {STAFF_ROLES.map((r) => (
            <li key={r}><span className="font-medium text-foreground">{tRoles(r)}:</span> {t(`roleHelp.${r}`)}</li>
          ))}
        </ul>
      </div>

      <CreateStaffDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ResetPasswordDialog staff={resetting} onClose={() => setResetting(null)} />
      <RemoveStaffDialog staff={removing} onClose={() => setRemoving(null)} />
    </div>
  );
}

function CreateStaffDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('platform.staff.create');
  const tRoles = useTranslations('platform.roles');
  const create = useCreateStaff();
  const [form, setForm] = useState({ name: '', email: '', role: 'SUPPORT' as PlatformStaffRole, password: '' });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await create.mutateAsync(form);
      toast.success(t('created'));
      setForm({ name: '', email: '', role: 'SUPPORT', password: '' });
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>{t('subtitle')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="staff-name">{t('name')}</Label>
            <Input id="staff-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="staff-email">{t('email')}</Label>
            <Input id="staff-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>{t('role')}</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as PlatformStaffRole })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAFF_ROLES.map((r) => <SelectItem key={r} value={r}>{tRoles(r)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="staff-password">{t('password')}</Label>
            <Input id="staff-password" type="password" required minLength={10} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <p className="text-xs text-muted-foreground">{t('passwordRule')}</p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ staff, onClose }: { staff: PlatformStaffRow | null; onClose: () => void }) {
  const t = useTranslations('platform.staff.reset');
  const update = useUpdateStaff();
  const [password, setPassword] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!staff) return;
    try {
      await update.mutateAsync({ id: staff.id, password });
      toast.success(t('done'));
      setPassword('');
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Dialog open={!!staff} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('title', { name: staff?.name ?? '' })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="reset-password">{t('password')}</Label>
            <Input id="reset-password" type="password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="text-xs text-muted-foreground">{t('passwordRule')}</p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={update.isPending}>{t('submit')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RemoveStaffDialog({ staff, onClose }: { staff: PlatformStaffRow | null; onClose: () => void }) {
  const t = useTranslations('platform.staff.removeDialog');
  const remove = useRemoveStaff();

  const confirm = async () => {
    if (!staff) return;
    try {
      await remove.mutateAsync(staff.id);
      toast.success(t('done'));
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Dialog open={!!staff} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title', { name: staff?.name ?? '' })}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
          <Button variant="destructive" onClick={confirm} disabled={remove.isPending}>{t('confirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

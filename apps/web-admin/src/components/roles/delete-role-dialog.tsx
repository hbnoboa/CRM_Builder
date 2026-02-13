'use client';

import { useTranslations } from 'next-intl';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDeleteCustomRole } from '@/hooks/use-custom-roles';
import { useTenant } from '@/stores/tenant-context';
import type { CustomRole } from '@/types';

interface DeleteRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: CustomRole | null;
  onSuccess?: () => void;
}

export function DeleteRoleDialog({ open, onOpenChange, role, onSuccess }: DeleteRoleDialogProps) {
  const t = useTranslations('rolesPage');
  const tCommon = useTranslations('common');
  const { effectiveTenantId } = useTenant();
  const deleteRole = useDeleteCustomRole({ success: t('toast.deleted') });

  const handleDelete = async () => {
    if (!role) return;
    try {
      await deleteRole.mutateAsync({ id: role.id, tenantId: effectiveTenantId || undefined });
      onOpenChange(false);
      onSuccess?.();
    } catch (error) { /* handled by hook */ }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('deleteConfirm.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('deleteConfirm.message', { name: role?.name || '' })}
            {' '}{t('deleteConfirm.warning')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleteRole.isPending}
          >
            {deleteRole.isPending ? tCommon('deleting') : tCommon('delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDeleteCustomApi } from '@/hooks/use-custom-apis';
import type { CustomApi } from '@/services/custom-apis.service';
import { useTranslations } from 'next-intl';

interface DeleteCustomApiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customApi: CustomApi | null;
  onSuccess?: () => void;
}

export function DeleteCustomApiDialog({ open, onOpenChange, customApi, onSuccess }: DeleteCustomApiDialogProps) {
  const t = useTranslations('apis.deleteDialog');
  const tCommon = useTranslations('common');
  const deleteCustomApi = useDeleteCustomApi();

  const handleDelete = async () => {
    if (!customApi) return;

    try {
      await deleteCustomApi.mutateAsync(customApi.id);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      // Error is handled by the hook
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('message', { name: customApi?.name ?? '' })}
            {' '}
            {t('warning')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleteCustomApi.isPending}
          >
            {deleteCustomApi.isPending ? tCommon('deleting') : tCommon('delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

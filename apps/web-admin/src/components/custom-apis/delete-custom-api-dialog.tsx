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

interface DeleteCustomApiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customApi: CustomApi | null;
  onSuccess?: () => void;
}

export function DeleteCustomApiDialog({ open, onOpenChange, customApi, onSuccess }: DeleteCustomApiDialogProps) {
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
          <AlertDialogTitle>Excluir API</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir a API <strong>{customApi?.name}</strong>?
            Esta acao nao pode ser desfeita e todas as chamadas a este endpoint deixarao de funcionar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleteCustomApi.isPending}
          >
            {deleteCustomApi.isPending ? 'Excluindo...' : 'Excluir'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

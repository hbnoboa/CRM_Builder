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
import { useDeleteTenant } from '@/hooks/use-tenants';
import type { Tenant } from '@/types';

interface DeleteTenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: Tenant | null;
  onSuccess?: () => void;
}

export function DeleteTenantDialog({ open, onOpenChange, tenant, onSuccess }: DeleteTenantDialogProps) {
  const deleteTenant = useDeleteTenant();

  const handleDelete = async () => {
    if (!tenant) return;

    try {
      await deleteTenant.mutateAsync(tenant.id);
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
          <AlertDialogTitle>Excluir Tenant</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir o tenant <strong>{tenant?.name}</strong>?
            Esta acao nao pode ser desfeita e todos os dados associados serao removidos.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleteTenant.isPending}
          >
            {deleteTenant.isPending ? 'Excluindo...' : 'Excluir'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

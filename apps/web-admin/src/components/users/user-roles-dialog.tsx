'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Shield,
  Plus,
  X,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { rolesService, type RoleWithCounts, type UserRole } from '@/services/roles.service';
import type { User } from '@/types';

interface UserRolesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onSuccess?: () => void;
}

const baseRoleColors: Record<string, string> = {
  PLATFORM_ADMIN: 'bg-purple-100 text-purple-800',
  ADMIN: 'bg-red-100 text-red-800',
  MANAGER: 'bg-blue-100 text-blue-800',
  USER: 'bg-green-100 text-green-800',
  VIEWER: 'bg-gray-100 text-gray-800',
};

export function UserRolesDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: UserRolesDialogProps) {
  const t = useTranslations('rolesPage');
  const tRoles = useTranslations('roles');
  const tRoleDesc = useTranslations('roleDescriptions');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());

  // Busca todas as roles disponiveis
  const { data: rolesData, isLoading: loadingRoles } = useQuery({
    queryKey: ['roles'],
    queryFn: rolesService.getAll,
    enabled: open,
  });

  // Extrai array de roles de forma segura
  const allRoles: RoleWithCounts[] = (() => {
    if (!rolesData) return [];
    if (Array.isArray(rolesData)) return rolesData;
    if (rolesData.data && Array.isArray(rolesData.data)) return rolesData.data;
    return [];
  })();

  // Busca roles do usuario
  const { data: userRolesData, isLoading: loadingUserRoles } = useQuery({
    queryKey: ['user-roles', user?.id],
    queryFn: () => (user ? rolesService.getUserRoles(user.id) : Promise.resolve([])),
    enabled: open && !!user,
  });

  // Extrai array de userRoles de forma segura
  const userRoles: UserRole[] = useMemo(
    () => (Array.isArray(userRolesData) ? userRolesData : []),
    [userRolesData]
  );

  // Atualiza selectedRoles apenas quando o dialog abre ou quando userRoles carrega inicialmente
  useEffect(() => {
    if (open && userRolesData !== undefined) {
      setSelectedRoles(new Set(userRoles.map((ur) => ur.roleId)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userRolesData]);

  // Mutation para atribuir role
  const assignMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      rolesService.assignToUser(userId, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles', user?.id] });
    },
  });

  // Mutation para remover role
  const removeMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      rolesService.removeFromUser(userId, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles', user?.id] });
    },
  });

  const handleRoleToggle = async (roleId: string, checked: boolean) => {
    if (!user) return;

    // Optimistic update
    setSelectedRoles((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(roleId);
      } else {
        newSet.delete(roleId);
      }
      return newSet;
    });

    try {
      if (checked) {
        await assignMutation.mutateAsync({ userId: user.id, roleId });
        toast.success(t('userRoles.roleAssigned'));
      } else {
        await removeMutation.mutateAsync({ userId: user.id, roleId });
        toast.success(t('userRoles.roleRemoved'));
      }
      onSuccess?.();
    } catch (error: any) {
      // Rollback on error
      setSelectedRoles((prev) => {
        const newSet = new Set(prev);
        if (checked) {
          newSet.delete(roleId);
        } else {
          newSet.add(roleId);
        }
        return newSet;
      });
      toast.error(error.response?.data?.message || t('userRoles.roleUpdateError'));
    }
  };

  const isLoading = loadingRoles || loadingUserRoles;
  const isMutating = assignMutation.isPending || removeMutation.isPending;

  // IMPORTANTE: Sempre renderizar o Dialog para evitar problemas com o portal do Radix
  // O controle de visibilidade deve ser feito apenas pelo prop 'open'
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t('userRoles.title')}
          </DialogTitle>
          <DialogDescription>
            {t('userRoles.subtitle', { name: user?.name || user?.email || '' })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Role Base do Usuario - so mostra se user existe */}
          {user && (
          <div className="space-y-3">
            <Label className="text-sm font-semibold">{t('userRoles.baseRole')}</Label>
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
              <div
                className={`px-2 py-1 rounded text-xs font-medium ${baseRoleColors[user.role] || 'bg-gray-100 text-gray-800'}`}
              >
                {tRoles(user.role as any) || user.role}
              </div>
              <p className="text-sm text-muted-foreground">
                {tRoleDesc(user.role as any) || ''}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('userRoles.baseRoleDescription')}
            </p>
          </div>
          )}

          {/* Roles Customizadas */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">{t('userRoles.additionalRoles')}</Label>
            <p className="text-xs text-muted-foreground mb-2">
              {t('userRoles.additionalRolesDescription')}
            </p>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : allRoles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {t('userRoles.noCustomRoles')}
                </p>
                <Button variant="link" size="sm" className="mt-2" asChild>
                  <a href="/roles">{t('userRoles.createRoles')}</a>
                </Button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {allRoles.map((role) => {
                  const isAssigned = selectedRoles.has(role.id);
                  const permissionCount = Array.isArray(role.permissions) ? role.permissions.length : 0;

                  return (
                    <div
                      key={role.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                        isAssigned ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                    >
                      <Checkbox
                        id={`role-${role.id}`}
                        checked={isAssigned}
                        onCheckedChange={(checked) =>
                          handleRoleToggle(role.id, checked as boolean)
                        }
                        disabled={isMutating}
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Label
                            htmlFor={`role-${role.id}`}
                            className="font-medium cursor-pointer"
                          >
                            {role.name}
                          </Label>
                          {role.isSystem && (
                            <Badge variant="secondary" className="text-xs">
                              {t('userRoles.system')}
                            </Badge>
                          )}
                        </div>
                        {role.description && (
                          <p className="text-xs text-muted-foreground">
                            {role.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Shield className="h-3 w-3" />
                          {permissionCount} {t('userRoles.permissions')}
                        </div>
                      </div>
                      {isAssigned && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Resumo de Permissoes */}
          {selectedRoles.size > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-sm font-semibold">{t('userRoles.assignedRoles')}</Label>
              <div className="flex flex-wrap gap-2">
                {allRoles
                  .filter((r) => selectedRoles.has(r.id))
                  .map((role) => (
                    <Badge
                      key={role.id}
                      variant="default"
                      className="flex items-center gap-1"
                    >
                      {role.name}
                      <button
                        onClick={() => handleRoleToggle(role.id, false)}
                        disabled={isMutating}
                        className="ml-1 hover:bg-primary-foreground/20 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon('close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

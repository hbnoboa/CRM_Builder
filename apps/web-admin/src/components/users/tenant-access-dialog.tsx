'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Building2, Plus, Trash2, Home, Shield } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useUserTenantAccess, useGrantTenantAccess, useRevokeTenantAccess } from '@/hooks/use-users';
import { useTenants } from '@/hooks/use-tenants';
import api from '@/lib/api';
import type { User } from '@/types';
import { useQuery } from '@tanstack/react-query';

interface TenantAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
}

export function TenantAccessDialog({ open, onOpenChange, user }: TenantAccessDialogProps) {
  const t = useTranslations('users');
  const tCommon = useTranslations('common');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');

  const { data: accessList, isLoading } = useUserTenantAccess(user?.id || null);
  const { data: tenantsData } = useTenants();
  const tenants = Array.isArray(tenantsData?.data) ? tenantsData.data : [];

  const grantAccess = useGrantTenantAccess({
    success: t('tenantAccess.granted'),
  });
  const revokeAccess = useRevokeTenantAccess({
    success: t('tenantAccess.revoked'),
  });

  // Fetch roles for the selected tenant
  const { data: rolesForTenant } = useQuery({
    queryKey: ['custom-roles', 'tenant', selectedTenantId],
    queryFn: async () => {
      const res = await api.get('/custom-roles', { params: { tenantId: selectedTenantId } });
      return res.data?.data || res.data || [];
    },
    enabled: !!selectedTenantId,
  });
  const roles = Array.isArray(rolesForTenant) ? rolesForTenant : [];

  // Filter out tenants the user already has access to (and their home tenant)
  const availableTenants = tenants.filter(
    (t) =>
      t.id !== user?.tenantId &&
      !accessList?.some((a) => a.tenantId === t.id)
  );

  const handleGrant = async () => {
    if (!user || !selectedTenantId || !selectedRoleId) return;
    try {
      await grantAccess.mutateAsync({
        userId: user.id,
        data: {
          tenantId: selectedTenantId,
          customRoleId: selectedRoleId,
        },
      });
      setShowAddForm(false);
      setSelectedTenantId('');
      setSelectedRoleId('');
    } catch {
      // handled by hook
    }
  };

  const handleRevoke = async (accessId: string) => {
    try {
      await revokeAccess.mutateAsync(accessId);
    } catch {
      // handled by hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t('tenantAccess.title')}
          </DialogTitle>
          <DialogDescription>
            {t('tenantAccess.description', { name: user?.name || '' })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Home tenant */}
          {user && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">
                    {(user as Record<string, unknown>).tenant
                      ? ((user as Record<string, unknown>).tenant as { name: string }).name
                      : 'Home Tenant'}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    <Home className="h-3 w-3 mr-1" />
                    {t('tenantAccess.home')}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {user.customRole?.name}
                </span>
              </div>
            </div>
          )}

          <Separator />

          {/* Access list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{t('tenantAccess.additionalAccess')}</Label>
              {!showAddForm && availableTenants.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddForm(true)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  {tCommon('add')}
                </Button>
              )}
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : accessList && accessList.length > 0 ? (
              <div className="space-y-2">
                {accessList.map((access) => (
                  <div
                    key={access.id}
                    className="flex items-center gap-3 p-3 rounded-lg border"
                  >
                    <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">
                        {access.tenant.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="text-[10px]"
                          style={access.customRole.color ? { backgroundColor: access.customRole.color + '20', color: access.customRole.color } : undefined}
                        >
                          {access.customRole.name}
                        </Badge>
                        <Badge
                          variant={access.status === 'ACTIVE' ? 'default' : 'secondary'}
                          className="text-[10px]"
                        >
                          {tCommon(access.status === 'ACTIVE' ? 'active' : 'inactive')}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleRevoke(access.id)}
                      disabled={revokeAccess.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t('tenantAccess.noAccess')}
              </p>
            )}
          </div>

          {/* Add form */}
          {showAddForm && (
            <>
              <Separator />
              <div className="space-y-3 p-3 rounded-lg border border-dashed">
                <Label className="text-sm font-medium">{t('tenantAccess.grantAccess')}</Label>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Tenant</Label>
                  <Select value={selectedTenantId} onValueChange={(v) => { setSelectedTenantId(v); setSelectedRoleId(''); }}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('tenantAccess.selectTenant')} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTenants.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedTenantId && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Role</Label>
                    <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('tenantAccess.selectRole')} />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((r: { id: string; name: string; roleType: string }) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setShowAddForm(false); setSelectedTenantId(''); setSelectedRoleId(''); }}
                  >
                    {tCommon('cancel')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleGrant}
                    disabled={!selectedTenantId || !selectedRoleId || grantAccess.isPending}
                  >
                    {grantAccess.isPending ? tCommon('saving') : t('tenantAccess.grant')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

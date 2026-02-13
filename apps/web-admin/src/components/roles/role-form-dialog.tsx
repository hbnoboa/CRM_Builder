'use client';

import { useEffect, useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Eye, Plus, Pencil, Trash2, Shield, Database, Users,
  Settings, Code, Layers, LayoutDashboard, Globe, User, Building2,
} from 'lucide-react';
import { useCreateCustomRole, useUpdateCustomRole } from '@/hooks/use-custom-roles';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useTenant } from '@/stores/tenant-context';
import type { CustomRole, EntityPermission, ModulePermission, ModulePermissions, Entity, PermissionScope } from '@/types';

const ROLE_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#6b7280',
];

const EMPTY_MODULE_PERM: ModulePermission = { canRead: false, canCreate: false, canUpdate: false, canDelete: false };

function normalizeModulePermToRecord(mp: Record<string, unknown> | null | undefined): Record<string, ModulePermission> {
  if (!mp) return {};
  const result: Record<string, ModulePermission> = {};
  for (const [key, value] of Object.entries(mp)) {
    if (typeof value === 'boolean') {
      result[key] = { canRead: value, canCreate: value, canUpdate: value, canDelete: value };
    } else if (value && typeof value === 'object') {
      result[key] = value as ModulePermission;
    } else {
      result[key] = { ...EMPTY_MODULE_PERM };
    }
  }
  return result;
}

const MODULE_KEYS = ['dashboard', 'users', 'settings', 'apis', 'pages', 'entities', 'tenants'] as const;

function getDefaultModulePerms(): Record<string, ModulePermission> {
  const result: Record<string, ModulePermission> = {};
  for (const key of MODULE_KEYS) {
    result[key] = key === 'dashboard'
      ? { canRead: true, canCreate: false, canUpdate: false, canDelete: false }
      : { ...EMPTY_MODULE_PERM };
  }
  return result;
}

interface RoleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: CustomRole | null;
  onSuccess?: () => void;
}

export function RoleFormDialog({ open, onOpenChange, role, onSuccess }: RoleFormDialogProps) {
  const t = useTranslations('rolesPage');
  const tCommon = useTranslations('common');
  const isEditing = !!role;

  const { effectiveTenantId } = useTenant();
  const createRole = useCreateCustomRole({ success: t('toast.created') });
  const updateRole = useUpdateCustomRole({ success: t('toast.updated') });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [isDefault, setIsDefault] = useState(false);
  const [permissions, setPermissions] = useState<EntityPermission[]>([]);
  const [modulePerms, setModulePerms] = useState<Record<string, ModulePermission>>(getDefaultModulePerms);

  // Buscar entidades do tenant
  const { data: entitiesData } = useQuery({
    queryKey: ['entities-for-roles', effectiveTenantId],
    queryFn: async () => {
      const params: Record<string, unknown> = { limit: 100 };
      if (effectiveTenantId) params.tenantId = effectiveTenantId;
      const res = await api.get('/entities', { params });
      return res.data;
    },
    enabled: open,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const entities: Entity[] = useMemo(() => {
    return Array.isArray(entitiesData?.data) ? entitiesData.data : [];
  }, [entitiesData]);

  // Inicializar formulário quando abre
  useEffect(() => {
    if (!open) return;

    if (role) {
      setName(role.name);
      setDescription(role.description || '');
      setColor(role.color || '#6366f1');
      setIsDefault(role.isDefault || false);
      setPermissions(Array.isArray(role.permissions) ? role.permissions : []);

      // Normalizar modulePermissions (backward compat: boolean → CRUD)
      const normalized = normalizeModulePermToRecord(role.modulePermissions as Record<string, unknown>);
      const perms: Record<string, ModulePermission> = {};
      for (const key of MODULE_KEYS) {
        perms[key] = normalized[key] || (key === 'dashboard'
          ? { canRead: true, canCreate: false, canUpdate: false, canDelete: false }
          : { ...EMPTY_MODULE_PERM });
      }
      setModulePerms(perms);
    } else {
      setName('');
      setDescription('');
      setColor('#6366f1');
      setIsDefault(false);
      setPermissions([]);
      setModulePerms(getDefaultModulePerms());
    }
  }, [role, open]);

  // Sincronizar entidades nas permissões
  useEffect(() => {
    if (!open || !entities.length) return;

    setPermissions((prev) => {
      const existingBySlug = new Map(prev.map((p) => [p.entitySlug, p]));
      return entities.map((e) => {
        const existing = existingBySlug.get(e.slug);
        if (existing) {
          return { ...existing, entityName: e.name, scope: existing.scope || 'all' };
        }
        return {
          entitySlug: e.slug,
          entityName: e.name,
          canCreate: false,
          canRead: true,
          canUpdate: false,
          canDelete: false,
          scope: 'all' as PermissionScope,
        };
      });
    });
  }, [entities, open]);

  const toggleEntityPermission = (entitySlug: string, field: keyof EntityPermission) => {
    setPermissions((prev) =>
      prev.map((p) =>
        p.entitySlug === entitySlug ? { ...p, [field]: !p[field] } : p
      )
    );
  };

  const toggleAllForEntity = (entitySlug: string, value: boolean) => {
    setPermissions((prev) =>
      prev.map((p) =>
        p.entitySlug === entitySlug
          ? { ...p, canCreate: value, canRead: value, canUpdate: value, canDelete: value }
          : p
      )
    );
  };

  const setEntityScope = (entitySlug: string, scope: PermissionScope) => {
    setPermissions((prev) =>
      prev.map((p) =>
        p.entitySlug === entitySlug ? { ...p, scope } : p
      )
    );
  };

  const toggleModulePerm = (moduleKey: string, action: keyof ModulePermission) => {
    setModulePerms((prev) => ({
      ...prev,
      [moduleKey]: {
        ...prev[moduleKey],
        [action]: !(prev[moduleKey]?.[action] ?? false),
      },
    }));
  };

  const toggleAllForModule = (moduleKey: string, value: boolean) => {
    setModulePerms((prev) => ({
      ...prev,
      [moduleKey]: { canRead: value, canCreate: value, canUpdate: value, canDelete: value },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const data = {
      name: name.trim(),
      description: description.trim() || undefined,
      color,
      isDefault,
      permissions: permissions.map((p) => ({
        entitySlug: p.entitySlug,
        canCreate: p.canCreate,
        canRead: p.canRead,
        canUpdate: p.canUpdate,
        canDelete: p.canDelete,
        scope: p.scope || 'all',
      })),
      modulePermissions: modulePerms as ModulePermissions,
      ...(effectiveTenantId ? { tenantId: effectiveTenantId } : {}),
    };

    try {
      if (isEditing && role) {
        await updateRole.mutateAsync({ id: role.id, data });
      } else {
        await createRole.mutateAsync(data);
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (error) { /* handled by hook */ }
  };

  const isLoading = createRole.isPending || updateRole.isPending;

  const moduleIcons: Record<string, React.ReactNode> = {
    dashboard: <LayoutDashboard className="h-4 w-4" />,
    users: <Users className="h-4 w-4" />,
    settings: <Settings className="h-4 w-4" />,
    apis: <Code className="h-4 w-4" />,
    pages: <Layers className="h-4 w-4" />,
    entities: <Database className="h-4 w-4" />,
    tenants: <Building2 className="h-4 w-4" />,
  };

  const moduleLabels: Record<string, string> = {
    dashboard: 'Dashboard',
    users: t('modules.users'),
    settings: t('modules.settings'),
    apis: 'APIs',
    pages: t('modules.pages'),
    entities: t('modules.entities'),
    tenants: t('modules.tenants'),
  };

  const crudActions = [
    { key: 'canRead' as const, label: t('form.read'), icon: <Eye className="h-3.5 w-3.5" /> },
    { key: 'canCreate' as const, label: t('form.create'), icon: <Plus className="h-3.5 w-3.5" /> },
    { key: 'canUpdate' as const, label: t('form.update'), icon: <Pencil className="h-3.5 w-3.5" /> },
    { key: 'canDelete' as const, label: t('form.delete'), icon: <Trash2 className="h-3.5 w-3.5" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? t('editRole') : t('newRole')}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? t('form.editDescription') : t('form.createDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
              {/* Nome e Descrição */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{tCommon('name')} *</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('form.namePlaceholder')}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tCommon('description')}</Label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('form.descriptionPlaceholder')}
                  />
                </div>
              </div>

              <Separator />

              {/* Módulos do Sistema - CRUD Grid */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">{t('form.systemModules')}</Label>
                <p className="text-sm text-muted-foreground">{t('form.systemModulesDesc')}</p>

                <div className="space-y-2">
                  {MODULE_KEYS.map((key) => {
                    const perm = modulePerms[key] || EMPTY_MODULE_PERM;
                    const allChecked = perm.canRead && perm.canCreate && perm.canUpdate && perm.canDelete;
                    const noneChecked = !perm.canRead && !perm.canCreate && !perm.canUpdate && !perm.canDelete;
                    const hasAny = perm.canRead || perm.canCreate || perm.canUpdate || perm.canDelete;

                    return (
                      <div
                        key={key}
                        className={`border rounded-lg p-3 space-y-2 transition-colors ${
                          hasAny ? 'border-primary/40 bg-primary/5' : 'border-border'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={hasAny ? 'text-primary' : 'text-muted-foreground'}>
                              {moduleIcons[key]}
                            </div>
                            <span className="text-sm font-semibold">{moduleLabels[key] || key}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {noneChecked ? t('form.noAccess') : allChecked ? t('form.fullAccess') : t('form.partial')}
                            </span>
                            <Checkbox
                              checked={allChecked || false}
                              onCheckedChange={(checked) => toggleAllForModule(key, !!checked)}
                              className="h-4 w-4"
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {crudActions.map(({ key: action, label, icon }) => (
                            <label
                              key={action}
                              className={`flex items-center gap-1.5 cursor-pointer rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                perm[action]
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-border text-muted-foreground hover:border-muted-foreground/50'
                              }`}
                            >
                              <Checkbox
                                checked={perm[action] || false}
                                onCheckedChange={() => toggleModulePerm(key, action)}
                                className="h-3.5 w-3.5"
                              />
                              {icon}
                              {label}
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Permissões por Entidade */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-semibold">{t('form.entityPermissions')}</Label>
                    <p className="text-sm text-muted-foreground">{t('form.entityPermissionsDesc')}</p>
                  </div>
                  {permissions.length > 0 && (
                    <Badge variant="secondary">{permissions.length} {t('form.entity').toLowerCase()}(s)</Badge>
                  )}
                </div>

                {permissions.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm border rounded-lg">
                    {t('form.noEntities')}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {permissions.map((perm) => {
                      const entity = entities.find((e) => e.slug === perm.entitySlug);
                      const allChecked = perm.canCreate && perm.canRead && perm.canUpdate && perm.canDelete;
                      const noneChecked = !perm.canCreate && !perm.canRead && !perm.canUpdate && !perm.canDelete;
                      return (
                        <div
                          key={perm.entitySlug}
                          className="border rounded-lg p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Database className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-semibold">
                                {entity?.name || perm.entityName || perm.entitySlug}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {noneChecked ? t('form.noAccess') : allChecked ? t('form.fullAccess') : t('form.partial')}
                              </span>
                              <Checkbox
                                checked={allChecked}
                                onCheckedChange={(checked) => toggleAllForEntity(perm.entitySlug, !!checked)}
                                className="h-4 w-4"
                              />
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            {crudActions.map(({ key: action, label, icon }) => (
                              <label
                                key={action}
                                className={`flex items-center gap-1.5 cursor-pointer rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                  perm[action]
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border text-muted-foreground hover:border-muted-foreground/50'
                                }`}
                              >
                                <Checkbox
                                  checked={perm[action]}
                                  onCheckedChange={() => toggleEntityPermission(perm.entitySlug, action)}
                                  className="h-3.5 w-3.5"
                                />
                                {icon}
                                {label}
                              </label>
                            ))}
                            <div className="ml-auto flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{t('form.scope')}:</span>
                              <Select
                                value={perm.scope || 'all'}
                                onValueChange={(value: PermissionScope) => setEntityScope(perm.entitySlug, value)}
                              >
                                <SelectTrigger className="h-7 w-[130px] text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">
                                    <div className="flex items-center gap-1.5">
                                      <Globe className="h-3.5 w-3.5" />
                                      {t('form.scopeAll')}
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="own">
                                    <div className="flex items-center gap-1.5">
                                      <User className="h-3.5 w-3.5" />
                                      {t('form.scopeOwn')}
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <Separator />

              {/* Default */}
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <Checkbox checked={isDefault} onCheckedChange={(checked) => setIsDefault(!!checked)} className="h-4 w-4" />
                <div>
                  <Label className="font-medium">{t('form.isDefault')}</Label>
                  <p className="text-xs text-muted-foreground">{t('form.isDefaultDesc')}</p>
                </div>
              </div>

          <DialogFooter className="pt-4 border-t mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading ? tCommon('saving') : isEditing ? tCommon('save') : tCommon('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

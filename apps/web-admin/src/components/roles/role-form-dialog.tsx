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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Eye, Plus, Pencil, Trash2, Shield, Database, Users,
  Settings, Code, LayoutDashboard, Globe, User, Building2,
  ChevronRight, BarChart3,
} from 'lucide-react';
import { useCreateCustomRole, useUpdateCustomRole } from '@/hooks/use-custom-roles';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useTenant } from '@/stores/tenant-context';
import { usePermissions } from '@/hooks/use-permissions';
import type { CustomRole, EntityPermission, EntityField, ModulePermission, ModulePermissions, Entity, PermissionScope } from '@/types';

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

const MODULE_KEYS = ['dashboard', 'users', 'roles', 'entities', 'data', 'apis', 'reports', 'settings', 'tenants'] as const;

function getDefaultModulePerms(): Record<string, ModulePermission> {
  const result: Record<string, ModulePermission> = {};
  for (const key of MODULE_KEYS) {
    result[key] = key === 'dashboard'
      ? { canRead: true, canCreate: false, canUpdate: false, canDelete: false }
      : { ...EMPTY_MODULE_PERM };
  }
  return result;
}

function countCrudActive(perm: ModulePermission): number {
  let count = 0;
  if (perm.canRead) count++;
  if (perm.canCreate) count++;
  if (perm.canUpdate) count++;
  if (perm.canDelete) count++;
  return count;
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
  const { hasModuleAction } = usePermissions();

  const { effectiveTenantId } = useTenant();
  const createRole = useCreateCustomRole({ success: t('toast.created') });
  const updateRole = useUpdateCustomRole({ success: t('toast.updated') });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [isDefault, setIsDefault] = useState(false);
  const [permissions, setPermissions] = useState<EntityPermission[]>([]);
  const [modulePerms, setModulePerms] = useState<Record<string, ModulePermission>>(getDefaultModulePerms);
  const [openModules, setOpenModules] = useState<Set<string>>(new Set());
  const [openEntities, setOpenEntities] = useState<Set<string>>(new Set());

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
    setOpenModules(new Set());
    setOpenEntities(new Set());
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

  const toggleFieldPermission = (entitySlug: string, fieldSlug: string, action: 'canView' | 'canEdit') => {
    setPermissions((prev) =>
      prev.map((p) => {
        if (p.entitySlug !== entitySlug) return p;
        const fps = p.fieldPermissions ? [...p.fieldPermissions] : [];
        const idx = fps.findIndex(fp => fp.fieldSlug === fieldSlug);
        if (idx >= 0) {
          fps[idx] = { ...fps[idx], [action]: !fps[idx][action] };
          if (action === 'canView' && !fps[idx].canView) {
            fps[idx].canEdit = false;
          }
        } else {
          fps.push({ fieldSlug, canView: action === 'canView' ? true : true, canEdit: action === 'canEdit' ? true : false });
        }
        return { ...p, fieldPermissions: fps };
      })
    );
  };

  const [expandedFieldPerms, setExpandedFieldPerms] = useState<Set<string>>(new Set());

  const toggleFieldPermsExpand = (entitySlug: string) => {
    setExpandedFieldPerms(prev => {
      const next = new Set(prev);
      if (next.has(entitySlug)) next.delete(entitySlug);
      else next.add(entitySlug);
      return next;
    });
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
        ...(p.fieldPermissions && p.fieldPermissions.length > 0 ? { fieldPermissions: p.fieldPermissions } : {}),
        ...(p.canExport ? { canExport: true } : {}),
        ...(p.canImport ? { canImport: true } : {}),
        ...(p.canConfigureColumns ? { canConfigureColumns: true } : {}),
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
    entities: <Database className="h-4 w-4" />,
    tenants: <Building2 className="h-4 w-4" />,
    data: <Globe className="h-4 w-4" />,
    roles: <Shield className="h-4 w-4" />,
    reports: <BarChart3 className="h-4 w-4" />,
  };

  const crudActions = [
    { key: 'canRead' as const, label: t('form.read'), icon: <Eye className="h-3.5 w-3.5" /> },
    { key: 'canCreate' as const, label: t('form.create'), icon: <Plus className="h-3.5 w-3.5" /> },
    { key: 'canUpdate' as const, label: t('form.update'), icon: <Pencil className="h-3.5 w-3.5" /> },
    { key: 'canDelete' as const, label: t('form.delete'), icon: <Trash2 className="h-3.5 w-3.5" /> },
  ];

  const MODULE_EXTRA_ACTIONS: Record<string, { key: string; label: string }[]> = {
    apis: [
      { key: 'canActivate', label: t('permissions.canActivate') },
      { key: 'canTest', label: t('permissions.canTest') },
    ],
    entities: [
      { key: 'canUpdateLayout', label: t('permissions.canUpdateLayout') },
      { key: 'canCreateField', label: t('permissions.canCreateField') },
      { key: 'canDeleteField', label: t('permissions.canDeleteField') },
      { key: 'canUpdateField', label: t('permissions.canUpdateField') },
    ],
    users: [
      { key: 'canAssignRole', label: t('permissions.canAssignRole') },
      { key: 'canChangeStatus', label: t('permissions.canChangeStatus') },
    ],
    roles: [
      { key: 'canSetDefault', label: t('permissions.canSetDefault') },
      { key: 'canManagePermissions', label: t('permissions.canManagePermissions') },
    ],
    tenants: [
      { key: 'canSuspend', label: t('permissions.canSuspend') },
      { key: 'canActivate', label: t('permissions.canActivate') },
    ],
    data: [
      { key: 'canConfigureColumns', label: t('permissions.canConfigureColumns') },
      { key: 'canExport', label: t('permissions.canExport') },
      { key: 'canImport', label: t('permissions.canImport') },
    ],
    reports: [
      { key: 'canExecute', label: t('permissions.canExecute') },
      { key: 'canExport', label: t('permissions.canExport') },
      { key: 'canDuplicate', label: t('permissions.canDuplicate') },
    ],
  };

  const ENTITY_EXTRA_ACTIONS = [
    { key: 'canConfigureColumns', label: t('permissions.canConfigureColumns') },
    { key: 'canExport', label: t('permissions.canExport') },
    { key: 'canImport', label: t('permissions.canImport') },
  ];

  const toggleModuleOpen = (key: string) => {
    setOpenModules(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleEntityOpen = (slug: string) => {
    setOpenEntities(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? t('editRole') : t('newRole')}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? t('form.editDescription') : t('form.createDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 min-h-0 flex-1 overflow-y-auto pr-1">
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

          {/* Default */}
          {hasModuleAction('roles', 'canSetDefault') && (
            <div className="flex items-center gap-3 p-3 rounded-lg border">
              <Checkbox checked={isDefault} onCheckedChange={(checked) => setIsDefault(!!checked)} className="h-4 w-4" />
              <div>
                <Label className="font-medium">{t('form.isDefault')}</Label>
                <p className="text-xs text-muted-foreground">{t('form.isDefaultDesc')}</p>
              </div>
            </div>
          )}

          {/* Permissions Tabs */}
          {hasModuleAction('roles', 'canManagePermissions') && (
            <Tabs defaultValue="modules">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="modules">{t('form.systemModules')}</TabsTrigger>
                <TabsTrigger value="entities">{t('form.entityPermissions')}</TabsTrigger>
              </TabsList>

              {/* System Modules Tab */}
              <TabsContent value="modules">
                <p className="text-sm text-muted-foreground mb-3">{t('form.systemModulesDesc')}</p>
                  <div className="space-y-1">
                    {MODULE_KEYS.map((key) => {
                      const perm = modulePerms[key] || EMPTY_MODULE_PERM;
                      const crudCount = countCrudActive(perm);
                      const maxCrud = key === 'dashboard' ? 1 : 4;
                      const hasAny = crudCount > 0;
                      const isOpen = openModules.has(key);
                      const extraActions = MODULE_EXTRA_ACTIONS[key];

                      return (
                        <Collapsible
                          key={key}
                          open={isOpen}
                          onOpenChange={() => toggleModuleOpen(key)}
                        >
                          <CollapsibleTrigger asChild>
                            <button
                              type="button"
                              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors hover:bg-accent/50 ${
                                hasAny ? 'border-primary/30 bg-primary/5' : 'border-border'
                              }`}
                            >
                              <div className={hasAny ? 'text-primary' : 'text-muted-foreground'}>
                                {moduleIcons[key]}
                              </div>
                              <div className="flex-1 text-left">
                                <div className="text-sm font-medium">{t(`modules.${key}`)}</div>
                                <div className="text-xs text-muted-foreground">{t(`modules.${key}Desc`)}</div>
                              </div>
                              <Badge
                                variant={crudCount === maxCrud ? 'default' : crudCount > 0 ? 'secondary' : 'outline'}
                                className="text-[10px] px-1.5 py-0"
                              >
                                {key === 'dashboard' ? (perm.canRead ? t('form.access') : t('form.noAccess')) : `${crudCount}/${maxCrud}`}
                              </Badge>
                              <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="ml-7 mr-1 mt-1 mb-2 p-3 rounded-lg border border-dashed space-y-3">
                              {/* CRUD checkboxes */}
                              <div className="flex items-center justify-between">
                                <div className="flex flex-wrap items-center gap-2">
                                  {key === 'dashboard' ? (
                                    <label
                                      className={`flex items-center gap-1.5 cursor-pointer rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                        perm.canRead
                                          ? 'border-primary bg-primary/10 text-primary'
                                          : 'border-border text-muted-foreground hover:border-muted-foreground/50'
                                      }`}
                                    >
                                      <Checkbox
                                        checked={perm.canRead || false}
                                        onCheckedChange={() => toggleModulePerm(key, 'canRead')}
                                        className="h-3.5 w-3.5"
                                      />
                                      <Eye className="h-3.5 w-3.5" />
                                      {t('form.access')}
                                    </label>
                                  ) : (
                                    crudActions.map(({ key: action, label, icon }) => (
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
                                    ))
                                  )}
                                </div>
                                {key !== 'dashboard' && (
                                  <Checkbox
                                    checked={crudCount === 4}
                                    onCheckedChange={(checked) => toggleAllForModule(key, !!checked)}
                                    className="h-4 w-4"
                                  />
                                )}
                              </div>
                              {/* Extra actions */}
                              {extraActions && extraActions.length > 0 && (
                                <>
                                  <Separator />
                                  <div>
                                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                                      {t('permissions.specialActions')}
                                    </span>
                                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                      {extraActions.map(({ key: actionKey, label: actionLabel }) => (
                                        <label
                                          key={actionKey}
                                          className={`flex items-center gap-1.5 cursor-pointer rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                            (perm as Record<string, unknown>)[actionKey]
                                              ? 'border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                              : 'border-border text-muted-foreground hover:border-muted-foreground/50'
                                          }`}
                                        >
                                          <Checkbox
                                            checked={!!(perm as Record<string, unknown>)[actionKey]}
                                            onCheckedChange={() => toggleModulePerm(key, actionKey as keyof ModulePermission)}
                                            className="h-3.5 w-3.5"
                                          />
                                          {actionLabel}
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>
              </TabsContent>

              {/* Entity Permissions Tab */}
              <TabsContent value="entities">
                <p className="text-sm text-muted-foreground mb-3">{t('form.entityPermissionsDesc')}</p>
                {permissions.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm border rounded-lg">
                    {t('form.noEntities')}
                  </div>
                ) : (
                    <div className="space-y-1">
                      {permissions.map((perm) => {
                        const entity = entities.find((e) => e.slug === perm.entitySlug);
                        const allChecked = perm.canCreate && perm.canRead && perm.canUpdate && perm.canDelete;
                        const crudCount = (perm.canRead ? 1 : 0) + (perm.canCreate ? 1 : 0) + (perm.canUpdate ? 1 : 0) + (perm.canDelete ? 1 : 0);
                        const isOpen = openEntities.has(perm.entitySlug);

                        return (
                          <Collapsible
                            key={perm.entitySlug}
                            open={isOpen}
                            onOpenChange={() => toggleEntityOpen(perm.entitySlug)}
                          >
                            <CollapsibleTrigger asChild>
                              <button
                                type="button"
                                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors hover:bg-accent/50 ${
                                  crudCount > 0 ? 'border-primary/30 bg-primary/5' : 'border-border'
                                }`}
                              >
                                <Database className={`h-4 w-4 ${crudCount > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
                                <div className="flex-1 text-left">
                                  <div className="text-sm font-medium">
                                    {entity?.name || perm.entityName || perm.entitySlug}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {perm.scope === 'own' ? t('form.scopeOwn') : t('form.scopeAll')}
                                  </div>
                                </div>
                                <Badge
                                  variant={crudCount === 4 ? 'default' : crudCount > 0 ? 'secondary' : 'outline'}
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  {crudCount}/4
                                </Badge>
                                <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                              </button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="ml-7 mr-1 mt-1 mb-2 p-3 rounded-lg border border-dashed space-y-3">
                                {/* CRUD + Scope */}
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
                                        checked={perm[action]}
                                        onCheckedChange={() => toggleEntityPermission(perm.entitySlug, action)}
                                        className="h-3.5 w-3.5"
                                      />
                                      {icon}
                                      {label}
                                    </label>
                                  ))}
                                  <Checkbox
                                    checked={allChecked}
                                    onCheckedChange={(checked) => toggleAllForEntity(perm.entitySlug, !!checked)}
                                    className="h-4 w-4 ml-auto"
                                  />
                                </div>

                                {/* Scope selector */}
                                <div className="flex items-center gap-2">
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

                                {/* Entity Extra Actions */}
                                <Separator />
                                <div>
                                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                                    {t('permissions.specialActions')}
                                  </span>
                                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                    {ENTITY_EXTRA_ACTIONS.map(({ key: actionKey, label: actionLabel }) => (
                                      <label
                                        key={actionKey}
                                        className={`flex items-center gap-1.5 cursor-pointer rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                          (perm as Record<string, unknown>)[actionKey]
                                            ? 'border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                            : 'border-border text-muted-foreground hover:border-muted-foreground/50'
                                        }`}
                                      >
                                        <Checkbox
                                          checked={!!(perm as Record<string, unknown>)[actionKey]}
                                          onCheckedChange={() => toggleEntityPermission(perm.entitySlug, actionKey as keyof EntityPermission)}
                                          className="h-3.5 w-3.5"
                                        />
                                        {actionLabel}
                                      </label>
                                    ))}
                                  </div>
                                </div>

                                {/* Field Permissions */}
                                {entity && entity.fields && entity.fields.length > 0 && (
                                  <>
                                    <Separator />
                                    <div>
                                      <button
                                        type="button"
                                        className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                                        onClick={(e) => { e.stopPropagation(); toggleFieldPermsExpand(perm.entitySlug); }}
                                      >
                                        <Shield className="h-3 w-3" />
                                        {t('form.fieldPermissions')} ({entity.fields.length})
                                        <span className="ml-1">{expandedFieldPerms.has(perm.entitySlug) ? '▾' : '▸'}</span>
                                      </button>
                                      {expandedFieldPerms.has(perm.entitySlug) && (
                                        <div className="mt-2 border rounded-md overflow-hidden">
                                          <table className="w-full text-xs">
                                            <thead className="bg-muted/50">
                                              <tr>
                                                <th className="text-left px-2 py-1.5 font-medium">{t('form.field')}</th>
                                                <th className="text-center px-2 py-1.5 font-medium w-16">{t('form.view')}</th>
                                                <th className="text-center px-2 py-1.5 font-medium w-16">{t('form.editField')}</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                              {entity.fields.filter((f: EntityField) => f.type !== 'hidden' && !f.hidden).map((field: EntityField) => {
                                                const fp = perm.fieldPermissions?.find(fp => fp.fieldSlug === field.slug);
                                                const canView = fp ? fp.canView : true;
                                                const canEdit = fp ? fp.canEdit : true;
                                                return (
                                                  <tr key={field.slug} className="hover:bg-muted/30">
                                                    <td className="px-2 py-1.5">{field.label || field.name}</td>
                                                    <td className="text-center px-2 py-1.5">
                                                      <Checkbox
                                                        checked={canView}
                                                        onCheckedChange={() => toggleFieldPermission(perm.entitySlug, field.slug, 'canView')}
                                                        className="h-3.5 w-3.5"
                                                      />
                                                    </td>
                                                    <td className="text-center px-2 py-1.5">
                                                      <Checkbox
                                                        checked={canEdit}
                                                        disabled={!canView}
                                                        onCheckedChange={() => toggleFieldPermission(perm.entitySlug, field.slug, 'canEdit')}
                                                        className="h-3.5 w-3.5"
                                                      />
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })}
                    </div>
                )}
              </TabsContent>
            </Tabs>
          )}

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

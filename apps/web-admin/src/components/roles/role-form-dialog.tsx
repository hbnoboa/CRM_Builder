'use client';

import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield,
  Database,
  FileText,
  Code,
  Users,
  Key,
  Building,
  Settings,
  BarChart3,
  Upload,
  CheckSquare,
  Loader2,
  Table2,
} from 'lucide-react';
import { useCreateRole, useUpdateRole } from '@/hooks/use-roles';
import { useEntities } from '@/hooks/use-entities';
import { rolesService, type EntityPermission, type EntityPermissionInput } from '@/services/roles.service';
import type { Role, Entity } from '@/types';

// ── Permissões do sistema organizadas por categoria ──────────────────────────

const PERMISSION_CATEGORIES_CONFIG: {
  key: string;
  labelKey: string;
  icon: React.ReactNode;
  color: string;
  permissions: { key: string; actionKey: string }[];
}[] = [
  {
    key: 'entities',
    labelKey: 'entities',
    icon: <Database className="h-4 w-4" />,
    color: 'text-blue-600',
    permissions: [
      { key: 'entities:create', actionKey: 'create' },
      { key: 'entities:read', actionKey: 'read' },
      { key: 'entities:update', actionKey: 'update' },
      { key: 'entities:delete', actionKey: 'delete' },
    ],
  },
  {
    key: 'data',
    labelKey: 'data',
    icon: <FileText className="h-4 w-4" />,
    color: 'text-green-600',
    permissions: [
      { key: 'data:create', actionKey: 'create' },
      { key: 'data:read', actionKey: 'read' },
      { key: 'data:update', actionKey: 'update' },
      { key: 'data:delete', actionKey: 'delete' },
      { key: 'data:export', actionKey: 'export' },
      { key: 'data:import', actionKey: 'import' },
    ],
  },
  {
    key: 'pages',
    labelKey: 'pages',
    icon: <FileText className="h-4 w-4" />,
    color: 'text-purple-600',
    permissions: [
      { key: 'pages:create', actionKey: 'create' },
      { key: 'pages:read', actionKey: 'read' },
      { key: 'pages:update', actionKey: 'update' },
      { key: 'pages:delete', actionKey: 'delete' },
      { key: 'pages:publish', actionKey: 'publish' },
    ],
  },
  {
    key: 'apis',
    labelKey: 'apis',
    icon: <Code className="h-4 w-4" />,
    color: 'text-orange-600',
    permissions: [
      { key: 'apis:create', actionKey: 'create' },
      { key: 'apis:read', actionKey: 'read' },
      { key: 'apis:update', actionKey: 'update' },
      { key: 'apis:delete', actionKey: 'delete' },
      { key: 'apis:execute', actionKey: 'execute' },
    ],
  },
  {
    key: 'users',
    labelKey: 'users',
    icon: <Users className="h-4 w-4" />,
    color: 'text-cyan-600',
    permissions: [
      { key: 'users:create', actionKey: 'create' },
      { key: 'users:read', actionKey: 'read' },
      { key: 'users:update', actionKey: 'update' },
      { key: 'users:delete', actionKey: 'delete' },
      { key: 'users:invite', actionKey: 'invite' },
    ],
  },
  {
    key: 'roles',
    labelKey: 'roles',
    icon: <Key className="h-4 w-4" />,
    color: 'text-yellow-600',
    permissions: [
      { key: 'roles:create', actionKey: 'create' },
      { key: 'roles:read', actionKey: 'read' },
      { key: 'roles:update', actionKey: 'update' },
      { key: 'roles:delete', actionKey: 'delete' },
      { key: 'roles:assign', actionKey: 'assign' },
    ],
  },
  {
    key: 'organization',
    labelKey: 'organization',
    icon: <Building className="h-4 w-4" />,
    color: 'text-indigo-600',
    permissions: [
      { key: 'organization:read', actionKey: 'read' },
      { key: 'organization:update', actionKey: 'update' },
    ],
  },
  {
    key: 'settings',
    labelKey: 'settings',
    icon: <Settings className="h-4 w-4" />,
    color: 'text-gray-600',
    permissions: [
      { key: 'settings:read', actionKey: 'read' },
      { key: 'settings:update', actionKey: 'update' },
    ],
  },
  {
    key: 'stats',
    labelKey: 'stats',
    icon: <BarChart3 className="h-4 w-4" />,
    color: 'text-pink-600',
    permissions: [{ key: 'stats:read', actionKey: 'read' }],
  },
  {
    key: 'upload',
    labelKey: 'upload',
    icon: <Upload className="h-4 w-4" />,
    color: 'text-teal-600',
    permissions: [
      { key: 'upload:create', actionKey: 'upload' },
      { key: 'upload:delete', actionKey: 'delete' },
    ],
  },
];

const ALL_PERMISSION_KEYS = PERMISSION_CATEGORIES_CONFIG.flatMap((c) =>
  c.permissions.map((p) => p.key)
);

// ── Schema ───────────────────────────────────────────────────────────────────

// Schema is created inside the component to use translations
type RoleFormData = {
  name: string;
  slug?: string;
  description?: string;
  permissions?: string[];
};

interface RoleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: Role | null;
  onSuccess?: () => void;
}

// Tipo para permissoes por entidade no estado local
interface LocalEntityPermission {
  entityId: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export function RoleFormDialog({
  open,
  onOpenChange,
  role,
  onSuccess,
}: RoleFormDialogProps) {
  const t = useTranslations('rolesPage');
  const tCommon = useTranslations('common');
  const tValidation = useTranslations('validation');
  const isEditing = !!role;

  // Estado para permissoes por entidade
  const [entityPermissions, setEntityPermissions] = useState<Map<string, LocalEntityPermission>>(new Map());
  const [activeTab, setActiveTab] = useState<string>('system');

  // Busca entidades disponiveis
  const { data: entitiesData, isLoading: loadingEntities } = useEntities();
  const entities: Entity[] = useMemo(() => {
    if (!entitiesData) return [];
    if (Array.isArray(entitiesData)) return entitiesData;
    if (entitiesData.data && Array.isArray(entitiesData.data)) return entitiesData.data;
    return [];
  }, [entitiesData]);

  // Busca permissoes de entidade da role (apenas quando editando)
  const { data: existingEntityPerms } = useQuery({
    queryKey: ['entity-permissions', role?.id],
    queryFn: () => role ? rolesService.getEntityPermissions(role.id) : Promise.resolve([]),
    enabled: open && !!role?.id,
  });

  // Schema with translations
  const roleSchema = z.object({
    name: z.string().min(2, tValidation('nameMin', { min: 2 })),
    slug: z
      .string()
      .min(2, tValidation('slugMin', { min: 2 }))
      .regex(/^[a-z0-9-_]+$/, tValidation('slugFormat'))
      .optional()
      .or(z.literal('')),
    description: z.string().optional(),
    permissions: z.array(z.string()).optional(),
  });
  const createRole = useCreateRole({ success: t('toast.created') });
  const updateRole = useUpdateRole({ success: t('toast.updated') });

  const form = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      permissions: [],
    },
  });

  const selectedPermissions = form.watch('permissions') || [];

  useEffect(() => {
    if (!open) return;
    setActiveTab('system');
    if (role) {
      const perms = Array.isArray(role.permissions)
        ? (role.permissions as string[])
        : typeof role.permissions === 'object'
          ? Object.keys(role.permissions || {})
          : [];
      form.reset({
        name: role.name,
        slug: role.slug || '',
        description: role.description || '',
        permissions: perms,
      });
    } else {
      form.reset({
        name: '',
        slug: '',
        description: '',
        permissions: [],
      });
      setEntityPermissions(new Map());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, open]);

  // Carrega permissoes de entidade existentes
  useEffect(() => {
    if (existingEntityPerms && Array.isArray(existingEntityPerms)) {
      const permsMap = new Map<string, LocalEntityPermission>();
      existingEntityPerms.forEach((perm: EntityPermission) => {
        permsMap.set(perm.entityId, {
          entityId: perm.entityId,
          canCreate: perm.canCreate,
          canRead: perm.canRead,
          canUpdate: perm.canUpdate,
          canDelete: perm.canDelete,
        });
      });
      setEntityPermissions(permsMap);
    }
  }, [existingEntityPerms]);

  // Auto-generate slug from name
  const watchName = form.watch('name');
  useEffect(() => {
    if (!isEditing && watchName) {
      const slug = watchName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-_]/g, '');
      form.setValue('slug', slug);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchName, isEditing]);

  const togglePermission = (key: string) => {
    const current = form.getValues('permissions') || [];
    if (current.includes(key)) {
      form.setValue(
        'permissions',
        current.filter((p) => p !== key),
        { shouldDirty: true }
      );
    } else {
      form.setValue('permissions', [...current, key], { shouldDirty: true });
    }
  };

  const toggleCategory = (categoryKey: string) => {
    const category = PERMISSION_CATEGORIES_CONFIG.find((c) => c.key === categoryKey);
    if (!category) return;
    const categoryPerms = category.permissions.map((p) => p.key);
    const current = form.getValues('permissions') || [];
    const allSelected = categoryPerms.every((p) => current.includes(p));

    if (allSelected) {
      form.setValue(
        'permissions',
        current.filter((p) => !categoryPerms.includes(p)),
        { shouldDirty: true }
      );
    } else {
      const newPerms = new Set([...current, ...categoryPerms]);
      form.setValue('permissions', Array.from(newPerms), { shouldDirty: true });
    }
  };

  const selectAll = () => {
    form.setValue('permissions', [...ALL_PERMISSION_KEYS], { shouldDirty: true });
  };

  const deselectAll = () => {
    form.setValue('permissions', [], { shouldDirty: true });
  };

  const isCategoryFullySelected = (categoryKey: string) => {
    const category = PERMISSION_CATEGORIES_CONFIG.find((c) => c.key === categoryKey);
    if (!category) return false;
    return category.permissions.every((p) =>
      selectedPermissions.includes(p.key)
    );
  };

  const isCategoryPartiallySelected = (categoryKey: string) => {
    const category = PERMISSION_CATEGORIES_CONFIG.find((c) => c.key === categoryKey);
    if (!category) return false;
    const some = category.permissions.some((p) =>
      selectedPermissions.includes(p.key)
    );
    const all = category.permissions.every((p) =>
      selectedPermissions.includes(p.key)
    );
    return some && !all;
  };

  // ========== Entity Permissions Helpers ==========

  const toggleEntityPermission = (
    entityId: string,
    permission: 'canCreate' | 'canRead' | 'canUpdate' | 'canDelete',
  ) => {
    setEntityPermissions((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(entityId) || {
        entityId,
        canCreate: false,
        canRead: false,
        canUpdate: false,
        canDelete: false,
      };
      newMap.set(entityId, {
        ...existing,
        [permission]: !existing[permission],
      });
      return newMap;
    });
  };

  const toggleAllEntityPermissions = (entityId: string) => {
    setEntityPermissions((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(entityId);
      const allEnabled = existing && existing.canCreate && existing.canRead && existing.canUpdate && existing.canDelete;

      if (allEnabled) {
        newMap.delete(entityId);
      } else {
        newMap.set(entityId, {
          entityId,
          canCreate: true,
          canRead: true,
          canUpdate: true,
          canDelete: true,
        });
      }
      return newMap;
    });
  };

  const getEntityPermission = (entityId: string): LocalEntityPermission => {
    return entityPermissions.get(entityId) || {
      entityId,
      canCreate: false,
      canRead: false,
      canUpdate: false,
      canDelete: false,
    };
  };

  const isEntityFullySelected = (entityId: string): boolean => {
    const perm = entityPermissions.get(entityId);
    return !!perm && perm.canCreate && perm.canRead && perm.canUpdate && perm.canDelete;
  };

  const isEntityPartiallySelected = (entityId: string): boolean => {
    const perm = entityPermissions.get(entityId);
    if (!perm) return false;
    const hasAny = perm.canCreate || perm.canRead || perm.canUpdate || perm.canDelete;
    const hasAll = perm.canCreate && perm.canRead && perm.canUpdate && perm.canDelete;
    return hasAny && !hasAll;
  };

  const getSelectedEntitiesCount = (): number => {
    return Array.from(entityPermissions.values()).filter(
      (p) => p.canCreate || p.canRead || p.canUpdate || p.canDelete
    ).length;
  };

  const onSubmit = async (data: RoleFormData) => {
    try {
      let roleId = role?.id;

      if (isEditing && role) {
        await updateRole.mutateAsync({
          id: role.id,
          data: {
            name: data.name,
            description: data.description,
            permissions: data.permissions,
          },
        });
      } else {
        const newRole = await createRole.mutateAsync({
          name: data.name,
          slug: data.slug || undefined,
          description: data.description,
          permissions: data.permissions,
        });
        roleId = newRole.id;
      }

      // Salvar permissoes de entidade (apenas se tiver roleId)
      if (roleId) {
        const entityPermsArray: EntityPermissionInput[] = Array.from(entityPermissions.values())
          .filter((p) => p.canCreate || p.canRead || p.canUpdate || p.canDelete);

        if (entityPermsArray.length > 0 || isEditing) {
          await rolesService.bulkSetEntityPermissions(roleId, entityPermsArray);
        }
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const isLoading = createRole.isPending || updateRole.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {isEditing ? t('editRole') : t('newRole')}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? t('form.editDescription')
              : t('form.createDescription')}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col flex-1 min-h-0 gap-4"
        >
          {/* Dados básicos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">{t('form.name')} *</Label>
              <Input
                id="name"
                placeholder={t('form.namePlaceholder')}
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            {!isEditing && (
              <div className="space-y-1.5">
                <Label htmlFor="slug">{t('form.slug')}</Label>
                <Input
                  id="slug"
                  placeholder={t('form.slugPlaceholder')}
                  {...form.register('slug')}
                  className="font-mono text-sm"
                />
                {form.formState.errors.slug && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.slug.message}
                  </p>
                )}
              </div>
            )}
            <div
              className={`space-y-1.5 ${isEditing ? '' : 'sm:col-span-2'}`}
            >
              <Label htmlFor="description">{t('form.description')}</Label>
              <Textarea
                id="description"
                placeholder={t('form.descriptionPlaceholder')}
                rows={2}
                {...form.register('description')}
              />
            </div>
          </div>

          <Separator />

          {/* Tabs de Permissoes */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="system" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                {t('permissions.systemTab')}
                <Badge variant="secondary" className="text-xs ml-1">
                  {selectedPermissions.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="entities" className="flex items-center gap-2">
                <Table2 className="h-4 w-4" />
                {t('permissions.entitiesTab')}
                <Badge variant="secondary" className="text-xs ml-1">
                  {getSelectedEntitiesCount()}
                </Badge>
              </TabsTrigger>
            </TabsList>

            {/* Tab: Permissoes do Sistema */}
            <TabsContent value="system" className="flex-1 flex flex-col min-h-0 mt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">{t('permissions.systemDescription')}</p>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={selectAll}
                  >
                    <CheckSquare className="h-3 w-3 mr-1" />
                    {t('permissions.selectAll')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={deselectAll}
                  >
                    {t('permissions.selectNone')}
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1 min-h-0 max-h-[280px] border rounded-lg">
                <div className="p-3 space-y-3">
                  {PERMISSION_CATEGORIES_CONFIG.map((category) => {
                    const fullySelected = isCategoryFullySelected(category.key);
                    const partiallySelected = isCategoryPartiallySelected(
                      category.key
                    );

                    return (
                      <div
                        key={category.key}
                        className="rounded-lg border bg-card p-3 space-y-2"
                      >
                        {/* Category header */}
                        <div
                          className="flex items-center gap-2 cursor-pointer select-none"
                          onClick={() => toggleCategory(category.key)}
                        >
                          <Checkbox
                            checked={
                              fullySelected
                                ? true
                                : partiallySelected
                                  ? 'indeterminate'
                                  : false
                            }
                            onCheckedChange={() => toggleCategory(category.key)}
                            className="data-[state=checked]:bg-primary data-[state=indeterminate]:bg-primary"
                          />
                          <span className={category.color}>{category.icon}</span>
                          <span className="text-sm font-medium">
                            {t(`permissionCategories.${category.labelKey}`)}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] ml-auto px-1.5 py-0"
                          >
                            {
                              category.permissions.filter((p) =>
                                selectedPermissions.includes(p.key)
                              ).length
                            }
                            /{category.permissions.length}
                          </Badge>
                        </div>
                        {/* Individual permissions */}
                        <div className="flex flex-wrap gap-1.5 pl-6">
                          {category.permissions.map((perm) => {
                            const isSelected = selectedPermissions.includes(
                              perm.key
                            );
                            return (
                              <button
                                key={perm.key}
                                type="button"
                                onClick={() => togglePermission(perm.key)}
                                className={`
                                  inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium
                                  transition-all border cursor-pointer
                                  ${
                                    isSelected
                                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                      : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted hover:border-border'
                                  }
                                `}
                              >
                                {t(`permissionActions.${perm.actionKey}`)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Tab: Permissoes por Entidade */}
            <TabsContent value="entities" className="flex-1 flex flex-col min-h-0 mt-3">
              <p className="text-xs text-muted-foreground mb-2">
                {t('permissions.entitiesDescription')}
              </p>

              {loadingEntities ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : entities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg">
                  <Database className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {t('permissions.noEntities')}
                  </p>
                </div>
              ) : (
                <ScrollArea className="flex-1 min-h-0 max-h-[280px] border rounded-lg">
                  <div className="p-3 space-y-2">
                    {entities.map((entity) => {
                      const perm = getEntityPermission(entity.id);
                      const fullySelected = isEntityFullySelected(entity.id);
                      const partiallySelected = isEntityPartiallySelected(entity.id);

                      return (
                        <div
                          key={entity.id}
                          className={`rounded-lg border p-3 transition-colors ${
                            fullySelected
                              ? 'border-primary bg-primary/5'
                              : partiallySelected
                                ? 'border-primary/50 bg-primary/5'
                                : 'bg-card hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {/* Checkbox de selecao total */}
                            <Checkbox
                              checked={
                                fullySelected
                                  ? true
                                  : partiallySelected
                                    ? 'indeterminate'
                                    : false
                              }
                              onCheckedChange={() => toggleAllEntityPermissions(entity.id)}
                              className="data-[state=checked]:bg-primary data-[state=indeterminate]:bg-primary"
                            />

                            {/* Icone da entidade */}
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-lg">{entity.icon || '📋'}</span>
                              <div className="min-w-0 flex-1">
                                <span className="text-sm font-medium block truncate">
                                  {entity.name}
                                </span>
                                <span className="text-xs text-muted-foreground block truncate">
                                  {entity.slug}
                                </span>
                              </div>
                            </div>

                            {/* Permissoes individuais */}
                            <div className="flex items-center gap-1">
                              {(['canCreate', 'canRead', 'canUpdate', 'canDelete'] as const).map((permKey) => {
                                const isEnabled = perm[permKey];
                                const labels: Record<string, string> = {
                                  canCreate: 'C',
                                  canRead: 'R',
                                  canUpdate: 'U',
                                  canDelete: 'D',
                                };
                                const colors: Record<string, string> = {
                                  canCreate: 'bg-green-500',
                                  canRead: 'bg-blue-500',
                                  canUpdate: 'bg-yellow-500',
                                  canDelete: 'bg-red-500',
                                };

                                return (
                                  <button
                                    key={permKey}
                                    type="button"
                                    onClick={() => toggleEntityPermission(entity.id, permKey)}
                                    className={`
                                      w-7 h-7 rounded text-xs font-bold transition-all
                                      ${
                                        isEnabled
                                          ? `${colors[permKey]} text-white shadow-sm`
                                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                      }
                                    `}
                                    title={t(`permissions.entity.${permKey}`)}
                                  >
                                    {labels[permKey]}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}

              {/* Legenda */}
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-4 h-4 rounded bg-green-500 text-white text-[10px] flex items-center justify-center font-bold">C</span>
                  {t('permissions.entity.canCreate')}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-4 h-4 rounded bg-blue-500 text-white text-[10px] flex items-center justify-center font-bold">R</span>
                  {t('permissions.entity.canRead')}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-4 h-4 rounded bg-yellow-500 text-white text-[10px] flex items-center justify-center font-bold">U</span>
                  {t('permissions.entity.canUpdate')}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-4 h-4 rounded bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">D</span>
                  {t('permissions.entity.canDelete')}
                </span>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {tCommon('saving')}
                </>
              ) : isEditing ? (
                tCommon('save')
              ) : (
                tCommon('create')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

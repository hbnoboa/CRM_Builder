'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
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
} from 'lucide-react';
import { useCreateRole, useUpdateRole } from '@/hooks/use-roles';
import type { Role } from '@/types';

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
    }
  }, [role, form, open]);

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
  }, [watchName, isEditing, form]);

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

  const onSubmit = async (data: RoleFormData) => {
    try {
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
        await createRole.mutateAsync({
          name: data.name,
          slug: data.slug || undefined,
          description: data.description,
          permissions: data.permissions,
        });
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

          {/* Permissões */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-semibold">{t('permissions.title')}</Label>
              <Badge variant="secondary" className="text-xs">
                {selectedPermissions.length}/{ALL_PERMISSION_KEYS.length}
              </Badge>
            </div>
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

          <ScrollArea className="flex-1 min-h-0 max-h-[340px] border rounded-lg">
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

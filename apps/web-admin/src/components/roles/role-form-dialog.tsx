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

// ── Categorias de permissoes ─────────────────────────────────────────────────

const PERMISSION_CATEGORIES = [
  {
    key: 'entities',
    icon: Database,
    color: 'text-blue-600',
    permissions: ['entities:create', 'entities:read', 'entities:update', 'entities:delete'],
  },
  {
    key: 'data',
    icon: FileText,
    color: 'text-green-600',
    permissions: ['data:create', 'data:read', 'data:update', 'data:delete', 'data:export', 'data:import'],
  },
  {
    key: 'pages',
    icon: FileText,
    color: 'text-purple-600',
    permissions: ['pages:create', 'pages:read', 'pages:update', 'pages:delete', 'pages:publish'],
  },
  {
    key: 'apis',
    icon: Code,
    color: 'text-orange-600',
    permissions: ['apis:create', 'apis:read', 'apis:update', 'apis:delete', 'apis:execute'],
  },
  {
    key: 'users',
    icon: Users,
    color: 'text-cyan-600',
    permissions: ['users:create', 'users:read', 'users:update', 'users:delete', 'users:invite'],
  },
  {
    key: 'roles',
    icon: Key,
    color: 'text-yellow-600',
    permissions: ['roles:create', 'roles:read', 'roles:update', 'roles:delete', 'roles:assign'],
  },
  {
    key: 'organization',
    icon: Building,
    color: 'text-indigo-600',
    permissions: ['organization:read', 'organization:update'],
  },
  {
    key: 'settings',
    icon: Settings,
    color: 'text-gray-600',
    permissions: ['settings:read', 'settings:update'],
  },
  {
    key: 'stats',
    icon: BarChart3,
    color: 'text-pink-600',
    permissions: ['stats:read'],
  },
  {
    key: 'upload',
    icon: Upload,
    color: 'text-teal-600',
    permissions: ['upload:create', 'upload:delete'],
  },
];

const ALL_PERMISSIONS = PERMISSION_CATEGORIES.flatMap((c) => c.permissions);

// ── Schema ───────────────────────────────────────────────────────────────────

const roleSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-_]+$/).optional().or(z.literal('')),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

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

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '');
}

export function RoleFormDialog({ open, onOpenChange, role, onSuccess }: RoleFormDialogProps) {
  const t = useTranslations('rolesPage');
  const tCommon = useTranslations('common');
  const isEditing = !!role;

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

  // Reset form quando abre/fecha ou muda role
  useEffect(() => {
    if (!open) return;

    if (role) {
      const perms = Array.isArray(role.permissions)
        ? role.permissions as string[]
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, role?.id]);

  // Leitura do form para render
  const permissions = form.watch('permissions') || [];

  // Handler para nome - gera slug automatico
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    form.setValue('name', name);
    if (!isEditing) {
      form.setValue('slug', generateSlug(name));
    }
  };

  const togglePermission = (perm: string) => {
    const current = form.getValues('permissions') || [];
    const updated = current.includes(perm)
      ? current.filter((p) => p !== perm)
      : [...current, perm];
    form.setValue('permissions', updated, { shouldDirty: true });
  };

  const toggleCategory = (categoryKey: string) => {
    const category = PERMISSION_CATEGORIES.find((c) => c.key === categoryKey);
    if (!category) return;

    const current = form.getValues('permissions') || [];
    const allSelected = category.permissions.every((p) => current.includes(p));

    const updated = allSelected
      ? current.filter((p) => !category.permissions.includes(p))
      : Array.from(new Set([...current, ...category.permissions]));

    form.setValue('permissions', updated, { shouldDirty: true });
  };

  const selectAll = () => form.setValue('permissions', [...ALL_PERMISSIONS], { shouldDirty: true });
  const deselectAll = () => form.setValue('permissions', [], { shouldDirty: true });

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
    } catch {
      // Error handled by hook
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
            {isEditing ? t('form.editDescription') : t('form.createDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0 gap-4">
          {/* Campos basicos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">{t('form.name')} *</Label>
              <Input
                id="name"
                placeholder={t('form.namePlaceholder')}
                value={form.watch('name')}
                onChange={handleNameChange}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            {!isEditing && (
              <div className="space-y-1.5">
                <Label htmlFor="slug">{t('form.slug')}</Label>
                <Input
                  id="slug"
                  placeholder={t('form.slugPlaceholder')}
                  className="font-mono text-sm"
                  {...form.register('slug')}
                />
                {form.formState.errors.slug && (
                  <p className="text-xs text-destructive">{form.formState.errors.slug.message}</p>
                )}
              </div>
            )}

            <div className={isEditing ? '' : 'sm:col-span-2'}>
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

          {/* Permissoes */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-semibold">{t('permissions.title')}</Label>
              <Badge variant="secondary" className="text-xs">
                {permissions.length}/{ALL_PERMISSIONS.length}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAll}>
                <CheckSquare className="h-3 w-3 mr-1" />
                {t('permissions.selectAll')}
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={deselectAll}>
                {t('permissions.selectNone')}
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1 min-h-0 max-h-[340px] border rounded-lg">
            <div className="p-3 space-y-3">
              {PERMISSION_CATEGORIES.map((category) => {
                const Icon = category.icon;
                const categoryPerms = category.permissions;
                const selectedCount = categoryPerms.filter((p) => permissions.includes(p)).length;
                const allSelected = selectedCount === categoryPerms.length;
                const someSelected = selectedCount > 0 && selectedCount < categoryPerms.length;

                return (
                  <div key={category.key} className="rounded-lg border bg-card p-3 space-y-2">
                    <div
                      className="flex items-center gap-2 cursor-pointer select-none"
                      onClick={() => toggleCategory(category.key)}
                    >
                      <Checkbox
                        checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                        className="data-[state=checked]:bg-primary data-[state=indeterminate]:bg-primary pointer-events-none"
                      />
                      <span className={category.color}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-medium">
                        {t(`permissionCategories.${category.key}`)}
                      </span>
                      <Badge variant="outline" className="text-[10px] ml-auto px-1.5 py-0">
                        {selectedCount}/{categoryPerms.length}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pl-6">
                      {categoryPerms.map((perm) => {
                        const action = perm.split(':')[1];
                        const isSelected = permissions.includes(perm);
                        return (
                          <button
                            key={perm}
                            type="button"
                            onClick={() => togglePermission(perm)}
                            className={`
                              inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium
                              transition-all border cursor-pointer
                              ${isSelected
                                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted hover:border-border'
                              }
                            `}
                          >
                            {t(`permissionActions.${action}`)}
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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

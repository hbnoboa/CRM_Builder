'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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

const PERMISSION_CATEGORIES: {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  permissions: { key: string; label: string }[];
}[] = [
  {
    key: 'entities',
    label: 'Entidades',
    icon: <Database className="h-4 w-4" />,
    color: 'text-blue-600',
    permissions: [
      { key: 'entities:create', label: 'Criar' },
      { key: 'entities:read', label: 'Visualizar' },
      { key: 'entities:update', label: 'Editar' },
      { key: 'entities:delete', label: 'Excluir' },
    ],
  },
  {
    key: 'data',
    label: 'Dados / Registros',
    icon: <FileText className="h-4 w-4" />,
    color: 'text-green-600',
    permissions: [
      { key: 'data:create', label: 'Criar' },
      { key: 'data:read', label: 'Visualizar' },
      { key: 'data:update', label: 'Editar' },
      { key: 'data:delete', label: 'Excluir' },
      { key: 'data:export', label: 'Exportar' },
      { key: 'data:import', label: 'Importar' },
    ],
  },
  {
    key: 'pages',
    label: 'Páginas',
    icon: <FileText className="h-4 w-4" />,
    color: 'text-purple-600',
    permissions: [
      { key: 'pages:create', label: 'Criar' },
      { key: 'pages:read', label: 'Visualizar' },
      { key: 'pages:update', label: 'Editar' },
      { key: 'pages:delete', label: 'Excluir' },
      { key: 'pages:publish', label: 'Publicar' },
    ],
  },
  {
    key: 'apis',
    label: 'APIs Customizadas',
    icon: <Code className="h-4 w-4" />,
    color: 'text-orange-600',
    permissions: [
      { key: 'apis:create', label: 'Criar' },
      { key: 'apis:read', label: 'Visualizar' },
      { key: 'apis:update', label: 'Editar' },
      { key: 'apis:delete', label: 'Excluir' },
      { key: 'apis:execute', label: 'Executar' },
    ],
  },
  {
    key: 'users',
    label: 'Usuários',
    icon: <Users className="h-4 w-4" />,
    color: 'text-cyan-600',
    permissions: [
      { key: 'users:create', label: 'Criar' },
      { key: 'users:read', label: 'Visualizar' },
      { key: 'users:update', label: 'Editar' },
      { key: 'users:delete', label: 'Excluir' },
      { key: 'users:invite', label: 'Convidar' },
    ],
  },
  {
    key: 'roles',
    label: 'Roles / Papéis',
    icon: <Key className="h-4 w-4" />,
    color: 'text-yellow-600',
    permissions: [
      { key: 'roles:create', label: 'Criar' },
      { key: 'roles:read', label: 'Visualizar' },
      { key: 'roles:update', label: 'Editar' },
      { key: 'roles:delete', label: 'Excluir' },
      { key: 'roles:assign', label: 'Atribuir' },
    ],
  },
  {
    key: 'organization',
    label: 'Organização',
    icon: <Building className="h-4 w-4" />,
    color: 'text-indigo-600',
    permissions: [
      { key: 'organization:read', label: 'Visualizar' },
      { key: 'organization:update', label: 'Editar' },
    ],
  },
  {
    key: 'settings',
    label: 'Configurações',
    icon: <Settings className="h-4 w-4" />,
    color: 'text-gray-600',
    permissions: [
      { key: 'settings:read', label: 'Visualizar' },
      { key: 'settings:update', label: 'Editar' },
    ],
  },
  {
    key: 'stats',
    label: 'Estatísticas',
    icon: <BarChart3 className="h-4 w-4" />,
    color: 'text-pink-600',
    permissions: [{ key: 'stats:read', label: 'Visualizar' }],
  },
  {
    key: 'upload',
    label: 'Upload / Arquivos',
    icon: <Upload className="h-4 w-4" />,
    color: 'text-teal-600',
    permissions: [
      { key: 'upload:create', label: 'Fazer Upload' },
      { key: 'upload:delete', label: 'Excluir' },
    ],
  },
];

const ALL_PERMISSION_KEYS = PERMISSION_CATEGORIES.flatMap((c) =>
  c.permissions.map((p) => p.key)
);

// ── Schema ───────────────────────────────────────────────────────────────────

const roleSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  slug: z
    .string()
    .min(2, 'Slug deve ter pelo menos 2 caracteres')
    .regex(
      /^[a-z0-9-_]+$/,
      'Apenas letras minúsculas, números, hífens e underscores'
    )
    .optional()
    .or(z.literal('')),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

type RoleFormData = z.infer<typeof roleSchema>;

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
  const isEditing = !!role;
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();

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
    const category = PERMISSION_CATEGORIES.find((c) => c.key === categoryKey);
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
    const category = PERMISSION_CATEGORIES.find((c) => c.key === categoryKey);
    if (!category) return false;
    return category.permissions.every((p) =>
      selectedPermissions.includes(p.key)
    );
  };

  const isCategoryPartiallySelected = (categoryKey: string) => {
    const category = PERMISSION_CATEGORIES.find((c) => c.key === categoryKey);
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
            {isEditing ? 'Editar Role' : 'Nova Role'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize as informações e permissões desta role.'
              : 'Defina o nome e as permissões para a nova role.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col flex-1 min-h-0 gap-4"
        >
          {/* Dados básicos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                placeholder="Ex: Gerente de Vendas"
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
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  placeholder="gerente-vendas"
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
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                placeholder="Descreva as responsabilidades desta role..."
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
              <Label className="text-sm font-semibold">Permissões</Label>
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
                Todas
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={deselectAll}
              >
                Nenhuma
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1 min-h-0 max-h-[340px] border rounded-lg">
            <div className="p-3 space-y-3">
              {PERMISSION_CATEGORIES.map((category) => {
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
                        {category.label}
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
                            {perm.label}
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
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : isEditing ? (
                'Salvar Alterações'
              ) : (
                'Criar Role'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

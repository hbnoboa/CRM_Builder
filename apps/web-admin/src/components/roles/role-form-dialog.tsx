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
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Eye, Plus, Pencil, Trash2, Shield, Database, Users,
  Settings, Code, Layers, LayoutDashboard,
} from 'lucide-react';
import { useCreateCustomRole, useUpdateCustomRole } from '@/hooks/use-custom-roles';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { CustomRole, EntityPermission, ModulePermissions, Entity } from '@/types';

const ROLE_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#6b7280',
];

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

  const createRole = useCreateCustomRole({ success: t('toast.created') });
  const updateRole = useUpdateCustomRole({ success: t('toast.updated') });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [isDefault, setIsDefault] = useState(false);
  const [permissions, setPermissions] = useState<EntityPermission[]>([]);
  const [modulePerms, setModulePerms] = useState<ModulePermissions>({
    dashboard: true, users: false, settings: false, apis: false, pages: false, entities: false,
  });

  // Buscar entidades do tenant - refetch sempre que abrir para garantir dados atualizados
  const { data: entitiesData } = useQuery({
    queryKey: ['entities-for-roles'],
    queryFn: async () => {
      const res = await api.get('/entities', { params: { limit: 100 } });
      return res.data;
    },
    enabled: open,
    staleTime: 0, // Sempre refetch quando abrir
    refetchOnMount: 'always',
  });

  const entities: Entity[] = useMemo(() => {
    return Array.isArray(entitiesData?.data) ? entitiesData.data : [];
  }, [entitiesData]);

  // Inicializar formulário quando abre (apenas no open/role, NÃO no entities)
  useEffect(() => {
    if (!open) return;

    if (role) {
      setName(role.name);
      setDescription(role.description || '');
      setColor(role.color || '#6366f1');
      setIsDefault(role.isDefault || false);
      setPermissions(Array.isArray(role.permissions) ? role.permissions : []);
      setModulePerms(role.modulePermissions || {
        dashboard: true, users: false, settings: false, apis: false, pages: false, entities: false,
      });
    } else {
      setName('');
      setDescription('');
      setColor('#6366f1');
      setIsDefault(false);
      setPermissions([]);
      setModulePerms({
        dashboard: true, users: false, settings: false, apis: false, pages: false, entities: false,
      });
    }
  }, [role, open]);

  // Sincronizar TODAS as entidades nas permissões (adiciona faltantes, mantém existentes)
  useEffect(() => {
    if (!open || !entities.length) return;

    setPermissions((prev) => {
      const existingBySlug = new Map(prev.map((p) => [p.entitySlug, p]));

      // Montar lista completa: manter permissões existentes + adicionar novas entidades
      return entities.map((e) => {
        const existing = existingBySlug.get(e.slug);
        if (existing) {
          return { ...existing, entityName: e.name };
        }
        return {
          entitySlug: e.slug,
          entityName: e.name,
          canCreate: false,
          canRead: true,
          canUpdate: false,
          canDelete: false,
        };
      });
    });
  }, [entities, open]);

  const togglePermission = (entitySlug: string, field: keyof EntityPermission) => {
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

  const toggleAllForAction = (field: 'canCreate' | 'canRead' | 'canUpdate' | 'canDelete', value: boolean) => {
    setPermissions((prev) => prev.map((p) => ({ ...p, [field]: value })));
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
        entityName: p.entityName,
        canCreate: p.canCreate,
        canRead: p.canRead,
        canUpdate: p.canUpdate,
        canDelete: p.canDelete,
      })),
      modulePermissions: modulePerms,
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
  };

  const moduleLabels: Record<string, string> = {
    dashboard: 'Dashboard',
    users: t('modules.users'),
    settings: t('modules.settings'),
    apis: 'APIs',
    pages: t('modules.pages'),
    entities: t('modules.entities'),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[98vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" style={{ color }} />
            {isEditing ? t('editRole') : t('newRole')}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? t('form.editDescription') : t('form.createDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="flex-1 min-h-0 pr-4 -mr-4">
            <div className="space-y-5 pb-4">
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

              {/* Cor */}
              <div className="space-y-2">
                <Label>{t('form.color')}</Label>
                <div className="flex gap-2 flex-wrap">
                  {ROLE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </div>

              <Separator />

              {/* Módulos do Sistema */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">{t('form.systemModules')}</Label>
                <p className="text-sm text-muted-foreground">{t('form.systemModulesDesc')}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.entries(modulePerms).map(([key, value]) => (
                    <div
                      key={key}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        value ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'
                      }`}
                      onClick={() => setModulePerms((prev) => ({ ...prev, [key]: !prev[key as keyof ModulePermissions] }))}
                    >
                      <div className={`${value ? 'text-primary' : 'text-muted-foreground'}`}>
                        {moduleIcons[key]}
                      </div>
                      <span className="text-sm font-medium flex-1">{moduleLabels[key] || key}</span>
                      <Switch
                        checked={value || false}
                        onCheckedChange={(checked) => {
                          setModulePerms((prev) => ({ ...prev, [key]: checked }));
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Permissões por Entidade */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">{t('form.entityPermissions')}</Label>
                <p className="text-sm text-muted-foreground">{t('form.entityPermissionsDesc')}</p>
                <div className="flex-1 min-h-0 overflow-y-auto border rounded-lg">
                  {permissions.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      {t('form.noEntities')}
                    </div>
                  ) : (
                    <div>
                      {/* Header */}
                      <div className="grid grid-cols-[1fr_repeat(4,60px)_40px] sm:grid-cols-[1fr_repeat(4,80px)_50px] items-center gap-1 p-2 sm:p-3 bg-muted/50 text-xs font-medium text-muted-foreground">
                        <span>{t('form.entity')}</span>
                        <button
                          type="button"
                          className="text-center hover:text-foreground transition-colors flex flex-col items-center gap-0.5"
                          onClick={() => toggleAllForAction('canCreate', !permissions.every((p) => p.canCreate))}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{t('form.create')}</span>
                        </button>
                        <button
                          type="button"
                          className="text-center hover:text-foreground transition-colors flex flex-col items-center gap-0.5"
                          onClick={() => toggleAllForAction('canRead', !permissions.every((p) => p.canRead))}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{t('form.read')}</span>
                        </button>
                        <button
                          type="button"
                          className="text-center hover:text-foreground transition-colors flex flex-col items-center gap-0.5"
                          onClick={() => toggleAllForAction('canUpdate', !permissions.every((p) => p.canUpdate))}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{t('form.update')}</span>
                        </button>
                        <button
                          type="button"
                          className="text-center hover:text-foreground transition-colors flex flex-col items-center gap-0.5"
                          onClick={() => toggleAllForAction('canDelete', !permissions.every((p) => p.canDelete))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{t('form.delete')}</span>
                        </button>
                        <span></span>
                      </div>

                      {/* Rows */}
                      {permissions.map((perm, idx) => {
                        const entity = entities.find((e) => e.slug === perm.entitySlug);
                        const allChecked = perm.canCreate && perm.canRead && perm.canUpdate && perm.canDelete;
                        return (
                          <div
                            key={perm.entitySlug}
                            className={`grid grid-cols-[1fr_repeat(4,60px)_40px] sm:grid-cols-[1fr_repeat(4,80px)_50px] items-center gap-1 p-2 sm:p-3 ${
                              idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Database className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="text-sm font-medium truncate">
                                {entity?.name || perm.entityName || perm.entitySlug}
                              </span>
                            </div>
                            {(['canCreate', 'canRead', 'canUpdate', 'canDelete'] as const).map((action) => (
                              <div key={action} className="flex justify-center">
                                <Checkbox
                                  checked={perm[action]}
                                  onCheckedChange={() => togglePermission(perm.entitySlug, action)}
                                  className="h-5 w-5"
                                />
                              </div>
                            ))}
                            <div className="flex justify-center">
                              <Checkbox
                                checked={allChecked}
                                onCheckedChange={(checked) => toggleAllForEntity(perm.entitySlug, !!checked)}
                                className="h-4 w-4"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Default */}
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <Switch checked={isDefault} onCheckedChange={setIsDefault} />
                <div>
                  <Label className="font-medium">{t('form.isDefault')}</Label>
                  <p className="text-xs text-muted-foreground">{t('form.isDefaultDesc')}</p>
                </div>
              </div>
            </div>
          </ScrollArea>

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

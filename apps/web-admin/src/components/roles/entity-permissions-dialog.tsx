'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Database } from 'lucide-react';
import { toast } from 'sonner';
import { useEntities } from '@/hooks/use-entities';
import { rolesService } from '@/services/roles.service';
import type { Role, Entity } from '@/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role | null;
}

type PermKey = 'canCreate' | 'canRead' | 'canUpdate' | 'canDelete';

interface EntityPerm {
  entityId: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export function EntityPermissionsDialog({ open, onOpenChange, role }: Props) {
  const t = useTranslations('rolesPage');
  const queryClient = useQueryClient();
  const [perms, setPerms] = useState<Map<string, EntityPerm>>(new Map());
  const [saving, setSaving] = useState(false);

  // Busca entidades
  const { data: entitiesData, isLoading: loadingEntities } = useEntities();
  const entities: Entity[] = Array.isArray(entitiesData)
    ? entitiesData
    : entitiesData?.data || [];

  // Busca permissoes existentes
  const { data: existingPerms, isLoading: loadingPerms } = useQuery({
    queryKey: ['entity-permissions', role?.id],
    queryFn: () => rolesService.getEntityPermissions(role!.id),
    enabled: open && !!role?.id,
  });

  // Carrega permissoes existentes no state
  useEffect(() => {
    if (!existingPerms) return;
    const map = new Map<string, EntityPerm>();
    existingPerms.forEach((p: EntityPerm) => {
      map.set(p.entityId, p);
    });
    setPerms(map);
  }, [existingPerms]);

  // Toggle uma permissao
  const toggle = (entityId: string, key: PermKey) => {
    setPerms((prev) => {
      const map = new Map(prev);
      const current = map.get(entityId) || {
        entityId,
        canCreate: false,
        canRead: false,
        canUpdate: false,
        canDelete: false,
      };
      map.set(entityId, { ...current, [key]: !current[key] });
      return map;
    });
  };

  // Toggle todas permissoes de uma entidade
  const toggleAll = (entityId: string) => {
    setPerms((prev) => {
      const map = new Map(prev);
      const current = map.get(entityId);
      const allOn = current?.canCreate && current?.canRead && current?.canUpdate && current?.canDelete;

      if (allOn) {
        map.delete(entityId);
      } else {
        map.set(entityId, {
          entityId,
          canCreate: true,
          canRead: true,
          canUpdate: true,
          canDelete: true,
        });
      }
      return map;
    });
  };

  // Salvar
  const save = async () => {
    if (!role) return;
    setSaving(true);
    try {
      const permsArray = Array.from(perms.values()).filter(
        (p) => p.canCreate || p.canRead || p.canUpdate || p.canDelete
      );
      await rolesService.bulkSetEntityPermissions(role.id, permsArray);
      queryClient.invalidateQueries({ queryKey: ['entity-permissions', role.id] });
      toast.success(t('toast.permissionsSaved'));
      onOpenChange(false);
    } catch {
      toast.error(t('toast.error'));
    } finally {
      setSaving(false);
    }
  };

  const isLoading = loadingEntities || loadingPerms;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {t('permissions.entitiesTitle')} - {role?.name}
          </DialogTitle>
          <DialogDescription>
            {t('permissions.entitiesDescription')}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : entities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {t('permissions.noEntities')}
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {/* Header */}
            <div className="grid grid-cols-[1fr,repeat(4,48px)] gap-2 px-2 text-xs font-medium text-muted-foreground sticky top-0 bg-background py-2">
              <div>Entidade</div>
              <div className="text-center">C</div>
              <div className="text-center">R</div>
              <div className="text-center">U</div>
              <div className="text-center">D</div>
            </div>

            {/* Rows */}
            {entities.map((entity) => {
              const perm = perms.get(entity.id);
              const allOn = perm?.canCreate && perm?.canRead && perm?.canUpdate && perm?.canDelete;

              return (
                <div
                  key={entity.id}
                  className={`grid grid-cols-[1fr,repeat(4,48px)] gap-2 p-2 rounded-lg border items-center ${
                    allOn ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted/50'
                  }`}
                >
                  {/* Entity name */}
                  <button
                    type="button"
                    onClick={() => toggleAll(entity.id)}
                    className="flex items-center gap-2 text-left"
                  >
                    <span className="text-lg">{entity.icon || '📋'}</span>
                    <span className="text-sm font-medium truncate">{entity.name}</span>
                  </button>

                  {/* CRUD buttons */}
                  {(['canCreate', 'canRead', 'canUpdate', 'canDelete'] as PermKey[]).map((key) => {
                    const isOn = perm?.[key] || false;
                    const colors: Record<PermKey, string> = {
                      canCreate: 'bg-green-500',
                      canRead: 'bg-blue-500',
                      canUpdate: 'bg-yellow-500',
                      canDelete: 'bg-red-500',
                    };
                    const labels: Record<PermKey, string> = {
                      canCreate: 'C',
                      canRead: 'R',
                      canUpdate: 'U',
                      canDelete: 'D',
                    };

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggle(entity.id, key)}
                        className={`w-8 h-8 rounded text-xs font-bold mx-auto transition-all ${
                          isOn
                            ? `${colors[key]} text-white shadow-sm`
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        {labels[key]}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* Legenda */}
        <div className="flex gap-4 text-xs text-muted-foreground border-t pt-3">
          <span><span className="inline-block w-4 h-4 rounded bg-green-500 text-white text-center text-[10px] leading-4 mr-1">C</span> Criar</span>
          <span><span className="inline-block w-4 h-4 rounded bg-blue-500 text-white text-center text-[10px] leading-4 mr-1">R</span> Ler</span>
          <span><span className="inline-block w-4 h-4 rounded bg-yellow-500 text-white text-center text-[10px] leading-4 mr-1">U</span> Editar</span>
          <span><span className="inline-block w-4 h-4 rounded bg-red-500 text-white text-center text-[10px] leading-4 mr-1">D</span> Excluir</span>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

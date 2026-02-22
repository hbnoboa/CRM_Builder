'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Plus, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { entitiesService } from '@/services/entities.service';
import api from '@/lib/api';
import type { DataFilter, Entity, EntityField } from '@/types';

interface CustomRoleOption {
  id: string;
  name: string;
  color?: string;
}

const FILTER_OPERATORS = [
  { value: 'equals', label: 'Igual a' },
  { value: 'contains', label: 'Contém' },
  { value: 'startsWith', label: 'Começa com' },
  { value: 'endsWith', label: 'Termina com' },
  { value: 'isEmpty', label: 'Está vazio' },
  { value: 'isNotEmpty', label: 'Não está vazio' },
];

interface RoleFiltersPopoverProps {
  entity: Entity;
}

export function RoleFiltersPopover({ entity }: RoleFiltersPopoverProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [newFilter, setNewFilter] = useState<{
    fieldSlug: string;
    operator: string;
    value: string;
  }>({ fieldSlug: '', operator: 'equals', value: '' });

  // Buscar roles
  const { data: rolesData } = useQuery({
    queryKey: ['custom-roles-for-filters'],
    queryFn: async () => {
      const res = await api.get('/custom-roles', { params: { limit: 100 } });
      return res.data;
    },
    enabled: open,
  });

  const roles: CustomRoleOption[] = (rolesData?.data || []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    color: r.color as string | undefined,
  }));

  // Buscar filtros por role da entidade
  const { data: roleFilters, isLoading: loadingFilters } = useQuery({
    queryKey: ['entity-role-filters', entity.id],
    queryFn: () => entitiesService.getRoleFilters(entity.id),
    enabled: open,
  });

  const totalFilters = roleFilters
    ? Object.values(roleFilters).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0)
    : 0;

  const currentFilters: DataFilter[] = selectedRoleId && roleFilters
    ? (roleFilters[selectedRoleId] || [])
    : [];

  // Mutation para salvar
  const saveMutation = useMutation({
    mutationFn: ({ filters }: { filters: DataFilter[] }) =>
      entitiesService.updateRoleFilters(entity.id, selectedRoleId, filters),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entity-role-filters', entity.id] });
      toast.success('Filtros salvos');
    },
    onError: () => toast.error('Erro ao salvar filtros'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => entitiesService.deleteRoleFilters(entity.id, selectedRoleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entity-role-filters', entity.id] });
      toast.success('Filtros removidos');
    },
  });

  const fields = (entity.fields || []).filter(
    (f: EntityField) => !['image', 'images', 'sub-entity', 'array', 'hidden'].includes(f.type)
  );

  const selectedField = fields.find((f: EntityField) => f.slug === newFilter.fieldSlug);
  const needsValue = !['isEmpty', 'isNotEmpty'].includes(newFilter.operator);

  const handleAddFilter = () => {
    if (!selectedField || !selectedRoleId) return;
    if (needsValue && !newFilter.value.trim()) return;

    const filter: DataFilter = {
      fieldSlug: newFilter.fieldSlug,
      fieldName: selectedField.label || selectedField.name,
      fieldType: selectedField.type,
      operator: newFilter.operator,
      ...(needsValue ? { value: newFilter.value.trim() } : {}),
    };

    const updated = [...currentFilters, filter];
    saveMutation.mutate({ filters: updated });
    setNewFilter({ fieldSlug: '', operator: 'equals', value: '' });
  };

  const handleRemoveFilter = (index: number) => {
    const updated = currentFilters.filter((_, i) => i !== index);
    if (updated.length === 0) {
      deleteMutation.mutate();
    } else {
      saveMutation.mutate({ filters: updated });
    }
  };

  const rolesWithFilters = roleFilters
    ? Object.entries(roleFilters)
        .filter(([, filters]) => Array.isArray(filters) && filters.length > 0)
        .map(([roleId]) => roles.find(r => r.id === roleId)?.name || roleId)
    : [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Shield className="h-4 w-4" />
          <span className="hidden sm:inline">Filtros por Role</span>
          {totalFilters > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
              {totalFilters}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-4" align="end">
        <div className="space-y-4">
          <div>
            <div className="font-medium">Filtros de Dados por Role</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Define quais registros cada role pode ver nesta entidade.
            </p>
          </div>

          {/* Roles com filtros ativos */}
          {rolesWithFilters.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {rolesWithFilters.map(name => (
                <Badge key={name} variant="outline" className="text-[10px]">
                  <Shield className="h-2.5 w-2.5 mr-1" />
                  {name}
                </Badge>
              ))}
            </div>
          )}

          {/* Selecionar role */}
          <div className="space-y-1.5">
            <Label className="text-xs">Role</Label>
            <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar role..." />
              </SelectTrigger>
              <SelectContent>
                {roles.map(role => (
                  <SelectItem key={role.id} value={role.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: role.color || '#6366f1' }}
                      />
                      {role.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedRoleId && (
            <>
              {/* Filtros existentes */}
              {loadingFilters ? (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : currentFilters.length > 0 ? (
                <div className="space-y-1">
                  <Label className="text-xs">Filtros ativos</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {currentFilters.map((filter, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="text-[10px] px-2 py-0.5 gap-1"
                      >
                        <span className="font-medium">{filter.fieldName}</span>
                        <span className="text-muted-foreground">
                          {filter.operator === 'equals' ? '=' : filter.operator}
                        </span>
                        <span>{String(filter.value ?? '')}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFilter(idx)}
                          className="ml-0.5 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-1">
                  Nenhum filtro para esta role. Usuarios veem todos os registros.
                </p>
              )}

              {/* Adicionar filtro */}
              <div className="space-y-2 border-t pt-3">
                <Label className="text-xs">Adicionar filtro</Label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Select
                    value={newFilter.fieldSlug}
                    onValueChange={(v) => setNewFilter(prev => ({ ...prev, fieldSlug: v }))}
                  >
                    <SelectTrigger className="h-7 w-[120px] text-[11px]">
                      <SelectValue placeholder="Campo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {fields.map((f: EntityField) => (
                        <SelectItem key={f.slug} value={f.slug} className="text-xs">
                          {f.label || f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={newFilter.operator}
                    onValueChange={(v) => setNewFilter(prev => ({ ...prev, operator: v }))}
                  >
                    <SelectTrigger className="h-7 w-[100px] text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FILTER_OPERATORS.map(op => (
                        <SelectItem key={op.value} value={op.value} className="text-xs">
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {needsValue && (
                    <Input
                      value={newFilter.value}
                      onChange={(e) => setNewFilter(prev => ({ ...prev, value: e.target.value }))}
                      placeholder="Valor..."
                      className="h-7 w-[100px] text-[11px]"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddFilter();
                        }
                      }}
                    />
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    onClick={handleAddFilter}
                    disabled={
                      !newFilter.fieldSlug ||
                      (needsValue && !newFilter.value.trim()) ||
                      saveMutation.isPending
                    }
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

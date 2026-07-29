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
  ChevronRight, ListFilter, X, FileText, Bell, ScrollText, BarChart3,
  Webhook, Zap, Mail,
} from 'lucide-react';
import { useCreateCustomRole, useUpdateCustomRole } from '@/hooks/use-custom-roles';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useTenant } from '@/stores/tenant-context';
import { usePermissions } from '@/hooks/use-permissions';
import type { CustomRole, DataFilter, EntityPermission, EntityField, ModulePermission, ModulePermissions, Entity, PermissionScope, NotificationRule } from '@/types';

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

type ModuleActionDef = { key: string; label: string; desc: string; writes?: string[]; danger?: boolean };

// notifications removido: era um modulo "fantasma" (nenhum endpoint/guard o verifica).
const MODULE_KEYS = [
  'dashboard', 'data', 'entities', 'users', 'roles', 'settings', 'tenants',
  'automations', 'templates', 'logs', 'publicLinks', 'archive'
] as const;

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

function getOperatorCategory(fieldType: string): string {
  const textTypes = ['text', 'textarea', 'richtext', 'email', 'phone', 'url', 'cpf', 'cnpj', 'cep', 'password'];
  const numberTypes = ['number', 'currency', 'percentage', 'rating', 'slider'];
  const dateTypes = ['date', 'datetime', 'time'];
  const booleanTypes = ['boolean'];
  const selectTypes = ['select', 'multiselect', 'api-select', 'relation'];

  if (textTypes.includes(fieldType)) return 'text';
  if (numberTypes.includes(fieldType)) return 'number';
  if (dateTypes.includes(fieldType)) return 'date';
  if (booleanTypes.includes(fieldType)) return 'boolean';
  if (selectTypes.includes(fieldType)) return 'select';
  return 'text';
}

function DataFilterAdder({ fields, onAdd }: {
  fields: EntityField[];
  onAdd: (filter: DataFilter) => void;
}) {
  const t = useTranslations('rolesPage');
  const tCommon = useTranslations('common');
  const [fieldSlug, setFieldSlug] = useState('');
  const [operator, setOperator] = useState('');
  const [value, setValue] = useState('');
  const [value2, setValue2] = useState('');

  const getOperatorsForType = (fieldType: string): { value: string; label: string }[] => {
    const category = getOperatorCategory(fieldType);
    const OPERATORS_BY_TYPE: Record<string, { value: string; label: string }[]> = {
      text: [
        { value: 'contains', label: t('dataFilters.operators.contains') },
        { value: 'equals', label: t('dataFilters.operators.equals') },
        { value: 'notEquals', label: t('dataFilters.operators.notEquals') },
        { value: 'startsWith', label: t('dataFilters.operators.startsWith') },
        { value: 'endsWith', label: t('dataFilters.operators.endsWith') },
        { value: 'isEmpty', label: t('dataFilters.operators.isEmpty') },
        { value: 'isNotEmpty', label: t('dataFilters.operators.isNotEmpty') },
      ],
      number: [
        { value: 'equals', label: t('dataFilters.operators.equals') },
        { value: 'gt', label: t('dataFilters.operators.gt') },
        { value: 'gte', label: t('dataFilters.operators.gte') },
        { value: 'lt', label: t('dataFilters.operators.lt') },
        { value: 'lte', label: t('dataFilters.operators.lte') },
        { value: 'between', label: t('dataFilters.operators.between') },
        { value: 'isEmpty', label: t('dataFilters.operators.isEmpty') },
      ],
      date: [
        { value: 'equals', label: t('dataFilters.operators.equals') },
        { value: 'gt', label: t('dataFilters.operators.gt') },
        { value: 'gte', label: t('dataFilters.operators.gte') },
        { value: 'lt', label: t('dataFilters.operators.lt') },
        { value: 'lte', label: t('dataFilters.operators.lte') },
        { value: 'between', label: t('dataFilters.operators.between') },
        { value: 'isEmpty', label: t('dataFilters.operators.isEmpty') },
      ],
      boolean: [
        { value: 'equals', label: t('dataFilters.operators.equals') },
      ],
      select: [
        { value: 'equals', label: t('dataFilters.operators.equals') },
        { value: 'notEquals', label: t('dataFilters.operators.notEquals') },
        { value: 'isEmpty', label: t('dataFilters.operators.isEmpty') },
        { value: 'isNotEmpty', label: t('dataFilters.operators.isNotEmpty') },
      ],
    };
    return OPERATORS_BY_TYPE[category] || OPERATORS_BY_TYPE.text;
  };

  const selectedField = fields.find(f => f.slug === fieldSlug);
  const operators = selectedField ? getOperatorsForType(selectedField.type) : getOperatorsForType('text');
  const category = selectedField ? getOperatorCategory(selectedField.type) : 'text';
  const needsValue = !['isEmpty', 'isNotEmpty'].includes(operator);
  const needsValue2 = operator === 'between';
  const inputType = category === 'number' ? 'number' : category === 'date' ? 'date' : 'text';

  const handleFieldChange = (slug: string) => {
    setFieldSlug(slug);
    const field = fields.find(f => f.slug === slug);
    const ops = field ? getOperatorsForType(field.type) : getOperatorsForType('text');
    setOperator(ops[0]?.value || 'equals');
    setValue('');
    setValue2('');
  };

  const handleOperatorChange = (op: string) => {
    setOperator(op);
    setValue('');
    setValue2('');
  };

  const handleAdd = () => {
    if (!fieldSlug || !selectedField) return;
    if (needsValue && !value.trim()) return;
    if (needsValue2 && !value2.trim()) return;
    onAdd({
      fieldSlug,
      fieldName: selectedField.label || selectedField.name,
      fieldType: selectedField.type,
      operator,
      ...(needsValue ? { value: category === 'boolean' ? value === 'true' : value.trim() } : {}),
      ...(needsValue2 ? { value2: value2.trim() } : {}),
    });
    setFieldSlug('');
    setOperator('');
    setValue('');
    setValue2('');
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Select value={fieldSlug} onValueChange={handleFieldChange}>
        <SelectTrigger className="h-7 w-[130px] text-[11px]">
          <SelectValue placeholder="Campo..." />
        </SelectTrigger>
        <SelectContent>
          {fields.map(f => (
            <SelectItem key={f.slug} value={f.slug} className="text-xs">
              {f.label || f.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {fieldSlug && (
        <Select value={operator} onValueChange={handleOperatorChange}>
          <SelectTrigger className="h-7 w-[120px] text-[11px]">
            <SelectValue placeholder="Operador..." />
          </SelectTrigger>
          <SelectContent>
            {operators.map(op => (
              <SelectItem key={op.value} value={op.value} className="text-xs">
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {needsValue && operator && category === 'boolean' && (
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger className="h-7 w-[100px] text-[11px]">
            <SelectValue placeholder="Valor..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true" className="text-xs">{tCommon('yes')}</SelectItem>
            <SelectItem value="false" className="text-xs">{tCommon('no')}</SelectItem>
          </SelectContent>
        </Select>
      )}
      {needsValue && operator && category !== 'boolean' && (
        <Input
          type={inputType}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={needsValue2 ? 'De...' : 'Valor...'}
          className="h-7 w-[100px] text-[11px]"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
        />
      )}
      {needsValue2 && (
        <Input
          type={inputType}
          value={value2}
          onChange={(e) => setValue2(e.target.value)}
          placeholder="Até..."
          className="h-7 w-[100px] text-[11px]"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
        />
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 px-2 text-[11px]"
        onClick={handleAdd}
        disabled={!fieldSlug || !operator || (needsValue && !value.trim()) || (needsValue2 && !value2.trim())}
      >
        <Plus className="h-3 w-3 mr-1" />
        {tCommon('add')}
      </Button>
    </div>
  );
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
  const [rank, setRank] = useState<string>('');
  const [permissions, setPermissions] = useState<EntityPermission[]>([]);
  const [modulePerms, setModulePerms] = useState<Record<string, ModulePermission>>(getDefaultModulePerms);
  // Acesso total ao tenant (dinâmico): flag que libera tudo, inclusive módulos/tabelas futuros.
  const [allAccess, setAllAccess] = useState(false);
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
      setRank(role.rank != null ? String(role.rank) : '');
      setPermissions(Array.isArray(role.permissions) ? role.permissions : []);

      const normalized = normalizeModulePermToRecord(role.modulePermissions as Record<string, unknown>);
      const perms: Record<string, ModulePermission> = {};
      for (const key of MODULE_KEYS) {
        perms[key] = normalized[key] || (key === 'dashboard'
          ? { canRead: true, canCreate: false, canUpdate: false, canDelete: false }
          : { ...EMPTY_MODULE_PERM });
      }
      const fa = (role.modulePermissions as Record<string, unknown> | undefined)?.allAccess === true;
      setAllAccess(fa);
      // Com acesso total, mostra tudo marcado (mesmo que o DB só tenha o flag).
      setModulePerms(fa ? buildFullModulePerms() : perms);
    } else {
      setAllAccess(false);
      setName('');
      setDescription('');
      setColor('#6366f1');
      setIsDefault(false);
      setRank('');
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
          fps.push({ fieldSlug, canView: true, canEdit: action === 'canEdit' });
        }
        return { ...p, fieldPermissions: fps };
      })
    );
  };

  const [expandedFieldPerms, setExpandedFieldPerms] = useState<Set<string>>(new Set());
  const [expandedDataFilters, setExpandedDataFilters] = useState<Set<string>>(new Set());

  const toggleFieldPermsExpand = (entitySlug: string) => {
    setExpandedFieldPerms(prev => {
      const next = new Set(prev);
      if (next.has(entitySlug)) next.delete(entitySlug);
      else next.add(entitySlug);
      return next;
    });
  };

  const toggleDataFiltersExpand = (entitySlug: string) => {
    setExpandedDataFilters(prev => {
      const next = new Set(prev);
      if (next.has(entitySlug)) next.delete(entitySlug);
      else next.add(entitySlug);
      return next;
    });
  };

  const addDataFilter = (entitySlug: string, filter: DataFilter) => {
    setPermissions(prev =>
      prev.map(p => {
        if (p.entitySlug !== entitySlug) return p;
        const existing = p.dataFilters || [];
        return { ...p, dataFilters: [...existing, filter] };
      })
    );
  };

  const removeDataFilter = (entitySlug: string, index: number) => {
    setPermissions(prev =>
      prev.map(p => {
        if (p.entitySlug !== entitySlug) return p;
        const filters = [...(p.dataFilters || [])];
        filters.splice(index, 1);
        return { ...p, dataFilters: filters };
      })
    );
  };

  const [expandedNotifRules, setExpandedNotifRules] = useState<Set<string>>(new Set());

  const toggleNotifRulesExpand = (entitySlug: string) => {
    setExpandedNotifRules(prev => {
      const next = new Set(prev);
      if (next.has(entitySlug)) next.delete(entitySlug);
      else next.add(entitySlug);
      return next;
    });
  };

  const toggleNotificationEnabled = (entitySlug: string) => {
    setPermissions(prev =>
      prev.map(p => {
        if (p.entitySlug !== entitySlug) return p;
        const current = p.notificationRules;
        if (!current || !current.enabled) {
          return { ...p, notificationRules: { enabled: true, onCreate: true, onUpdate: true, onDelete: true, conditions: [] } };
        }
        return { ...p, notificationRules: { ...current, enabled: false } };
      })
    );
  };

  const toggleNotificationOp = (entitySlug: string, op: 'onCreate' | 'onUpdate' | 'onDelete') => {
    setPermissions(prev =>
      prev.map(p => {
        if (p.entitySlug !== entitySlug || !p.notificationRules) return p;
        return { ...p, notificationRules: { ...p.notificationRules, [op]: !p.notificationRules[op] } };
      })
    );
  };

  const addNotifCondition = (entitySlug: string, filter: DataFilter) => {
    setPermissions(prev =>
      prev.map(p => {
        if (p.entitySlug !== entitySlug || !p.notificationRules) return p;
        const existing = p.notificationRules.conditions || [];
        return { ...p, notificationRules: { ...p.notificationRules, conditions: [...existing, filter] } };
      })
    );
  };

  const removeNotifCondition = (entitySlug: string, index: number) => {
    setPermissions(prev =>
      prev.map(p => {
        if (p.entitySlug !== entitySlug || !p.notificationRules) return p;
        const conditions = [...(p.notificationRules.conditions || [])];
        conditions.splice(index, 1);
        return { ...p, notificationRules: { ...p.notificationRules, conditions } };
      })
    );
  };

  // Liga/desliga uma acao. Uma acao pode escrever varias flags (ex.: publicLinks
  // 'Gerenciar' grava canManage + CRUD para casar backend e frontend).
  // Materializa TODOS os módulos com todas as ações marcadas (usado ao ligar "Acesso total").
  const buildFullModulePerms = (): Record<string, ModulePermission> => {
    const full: Record<string, ModulePermission> = {};
    for (const key of MODULE_KEYS) {
      const acts: Record<string, boolean> = {};
      for (const a of MODULE_ACTIONS[key] ?? []) {
        for (const w of a.writes ?? [a.key]) acts[w] = true;
      }
      full[key] = acts as unknown as ModulePermission;
    }
    return full;
  };

  // Liga o "Acesso total": marca tudo (módulos + coringa '*' de entidade) e ativa o flag.
  const enableFullAccess = () => {
    setModulePerms(buildFullModulePerms());
    setPermissions((prev) => {
      const rest = prev.filter((p) => p.entitySlug !== '*');
      const wildcard: EntityPermission = {
        entitySlug: '*', canRead: true, canCreate: true, canUpdate: true, canDelete: true, scope: 'all',
      };
      return [wildcard, ...rest];
    });
    setAllAccess(true);
  };

  const toggleModuleAction = (
    moduleKey: string,
    action: { key: string; writes?: string[] },
  ) => {
    if (allAccess) setAllAccess(false); // customizou → materializa (estado já está cheio) e sai do modo dinâmico
    const writes = action.writes ?? [action.key];
    const current = !!(modulePerms[moduleKey] as Record<string, unknown> | undefined)?.[action.key];
    setModulePerms((prev) => {
      const next = { ...(prev[moduleKey] ?? EMPTY_MODULE_PERM) } as Record<string, unknown>;
      for (const w of writes) next[w] = !current;
      return { ...prev, [moduleKey]: next as unknown as ModulePermission };
    });
  };

  const toggleAllModule = (moduleKey: string, value: boolean) => {
    if (allAccess) setAllAccess(false);
    setModulePerms((prev) => {
      const next = { ...(prev[moduleKey] ?? EMPTY_MODULE_PERM) } as Record<string, unknown>;
      for (const a of MODULE_ACTIONS[moduleKey] ?? []) {
        for (const w of a.writes ?? [a.key]) next[w] = value;
      }
      return { ...prev, [moduleKey]: next as unknown as ModulePermission };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Preserva chaves de modulePermissions que este form NAO renderiza (ex.: 'platform'
    // com crossTenant/manageTenants/impersonateAny). Sem isso, salvar o cargo Super Admin
    // apagaria o acesso de plataforma e o backend bloquearia por anti-lockout (403).
    const known = new Set<string>(MODULE_KEYS);
    const passthrough = Object.fromEntries(
      Object.entries((role?.modulePermissions ?? {}) as Record<string, unknown>)
        .filter(([k]) => !known.has(k)),
    );

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
        ...(p.dataFilters && p.dataFilters.length > 0 ? { dataFilters: p.dataFilters } : {}),
        ...(p.canExport ? { canExport: true } : {}),
        ...(p.canImport ? { canImport: true } : {}),
        ...(p.canConfigureColumns ? { canConfigureColumns: true } : {}),
        ...(p.notificationRules?.enabled ? { notificationRules: p.notificationRules } : {}),
      })),
      // allAccess: flag dinâmico de "acesso total ao tenant". Sempre enviado (true/false)
      // para ligar/desligar de forma explícita no banco.
      modulePermissions: { ...passthrough, ...modulePerms, allAccess } as ModulePermissions,
      ...(rank.trim() !== '' && Number.isFinite(Number(rank)) ? { rank: Number(rank) } : {}),
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
    templates: <FileText className="h-4 w-4" />,
    entities: <Database className="h-4 w-4" />,
    tenants: <Building2 className="h-4 w-4" />,
    data: <Globe className="h-4 w-4" />,
    roles: <Shield className="h-4 w-4" />,
    logs: <ScrollText className="h-4 w-4" />,
    automations: <Zap className="h-4 w-4" />,
    notifications: <Bell className="h-4 w-4" />,
  };

  const crudActions = [
    { key: 'canRead' as const, label: t('form.read'), icon: <Eye className="h-3.5 w-3.5" /> },
    { key: 'canCreate' as const, label: t('form.create'), icon: <Plus className="h-3.5 w-3.5" /> },
    { key: 'canUpdate' as const, label: t('form.update'), icon: <Pencil className="h-3.5 w-3.5" /> },
    { key: 'canDelete' as const, label: t('form.delete'), icon: <Trash2 className="h-3.5 w-3.5" /> },
  ];

  // Schema de acoes REAIS por modulo (cada uma enforçada/usada no sistema).
  // Cada acao e um toggle independente, com label + descricao. `writes` permite
  // que um toggle grave varias flags (publicLinks: canManage + CRUD). `danger`
  // destaca acoes destrutivas. Sem CRUD generico onde nao existe (ex.: logs nao
  // tem "criar"; archive so tem ver + excluir definitivo).
  const A = (key: string, label: string, descKey: string, opts?: { writes?: string[]; danger?: boolean }) => ({
    key, label, desc: t(`acts.${descKey}`), writes: opts?.writes, danger: opts?.danger,
  });
  const R = (m: string) => A('canRead', t('form.read'), `${m}_canRead`);
  const C = (m: string) => A('canCreate', t('form.create'), `${m}_canCreate`);
  const U = (m: string) => A('canUpdate', t('form.update'), `${m}_canUpdate`);
  const D = (m: string) => A('canDelete', t('form.delete'), `${m}_canDelete`, { danger: true });

  const MODULE_ACTIONS: Record<string, ModuleActionDef[]> = {
    dashboard: [R('dashboard'), C('dashboard'), U('dashboard'), D('dashboard')],
    data: [R('data'), C('data'), U('data'), D('data')],
    // entities: sem canRead (nao e verificado em lugar nenhum); so estrutura.
    entities: [C('entities'), U('entities'), D('entities')],
    users: [
      R('users'), C('users'), U('users'), D('users'),
      A('canAssignRole', t('permissions.canAssignRole'), 'users_canAssignRole'),
      A('canChangeStatus', t('permissions.canChangeStatus'), 'users_canChangeStatus'),
      A('canManageTenantAccess', t('permissions.canManageTenantAccess'), 'users_canManageTenantAccess'),
    ],
    roles: [
      R('roles'), C('roles'), U('roles'), D('roles'),
      A('canSetDefault', t('permissions.canSetDefault'), 'roles_canSetDefault'),
      A('canManagePermissions', t('permissions.canManagePermissions'), 'roles_canManagePermissions'),
    ],
    // settings: unica permissao real e abrir/editar a aba "Organizacao"
    // (perfil/idioma/tema sao pessoais e nao exigem permissao).
    settings: [A('canUpdate', t('permissions.canManageOrg'), 'settings_canUpdate')],
    // tenants: sem canRead (nao verificado); CUD sao operacoes de plataforma.
    tenants: [
      C('tenants'), U('tenants'), D('tenants'),
      A('canSuspend', t('permissions.canSuspend'), 'tenants_canSuspend'),
      A('canActivate', t('permissions.canActivate'), 'tenants_canActivate'),
    ],
    automations: [
      R('automations'), C('automations'), U('automations'), D('automations'),
      A('canExecute', t('permissions.canExecute'), 'automations_canExecute'),
    ],
    templates: [
      R('templates'), C('templates'), U('templates'), D('templates'),
      A('canGenerate', t('permissions.canGenerate'), 'templates_canGenerate'),
    ],
    logs: [R('logs'), U('logs'), D('logs')],
    publicLinks: [
      A('canManage', t('permissions.canManage'), 'publicLinks_canManage', {
        writes: ['canManage', 'canRead', 'canCreate', 'canUpdate', 'canDelete'],
      }),
    ],
    archive: [
      R('archive'),
      A('canPermanentDelete', t('permissions.canPermanentDelete'), 'archive_canPermanentDelete', { danger: true }),
    ],
  };

  const ENTITY_EXTRA_ACTIONS = [
    { key: 'canConfigureColumns', label: t('permissions.canConfigureColumns') },
    { key: 'canExport', label: t('permissions.canExport') },
    { key: 'canImport', label: t('permissions.canImport') },
    { key: 'canEditLocked', label: t('permissions.canEditLocked') },
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
          {/* Nome, Descrição e Cor */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-4">
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
            <div className="space-y-2">
              <Label>{t('form.color')}</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-9 rounded border cursor-pointer p-0.5"
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-[90px] text-xs font-mono"
                  placeholder="#6366f1"
                />
              </div>
            </div>
          </div>

          {/* Rank de governanca */}
          <div className="flex items-start gap-3 p-3 rounded-lg border">
            <Input
              type="number"
              min={1}
              value={rank}
              onChange={(e) => setRank(e.target.value)}
              placeholder="auto"
              className="w-24"
            />
            <div>
              <Label className="font-medium">Rank de governança</Label>
              <p className="text-xs text-muted-foreground">
                Número menor = mais poder (1 = topo). Quem gerencia só age sobre cargos de rank maior que o próprio. Deixe vazio para herdar um rank subordinado automaticamente.
              </p>
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

          {/* Acesso total ao tenant (dinâmico) */}
          {hasModuleAction('roles', 'canManagePermissions') && (
            <label className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 cursor-pointer">
              <Checkbox
                checked={allAccess}
                onCheckedChange={(v) => { if (v) enableFullAccess(); else setAllAccess(false); }}
                className="mt-0.5"
              />
              <span className="text-sm">
                <span className="font-medium">Acesso total ao tenant</span>
                <span className="block text-xs text-muted-foreground">
                  Libera todos os módulos e tabelas — <strong>inclusive os criados no futuro</strong>, sem precisar re-marcar.
                  Não dá poder de plataforma (cross-tenant). Desmarcar qualquer permissão abaixo desliga o modo automático.
                </span>
              </span>
            </label>
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
                      const actions = MODULE_ACTIONS[key] || [];
                      const total = actions.length;
                      const activeCount = actions.filter((a) => !!(perm as Record<string, unknown>)[a.key]).length;
                      const hasAny = activeCount > 0;
                      const isOpen = openModules.has(key);

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
                                variant={total > 0 && activeCount === total ? 'default' : activeCount > 0 ? 'secondary' : 'outline'}
                                className="text-[10px] px-1.5 py-0"
                              >
                                {total === 1 ? (hasAny ? t('form.access') : t('form.noAccess')) : `${activeCount}/${total}`}
                              </Badge>
                              <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="ml-7 mr-1 mt-1 mb-2 p-3 rounded-lg border border-dashed space-y-2">
                              {/* "Selecionar tudo" do modulo (so quando ha 2+ acoes) */}
                              {total > 1 && (
                                <label className="flex items-center justify-end gap-1.5 cursor-pointer text-[11px] text-muted-foreground pb-1">
                                  {t('permissions.selectAll')}
                                  <Checkbox
                                    checked={activeCount === total}
                                    onCheckedChange={(checked) => toggleAllModule(key, !!checked)}
                                    className="h-3.5 w-3.5"
                                  />
                                </label>
                              )}
                              {/* Acoes independentes, cada uma com descricao */}
                              {actions.map((a) => {
                                const active = !!(perm as Record<string, unknown>)[a.key];
                                return (
                                  <label
                                    key={a.key}
                                    className={`flex items-start gap-3 cursor-pointer rounded-md border px-3 py-2 transition-colors ${
                                      active
                                        ? a.danger
                                          ? 'border-red-500/50 bg-red-500/5'
                                          : 'border-primary/40 bg-primary/5'
                                        : 'border-border hover:bg-accent/40'
                                    }`}
                                  >
                                    <Checkbox
                                      checked={active}
                                      onCheckedChange={() => toggleModuleAction(key, a)}
                                      className="h-4 w-4 mt-0.5"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className={`text-xs font-medium ${active && a.danger ? 'text-red-600 dark:text-red-400' : ''}`}>
                                        {a.label}
                                      </div>
                                      <div className="text-[11px] text-muted-foreground leading-snug">
                                        {a.desc}
                                      </div>
                                    </div>
                                  </label>
                                );
                              })}
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
                                          (perm as unknown as Record<string, unknown>)[actionKey]
                                            ? 'border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                            : 'border-border text-muted-foreground hover:border-muted-foreground/50'
                                        }`}
                                      >
                                        <Checkbox
                                          checked={!!(perm as unknown as Record<string, unknown>)[actionKey]}
                                          onCheckedChange={() => toggleEntityPermission(perm.entitySlug, actionKey as keyof EntityPermission)}
                                          className="h-3.5 w-3.5"
                                        />
                                        {actionLabel}
                                      </label>
                                    ))}
                                  </div>
                                </div>

                                {/* Data Filters */}
                                {entity && entity.fields && entity.fields.length > 0 && (
                                  <>
                                    <Separator />
                                    <div>
                                      <button
                                        type="button"
                                        className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                                        onClick={(e) => { e.stopPropagation(); toggleDataFiltersExpand(perm.entitySlug); }}
                                      >
                                        <ListFilter className="h-3 w-3" />
                                        {t('dataFilters.sectionTitle', { count: perm.dataFilters?.length || 0 })}
                                        <span className="ml-1">{expandedDataFilters.has(perm.entitySlug) ? '▾' : '▸'}</span>
                                      </button>
                                      {expandedDataFilters.has(perm.entitySlug) && (
                                        <div className="mt-2 space-y-2">
                                          {/* Existing filters */}
                                          {perm.dataFilters && perm.dataFilters.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5">
                                              {perm.dataFilters.map((filter, idx) => (
                                                <Badge
                                                  key={idx}
                                                  variant="secondary"
                                                  className="text-[10px] px-2 py-0.5 gap-1"
                                                >
                                                  <span className="font-medium">{filter.fieldName}</span>
                                                  <span className="text-muted-foreground">
                                                    {filter.operator === 'equals' ? '=' : filter.operator === 'between' ? '↔' : filter.operator}
                                                  </span>
                                                  <span>
                                                    {filter.operator === 'between'
                                                      ? `${String(filter.value ?? '')} — ${String(filter.value2 ?? '')}`
                                                      : String(filter.value ?? '')}
                                                  </span>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); removeDataFilter(perm.entitySlug, idx); }}
                                                    className="ml-0.5 hover:text-destructive"
                                                  >
                                                    <X className="h-3 w-3" />
                                                  </button>
                                                </Badge>
                                              ))}
                                            </div>
                                          )}
                                          {/* Add new filter */}
                                          <DataFilterAdder
                                            fields={entity.fields.filter((f: EntityField) => !['image', 'images', 'sub-entity', 'array', 'hidden'].includes(f.type))}
                                            onAdd={(filter) => addDataFilter(perm.entitySlug, filter)}
                                          />
                                          <p className="text-[10px] text-muted-foreground">
                                            Filtros restringem quais registros usuarios com esta role podem ver nesta entidade.
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </>
                                )}

                                {/* Notification Rules */}
                                {entity && entity.fields && entity.fields.length > 0 && (
                                  <>
                                    <Separator />
                                    <div>
                                      <button
                                        type="button"
                                        className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                                        onClick={(e) => { e.stopPropagation(); toggleNotifRulesExpand(perm.entitySlug); }}
                                      >
                                        <Bell className="h-3 w-3" />
                                        {t('notificationRules.title')} {perm.notificationRules?.enabled ? t('notificationRules.active') : ''}
                                        <span className="ml-1">{expandedNotifRules.has(perm.entitySlug) ? '▾' : '▸'}</span>
                                      </button>
                                      {expandedNotifRules.has(perm.entitySlug) && (
                                        <div className="mt-2 space-y-2">
                                          {/* Enable toggle */}
                                          <label className="flex items-center gap-2 text-xs">
                                            <Checkbox
                                              checked={perm.notificationRules?.enabled || false}
                                              onCheckedChange={() => toggleNotificationEnabled(perm.entitySlug)}
                                              className="h-3.5 w-3.5"
                                            />
                                            {t('notificationRules.enableLabel')}
                                          </label>
                                          {perm.notificationRules?.enabled && (
                                            <div className="ml-5 space-y-2">
                                              {/* Operations */}
                                              <div className="flex items-center gap-3">
                                                <span className="text-[10px] text-muted-foreground">{t('notificationRules.whenLabel')}</span>
                                                {([
                                                  { key: 'onCreate' as const, label: t('notificationRules.onCreate') },
                                                  { key: 'onUpdate' as const, label: t('notificationRules.onUpdate') },
                                                  { key: 'onDelete' as const, label: t('notificationRules.onDelete') },
                                                ]).map(({ key, label }) => (
                                                  <label
                                                    key={key}
                                                    className={`flex items-center gap-1 cursor-pointer rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                                                      perm.notificationRules?.[key]
                                                        ? 'border-primary bg-primary/10 text-primary'
                                                        : 'border-border text-muted-foreground hover:border-muted-foreground/50'
                                                    }`}
                                                  >
                                                    <Checkbox
                                                      checked={perm.notificationRules?.[key] || false}
                                                      onCheckedChange={() => toggleNotificationOp(perm.entitySlug, key)}
                                                      className="h-3 w-3"
                                                    />
                                                    {label}
                                                  </label>
                                                ))}
                                              </div>
                                              {/* Conditions */}
                                              <div>
                                                <span className="text-[10px] text-muted-foreground">Condições (opcional):</span>
                                                {perm.notificationRules?.conditions && perm.notificationRules.conditions.length > 0 && (
                                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                                    {perm.notificationRules.conditions.map((filter, idx) => (
                                                      <Badge
                                                        key={idx}
                                                        variant="secondary"
                                                        className="text-[10px] px-2 py-0.5 gap-1"
                                                      >
                                                        <span className="font-medium">{filter.fieldName}</span>
                                                        <span className="text-muted-foreground">
                                                          {filter.operator === 'equals' ? '=' : filter.operator === 'between' ? '↔' : filter.operator}
                                                        </span>
                                                        <span>
                                                          {filter.operator === 'between'
                                                            ? `${String(filter.value ?? '')} — ${String(filter.value2 ?? '')}`
                                                            : String(filter.value ?? '')}
                                                        </span>
                                                        <button
                                                          type="button"
                                                          onClick={(e) => { e.stopPropagation(); removeNotifCondition(perm.entitySlug, idx); }}
                                                          className="ml-0.5 hover:text-destructive"
                                                        >
                                                          <X className="h-3 w-3" />
                                                        </button>
                                                      </Badge>
                                                    ))}
                                                  </div>
                                                )}
                                                <div className="mt-1.5">
                                                  <DataFilterAdder
                                                    fields={entity.fields.filter((f: EntityField) => !['image', 'images', 'sub-entity', 'array', 'hidden'].includes(f.type))}
                                                    onAdd={(filter) => addNotifCondition(perm.entitySlug, filter)}
                                                  />
                                                </div>
                                                <p className="text-[10px] text-muted-foreground mt-1">
                                                  Só notifica quando todas as condições forem atendidas.
                                                </p>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </>
                                )}

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

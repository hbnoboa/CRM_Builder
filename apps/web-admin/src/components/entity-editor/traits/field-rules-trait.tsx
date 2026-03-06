'use client';

import { useState, useMemo } from 'react';
import {
  Plus, Pencil, Trash2, Loader2, ShieldCheck, Eye, Type, Calculator, CheckCircle,
  ChevronDown, ChevronUp, X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useFieldRules,
  useCreateFieldRule,
  useUpdateFieldRule,
  useDeleteFieldRule,
} from '@/hooks/use-field-rules';
import type { EntityFieldRule, FieldRuleType, CreateFieldRuleData } from '@/services/field-rules.service';

interface FieldRulesTraitProps {
  entityId: string;
  fieldSlug: string;
  allFields: Array<{ slug: string; name: string }>;
}

const ruleTypeConfig: Record<FieldRuleType, {
  label: string;
  icon: typeof ShieldCheck;
  color: string;
  bgColor: string;
}> = {
  required: { label: 'Obrigatorio', icon: ShieldCheck, color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  visible: { label: 'Visibilidade', icon: Eye, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  default: { label: 'Valor Padrao', icon: Type, color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  computed: { label: 'Calculado', icon: Calculator, color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
  validation: { label: 'Validacao', icon: CheckCircle, color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
};

const conditionOperators = [
  { value: 'eq', label: 'Igual a' },
  { value: 'neq', label: 'Diferente de' },
  { value: 'contains', label: 'Contem' },
  { value: 'gt', label: 'Maior que' },
  { value: 'lt', label: 'Menor que' },
  { value: 'is_empty', label: 'Esta vazio' },
  { value: 'is_not_empty', label: 'Nao esta vazio' },
];

interface RuleFormState {
  ruleType: FieldRuleType;
  hasCondition: boolean;
  conditionField: string;
  conditionOperator: string;
  conditionValue: string;
  requiredMessage: string;
  visibleShow: boolean;
  defaultValue: string;
  defaultTemplate: string;
  defaultUseTemplate: boolean;
  computedFormula: string;
  computedDependsOn: string[];
  validationPattern: string;
  validationMessage: string;
  isActive: boolean;
  priority: number;
}

function getInitialFormState(rule?: EntityFieldRule | null): RuleFormState {
  if (rule) {
    return {
      ruleType: rule.ruleType,
      hasCondition: !!rule.condition,
      conditionField: rule.condition?.field || '',
      conditionOperator: rule.condition?.operator || 'eq',
      conditionValue: String(rule.condition?.value ?? ''),
      requiredMessage: String(rule.config?.message || ''),
      visibleShow: rule.config?.visible !== false,
      defaultValue: String(rule.config?.value ?? ''),
      defaultTemplate: String(rule.config?.template || ''),
      defaultUseTemplate: !!rule.config?.template,
      computedFormula: String(rule.config?.formula || ''),
      computedDependsOn: Array.isArray(rule.config?.dependsOn) ? (rule.config.dependsOn as string[]) : [],
      validationPattern: String(rule.config?.pattern || ''),
      validationMessage: String(rule.config?.message || ''),
      isActive: rule.isActive,
      priority: rule.priority,
    };
  }
  return {
    ruleType: 'required',
    hasCondition: false,
    conditionField: '',
    conditionOperator: 'eq',
    conditionValue: '',
    requiredMessage: '',
    visibleShow: true,
    defaultValue: '',
    defaultTemplate: '',
    defaultUseTemplate: false,
    computedFormula: '',
    computedDependsOn: [],
    validationPattern: '',
    validationMessage: '',
    isActive: true,
    priority: 0,
  };
}

function buildRuleData(fieldSlug: string, form: RuleFormState): CreateFieldRuleData {
  const data: CreateFieldRuleData = {
    fieldSlug,
    ruleType: form.ruleType,
    isActive: form.isActive,
    priority: form.priority,
    config: {},
  };

  if (form.hasCondition && form.conditionField) {
    data.condition = {
      field: form.conditionField,
      operator: form.conditionOperator,
      value: form.conditionValue,
    };
  }

  switch (form.ruleType) {
    case 'required':
      data.config = { message: form.requiredMessage || undefined };
      break;
    case 'visible':
      data.config = { visible: form.visibleShow };
      break;
    case 'default':
      if (form.defaultUseTemplate) {
        data.config = { template: form.defaultTemplate };
      } else {
        data.config = { value: form.defaultValue };
      }
      break;
    case 'computed':
      data.config = {
        formula: form.computedFormula,
        dependsOn: form.computedDependsOn.length > 0 ? form.computedDependsOn : undefined,
      };
      break;
    case 'validation':
      data.config = {
        pattern: form.validationPattern,
        message: form.validationMessage || undefined,
      };
      break;
  }

  return data;
}

function getConfigSummary(rule: EntityFieldRule): string {
  const config = rule.config || {};
  switch (rule.ruleType) {
    case 'required':
      return config.message ? `Msg: "${config.message}"` : 'Campo obrigatorio';
    case 'visible':
      return config.visible === false ? 'Ocultar campo' : 'Mostrar campo';
    case 'default':
      if (config.template) return `Template: ${config.template}`;
      return config.value != null ? `Valor: ${config.value}` : '-';
    case 'computed':
      return config.formula ? `Formula: ${config.formula}` : '-';
    case 'validation':
      return config.pattern ? `Padrao: ${config.pattern}` : '-';
    default:
      return '-';
  }
}

function getConditionSummary(condition?: { field: string; operator: string; value: unknown }): string {
  if (!condition) return '';
  const op = conditionOperators.find(o => o.value === condition.operator);
  const opLabel = op?.label || condition.operator;
  if (condition.operator === 'is_empty' || condition.operator === 'is_not_empty') {
    return `Se ${condition.field} ${opLabel.toLowerCase()}`;
  }
  return `Se ${condition.field} ${opLabel.toLowerCase()} "${condition.value}"`;
}

export function FieldRulesTraitEditor({ entityId, fieldSlug, allFields }: FieldRulesTraitProps) {
  const { data: allRules, isLoading } = useFieldRules(entityId);
  const createMutation = useCreateFieldRule(entityId, {
    success: 'Regra criada',
    error: 'Erro ao criar regra',
  });
  const updateMutation = useUpdateFieldRule(entityId, {
    success: 'Regra atualizada',
    error: 'Erro ao atualizar regra',
  });
  const deleteMutation = useDeleteFieldRule(entityId, {
    success: 'Regra excluida',
    error: 'Erro ao excluir regra',
  });

  const [showForm, setShowForm] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [form, setForm] = useState<RuleFormState>(getInitialFormState());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fieldRules = useMemo(() => {
    if (!allRules) return [];
    return allRules.filter(r => r.fieldSlug === fieldSlug);
  }, [allRules, fieldSlug]);

  const otherFields = useMemo(() => {
    return allFields.filter(f => f.slug !== fieldSlug);
  }, [allFields, fieldSlug]);

  const updateForm = (updates: Partial<RuleFormState>) => {
    setForm(prev => ({ ...prev, ...updates }));
  };

  const openCreate = () => {
    setEditingRuleId(null);
    setForm(getInitialFormState());
    setShowForm(true);
  };

  const openEdit = (rule: EntityFieldRule) => {
    setEditingRuleId(rule.id);
    setForm(getInitialFormState(rule));
    setShowForm(true);
  };

  const handleSave = async () => {
    const data = buildRuleData(fieldSlug, form);
    try {
      if (editingRuleId) {
        await updateMutation.mutateAsync({ id: editingRuleId, data });
      } else {
        await createMutation.mutateAsync(data);
      }
      setShowForm(false);
      setEditingRuleId(null);
    } catch {
      // Error handled by mutation
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      setDeleteConfirmId(null);
      if (editingRuleId === id) {
        setShowForm(false);
        setEditingRuleId(null);
      }
    } catch {
      // Error handled by mutation
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex justify-center py-3">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Regras de campo</span>
        {!showForm && (
          <button
            className="text-xs text-primary hover:text-primary/80 flex items-center gap-0.5"
            onClick={openCreate}
          >
            <Plus className="h-3 w-3" />
            Regra
          </button>
        )}
      </div>

      {/* Existing rules */}
      {fieldRules.length > 0 && !showForm && (
        <div className="space-y-1">
          {fieldRules.map(rule => {
            const cfg = ruleTypeConfig[rule.ruleType];
            const Icon = cfg.icon;
            const condSummary = getConditionSummary(rule.condition);

            if (deleteConfirmId === rule.id) {
              return (
                <div key={rule.id} className="p-2 border rounded-md bg-destructive/5 space-y-2">
                  <p className="text-xs text-center">Excluir esta regra?</p>
                  <div className="flex gap-1 justify-center">
                    <button
                      className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80"
                      onClick={() => setDeleteConfirmId(null)}
                    >
                      Cancelar
                    </button>
                    <button
                      className="text-xs px-2 py-1 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => handleDelete(rule.id)}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={rule.id}
                className={`p-2 border rounded-md ${!rule.isActive ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-1.5">
                  <Icon className={`h-3 w-3 flex-shrink-0 ${cfg.color}`} />
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${cfg.bgColor} ${cfg.color} font-medium`}>
                    {cfg.label}
                  </span>
                  <div className="flex-1" />
                  <button
                    className="p-0.5 hover:bg-muted rounded"
                    onClick={() => openEdit(rule)}
                    title="Editar"
                  >
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </button>
                  <button
                    className="p-0.5 hover:bg-muted rounded"
                    onClick={() => setDeleteConfirmId(rule.id)}
                    title="Excluir"
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </button>
                </div>
                <p className="text-xs mt-1 truncate">{getConfigSummary(rule)}</p>
                {condSummary && (
                  <p className="text-[10px] text-muted-foreground truncate">{condSummary}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {fieldRules.length === 0 && !showForm && (
        <div className="text-center py-3 border border-dashed rounded-md">
          <p className="text-[10px] text-muted-foreground mb-1.5">Nenhuma regra</p>
          <button
            className="text-xs text-primary hover:text-primary/80 flex items-center gap-0.5 mx-auto"
            onClick={openCreate}
          >
            <Plus className="h-3 w-3" />
            Adicionar
          </button>
        </div>
      )}

      {/* Inline form for create/edit */}
      {showForm && (
        <div className="border rounded-md p-2 space-y-2 bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">
              {editingRuleId ? 'Editar regra' : 'Nova regra'}
            </span>
            <button onClick={() => { setShowForm(false); setEditingRuleId(null); }}>
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          </div>

          {/* Rule type */}
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground">Tipo</label>
            <select
              className="w-full h-7 text-xs border rounded-md px-2 bg-background"
              value={form.ruleType}
              onChange={(e) => updateForm({ ruleType: e.target.value as FieldRuleType })}
            >
              {(Object.entries(ruleTypeConfig) as [FieldRuleType, typeof ruleTypeConfig[FieldRuleType]][]).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>

          {/* Config by rule type */}
          {form.ruleType === 'required' && (
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">Mensagem de erro</label>
              <input
                className="w-full h-7 text-xs border rounded-md px-2 bg-background"
                placeholder="Este campo e obrigatorio"
                value={form.requiredMessage}
                onChange={(e) => updateForm({ requiredMessage: e.target.value })}
              />
            </div>
          )}

          {form.ruleType === 'visible' && (
            <div className="flex items-center justify-between p-2 bg-background rounded-md">
              <label className="text-xs">Mostrar quando condicao verdadeira</label>
              <input
                type="checkbox"
                className="h-3.5 w-3.5"
                checked={form.visibleShow}
                onChange={(e) => updateForm({ visibleShow: e.target.checked })}
              />
            </div>
          )}

          {form.ruleType === 'default' && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-medium text-muted-foreground">Template</label>
                <input
                  type="checkbox"
                  className="h-3 w-3"
                  checked={form.defaultUseTemplate}
                  onChange={(e) => updateForm({ defaultUseTemplate: e.target.checked })}
                />
              </div>
              {form.defaultUseTemplate ? (
                <input
                  className="w-full h-7 text-xs border rounded-md px-2 bg-background"
                  placeholder="{{now}}, {{user.name}}"
                  value={form.defaultTemplate}
                  onChange={(e) => updateForm({ defaultTemplate: e.target.value })}
                />
              ) : (
                <input
                  className="w-full h-7 text-xs border rounded-md px-2 bg-background"
                  placeholder="Valor padrao"
                  value={form.defaultValue}
                  onChange={(e) => updateForm({ defaultValue: e.target.value })}
                />
              )}
            </div>
          )}

          {form.ruleType === 'computed' && (
            <div className="space-y-1.5">
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Formula</label>
                <textarea
                  className="w-full text-xs border rounded-md px-2 py-1 bg-background resize-none"
                  placeholder="{{campo_a}} + {{campo_b}}"
                  rows={2}
                  value={form.computedFormula}
                  onChange={(e) => updateForm({ computedFormula: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Campos dependentes</label>
                <div className="flex flex-wrap gap-1 p-1.5 border rounded-md bg-background min-h-[28px]">
                  {otherFields.map(f => {
                    const isSelected = form.computedDependsOn.includes(f.slug);
                    return (
                      <button
                        key={f.slug}
                        type="button"
                        className={`px-1.5 py-0.5 rounded-full text-[10px] transition-colors ${
                          isSelected
                            ? 'bg-purple-500 text-white'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                        onClick={() => {
                          const updated = isSelected
                            ? form.computedDependsOn.filter(s => s !== f.slug)
                            : [...form.computedDependsOn, f.slug];
                          updateForm({ computedDependsOn: updated });
                        }}
                      >
                        {f.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {form.ruleType === 'validation' && (
            <div className="space-y-1.5">
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Padrao (regex)</label>
                <input
                  className="w-full h-7 text-xs border rounded-md px-2 bg-background font-mono"
                  placeholder="^[A-Za-z]+$"
                  value={form.validationPattern}
                  onChange={(e) => updateForm({ validationPattern: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Mensagem de erro</label>
                <input
                  className="w-full h-7 text-xs border rounded-md px-2 bg-background"
                  placeholder="Formato invalido"
                  value={form.validationMessage}
                  onChange={(e) => updateForm({ validationMessage: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Condition (collapsible) */}
          <div>
            <button
              className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground"
              onClick={() => updateForm({ hasCondition: !form.hasCondition })}
            >
              {form.hasCondition ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Condicao
            </button>
            {form.hasCondition && (
              <div className="mt-1 space-y-1 p-1.5 bg-background rounded-md border">
                <select
                  className="w-full h-6 text-[10px] border rounded px-1 bg-background"
                  value={form.conditionField}
                  onChange={(e) => updateForm({ conditionField: e.target.value })}
                >
                  <option value="">Campo...</option>
                  {allFields.map(f => (
                    <option key={f.slug} value={f.slug}>{f.name}</option>
                  ))}
                </select>
                <select
                  className="w-full h-6 text-[10px] border rounded px-1 bg-background"
                  value={form.conditionOperator}
                  onChange={(e) => updateForm({ conditionOperator: e.target.value })}
                >
                  {conditionOperators.map(op => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
                {form.conditionOperator !== 'is_empty' && form.conditionOperator !== 'is_not_empty' && (
                  <input
                    className="w-full h-6 text-[10px] border rounded px-1 bg-background"
                    placeholder="Valor"
                    value={form.conditionValue}
                    onChange={(e) => updateForm({ conditionValue: e.target.value })}
                  />
                )}
              </div>
            )}
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-medium text-muted-foreground">Ativa</label>
            <input
              type="checkbox"
              className="h-3.5 w-3.5"
              checked={form.isActive}
              onChange={(e) => updateForm({ isActive: e.target.checked })}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-1.5 pt-1">
            <button
              className="flex-1 h-7 text-xs border rounded-md bg-background hover:bg-muted"
              onClick={() => { setShowForm(false); setEditingRuleId(null); }}
              disabled={isSaving}
            >
              Cancelar
            </button>
            <button
              className="flex-1 h-7 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-1"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
              {editingRuleId ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

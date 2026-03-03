'use client';

import { useState, useMemo } from 'react';
import {
  Plus, Pencil, Trash2, Loader2, ShieldCheck, Eye, Type, Calculator, CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  useFieldRules,
  useCreateFieldRule,
  useUpdateFieldRule,
  useDeleteFieldRule,
} from '@/hooks/use-field-rules';
import type { EntityFieldRule, FieldRuleType, CreateFieldRuleData } from '@/services/field-rules.service';

interface FieldRulesSectionProps {
  entityId: string;
  fields: Array<{ slug: string; name: string; type: string }>;
}

const ruleTypeConfig: Record<FieldRuleType, {
  label: string;
  icon: typeof ShieldCheck;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  color: string;
}> = {
  required: { label: 'Obrigatorio', icon: ShieldCheck, variant: 'destructive', color: 'text-red-600' },
  visible: { label: 'Visibilidade', icon: Eye, variant: 'secondary', color: 'text-blue-600' },
  default: { label: 'Valor Padrao', icon: Type, variant: 'outline', color: 'text-green-600' },
  computed: { label: 'Calculado', icon: Calculator, variant: 'default', color: 'text-purple-600' },
  validation: { label: 'Validacao', icon: CheckCircle, variant: 'outline', color: 'text-orange-600' },
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

interface RuleFormState {
  fieldSlug: string;
  ruleType: FieldRuleType;
  hasCondition: boolean;
  conditionField: string;
  conditionOperator: string;
  conditionValue: string;
  // Config by type
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

function getInitialFormState(rule?: EntityFieldRule | null, defaultFieldSlug?: string): RuleFormState {
  if (rule) {
    return {
      fieldSlug: rule.fieldSlug,
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
    fieldSlug: defaultFieldSlug || '',
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

function buildRuleData(form: RuleFormState): CreateFieldRuleData {
  const data: CreateFieldRuleData = {
    fieldSlug: form.fieldSlug,
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

export function FieldRulesSection({ entityId, fields }: FieldRulesSectionProps) {
  const { data: rules, isLoading } = useFieldRules(entityId);
  const createMutation = useCreateFieldRule(entityId, {
    success: 'Regra criada com sucesso',
    error: 'Erro ao criar regra',
  });
  const updateMutation = useUpdateFieldRule(entityId, {
    success: 'Regra atualizada com sucesso',
    error: 'Erro ao atualizar regra',
  });
  const deleteMutation = useDeleteFieldRule(entityId, {
    success: 'Regra excluida com sucesso',
    error: 'Erro ao excluir regra',
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<EntityFieldRule | null>(null);
  const [defaultFieldSlug, setDefaultFieldSlug] = useState<string>('');
  const [form, setForm] = useState<RuleFormState>(getInitialFormState());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const rulesGroupedByField = useMemo(() => {
    if (!rules) return {};
    const grouped: Record<string, EntityFieldRule[]> = {};
    for (const rule of rules) {
      if (!grouped[rule.fieldSlug]) grouped[rule.fieldSlug] = [];
      grouped[rule.fieldSlug].push(rule);
    }
    return grouped;
  }, [rules]);

  const openCreateDialog = (fieldSlug?: string) => {
    setEditingRule(null);
    setDefaultFieldSlug(fieldSlug || '');
    setForm(getInitialFormState(null, fieldSlug));
    setDialogOpen(true);
  };

  const openEditDialog = (rule: EntityFieldRule) => {
    setEditingRule(rule);
    setForm(getInitialFormState(rule));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.fieldSlug) {
      toast.error('Selecione um campo');
      return;
    }

    const data = buildRuleData(form);

    if (editingRule) {
      await updateMutation.mutateAsync({ id: editingRule.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    setDeleteConfirmId(null);
  };

  const updateForm = (updates: Partial<RuleFormState>) => {
    setForm(prev => ({ ...prev, ...updates }));
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const rulesList = rules || [];
  const fieldsWithRules = Object.keys(rulesGroupedByField);
  const fieldsWithoutRules = fields.filter(f => !fieldsWithRules.includes(f.slug));

  return (
    <div className="space-y-4">
      {/* Fields that have rules */}
      {fieldsWithRules.map(fieldSlug => {
        const fieldInfo = fields.find(f => f.slug === fieldSlug);
        const fieldRules = rulesGroupedByField[fieldSlug];
        return (
          <div key={fieldSlug} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{fieldInfo?.name || fieldSlug}</span>
                <Badge variant="outline" className="text-xs">{fieldSlug}</Badge>
                <Badge variant="secondary" className="text-xs">{fieldRules.length} regra(s)</Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => openCreateDialog(fieldSlug)}
              >
                <Plus className="h-3 w-3 mr-1" />
                Regra
              </Button>
            </div>
            <div className="space-y-1.5 ml-4">
              {fieldRules.map(rule => {
                const typeConfig = ruleTypeConfig[rule.ruleType];
                const TypeIcon = typeConfig.icon;
                const condSummary = getConditionSummary(rule.condition);
                return (
                  <Card key={rule.id} className={`border-l-4 ${rule.isActive ? 'border-l-primary/40' : 'border-l-muted opacity-60'}`}>
                    <CardContent className="flex items-center gap-3 p-3">
                      <TypeIcon className={`h-4 w-4 flex-shrink-0 ${typeConfig.color}`} />
                      <Badge variant={typeConfig.variant} className="text-xs flex-shrink-0">
                        {typeConfig.label}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm truncate block">{getConfigSummary(rule)}</span>
                        {condSummary && (
                          <span className="text-xs text-muted-foreground block truncate">{condSummary}</span>
                        )}
                      </div>
                      {!rule.isActive && (
                        <Badge variant="outline" className="text-xs flex-shrink-0">Inativa</Badge>
                      )}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEditDialog(rule)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => setDeleteConfirmId(rule.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Empty state */}
      {rulesList.length === 0 && (
        <div className="text-center py-8 border-2 border-dashed rounded-lg">
          <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground mb-3">
            Nenhuma regra de campo configurada.
          </p>
          <Button variant="outline" size="sm" onClick={() => openCreateDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar regra
          </Button>
        </div>
      )}

      {/* Quick add for fields without rules (only show if there are already some rules) */}
      {rulesList.length > 0 && fieldsWithoutRules.length > 0 && (
        <div className="pt-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => openCreateDialog()}
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar regra para outro campo
          </Button>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'Editar Regra de Campo' : 'Nova Regra de Campo'}
            </DialogTitle>
            <DialogDescription>
              Configure as regras de comportamento para campos da entidade.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Field selector */}
            <div className="space-y-2">
              <Label>Campo</Label>
              <Select
                value={form.fieldSlug}
                onValueChange={(val) => updateForm({ fieldSlug: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o campo" />
                </SelectTrigger>
                <SelectContent>
                  {fields.map(f => (
                    <SelectItem key={f.slug} value={f.slug}>
                      {f.name} ({f.slug})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Rule type */}
            <div className="space-y-2">
              <Label>Tipo de regra</Label>
              <Select
                value={form.ruleType}
                onValueChange={(val) => updateForm({ ruleType: val as FieldRuleType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(ruleTypeConfig) as [FieldRuleType, typeof ruleTypeConfig[FieldRuleType]][]).map(([key, config]) => {
                    const Icon = config.icon;
                    return (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                          {config.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Condition (optional) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Condicao (opcional)</Label>
                <Switch
                  checked={form.hasCondition}
                  onCheckedChange={(checked) => updateForm({ hasCondition: checked })}
                />
              </div>
              {form.hasCondition && (
                <div className="grid grid-cols-3 gap-2 p-3 bg-muted/50 rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-xs">Campo</Label>
                    <Select
                      value={form.conditionField}
                      onValueChange={(val) => updateForm({ conditionField: val })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Campo" />
                      </SelectTrigger>
                      <SelectContent>
                        {fields.map(f => (
                          <SelectItem key={f.slug} value={f.slug}>
                            {f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Operador</Label>
                    <Select
                      value={form.conditionOperator}
                      onValueChange={(val) => updateForm({ conditionOperator: val })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {conditionOperators.map(op => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Valor</Label>
                    <Input
                      className="h-8 text-xs"
                      placeholder="valor"
                      value={form.conditionValue}
                      onChange={(e) => updateForm({ conditionValue: e.target.value })}
                      disabled={form.conditionOperator === 'is_empty' || form.conditionOperator === 'is_not_empty'}
                    />
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Config by rule type */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Configuracao</Label>

              {form.ruleType === 'required' && (
                <div className="space-y-2">
                  <Label className="text-xs">Mensagem de erro (opcional)</Label>
                  <Input
                    placeholder="Este campo e obrigatorio"
                    value={form.requiredMessage}
                    onChange={(e) => updateForm({ requiredMessage: e.target.value })}
                  />
                </div>
              )}

              {form.ruleType === 'visible' && (
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <Label>Mostrar campo quando a condicao for verdadeira</Label>
                  <Switch
                    checked={form.visibleShow}
                    onCheckedChange={(checked) => updateForm({ visibleShow: checked })}
                  />
                </div>
              )}

              {form.ruleType === 'default' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Label className="text-xs">Usar template</Label>
                    <Switch
                      checked={form.defaultUseTemplate}
                      onCheckedChange={(checked) => updateForm({ defaultUseTemplate: checked })}
                    />
                  </div>
                  {form.defaultUseTemplate ? (
                    <div className="space-y-1">
                      <Label className="text-xs">Template</Label>
                      <Input
                        placeholder="{{now}}, {{user.name}}, etc."
                        value={form.defaultTemplate}
                        onChange={(e) => updateForm({ defaultTemplate: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Use templates como {'{{now}}'}, {'{{today}}'}, {'{{user.name}}'}, {'{{user.email}}'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label className="text-xs">Valor padrao</Label>
                      <Input
                        placeholder="Valor padrao do campo"
                        value={form.defaultValue}
                        onChange={(e) => updateForm({ defaultValue: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              )}

              {form.ruleType === 'computed' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Formula</Label>
                    <Textarea
                      placeholder="Ex: {{campo_a}} + {{campo_b}}"
                      value={form.computedFormula}
                      onChange={(e) => updateForm({ computedFormula: e.target.value })}
                      rows={2}
                    />
                    <p className="text-xs text-muted-foreground">
                      Use referencias a outros campos com {'{{nome_do_campo}}'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Campos dependentes</Label>
                    <div className="flex flex-wrap gap-1.5 p-2 border rounded-lg bg-background min-h-[34px]">
                      {fields.filter(f => f.slug !== form.fieldSlug).map(f => {
                        const isSelected = form.computedDependsOn.includes(f.slug);
                        return (
                          <button
                            key={f.slug}
                            type="button"
                            className={`px-2 py-0.5 rounded-full text-xs transition-colors ${
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
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Padrao (regex)</Label>
                    <Input
                      placeholder="^[A-Za-z]+$"
                      value={form.validationPattern}
                      onChange={(e) => updateForm({ validationPattern: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Mensagem de erro</Label>
                    <Input
                      placeholder="Formato invalido"
                      value={form.validationMessage}
                      onChange={(e) => updateForm({ validationMessage: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Active / Priority */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-sm">Ativa</Label>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) => updateForm({ isActive: checked })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">Prioridade</Label>
                <Input
                  type="number"
                  className="h-8 w-20 text-xs"
                  value={form.priority}
                  onChange={(e) => updateForm({ priority: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingRule ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir Regra</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir esta regra? Esta acao nao pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import {
  Plus, Trash2, Loader2, ArrowUp, ArrowDown,
  Zap, Mail, Globe, Bell, Clock, GitBranch, FileEdit, FilePlus, Pause,
  Search, RefreshCw, Calculator, Code,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { toast } from 'sonner';
import {
  useCreateAutomation,
  useUpdateAutomation,
} from '@/hooks/use-entity-automations';
import { useEntities } from '@/hooks/use-entities';
import type {
  EntityAutomation,
  AutomationTrigger,
  CreateAutomationData,
} from '@/services/entity-automation.service';

interface AutomationWizardProps {
  entityId: string;
  fields: Array<{ slug: string; name: string; type: string }>;
  automation?: EntityAutomation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTriggerType?: AutomationTrigger;
}

// -- Action types --
type ActionType =
  | 'send_email'
  | 'call_webhook'
  | 'update_field'
  | 'create_record'
  | 'notify_user'
  | 'change_status'
  | 'wait'
  | 'lookup_record'
  | 'update_related_record'
  | 'aggregate_records'
  | 'run_script';

interface ActionItem {
  type: ActionType;
  config: Record<string, unknown>;
}

const actionTypeLabels: Record<ActionType, string> = {
  send_email: 'Enviar Email',
  call_webhook: 'Chamar Webhook',
  update_field: 'Atualizar Campo',
  create_record: 'Criar Registro',
  notify_user: 'Notificar Usuario',
  change_status: 'Mudar Status',
  wait: 'Aguardar',
  lookup_record: 'Buscar Registro',
  update_related_record: 'Atualizar Relacionado',
  aggregate_records: 'Contar/Somar Registros',
  run_script: 'Executar Script',
};

const actionTypeIcons: Record<ActionType, typeof Zap> = {
  send_email: Mail,
  call_webhook: Globe,
  update_field: FileEdit,
  create_record: FilePlus,
  notify_user: Bell,
  change_status: GitBranch,
  wait: Pause,
  lookup_record: Search,
  update_related_record: RefreshCw,
  aggregate_records: Calculator,
  run_script: Code,
};

const triggerOptions: { value: AutomationTrigger; label: string; description: string }[] = [
  { value: 'ON_CREATE', label: 'Ao Criar', description: 'Quando um novo registro e criado' },
  { value: 'ON_UPDATE', label: 'Ao Atualizar', description: 'Quando um registro e atualizado' },
  { value: 'ON_FIELD_CHANGE', label: 'Ao Mudar Campo', description: 'Quando um campo especifico muda de valor' },
  { value: 'ON_STATUS_CHANGE', label: 'Ao Mudar Status', description: 'Quando o status do registro muda' },
  { value: 'ON_DELETE', label: 'Ao Excluir', description: 'Quando um registro e excluido' },
  { value: 'SCHEDULE', label: 'Agendado', description: 'Executar em horarios programados' },
  { value: 'MANUAL', label: 'Manual', description: 'Executar manualmente sob demanda' },
];

const conditionOperators = [
  { value: 'eq', label: 'Igual a' },
  { value: 'neq', label: 'Diferente de' },
  { value: 'contains', label: 'Contem' },
  { value: 'gt', label: 'Maior que' },
  { value: 'lt', label: 'Menor que' },
  { value: 'in', label: 'Esta em (lista)' },
  { value: 'is_empty', label: 'Esta vazio' },
  { value: 'is_not_empty', label: 'Nao esta vazio' },
];

const timezones = [
  'America/Sao_Paulo',
  'America/Fortaleza',
  'America/Manaus',
  'America/Rio_Branco',
  'America/Noronha',
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Tokyo',
];

interface WizardFormState {
  name: string;
  description: string;
  trigger: AutomationTrigger;
  // Trigger config
  triggerFieldSlug: string;
  triggerFromValue: string;
  triggerToValue: string;
  cronExpression: string;
  timezone: string;
  // Conditions
  conditions: Array<{ field: string; operator: string; value: string }>;
  // Actions
  actions: ActionItem[];
  // Settings
  errorHandling: 'stop' | 'continue';
  maxExecutionsPerHour: number;
  isActive: boolean;
}

function getInitialForm(
  automation?: EntityAutomation,
  defaultTrigger?: AutomationTrigger,
): WizardFormState {
  if (automation) {
    return {
      name: automation.name,
      description: automation.description || '',
      trigger: automation.trigger,
      triggerFieldSlug: String(automation.triggerConfig?.fieldSlug || ''),
      triggerFromValue: String(automation.triggerConfig?.fromValue || ''),
      triggerToValue: String(automation.triggerConfig?.toValue || ''),
      cronExpression: String(automation.triggerConfig?.cron || ''),
      timezone: String(automation.triggerConfig?.timezone || 'America/Sao_Paulo'),
      conditions: (automation.conditions || []).map(c => ({
        field: c.field,
        operator: c.operator,
        value: String(c.value ?? ''),
      })),
      actions: (automation.actions || []).map(a => ({
        type: a.type as ActionType,
        config: a.config || {},
      })),
      errorHandling: (automation.errorHandling as 'stop' | 'continue') || 'stop',
      maxExecutionsPerHour: automation.maxExecutionsPerHour ?? 100,
      isActive: automation.isActive,
    };
  }
  return {
    name: '',
    description: '',
    trigger: defaultTrigger || 'ON_CREATE',
    triggerFieldSlug: '',
    triggerFromValue: '',
    triggerToValue: '',
    cronExpression: '0 9 * * *',
    timezone: 'America/Sao_Paulo',
    conditions: [],
    actions: [],
    errorHandling: 'stop',
    maxExecutionsPerHour: 100,
    isActive: true,
  };
}

function buildAutomationData(form: WizardFormState): CreateAutomationData {
  const triggerConfig: Record<string, unknown> = {};

  if (form.trigger === 'ON_FIELD_CHANGE') {
    triggerConfig.fieldSlug = form.triggerFieldSlug;
    if (form.triggerFromValue) triggerConfig.fromValue = form.triggerFromValue;
    if (form.triggerToValue) triggerConfig.toValue = form.triggerToValue;
  }
  if (form.trigger === 'ON_STATUS_CHANGE') {
    if (form.triggerFromValue) triggerConfig.fromStatus = form.triggerFromValue;
    if (form.triggerToValue) triggerConfig.toStatus = form.triggerToValue;
  }
  if (form.trigger === 'SCHEDULE') {
    triggerConfig.cron = form.cronExpression;
    triggerConfig.timezone = form.timezone;
  }

  return {
    name: form.name,
    description: form.description || undefined,
    trigger: form.trigger,
    triggerConfig: Object.keys(triggerConfig).length > 0 ? triggerConfig : undefined,
    conditions: form.conditions.length > 0
      ? form.conditions.map(c => ({ field: c.field, operator: c.operator, value: c.value }))
      : undefined,
    actions: form.actions.map((a, i) => ({
      order: i + 1,
      type: a.type,
      config: a.config,
    })),
    errorHandling: form.errorHandling,
    maxExecutionsPerHour: form.maxExecutionsPerHour,
    isActive: form.isActive,
  };
}

function getConfigValue(config: Record<string, unknown>, key: string, fallback: string = ''): string {
  const val = config[key];
  if (val === undefined || val === null) return fallback;
  if (typeof val === 'string') return val;
  return JSON.stringify(val);
}

export function AutomationWizard({
  entityId,
  fields,
  automation,
  open,
  onOpenChange,
  defaultTriggerType,
}: AutomationWizardProps) {
  const [form, setForm] = useState<WizardFormState>(
    getInitialForm(automation, defaultTriggerType),
  );

  const { data: entitiesData } = useEntities({ limit: 200 });
  const entities = entitiesData?.data ?? [];

  const createMutation = useCreateAutomation(entityId, {
    success: 'Automacao criada com sucesso',
    error: 'Erro ao criar automacao',
  });
  const updateMutation = useUpdateAutomation(entityId, {
    success: 'Automacao atualizada com sucesso',
    error: 'Erro ao atualizar automacao',
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setForm(getInitialForm(automation, defaultTriggerType));
    }
  }, [open, automation, defaultTriggerType]);

  const updateForm = (updates: Partial<WizardFormState>) => {
    setForm(prev => ({ ...prev, ...updates }));
  };

  // -- Conditions --
  const addCondition = () => {
    updateForm({
      conditions: [...form.conditions, { field: '', operator: 'eq', value: '' }],
    });
  };

  const updateCondition = (index: number, updates: Partial<{ field: string; operator: string; value: string }>) => {
    const updated = form.conditions.map((c, i) =>
      i === index ? { ...c, ...updates } : c,
    );
    updateForm({ conditions: updated });
  };

  const removeCondition = (index: number) => {
    updateForm({ conditions: form.conditions.filter((_, i) => i !== index) });
  };

  // -- Actions --
  const addAction = () => {
    updateForm({
      actions: [...form.actions, { type: 'notify_user', config: {} }],
    });
  };

  const updateAction = (index: number, updates: Partial<ActionItem>) => {
    const updated = form.actions.map((a, i) =>
      i === index ? { ...a, ...updates } : a,
    );
    updateForm({ actions: updated });
  };

  const updateActionConfig = (index: number, key: string, value: unknown) => {
    const action = form.actions[index];
    updateAction(index, { config: { ...action.config, [key]: value } });
  };

  const removeAction = (index: number) => {
    updateForm({ actions: form.actions.filter((_, i) => i !== index) });
  };

  const moveAction = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= form.actions.length) return;
    const updated = [...form.actions];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    updateForm({ actions: updated });
  };

  // -- Save --
  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Informe o nome da automacao');
      return;
    }
    if (form.actions.length === 0) {
      toast.error('Adicione pelo menos uma acao');
      return;
    }

    const data = buildAutomationData(form);

    if (automation) {
      await updateMutation.mutateAsync({ id: automation.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
    onOpenChange(false);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // -- Action config array helpers --
  const getActionConfigArray = (index: number, key: string): Array<Record<string, unknown>> => {
    const val = form.actions[index]?.config[key];
    if (Array.isArray(val)) return val as Array<Record<string, unknown>>;
    return [];
  };

  const addActionConfigArrayItem = (index: number, key: string, item: Record<string, unknown>) => {
    const arr = getActionConfigArray(index, key);
    updateActionConfig(index, key, [...arr, item]);
  };

  const updateActionConfigArrayItem = (
    actionIndex: number,
    key: string,
    itemIndex: number,
    updates: Record<string, unknown>,
  ) => {
    const arr = getActionConfigArray(actionIndex, key);
    const updated = arr.map((item, i) => (i === itemIndex ? { ...item, ...updates } : item));
    updateActionConfig(actionIndex, key, updated);
  };

  const removeActionConfigArrayItem = (actionIndex: number, key: string, itemIndex: number) => {
    const arr = getActionConfigArray(actionIndex, key);
    updateActionConfig(actionIndex, key, arr.filter((_, i) => i !== itemIndex));
  };

  // -- Entity selector helper --
  const renderEntitySelect = (actionIndex: number, configKey: string = 'entitySlug') => (
    <div className="space-y-1">
      <Label className="text-xs">Entidade</Label>
      <Select
        value={getConfigValue(form.actions[actionIndex].config, configKey)}
        onValueChange={(v) => updateActionConfig(actionIndex, configKey, v)}
      >
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Selecione a entidade" />
        </SelectTrigger>
        <SelectContent>
          {entities.map((e: { id: string; slug: string; name: string }) => (
            <SelectItem key={e.id} value={e.slug}>
              {e.name} ({e.slug})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  // -- Inline filters builder --
  const renderFiltersBuilder = (actionIndex: number) => {
    const filters = getActionConfigArray(actionIndex, 'filters');
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Filtros (opcional)</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => addActionConfigArrayItem(actionIndex, 'filters', { field: '', operator: 'eq', value: '' })}
          >
            <Plus className="h-3 w-3 mr-1" />
            Filtro
          </Button>
        </div>
        {filters.map((filter, fi) => (
          <div key={fi} className="flex items-center gap-1.5">
            <Input
              placeholder="campo"
              value={String(filter.field ?? '')}
              onChange={(e) => updateActionConfigArrayItem(actionIndex, 'filters', fi, { field: e.target.value })}
              className="h-7 text-xs flex-1"
            />
            <Select
              value={String(filter.operator ?? 'eq')}
              onValueChange={(v) => updateActionConfigArrayItem(actionIndex, 'filters', fi, { operator: v })}
            >
              <SelectTrigger className="h-7 text-xs w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {conditionOperators.map(op => (
                  <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="valor ou {{template}}"
              value={String(filter.value ?? '')}
              onChange={(e) => updateActionConfigArrayItem(actionIndex, 'filters', fi, { value: e.target.value })}
              className="h-7 text-xs flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive flex-shrink-0"
              onClick={() => removeActionConfigArrayItem(actionIndex, 'filters', fi)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    );
  };

  // -- Render action config --
  const renderActionConfig = (action: ActionItem, index: number) => {
    switch (action.type) {
      case 'send_email':
        return (
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs">ID do Template</Label>
              <Input
                placeholder="template-id"
                value={getConfigValue(action.config, 'templateId')}
                onChange={(e) => updateActionConfig(index, 'templateId', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Destinatario (campo ou email)</Label>
              <Input
                placeholder="{{record.email}} ou usuario@email.com"
                value={getConfigValue(action.config, 'to')}
                onChange={(e) => updateActionConfig(index, 'to', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
        );

      case 'call_webhook':
        return (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">URL</Label>
                <Input
                  placeholder="https://example.com/hook"
                  value={getConfigValue(action.config, 'url')}
                  onChange={(e) => updateActionConfig(index, 'url', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Metodo</Label>
                <Select
                  value={getConfigValue(action.config, 'method', 'POST')}
                  onValueChange={(v) => updateActionConfig(index, 'method', v)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Headers (JSON)</Label>
              <Textarea
                placeholder='{"Authorization": "Bearer ..."}'
                value={getConfigValue(action.config, 'headers')}
                onChange={(e) => {
                  try {
                    updateActionConfig(index, 'headers', JSON.parse(e.target.value));
                  } catch {
                    updateActionConfig(index, 'headers', e.target.value);
                  }
                }}
                rows={2}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Body Template (JSON)</Label>
              <Textarea
                placeholder='{"data": "{{record}}"}'
                value={getConfigValue(action.config, 'body')}
                onChange={(e) => {
                  try {
                    updateActionConfig(index, 'body', JSON.parse(e.target.value));
                  } catch {
                    updateActionConfig(index, 'body', e.target.value);
                  }
                }}
                rows={2}
                className="text-sm"
              />
            </div>
          </div>
        );

      case 'update_field':
        return (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Campo</Label>
              <Select
                value={getConfigValue(action.config, 'fieldSlug')}
                onValueChange={(v) => updateActionConfig(index, 'fieldSlug', v)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Selecione" />
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
              <Label className="text-xs">Valor</Label>
              <Input
                placeholder="novo valor ou {{template}}"
                value={getConfigValue(action.config, 'value')}
                onChange={(e) => updateActionConfig(index, 'value', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
        );

      case 'create_record':
        return (
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs">Entidade (slug)</Label>
              <Input
                placeholder="slug-da-entidade"
                value={getConfigValue(action.config, 'entitySlug')}
                onChange={(e) => updateActionConfig(index, 'entitySlug', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dados (JSON)</Label>
              <Textarea
                placeholder='{"campo": "{{record.campo}}"}'
                value={getConfigValue(action.config, 'data')}
                onChange={(e) => {
                  try {
                    updateActionConfig(index, 'data', JSON.parse(e.target.value));
                  } catch {
                    updateActionConfig(index, 'data', e.target.value);
                  }
                }}
                rows={3}
                className="text-sm"
              />
            </div>
          </div>
        );

      case 'notify_user':
        return (
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs">Titulo</Label>
              <Input
                placeholder="Titulo da notificacao"
                value={getConfigValue(action.config, 'title')}
                onChange={(e) => updateActionConfig(index, 'title', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mensagem</Label>
              <Textarea
                placeholder="Registro {{record.name}} foi atualizado"
                value={getConfigValue(action.config, 'message')}
                onChange={(e) => updateActionConfig(index, 'message', e.target.value)}
                rows={2}
                className="text-sm"
              />
            </div>
          </div>
        );

      case 'change_status':
        return (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Campo de status</Label>
              <Select
                value={getConfigValue(action.config, 'fieldSlug')}
                onValueChange={(v) => updateActionConfig(index, 'fieldSlug', v)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {fields.filter(f => f.type === 'select' || f.type === 'text').map(f => (
                    <SelectItem key={f.slug} value={f.slug}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Novo status</Label>
              <Input
                placeholder="APROVADO"
                value={getConfigValue(action.config, 'targetStatus')}
                onChange={(e) => updateActionConfig(index, 'targetStatus', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
        );

      case 'wait':
        return (
          <div className="space-y-1">
            <Label className="text-xs">Duracao (milissegundos)</Label>
            <Input
              type="number"
              placeholder="5000"
              value={getConfigValue(action.config, 'duration')}
              onChange={(e) => updateActionConfig(index, 'duration', parseInt(e.target.value) || 0)}
              className="h-8 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              1000ms = 1 segundo, 60000ms = 1 minuto
            </p>
          </div>
        );

      case 'lookup_record':
        return (
          <div className="space-y-2">
            {renderEntitySelect(index)}
            {renderFiltersBuilder(index)}
            <div className="space-y-1">
              <Label className="text-xs">Campos a retornar (opcional, separados por virgula)</Label>
              <Input
                placeholder="cnpj, email, nome"
                value={getConfigValue(action.config, 'selectedFields')}
                onChange={(e) => {
                  const val = e.target.value;
                  updateActionConfig(
                    index,
                    'selectedFields',
                    val ? val.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
                  );
                }}
                className="h-8 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Limite de resultados</Label>
                <Input
                  type="number"
                  placeholder="1"
                  value={getConfigValue(action.config, 'limit', '1')}
                  onChange={(e) => updateActionConfig(index, 'limit', parseInt(e.target.value) || 1)}
                  className="h-8 text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  1 = objeto unico, mais = array
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Salvar como</Label>
                <Input
                  placeholder="ex: segurado"
                  value={getConfigValue(action.config, 'saveAs')}
                  onChange={(e) => updateActionConfig(index, 'saveAs', e.target.value)}
                  className="h-8 text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Use {'{{'}<span>nome.campo</span>{'}}'}
                </p>
              </div>
            </div>
          </div>
        );

      case 'update_related_record': {
        const updates = getActionConfigArray(index, 'updates');
        return (
          <div className="space-y-2">
            {renderEntitySelect(index)}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">ID do registro (ou template)</Label>
                <Input
                  placeholder="{{record.projeto_id}}"
                  value={getConfigValue(action.config, 'recordId')}
                  onChange={(e) => updateActionConfig(index, 'recordId', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ou buscar por campo</Label>
                <div className="flex gap-1">
                  <Input
                    placeholder="campo"
                    value={String((action.config.findBy as Record<string, unknown>)?.field ?? '')}
                    onChange={(e) =>
                      updateActionConfig(index, 'findBy', {
                        ...((action.config.findBy as Record<string, unknown>) || {}),
                        field: e.target.value,
                      })
                    }
                    className="h-8 text-xs flex-1"
                  />
                  <Input
                    placeholder="valor"
                    value={String((action.config.findBy as Record<string, unknown>)?.value ?? '')}
                    onChange={(e) =>
                      updateActionConfig(index, 'findBy', {
                        ...((action.config.findBy as Record<string, unknown>) || {}),
                        value: e.target.value,
                      })
                    }
                    className="h-8 text-xs flex-1"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Atualizacoes</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={() => addActionConfigArrayItem(index, 'updates', { field: '', mode: 'set', value: '' })}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Campo
                </Button>
              </div>
              {updates.map((upd, ui) => (
                <div key={ui} className="flex items-center gap-1.5">
                  <Input
                    placeholder="campo"
                    value={String(upd.field ?? '')}
                    onChange={(e) => updateActionConfigArrayItem(index, 'updates', ui, { field: e.target.value })}
                    className="h-7 text-xs flex-1"
                  />
                  <Select
                    value={String(upd.mode ?? 'set')}
                    onValueChange={(v) => updateActionConfigArrayItem(index, 'updates', ui, { mode: v })}
                  >
                    <SelectTrigger className="h-7 text-xs w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="set">Definir</SelectItem>
                      <SelectItem value="increment">Incrementar</SelectItem>
                      <SelectItem value="decrement">Decrementar</SelectItem>
                      <SelectItem value="append">Adicionar a lista</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="valor ou {{template}}"
                    value={String(upd.value ?? '')}
                    onChange={(e) => updateActionConfigArrayItem(index, 'updates', ui, { value: e.target.value })}
                    className="h-7 text-xs flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive flex-shrink-0"
                    onClick={() => removeActionConfigArrayItem(index, 'updates', ui)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {updates.length === 0 && (
                <p className="text-xs text-muted-foreground">Clique em &quot;+ Campo&quot; para adicionar atualizacoes.</p>
              )}
            </div>
          </div>
        );
      }

      case 'aggregate_records':
        return (
          <div className="space-y-2">
            {renderEntitySelect(index)}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Operacao</Label>
                <Select
                  value={getConfigValue(action.config, 'operation', 'count')}
                  onValueChange={(v) => updateActionConfig(index, 'operation', v)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="count">Contar</SelectItem>
                    <SelectItem value="sum">Somar</SelectItem>
                    <SelectItem value="avg">Media</SelectItem>
                    <SelectItem value="min">Minimo</SelectItem>
                    <SelectItem value="max">Maximo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">
                  Campo {getConfigValue(action.config, 'operation', 'count') === 'count' ? '(opcional)' : ''}
                </Label>
                <Input
                  placeholder="campo numerico"
                  value={getConfigValue(action.config, 'field')}
                  onChange={(e) => updateActionConfig(index, 'field', e.target.value || null)}
                  className="h-8 text-sm"
                  disabled={getConfigValue(action.config, 'operation', 'count') === 'count'}
                />
              </div>
            </div>
            {renderFiltersBuilder(index)}
            <div className="space-y-1">
              <Label className="text-xs">Salvar como</Label>
              <Input
                placeholder="ex: total_nc"
                value={getConfigValue(action.config, 'saveAs')}
                onChange={(e) => updateActionConfig(index, 'saveAs', e.target.value)}
                className="h-8 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Resultado disponivel como {'{{'}<span>nome</span>{'}}'}
              </p>
            </div>
          </div>
        );

      case 'run_script':
        return (
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs">Codigo JavaScript</Label>
              <Textarea
                placeholder={`const total = record.quantidade * record.preco;\nreturn { total, imposto: total * 0.1 };`}
                value={getConfigValue(action.config, 'code')}
                onChange={(e) => updateActionConfig(index, 'code', e.target.value)}
                rows={5}
                className="text-sm font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Max 10.000 caracteres. Timeout: 5s.
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Salvar como (opcional)</Label>
              <Input
                placeholder="ex: calculo"
                value={getConfigValue(action.config, 'saveAs')}
                onChange={(e) => updateActionConfig(index, 'saveAs', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="p-2 bg-muted/50 rounded text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Variaveis disponiveis:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li><code className="text-foreground">record</code> - Dados do registro atual</li>
                <li><code className="text-foreground">previousRecord</code> - Dados anteriores (em updates)</li>
                <li><code className="text-foreground">user</code> - Usuario que disparou</li>
                <li><code className="text-foreground">entity</code> - Entidade (id, slug, name)</li>
                <li><code className="text-foreground">lookups</code> - Resultados de lookup/aggregate anteriores</li>
                <li><code className="text-foreground">JSON, Date, Math, Array, Object</code> - Globais seguros</li>
              </ul>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>
            {automation ? 'Editar Automacao' : 'Nova Automacao'}
          </DialogTitle>
          <DialogDescription>
            Configure o gatilho, condicoes e acoes para esta automacao.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-160px)] px-6">
          <div className="space-y-6 py-4">
            {/* ── Section 1: Basic Info ────────────────────────────── */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                  1
                </span>
                Informacoes Basicas
              </h3>
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  placeholder="Nome da automacao"
                  value={form.name}
                  onChange={(e) => updateForm({ name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Descricao (opcional)</Label>
                <Textarea
                  placeholder="Descreva o que esta automacao faz..."
                  value={form.description}
                  onChange={(e) => updateForm({ description: e.target.value })}
                  rows={2}
                />
              </div>
            </div>

            <Separator />

            {/* ── Section 2: Trigger ───────────────────────────────── */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                  2
                </span>
                Gatilho - "Quando..."
              </h3>
              <div className="space-y-2">
                <Label>Tipo de gatilho</Label>
                <Select
                  value={form.trigger}
                  onValueChange={(val) => updateForm({ trigger: val as AutomationTrigger })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {triggerOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex flex-col">
                          <span>{opt.label}</span>
                          <span className="text-xs text-muted-foreground">{opt.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Trigger-specific config */}
              {form.trigger === 'ON_FIELD_CHANGE' && (
                <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-xs">Campo monitorado</Label>
                    <Select
                      value={form.triggerFieldSlug}
                      onValueChange={(val) => updateForm({ triggerFieldSlug: val })}
                    >
                      <SelectTrigger className="h-8 text-sm">
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
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">De (opcional)</Label>
                      <Input
                        placeholder="valor anterior"
                        value={form.triggerFromValue}
                        onChange={(e) => updateForm({ triggerFromValue: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Para (opcional)</Label>
                      <Input
                        placeholder="novo valor"
                        value={form.triggerToValue}
                        onChange={(e) => updateForm({ triggerToValue: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              {form.trigger === 'ON_STATUS_CHANGE' && (
                <div className="grid grid-cols-2 gap-2 p-3 bg-muted/50 rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-xs">De status (opcional)</Label>
                    <Input
                      placeholder="PENDENTE"
                      value={form.triggerFromValue}
                      onChange={(e) => updateForm({ triggerFromValue: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Para status (opcional)</Label>
                    <Input
                      placeholder="APROVADO"
                      value={form.triggerToValue}
                      onChange={(e) => updateForm({ triggerToValue: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              )}

              {form.trigger === 'SCHEDULE' && (
                <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-xs">Expressao Cron</Label>
                    <Input
                      placeholder="0 9 * * *"
                      value={form.cronExpression}
                      onChange={(e) => updateForm({ cronExpression: e.target.value })}
                      className="h-8 text-sm font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Formato: minuto hora dia-do-mes mes dia-da-semana. Ex: &quot;0 9 * * 1-5&quot; = seg a sex as 09:00
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Fuso Horario</Label>
                    <Select
                      value={form.timezone}
                      onValueChange={(val) => updateForm({ timezone: val })}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {timezones.map(tz => (
                          <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* ── Section 3: Conditions ────────────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                    3
                  </span>
                  Condicoes - "Somente se..." (opcional)
                </h3>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addCondition}>
                  <Plus className="h-3 w-3 mr-1" />
                  Condicao
                </Button>
              </div>

              {form.conditions.length === 0 && (
                <p className="text-xs text-muted-foreground pl-7">
                  Sem condicoes - a automacao sera executada sempre que o gatilho disparar.
                </p>
              )}

              {form.conditions.map((cond, index) => (
                <div key={index} className="flex items-center gap-2 pl-7">
                  {index > 0 && (
                    <Badge variant="outline" className="text-xs flex-shrink-0">E</Badge>
                  )}
                  <Select
                    value={cond.field}
                    onValueChange={(val) => updateCondition(index, { field: val })}
                  >
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue placeholder="Campo" />
                    </SelectTrigger>
                    <SelectContent>
                      {fields.map(f => (
                        <SelectItem key={f.slug} value={f.slug}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={cond.operator}
                    onValueChange={(val) => updateCondition(index, { operator: val })}
                  >
                    <SelectTrigger className="h-8 text-xs w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {conditionOperators.map(op => (
                        <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="valor"
                    value={cond.value}
                    onChange={(e) => updateCondition(index, { value: e.target.value })}
                    className="h-8 text-xs flex-1"
                    disabled={cond.operator === 'is_empty' || cond.operator === 'is_not_empty'}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive flex-shrink-0"
                    onClick={() => removeCondition(index)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>

            <Separator />

            {/* ── Section 4: Actions ───────────────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                    4
                  </span>
                  Acoes - "Entao faca..."
                </h3>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addAction}>
                  <Plus className="h-3 w-3 mr-1" />
                  Acao
                </Button>
              </div>

              {form.actions.length === 0 && (
                <div className="text-center py-4 border-2 border-dashed rounded-lg ml-7">
                  <p className="text-xs text-muted-foreground">
                    Nenhuma acao adicionada. Clique em &quot;+ Acao&quot; para adicionar.
                  </p>
                </div>
              )}

              <div className="space-y-2 pl-7">
                {form.actions.map((action, index) => {
                  const Icon = actionTypeIcons[action.type] || Zap;
                  return (
                    <div key={index} className="relative">
                      {/* Timeline connector */}
                      {index > 0 && (
                        <div className="absolute left-4 -top-2 w-0.5 h-2 bg-border" />
                      )}
                      {index < form.actions.length - 1 && (
                        <div className="absolute left-4 -bottom-2 w-0.5 h-2 bg-border" />
                      )}

                      <div className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex-shrink-0">
                            {index + 1}
                          </span>
                          <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <Select
                            value={action.type}
                            onValueChange={(val) =>
                              updateAction(index, { type: val as ActionType, config: {} })
                            }
                          >
                            <SelectTrigger className="h-8 text-sm flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.entries(actionTypeLabels) as [ActionType, string][]).map(([key, label]) => {
                                const ActionIcon = actionTypeIcons[key];
                                return (
                                  <SelectItem key={key} value={key}>
                                    <span className="flex items-center gap-2">
                                      <ActionIcon className="h-3.5 w-3.5" />
                                      {label}
                                    </span>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={index === 0}
                              onClick={() => moveAction(index, 'up')}
                            >
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={index === form.actions.length - 1}
                              onClick={() => moveAction(index, 'down')}
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => removeAction(index)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        {renderActionConfig(action, index)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* ── Section 5: Settings ──────────────────────────────── */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                  5
                </span>
                Configuracoes
              </h3>

              <div className="space-y-3 pl-7">
                {/* Error handling */}
                <div className="space-y-2">
                  <Label className="text-sm">Tratamento de erros</Label>
                  <RadioGroup
                    value={form.errorHandling}
                    onValueChange={(val) => updateForm({ errorHandling: val as 'stop' | 'continue' })}
                    className="flex gap-4"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="stop" id="error-stop" />
                      <Label htmlFor="error-stop" className="text-sm cursor-pointer">
                        Parar ao falhar
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="continue" id="error-continue" />
                      <Label htmlFor="error-continue" className="text-sm cursor-pointer">
                        Continuar mesmo com erro
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Max executions */}
                <div className="space-y-1">
                  <Label className="text-sm">Max. execucoes por hora</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10000}
                    value={form.maxExecutionsPerHour}
                    onChange={(e) => updateForm({ maxExecutionsPerHour: parseInt(e.target.value) || 100 })}
                    className="h-8 text-sm w-32"
                  />
                  <p className="text-xs text-muted-foreground">
                    Limita execucoes para evitar loops infinitos.
                  </p>
                </div>

                {/* Active toggle */}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <Label className="text-sm">Automacao ativa</Label>
                    <p className="text-xs text-muted-foreground">
                      Desative para pausar a automacao sem excluir.
                    </p>
                  </div>
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={(checked) => updateForm({ isActive: checked })}
                  />
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {automation ? 'Salvar Alteracoes' : 'Criar Automacao'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

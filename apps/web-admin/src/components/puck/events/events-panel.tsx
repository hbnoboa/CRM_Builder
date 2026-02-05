'use client';

import { useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  Zap,
  PenLine,
  Filter,
  ExternalLink,
  Bell,
  Maximize2,
  Minimize2,
  RefreshCw,
  Eye,
  Loader2,
  Play,
} from 'lucide-react';
import {
  ComponentEvent,
  Action,
  EventType,
  ActionType,
  createEmptyEvent,
  createEmptyAction,
  getEventLabel,
  getActionLabel,
  getActionIcon,
  getActionColor,
  getAvailableEvents,
} from '@/lib/page-events';

// Icon mapping
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap,
  PenLine,
  Filter,
  ExternalLink,
  Bell,
  Maximize2,
  Minimize2,
  RefreshCw,
  Eye,
  Loader2,
  Play,
};

interface EventsPanelProps {
  componentType: string;
  componentId: string;
  events: ComponentEvent[];
  onChange: (events: ComponentEvent[]) => void;
  availableComponents?: { id: string; label: string; type: string }[];
  availableApis?: { id: string; name: string; path: string; method: string }[];
}

export function EventsPanel({
  componentType,
  componentId,
  events = [],
  onChange,
  availableComponents = [],
  availableApis = [],
}: EventsPanelProps) {
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const availableEventTypes = getAvailableEvents(componentType);

  const addEvent = (type: EventType) => {
    const newEvent = createEmptyEvent(type);
    onChange([...events, newEvent]);
    setExpandedEvent(newEvent.id);
  };

  const updateEvent = (eventId: string, updates: Partial<ComponentEvent>) => {
    onChange(
      events.map((e) => (e.id === eventId ? { ...e, ...updates } : e))
    );
  };

  const removeEvent = (eventId: string) => {
    onChange(events.filter((e) => e.id !== eventId));
  };

  const addAction = (eventId: string, type: ActionType) => {
    const event = events.find((e) => e.id === eventId);
    if (!event) return;

    const newAction = createEmptyAction(type);
    updateEvent(eventId, {
      actions: [...event.actions, newAction],
    });
  };

  const updateAction = (
    eventId: string,
    actionId: string,
    updates: Partial<Action>
  ) => {
    const event = events.find((e) => e.id === eventId);
    if (!event) return;

    updateEvent(eventId, {
      actions: event.actions.map((a) =>
        a.id === actionId ? { ...a, ...updates } : a
      ),
    });
  };

  const removeAction = (eventId: string, actionId: string) => {
    const event = events.find((e) => e.id === eventId);
    if (!event) return;

    updateEvent(eventId, {
      actions: event.actions.filter((a) => a.id !== actionId),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Eventos</Label>
        <EventTypeSelector
          availableTypes={availableEventTypes}
          usedTypes={events.map((e) => e.type)}
          onSelect={addEvent}
        />
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum evento configurado
        </p>
      ) : (
        <Accordion
          type="single"
          collapsible
          value={expandedEvent || undefined}
          onValueChange={(v) => setExpandedEvent(v || null)}
        >
          {events.map((event) => (
            <AccordionItem key={event.id} value={event.id}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2 flex-1">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <Badge variant={event.enabled ? 'default' : 'secondary'}>
                    {getEventLabel(event.type)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {event.actions.length} acao(oes)
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={event.enabled}
                        onCheckedChange={(enabled) =>
                          updateEvent(event.id, { enabled })
                        }
                      />
                      <Label className="text-sm">Ativo</Label>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeEvent(event.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  <div>
                    <Label className="text-xs">Condicao (opcional)</Label>
                    <Input
                      placeholder="{{form.status}} === 'active'"
                      value={event.condition || ''}
                      onChange={(e) =>
                        updateEvent(event.id, { condition: e.target.value })
                      }
                      className="mt-1 text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">Acoes</Label>
                      <ActionTypeSelector
                        onSelect={(type) => addAction(event.id, type)}
                      />
                    </div>

                    {event.actions.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        Adicione acoes para este evento
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {event.actions.map((action, index) => (
                          <ActionCard
                            key={action.id}
                            action={action}
                            index={index}
                            onUpdate={(updates) =>
                              updateAction(event.id, action.id, updates)
                            }
                            onRemove={() => removeAction(event.id, action.id)}
                            availableComponents={availableComponents}
                            availableApis={availableApis}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}

// Selector para tipo de evento
function EventTypeSelector({
  availableTypes,
  usedTypes,
  onSelect,
}: {
  availableTypes: EventType[];
  usedTypes: EventType[];
  onSelect: (type: EventType) => void;
}) {
  const unusedTypes = availableTypes.filter((t) => !usedTypes.includes(t));

  if (unusedTypes.length === 0) return null;

  return (
    <Select onValueChange={(v: string) => onSelect(v as EventType)}>
      <SelectTrigger className="w-[140px] h-8">
        <Plus className="h-3 w-3 mr-1" />
        <span className="text-xs">Evento</span>
      </SelectTrigger>
      <SelectContent>
        {unusedTypes.map((type) => (
          <SelectItem key={type} value={type}>
            {getEventLabel(type)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Selector para tipo de acao
function ActionTypeSelector({
  onSelect,
}: {
  onSelect: (type: ActionType) => void;
}) {
  const actionTypes: ActionType[] = [
    'callApi',
    'setValue',
    'filterData',
    'navigate',
    'showToast',
    'showModal',
    'closeModal',
    'refresh',
    'setVisibility',
    'setLoading',
    'runActions',
  ];

  return (
    <Select onValueChange={(v) => onSelect(v as ActionType)}>
      <SelectTrigger className="w-[120px] h-7">
        <Plus className="h-3 w-3 mr-1" />
        <span className="text-xs">Acao</span>
      </SelectTrigger>
      <SelectContent>
        {actionTypes.map((type) => {
          const IconComponent = iconMap[getActionIcon(type)];
          return (
            <SelectItem key={type} value={type}>
              <div className="flex items-center gap-2">
                {IconComponent && <IconComponent className="h-3 w-3" />}
                <span>{getActionLabel(type)}</span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

// Card de acao individual
function ActionCard({
  action,
  index,
  onUpdate,
  onRemove,
  availableComponents,
  availableApis,
}: {
  action: Action;
  index: number;
  onUpdate: (updates: Partial<Action>) => void;
  onRemove: () => void;
  availableComponents: { id: string; label: string; type: string }[];
  availableApis: { id: string; name: string; path: string; method: string }[];
}) {
  const [expanded, setExpanded] = useState(false);
  const IconComponent = iconMap[getActionIcon(action.type)];
  const colorClass = getActionColor(action.type);

  return (
    <div className="border rounded-lg p-3 bg-muted/30">
      <div className="flex items-center gap-2">
        <div
          className={`w-6 h-6 rounded flex items-center justify-center ${colorClass}`}
        >
          {IconComponent && <IconComponent className="h-3 w-3 text-white" />}
        </div>
        <span className="text-sm font-medium flex-1">
          {action.label || getActionLabel(action.type)}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => setExpanded(!expanded)}
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={onRemove}
        >
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 pt-3 border-t">
          <div>
            <Label className="text-xs">Nome da acao</Label>
            <Input
              value={action.label || ''}
              onChange={(e) => onUpdate({ label: e.target.value })}
              placeholder={getActionLabel(action.type)}
              className="mt-1 h-8 text-sm"
            />
          </div>

          {/* Campos especificos por tipo de acao */}
          {action.type === 'callApi' && (
            <CallApiFields
              action={action}
              onUpdate={onUpdate}
              availableApis={availableApis}
            />
          )}

          {action.type === 'setValue' && (
            <SetValueFields
              action={action}
              onUpdate={onUpdate}
              availableComponents={availableComponents}
            />
          )}

          {action.type === 'filterData' && (
            <FilterDataFields
              action={action}
              onUpdate={onUpdate}
              availableComponents={availableComponents}
            />
          )}

          {action.type === 'navigate' && (
            <NavigateFields action={action} onUpdate={onUpdate} />
          )}

          {action.type === 'showToast' && (
            <ShowToastFields action={action} onUpdate={onUpdate} />
          )}

          {(action.type === 'showModal' || action.type === 'closeModal') && (
            <ModalFields action={action} onUpdate={onUpdate} />
          )}

          {action.type === 'refresh' && (
            <RefreshFields
              action={action}
              onUpdate={onUpdate}
              availableComponents={availableComponents}
            />
          )}

          {action.type === 'setVisibility' && (
            <VisibilityFields
              action={action}
              onUpdate={onUpdate}
              availableComponents={availableComponents}
            />
          )}

          {action.type === 'setLoading' && (
            <LoadingFields
              action={action}
              onUpdate={onUpdate}
              availableComponents={availableComponents}
            />
          )}

          {/* Condicao e delay */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Delay (ms)</Label>
              <Input
                type="number"
                value={action.delay || ''}
                onChange={(e) =>
                  onUpdate({ delay: parseInt(e.target.value) || undefined })
                }
                placeholder="0"
                className="mt-1 h-8 text-sm"
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={action.async || false}
                  onCheckedChange={(async) => onUpdate({ async })}
                />
                <Label className="text-xs">Async</Label>
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs">Condicao</Label>
            <Input
              value={action.condition || ''}
              onChange={(e) => onUpdate({ condition: e.target.value })}
              placeholder="{{response.success}} === true"
              className="mt-1 h-8 text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Campos para callApi
function CallApiFields({
  action,
  onUpdate,
  availableApis,
}: {
  action: Action;
  onUpdate: (updates: Partial<Action>) => void;
  availableApis: { id: string; name: string; path: string; method: string }[];
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Tipo de API</Label>
        <Select
          value={action.apiType || 'crud'}
          onValueChange={(v) => onUpdate({ apiType: v as 'crud' | 'custom' })}
        >
          <SelectTrigger className="mt-1 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="crud">CRUD (Auto-gerado)</SelectItem>
            <SelectItem value="custom">Custom API</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {action.apiType === 'custom' && availableApis.length > 0 && (
        <div>
          <Label className="text-xs">API Custom</Label>
          <Select
            value={action.apiPath || ''}
            onValueChange={(v) => {
              const api = availableApis.find((a) => a.path === v);
              onUpdate({
                apiPath: v,
                apiMethod: api?.method as Action['apiMethod'],
              });
            }}
          >
            <SelectTrigger className="mt-1 h-8">
              <SelectValue placeholder="Selecione uma API" />
            </SelectTrigger>
            <SelectContent>
              {availableApis.map((api) => (
                <SelectItem key={api.id} value={api.path}>
                  <span
                    className={`text-xs font-mono mr-2 ${
                      api.method === 'GET'
                        ? 'text-green-600'
                        : api.method === 'POST'
                          ? 'text-blue-600'
                          : api.method === 'PUT'
                            ? 'text-yellow-600'
                            : api.method === 'DELETE'
                              ? 'text-red-600'
                              : ''
                    }`}
                  >
                    {api.method}
                  </span>
                  {api.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">Metodo</Label>
          <Select
            value={action.apiMethod || 'GET'}
            onValueChange={(v) =>
              onUpdate({ apiMethod: v as Action['apiMethod'] })
            }
          >
            <SelectTrigger className="mt-1 h-8">
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
        <div className="col-span-2">
          <Label className="text-xs">Path</Label>
          <Input
            value={action.apiPath || ''}
            onChange={(e) => onUpdate({ apiPath: e.target.value })}
            placeholder="/api/entity/:id"
            className="mt-1 h-8 text-sm"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs">Body (JSON ou expressao)</Label>
        <Textarea
          value={
            typeof action.apiBody === 'string'
              ? action.apiBody
              : JSON.stringify(action.apiBody || {}, null, 2)
          }
          onChange={(e) => {
            try {
              onUpdate({ apiBody: JSON.parse(e.target.value) });
            } catch {
              onUpdate({ apiBody: e.target.value });
            }
          }}
          placeholder='{"nome": "{{form.nome}}"}'
          className="mt-1 text-sm font-mono"
          rows={3}
        />
      </div>
    </div>
  );
}

// Campos para setValue
function SetValueFields({
  action,
  onUpdate,
  availableComponents,
}: {
  action: Action;
  onUpdate: (updates: Partial<Action>) => void;
  availableComponents: { id: string; label: string; type: string }[];
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Componente alvo</Label>
        <Select
          value={action.targetComponentId || ''}
          onValueChange={(v) => onUpdate({ targetComponentId: v })}
        >
          <SelectTrigger className="mt-1 h-8">
            <SelectValue placeholder="Selecione um componente" />
          </SelectTrigger>
          <SelectContent>
            {availableComponents.map((comp) => (
              <SelectItem key={comp.id} value={comp.id}>
                {comp.label} ({comp.type})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs">Campo (opcional)</Label>
        <Input
          value={action.targetField || ''}
          onChange={(e) => onUpdate({ targetField: e.target.value })}
          placeholder="value"
          className="mt-1 h-8 text-sm"
        />
      </div>

      <div>
        <Label className="text-xs">Valor</Label>
        <Input
          value={String(action.value || '')}
          onChange={(e) => onUpdate({ value: e.target.value })}
          placeholder="{{response.data.nome}}"
          className="mt-1 h-8 text-sm"
        />
      </div>
    </div>
  );
}

// Campos para filterData
function FilterDataFields({
  action,
  onUpdate,
  availableComponents,
}: {
  action: Action;
  onUpdate: (updates: Partial<Action>) => void;
  availableComponents: { id: string; label: string; type: string }[];
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Componente a filtrar</Label>
        <Select
          value={action.filterComponentId || ''}
          onValueChange={(v) => onUpdate({ filterComponentId: v })}
        >
          <SelectTrigger className="mt-1 h-8">
            <SelectValue placeholder="Selecione um componente" />
          </SelectTrigger>
          <SelectContent>
            {availableComponents
              .filter((c) =>
                ['SelectField', 'DataTable', 'DataList'].includes(c.type)
              )
              .map((comp) => (
                <SelectItem key={comp.id} value={comp.id}>
                  {comp.label} ({comp.type})
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs">Campo de filtro</Label>
        <Input
          value={action.filterField || ''}
          onChange={(e) => onUpdate({ filterField: e.target.value })}
          placeholder="categoria_id"
          className="mt-1 h-8 text-sm"
        />
      </div>

      <div>
        <Label className="text-xs">Valor do filtro</Label>
        <Input
          value={action.filterValue || ''}
          onChange={(e) => onUpdate({ filterValue: e.target.value })}
          placeholder="{{event.value}}"
          className="mt-1 h-8 text-sm"
        />
      </div>
    </div>
  );
}

// Campos para navigate
function NavigateFields({
  action,
  onUpdate,
}: {
  action: Action;
  onUpdate: (updates: Partial<Action>) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">URL ou slug da pagina</Label>
        <Input
          value={action.navigateTo || ''}
          onChange={(e) => onUpdate({ navigateTo: e.target.value })}
          placeholder="/clientes/{{response.data.id}}"
          className="mt-1 h-8 text-sm"
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={action.openInNewTab || false}
          onCheckedChange={(openInNewTab) => onUpdate({ openInNewTab })}
        />
        <Label className="text-xs">Abrir em nova aba</Label>
      </div>
    </div>
  );
}

// Campos para showToast
function ShowToastFields({
  action,
  onUpdate,
}: {
  action: Action;
  onUpdate: (updates: Partial<Action>) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Tipo</Label>
        <Select
          value={action.toastType || 'success'}
          onValueChange={(v) =>
            onUpdate({ toastType: v as Action['toastType'] })
          }
        >
          <SelectTrigger className="mt-1 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="success">Sucesso</SelectItem>
            <SelectItem value="error">Erro</SelectItem>
            <SelectItem value="warning">Aviso</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs">Mensagem</Label>
        <Input
          value={action.toastMessage || ''}
          onChange={(e) => onUpdate({ toastMessage: e.target.value })}
          placeholder="Operacao realizada com sucesso!"
          className="mt-1 h-8 text-sm"
        />
      </div>

      <div>
        <Label className="text-xs">Duracao (ms)</Label>
        <Input
          type="number"
          value={action.toastDuration || ''}
          onChange={(e) =>
            onUpdate({ toastDuration: parseInt(e.target.value) || undefined })
          }
          placeholder="3000"
          className="mt-1 h-8 text-sm"
        />
      </div>
    </div>
  );
}

// Campos para modal
function ModalFields({
  action,
  onUpdate,
}: {
  action: Action;
  onUpdate: (updates: Partial<Action>) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">ID do Modal</Label>
        <Input
          value={action.modalId || ''}
          onChange={(e) => onUpdate({ modalId: e.target.value })}
          placeholder="confirm-delete"
          className="mt-1 h-8 text-sm"
        />
      </div>

      {action.type === 'showModal' && (
        <>
          <div>
            <Label className="text-xs">Titulo</Label>
            <Input
              value={action.modalTitle || ''}
              onChange={(e) => onUpdate({ modalTitle: e.target.value })}
              placeholder="Confirmar acao"
              className="mt-1 h-8 text-sm"
            />
          </div>

          <div>
            <Label className="text-xs">Conteudo</Label>
            <Textarea
              value={action.modalContent || ''}
              onChange={(e) => onUpdate({ modalContent: e.target.value })}
              placeholder="Tem certeza que deseja continuar?"
              className="mt-1 text-sm"
              rows={2}
            />
          </div>
        </>
      )}
    </div>
  );
}

// Campos para refresh
function RefreshFields({
  action,
  onUpdate,
  availableComponents,
}: {
  action: Action;
  onUpdate: (updates: Partial<Action>) => void;
  availableComponents: { id: string; label: string; type: string }[];
}) {
  return (
    <div>
      <Label className="text-xs">Componente a atualizar</Label>
      <Select
        value={action.refreshComponentId || ''}
        onValueChange={(v) => onUpdate({ refreshComponentId: v })}
      >
        <SelectTrigger className="mt-1 h-8">
          <SelectValue placeholder="Selecione um componente" />
        </SelectTrigger>
        <SelectContent>
          {availableComponents.map((comp) => (
            <SelectItem key={comp.id} value={comp.id}>
              {comp.label} ({comp.type})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// Campos para visibility
function VisibilityFields({
  action,
  onUpdate,
  availableComponents,
}: {
  action: Action;
  onUpdate: (updates: Partial<Action>) => void;
  availableComponents: { id: string; label: string; type: string }[];
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Componente</Label>
        <Select
          value={action.visibilityComponentId || ''}
          onValueChange={(v) => onUpdate({ visibilityComponentId: v })}
        >
          <SelectTrigger className="mt-1 h-8">
            <SelectValue placeholder="Selecione um componente" />
          </SelectTrigger>
          <SelectContent>
            {availableComponents.map((comp) => (
              <SelectItem key={comp.id} value={comp.id}>
                {comp.label} ({comp.type})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs">Acao</Label>
        <Select
          value={action.visibilityAction || 'show'}
          onValueChange={(v) =>
            onUpdate({ visibilityAction: v as Action['visibilityAction'] })
          }
        >
          <SelectTrigger className="mt-1 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="show">Mostrar</SelectItem>
            <SelectItem value="hide">Esconder</SelectItem>
            <SelectItem value="toggle">Alternar</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// Campos para loading
function LoadingFields({
  action,
  onUpdate,
  availableComponents,
}: {
  action: Action;
  onUpdate: (updates: Partial<Action>) => void;
  availableComponents: { id: string; label: string; type: string }[];
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Componente</Label>
        <Select
          value={action.loadingComponentId || ''}
          onValueChange={(v) => onUpdate({ loadingComponentId: v })}
        >
          <SelectTrigger className="mt-1 h-8">
            <SelectValue placeholder="Selecione um componente" />
          </SelectTrigger>
          <SelectContent>
            {availableComponents.map((comp) => (
              <SelectItem key={comp.id} value={comp.id}>
                {comp.label} ({comp.type})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={action.loadingState || false}
          onCheckedChange={(loadingState) => onUpdate({ loadingState })}
        />
        <Label className="text-xs">Ativar loading</Label>
      </div>
    </div>
  );
}

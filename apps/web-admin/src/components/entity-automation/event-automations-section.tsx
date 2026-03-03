'use client';

import { useState } from 'react';
import {
  Plus, Pencil, Trash2, Loader2, Zap, Play, History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  useEntityAutomations,
  useUpdateAutomation,
  useDeleteAutomation,
  useExecuteAutomation,
} from '@/hooks/use-entity-automations';
import type { EntityAutomation, AutomationTrigger } from '@/services/entity-automation.service';
import { AutomationWizard } from './automation-wizard';
import { ExecutionHistoryDialog } from './execution-history-dialog';

import type { EntityField } from '@/types';

interface EventAutomationsSectionProps {
  entityId: string;
  fields: EntityField[];
}

const EVENT_TRIGGERS: AutomationTrigger[] = [
  'ON_CREATE', 'ON_UPDATE', 'ON_FIELD_CHANGE', 'ON_STATUS_CHANGE', 'ON_DELETE', 'MANUAL',
];

const triggerLabels: Record<string, string> = {
  ON_CREATE: 'Ao Criar',
  ON_UPDATE: 'Ao Atualizar',
  ON_FIELD_CHANGE: 'Ao Mudar Campo',
  ON_STATUS_CHANGE: 'Ao Mudar Status',
  ON_DELETE: 'Ao Excluir',
  MANUAL: 'Manual',
};

const triggerColors: Record<string, string> = {
  ON_CREATE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  ON_UPDATE: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  ON_FIELD_CHANGE: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  ON_STATUS_CHANGE: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  ON_DELETE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  MANUAL: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

function getActionsSummary(actions: EntityAutomation['actions']): string {
  if (!actions || actions.length === 0) return 'Sem acoes';
  const types = [...new Set(actions.map(a => a.type))];
  return `${actions.length} acao(oes): ${types.join(', ')}`;
}

function getConditionsSummary(conditions?: EntityAutomation['conditions']): string {
  if (!conditions || conditions.length === 0) return '';
  return `${conditions.length} condicao(oes)`;
}

export function EventAutomationsSection({ entityId, fields }: EventAutomationsSectionProps) {
  const { data: allAutomations, isLoading } = useEntityAutomations(entityId);
  const updateMutation = useUpdateAutomation(entityId, {
    success: 'Automacao atualizada',
    error: 'Erro ao atualizar automacao',
  });
  const deleteMutation = useDeleteAutomation(entityId, {
    success: 'Automacao excluida',
    error: 'Erro ao excluir automacao',
  });
  const executeMutation = useExecuteAutomation(entityId, {
    success: 'Automacao executada',
    error: 'Erro ao executar automacao',
  });

  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<EntityAutomation | undefined>(undefined);
  const [historyAutomation, setHistoryAutomation] = useState<EntityAutomation | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const eventAutomations = (allAutomations || []).filter(
    a => EVENT_TRIGGERS.includes(a.trigger)
  );

  const handleToggleActive = async (automation: EntityAutomation) => {
    await updateMutation.mutateAsync({
      id: automation.id,
      data: { isActive: !automation.isActive },
    });
  };

  const handleExecute = async (automation: EntityAutomation) => {
    await executeMutation.mutateAsync({ id: automation.id });
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    setDeleteConfirmId(null);
  };

  const openCreateWizard = () => {
    setEditingAutomation(undefined);
    setWizardOpen(true);
  };

  const openEditWizard = (automation: EntityAutomation) => {
    setEditingAutomation(automation);
    setWizardOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {eventAutomations.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed rounded-lg">
          <Zap className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground mb-3">
            Nenhuma automacao de evento configurada.
          </p>
          <Button variant="outline" size="sm" onClick={openCreateWizard}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Automacao
          </Button>
        </div>
      ) : (
        <>
          {eventAutomations.map(automation => {
            const condSummary = getConditionsSummary(automation.conditions);
            return (
              <Card
                key={automation.id}
                className={`border-l-4 transition-opacity ${
                  automation.isActive ? 'border-l-primary/40' : 'border-l-muted opacity-60'
                }`}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <Zap className="h-4 w-4 mt-0.5 text-amber-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{automation.name}</span>
                        <Badge className={`text-xs ${triggerColors[automation.trigger] || ''}`}>
                          {triggerLabels[automation.trigger] || automation.trigger}
                        </Badge>
                        {automation.trigger === 'ON_FIELD_CHANGE' && automation.triggerConfig?.fieldSlug && (
                          <Badge variant="outline" className="text-xs">
                            Campo: {String(automation.triggerConfig.fieldSlug)}
                          </Badge>
                        )}
                      </div>
                      {automation.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {automation.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span>{getActionsSummary(automation.actions)}</span>
                        {condSummary && (
                          <>
                            <span className="text-muted-foreground/40">|</span>
                            <span>{condSummary}</span>
                          </>
                        )}
                        {automation.lastRunAt && (
                          <>
                            <span className="text-muted-foreground/40">|</span>
                            <span>
                              Ultima exec.: {new Date(automation.lastRunAt).toLocaleString('pt-BR', {
                                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                              })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Switch
                        checked={automation.isActive}
                        onCheckedChange={() => handleToggleActive(automation)}
                        disabled={updateMutation.isPending}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 justify-end border-t pt-2">
                    {automation.trigger === 'MANUAL' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleExecute(automation)}
                        disabled={executeMutation.isPending || !automation.isActive}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Executar
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setHistoryAutomation(automation)}
                    >
                      <History className="h-3 w-3 mr-1" />
                      Historico
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => openEditWizard(automation)}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={() => setDeleteConfirmId(automation.id)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={openCreateWizard}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Automacao
          </Button>
        </>
      )}

      {/* Automation Wizard */}
      <AutomationWizard
        entityId={entityId}
        fields={fields}
        automation={editingAutomation}
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        defaultTriggerType="ON_CREATE"
      />

      {/* Execution History */}
      {historyAutomation && (
        <ExecutionHistoryDialog
          entityId={entityId}
          automationId={historyAutomation.id}
          automationName={historyAutomation.name}
          open={!!historyAutomation}
          onOpenChange={(open) => !open && setHistoryAutomation(null)}
        />
      )}

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir Automacao</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir esta automacao? Esta acao nao pode ser desfeita.
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

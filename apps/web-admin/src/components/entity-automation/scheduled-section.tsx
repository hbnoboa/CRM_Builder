'use client';

import { useState } from 'react';
import {
  Plus, Pencil, Trash2, Loader2, Clock, History,
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
} from '@/hooks/use-entity-automations';
import type { EntityAutomation } from '@/services/entity-automation.service';
import { AutomationWizard } from './automation-wizard';
import { ExecutionHistoryDialog } from './execution-history-dialog';

interface ScheduledSectionProps {
  entityId: string;
  fields: Array<{ slug: string; name: string; type: string }>;
}

/**
 * Converts a cron expression to a human-readable Portuguese string.
 * Covers common patterns; falls back to the raw expression.
 */
function cronToHumanReadable(cron?: string): string {
  if (!cron) return '-';
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return cron;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Every minute
  if (minute === '*' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return 'A cada minuto';
  }

  // Every N minutes
  if (minute.startsWith('*/') && hour === '*' && dayOfMonth === '*') {
    return `A cada ${minute.slice(2)} minutos`;
  }

  // Every hour at minute X
  if (minute !== '*' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return `A cada hora, no minuto ${minute}`;
  }

  // Every N hours
  if (minute !== '*' && hour.startsWith('*/') && dayOfMonth === '*') {
    return `A cada ${hour.slice(2)} horas, no minuto ${minute}`;
  }

  // Daily at HH:MM
  if (minute !== '*' && hour !== '*' && !hour.includes('/') && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return `Diariamente as ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  }

  // Weekly
  const weekDays: Record<string, string> = {
    '0': 'Domingo', '1': 'Segunda', '2': 'Terca', '3': 'Quarta',
    '4': 'Quinta', '5': 'Sexta', '6': 'Sabado', '7': 'Domingo',
  };
  if (minute !== '*' && hour !== '*' && dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
    const days = dayOfWeek.split(',').map(d => weekDays[d] || d).join(', ');
    return `${days} as ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  }

  // Monthly
  if (minute !== '*' && hour !== '*' && dayOfMonth !== '*' && month === '*' && dayOfWeek === '*') {
    return `Dia ${dayOfMonth} de cada mes as ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  }

  return cron;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ScheduledSection({ entityId, fields }: ScheduledSectionProps) {
  const { data: allAutomations, isLoading } = useEntityAutomations(entityId);
  const updateMutation = useUpdateAutomation(entityId, {
    success: 'Automacao agendada atualizada',
    error: 'Erro ao atualizar automacao',
  });
  const deleteMutation = useDeleteAutomation(entityId, {
    success: 'Automacao agendada excluida',
    error: 'Erro ao excluir automacao',
  });

  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<EntityAutomation | undefined>(undefined);
  const [historyAutomation, setHistoryAutomation] = useState<EntityAutomation | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const scheduledAutomations = (allAutomations || []).filter(
    a => a.trigger === 'SCHEDULE'
  );

  const handleToggleActive = async (automation: EntityAutomation) => {
    await updateMutation.mutateAsync({
      id: automation.id,
      data: { isActive: !automation.isActive },
    });
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
      {scheduledAutomations.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed rounded-lg">
          <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground mb-3">
            Nenhuma automacao agendada configurada.
          </p>
          <Button variant="outline" size="sm" onClick={openCreateWizard}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Automacao Agendada
          </Button>
        </div>
      ) : (
        <>
          {scheduledAutomations.map(automation => {
            const cronExpr = String(automation.triggerConfig?.cron || '');
            const timezone = String(automation.triggerConfig?.timezone || 'UTC');
            return (
              <Card
                key={automation.id}
                className={`border-l-4 transition-opacity ${
                  automation.isActive ? 'border-l-blue-400' : 'border-l-muted opacity-60'
                }`}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <Clock className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{automation.name}</span>
                        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-xs">
                          Agendado
                        </Badge>
                      </div>
                      {automation.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {automation.description}
                        </p>
                      )}
                      <div className="mt-2 p-2 bg-muted/50 rounded text-xs space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Cron:</span>
                          <code className="bg-background px-1.5 py-0.5 rounded text-xs">
                            {cronExpr || '-'}
                          </code>
                          <span className="text-muted-foreground">
                            ({cronToHumanReadable(cronExpr)})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Fuso:</span>
                          <span>{timezone}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div>
                            <span className="font-medium">Ultima exec.:</span>{' '}
                            <span>{formatDate(automation.lastRunAt)}</span>
                          </div>
                          <div>
                            <span className="font-medium">Proxima exec.:</span>{' '}
                            <span>{formatDate(automation.nextRunAt)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span>{automation.actions?.length || 0} acao(oes)</span>
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
            Nova Automacao Agendada
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
        defaultTriggerType="SCHEDULE"
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
            <DialogTitle>Excluir Automacao Agendada</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir esta automacao agendada? Esta acao nao pode ser desfeita.
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

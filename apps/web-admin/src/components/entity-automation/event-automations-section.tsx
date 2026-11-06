'use client';

import { useState } from 'react';
import {
  Plus, Pencil, Trash2, Loader2, Zap, Play, History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { AutomationRecipes } from './automation-recipes';
import { describeAutomation } from '@/lib/automation-describe';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { ExecutionHistoryDialog } from './execution-history-dialog';

import type { EntityField } from '@/types';

interface EventAutomationsSectionProps {
  entityId: string;
  fields: EntityField[];
  entityName?: string;
  statusField?: string;
  titleField?: string;
}

const EVENT_TRIGGERS: AutomationTrigger[] = [
  'ON_CREATE', 'ON_UPDATE', 'ON_FIELD_CHANGE', 'ON_STATUS_CHANGE', 'ON_DELETE', 'MANUAL',
];

export function EventAutomationsSection({ entityId, fields, entityName = 'Registro', statusField, titleField }: EventAutomationsSectionProps) {
  const { data: allAutomations, isLoading } = useEntityAutomations(entityId);
  const [recipesOpen, setRecipesOpen] = useState(false);
  const { data: team } = useQuery({
    queryKey: ['team-directory'],
    queryFn: async () => (await api.get<Array<{ id: string; name: string }>>('/team-directory')).data,
    staleTime: 5 * 60_000,
  });
  const people = new Map((team || []).map((m) => [m.id, m.name]));
  const updateMutation = useUpdateAutomation(entityId, {
    success: 'Automação atualizada',
    error: 'Erro ao atualizar automação',
  });
  const deleteMutation = useDeleteAutomation(entityId, {
    success: 'Automação excluida',
    error: 'Erro ao excluir automação',
  });
  const executeMutation = useExecuteAutomation(entityId, {
    success: 'Automação executada',
    error: 'Erro ao executar automação',
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

  // "Nova automação" abre as receitas; "Montar do zero" (dentro delas) abre o assistente completo
  const openCreateWizard = () => setRecipesOpen(true);
  const openCustomWizard = () => {
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
          <Zap className="h-8 w-8 mx-auto mb-2 text-amber-500" />
          <p className="text-sm font-medium">Deixe o sistema trabalhar por você</p>
          <p className="mx-auto mb-4 mt-1 max-w-md text-sm text-muted-foreground">
            Ex.: avisar o gerente quando chegar uma OS nova, mandar e-mail ao cliente quando ela for concluída,
            preencher a data de conclusão sozinho.
          </p>
          <Button size="sm" onClick={openCreateWizard} data-testid="new-automation">
            <Plus className="h-4 w-4 mr-2" />
            Criar automação
          </Button>
        </div>
      ) : (
        <>
          {eventAutomations.map(automation => {
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
                      <span className="font-medium text-sm">{automation.name}</span>
                      {(() => {
                        const d = describeAutomation(automation, fields, entityName, people);
                        return (
                          <p className="mt-1 text-sm text-muted-foreground" data-testid="automation-sentence">
                            <span className="text-foreground">{d.when}</span>, {d.then}.
                          </p>
                        );
                      })()}
                      {automation.lastRunAt && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Funcionou pela última vez em {new Date(automation.lastRunAt).toLocaleString('pt-BR', {
                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">{automation.isActive ? 'Ligada' : 'Desligada'}</span>
                      <Switch
                        checked={automation.isActive}
                        onCheckedChange={() => handleToggleActive(automation)}
                        disabled={updateMutation.isPending}
                        aria-label={automation.isActive ? 'Desligar automação' : 'Ligar automação'}
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
                      Histórico
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
            Criar automação
          </Button>
        </>
      )}

      <AutomationRecipes
        open={recipesOpen}
        onOpenChange={setRecipesOpen}
        entityId={entityId}
        entityName={entityName}
        fields={fields}
        statusField={statusField}
        titleField={titleField}
        onCustom={openCustomWizard}
      />

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
              Tem certeza que deseja excluir esta automação? Esta ação não pode ser desfeita.
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

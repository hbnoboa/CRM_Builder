'use client';

import { useState } from 'react';
import {
  CheckCircle, XCircle, AlertTriangle, Loader2,
  ChevronDown, ChevronRight, Clock,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAutomationExecutions } from '@/hooks/use-entity-automations';
import type { AutomationExecution } from '@/services/entity-automation.service';

interface ExecutionHistoryDialogProps {
  entityId: string;
  automationId: string;
  automationName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig: Record<
  string,
  { icon: typeof CheckCircle; label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  completed: { icon: CheckCircle, label: 'Concluido', variant: 'default' },
  running: { icon: Loader2, label: 'Executando', variant: 'secondary' },
  failed: { icon: XCircle, label: 'Falhou', variant: 'destructive' },
  cancelled: { icon: AlertTriangle, label: 'Cancelado', variant: 'outline' },
};

const stepStatusConfig: Record<string, { icon: typeof CheckCircle; color: string }> = {
  success: { icon: CheckCircle, color: 'text-green-600' },
  error: { icon: XCircle, color: 'text-red-600' },
  skipped: { icon: AlertTriangle, color: 'text-yellow-600' },
};

function formatDuration(ms?: number): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function ExecutionHistoryDialog({
  entityId,
  automationId,
  automationName,
  open,
  onOpenChange,
}: ExecutionHistoryDialogProps) {
  const [expandedExecution, setExpandedExecution] = useState<string | null>(null);

  const { data, isLoading } = useAutomationExecutions(entityId, automationId, { limit: 50 });

  const executions: AutomationExecution[] = (() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.data && Array.isArray(data.data)) return data.data;
    return [];
  })();

  const toggleExecution = (id: string) => {
    setExpandedExecution(prev => (prev === id ? null : id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Historico de Execucoes - {automationName}</DialogTitle>
          <DialogDescription>
            Visualize o historico de execucoes desta automacao.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : executions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma execucao encontrada.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {executions.map(execution => {
                const status = statusConfig[execution.status] || statusConfig.failed;
                const StatusIcon = status.icon;
                const isExpanded = expandedExecution === execution.id;

                return (
                  <div key={execution.id} className="border rounded-lg overflow-hidden">
                    {/* Execution Header */}
                    <button
                      type="button"
                      className="flex items-center gap-3 w-full p-3 text-left hover:bg-muted/50 transition-colors"
                      onClick={() => toggleExecution(execution.id)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <Badge variant={status.variant} className="flex items-center gap-1 flex-shrink-0">
                        <StatusIcon
                          className={`h-3 w-3 ${execution.status === 'running' ? 'animate-spin' : ''}`}
                        />
                        {status.label}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground truncate">
                            por {execution.triggeredBy}
                          </span>
                          <span className="text-muted-foreground/40">|</span>
                          <span className="text-muted-foreground whitespace-nowrap">
                            {execution.currentStep}/{execution.totalSteps} passos
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
                        <span>{formatDuration(execution.duration)}</span>
                        <span className="text-muted-foreground/40">|</span>
                        <span>{formatDate(execution.startedAt)}</span>
                      </div>
                    </button>

                    {/* Execution Details (Expanded) */}
                    {isExpanded && (
                      <div className="border-t">
                        {execution.errorMessage && (
                          <div className="px-3 py-2 bg-destructive/10 text-destructive text-sm">
                            Erro: {execution.errorMessage}
                          </div>
                        )}

                        {execution.recordId && (
                          <div className="px-3 py-2 bg-muted/30 text-sm">
                            <span className="font-medium">Registro:</span>{' '}
                            <code className="text-xs bg-background px-1.5 py-0.5 rounded">
                              {execution.recordId}
                            </code>
                          </div>
                        )}

                        {execution.stepResults && execution.stepResults.length > 0 ? (
                          <div className="divide-y">
                            {execution.stepResults.map((result, rIdx) => {
                              const stepStatus = stepStatusConfig[result.status] || stepStatusConfig.error;
                              const StepStatusIcon = stepStatus.icon;

                              return (
                                <div key={rIdx} className="flex items-start gap-3 p-3 text-sm">
                                  <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                                    <span className="text-muted-foreground font-mono text-xs w-6 text-right">
                                      #{result.step}
                                    </span>
                                    <StepStatusIcon className={`h-4 w-4 ${stepStatus.color}`} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{result.type}</span>
                                      <Badge variant="outline" className="text-xs">
                                        {result.status}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">
                                        {formatDuration(result.duration)}
                                      </span>
                                    </div>
                                    {result.error && (
                                      <p className="text-destructive text-xs mt-1">{result.error}</p>
                                    )}
                                    {result.output && (
                                      <details className="mt-1">
                                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                          Ver saida
                                        </summary>
                                        <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto max-h-32">
                                          {typeof result.output === 'string'
                                            ? result.output
                                            : JSON.stringify(result.output, null, 2)}
                                        </pre>
                                      </details>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-3 text-sm text-muted-foreground text-center">
                            Nenhum resultado de passo disponivel.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

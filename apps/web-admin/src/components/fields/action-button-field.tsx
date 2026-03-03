'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface ActionButtonConfig {
  label: string;
  style?: 'primary' | 'secondary' | 'danger' | 'outline';
  confirmMessage?: string;
  action: {
    type: 'webhook' | 'status-change' | 'email' | 'action-chain';
    config: Record<string, unknown>;
  };
  visibleIf?: {
    field: string;
    operator: string;
    value: unknown;
  };
}

interface ActionButtonFieldProps {
  config: ActionButtonConfig;
  recordId?: string;
  recordData?: Record<string, unknown>;
  entitySlug?: string;
  disabled?: boolean;
  onSuccess?: () => void;
}

export function ActionButtonField({
  config,
  recordId,
  recordData,
  entitySlug,
  disabled,
  onSuccess,
}: ActionButtonFieldProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Verificar visibilidade condicional
  if (config.visibleIf && recordData) {
    const fieldValue = recordData[config.visibleIf.field];
    const conditionValue = config.visibleIf.value;

    let isVisible = false;
    switch (config.visibleIf.operator) {
      case 'equals':
        isVisible = fieldValue === conditionValue;
        break;
      case 'not_equals':
        isVisible = fieldValue !== conditionValue;
        break;
      case 'contains':
        isVisible = String(fieldValue || '').includes(String(conditionValue));
        break;
      case 'in':
        isVisible = Array.isArray(conditionValue) && conditionValue.includes(fieldValue);
        break;
      case 'is_empty':
        isVisible = fieldValue == null || fieldValue === '';
        break;
      case 'is_not_empty':
        isVisible = fieldValue != null && fieldValue !== '';
        break;
      default:
        isVisible = true;
    }

    if (!isVisible) {
      return null;
    }
  }

  const handleClick = () => {
    if (config.confirmMessage) {
      setShowConfirm(true);
    } else {
      executeAction();
    }
  };

  const executeAction = async () => {
    setIsLoading(true);
    setShowConfirm(false);

    try {
      const actionConfig = config.action.config;

      switch (config.action.type) {
        case 'webhook':
          await fetch(actionConfig.url as string, {
            method: (actionConfig.method as string) || 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...((actionConfig.headers as Record<string, string>) || {}),
            },
            body: JSON.stringify({
              recordId,
              entitySlug,
              data: recordData,
              ...((actionConfig.body as Record<string, unknown>) || {}),
            }),
          });
          break;

        case 'status-change':
          if (recordId && entitySlug) {
            await api.patch(`/entities/${entitySlug}/data/${recordId}`, {
              data: {
                [actionConfig.statusField as string]: actionConfig.newStatus,
              },
            });
          }
          break;

        case 'action-chain':
          if (actionConfig.actionChainId) {
            await api.post(`/action-chains/${actionConfig.actionChainId}/execute`, {
              recordId,
              inputData: recordData,
            });
          }
          break;

        case 'email':
          // Email seria enviado via backend
          if (actionConfig.templateId) {
            await api.post('/notifications/send-email', {
              templateId: actionConfig.templateId,
              recordId,
              entitySlug,
              data: recordData,
            });
          }
          break;
      }

      toast.success('Acao executada com sucesso');
      onSuccess?.();
    } catch (error) {
      const err = error as Error;
      toast.error(`Erro ao executar acao: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getButtonVariant = () => {
    switch (config.style) {
      case 'primary':
        return 'default';
      case 'secondary':
        return 'secondary';
      case 'danger':
        return 'destructive';
      case 'outline':
        return 'outline';
      default:
        return 'default';
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={getButtonVariant()}
        onClick={handleClick}
        disabled={disabled || isLoading || !recordId}
      >
        {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {config.label}
      </Button>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar acao</AlertDialogTitle>
            <AlertDialogDescription>
              {config.confirmMessage || 'Tem certeza que deseja executar esta acao?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeAction}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

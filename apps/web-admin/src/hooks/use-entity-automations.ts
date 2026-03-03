import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  entityAutomationService,
  CreateAutomationData,
  UpdateAutomationData,
  QueryAutomationsParams,
} from '@/services/entity-automation.service';
import { getErrorMessage } from '@/lib/get-error-message';

export const automationKeys = {
  all: ['entity-automations'] as const,
  lists: (entityId: string) => [...automationKeys.all, 'list', entityId] as const,
  list: (entityId: string, params?: QueryAutomationsParams) =>
    [...automationKeys.lists(entityId), params] as const,
  details: (entityId: string) =>
    [...automationKeys.all, 'detail', entityId] as const,
  detail: (entityId: string, id: string) =>
    [...automationKeys.details(entityId), id] as const,
  executions: (entityId: string, automationId: string) =>
    [...automationKeys.all, 'executions', entityId, automationId] as const,
};

interface MutationMessages {
  success?: string;
  error?: string;
}

export function useEntityAutomations(
  entityId: string,
  params?: QueryAutomationsParams,
) {
  return useQuery({
    queryKey: automationKeys.list(entityId, params),
    queryFn: () => entityAutomationService.getAll(entityId, params),
    enabled: !!entityId,
  });
}

export function useEntityAutomation(entityId: string, id: string) {
  return useQuery({
    queryKey: automationKeys.detail(entityId, id),
    queryFn: () => entityAutomationService.getById(entityId, id),
    enabled: !!entityId && !!id,
  });
}

export function useCreateAutomation(
  entityId: string,
  messages?: MutationMessages,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateAutomationData) =>
      entityAutomationService.create(entityId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: automationKeys.lists(entityId),
      });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, messages?.error));
    },
  });
}

export function useUpdateAutomation(
  entityId: string,
  messages?: MutationMessages,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAutomationData }) =>
      entityAutomationService.update(entityId, id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({
        queryKey: automationKeys.lists(entityId),
      });
      queryClient.invalidateQueries({
        queryKey: automationKeys.detail(entityId, id),
      });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, messages?.error));
    },
  });
}

export function useDeleteAutomation(
  entityId: string,
  messages?: MutationMessages,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      entityAutomationService.delete(entityId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: automationKeys.lists(entityId),
      });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, messages?.error));
    },
  });
}

export function useExecuteAutomation(
  entityId: string,
  messages?: MutationMessages,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data?: { recordId?: string; inputData?: Record<string, unknown> };
    }) => entityAutomationService.execute(entityId, id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({
        queryKey: automationKeys.executions(entityId, id),
      });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, messages?.error));
    },
  });
}

export function useAutomationExecutions(
  entityId: string,
  automationId: string,
  params?: { page?: number; limit?: number },
) {
  return useQuery({
    queryKey: [
      ...automationKeys.executions(entityId, automationId),
      params,
    ] as const,
    queryFn: () =>
      entityAutomationService.getExecutions(entityId, automationId, params),
    enabled: !!entityId && !!automationId,
  });
}

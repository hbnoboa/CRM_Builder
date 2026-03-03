import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  fieldRulesService,
  CreateFieldRuleData,
  UpdateFieldRuleData,
} from '@/services/field-rules.service';
import { getErrorMessage } from '@/lib/get-error-message';

export const fieldRuleKeys = {
  all: ['field-rules'] as const,
  lists: (entityId: string) => [...fieldRuleKeys.all, 'list', entityId] as const,
  list: (entityId: string) => [...fieldRuleKeys.lists(entityId)] as const,
};

interface MutationMessages {
  success?: string;
  error?: string;
}

export function useFieldRules(entityId: string) {
  return useQuery({
    queryKey: fieldRuleKeys.list(entityId),
    queryFn: () => fieldRulesService.getAll(entityId),
    enabled: !!entityId,
  });
}

export function useCreateFieldRule(
  entityId: string,
  messages?: MutationMessages,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateFieldRuleData) =>
      fieldRulesService.create(entityId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: fieldRuleKeys.lists(entityId),
      });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, messages?.error));
    },
  });
}

export function useUpdateFieldRule(
  entityId: string,
  messages?: MutationMessages,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFieldRuleData }) =>
      fieldRulesService.update(entityId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: fieldRuleKeys.lists(entityId),
      });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, messages?.error));
    },
  });
}

export function useDeleteFieldRule(
  entityId: string,
  messages?: MutationMessages,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => fieldRulesService.delete(entityId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: fieldRuleKeys.lists(entityId),
      });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, messages?.error));
    },
  });
}

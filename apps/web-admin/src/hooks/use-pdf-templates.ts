import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  pdfService,
  CreatePdfTemplateData,
  UpdatePdfTemplateData,
  QueryPdfTemplatesParams,
  GeneratePdfData,
  GenerateBatchPdfData,
} from '@/services/pdf.service';
import { getErrorMessage } from '@/lib/get-error-message';

export const pdfTemplateKeys = {
  all: ['pdf-templates'] as const,
  lists: () => [...pdfTemplateKeys.all, 'list'] as const,
  list: (params?: QueryPdfTemplatesParams) => [...pdfTemplateKeys.lists(), params] as const,
  details: () => [...pdfTemplateKeys.all, 'detail'] as const,
  detail: (id: string) => [...pdfTemplateKeys.details(), id] as const,
  bySlug: (slug: string) => [...pdfTemplateKeys.all, 'slug', slug] as const,
  byEntity: (entitySlug: string) => [...pdfTemplateKeys.all, 'entity', entitySlug] as const,
};

export const pdfGenerationKeys = {
  all: ['pdf-generations'] as const,
  lists: () => [...pdfGenerationKeys.all, 'list'] as const,
  list: (params?: { page?: number; limit?: number; status?: string }) => [...pdfGenerationKeys.lists(), params] as const,
  detail: (id: string) => [...pdfGenerationKeys.all, 'detail', id] as const,
};

// ============================================================================
// Template Hooks
// ============================================================================

export function usePdfTemplates(params?: QueryPdfTemplatesParams) {
  return useQuery({
    queryKey: pdfTemplateKeys.list(params),
    queryFn: () => pdfService.getTemplates(params),
  });
}

export function usePdfTemplate(id: string) {
  return useQuery({
    queryKey: pdfTemplateKeys.detail(id),
    queryFn: () => pdfService.getTemplateById(id),
    enabled: !!id,
  });
}

export function usePdfTemplateBySlug(slug: string) {
  return useQuery({
    queryKey: pdfTemplateKeys.bySlug(slug),
    queryFn: () => pdfService.getTemplateBySlug(slug),
    enabled: !!slug,
  });
}

export function usePdfTemplatesByEntity(entitySlug: string) {
  return useQuery({
    queryKey: pdfTemplateKeys.byEntity(entitySlug),
    queryFn: () => pdfService.getTemplatesByEntity(entitySlug),
    enabled: !!entitySlug,
  });
}

interface MutationMessages {
  success?: string;
  error?: string;
}

export function useCreatePdfTemplate(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePdfTemplateData) => pdfService.createTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pdfTemplateKeys.lists() });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, messages?.error));
    },
  });
}

export function useUpdatePdfTemplate(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePdfTemplateData }) =>
      pdfService.updateTemplate(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: pdfTemplateKeys.lists() });
      queryClient.invalidateQueries({ queryKey: pdfTemplateKeys.detail(id) });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, messages?.error));
    },
  });
}

export function usePublishPdfTemplate(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => pdfService.publishTemplate(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: pdfTemplateKeys.lists() });
      queryClient.invalidateQueries({ queryKey: pdfTemplateKeys.detail(id) });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, messages?.error));
    },
  });
}

export function useUnpublishPdfTemplate(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => pdfService.unpublishTemplate(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: pdfTemplateKeys.lists() });
      queryClient.invalidateQueries({ queryKey: pdfTemplateKeys.detail(id) });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, messages?.error));
    },
  });
}

export function useDuplicatePdfTemplate(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => pdfService.duplicateTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pdfTemplateKeys.lists() });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, messages?.error));
    },
  });
}

export function useDeletePdfTemplate(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => pdfService.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pdfTemplateKeys.lists() });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, messages?.error));
    },
  });
}

// ============================================================================
// Generation Hooks
// ============================================================================

export function usePdfGenerations(params?: { page?: number; limit?: number; status?: string }) {
  return useQuery({
    queryKey: pdfGenerationKeys.list(params),
    queryFn: () => pdfService.getGenerations(params),
  });
}

export function usePdfGenerationStatus(id: string, options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: pdfGenerationKeys.detail(id),
    queryFn: () => pdfService.getGenerationStatus(id),
    enabled: !!id,
    refetchInterval: options?.refetchInterval,
  });
}

export function useGeneratePdf(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: GeneratePdfData) => pdfService.generate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pdfGenerationKeys.lists() });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, messages?.error));
    },
  });
}

export function useGeneratePdfBatch(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: GenerateBatchPdfData) => pdfService.generateBatch(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pdfGenerationKeys.lists() });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, messages?.error));
    },
  });
}

export function useGeneratePdfSync(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: GeneratePdfData) => pdfService.generateSync(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pdfGenerationKeys.lists() });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, messages?.error));
    },
  });
}

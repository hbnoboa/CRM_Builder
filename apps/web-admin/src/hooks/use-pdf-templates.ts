'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  pdfTemplatesService,
  type PdfTemplate,
  type QueryPdfTemplateParams,
  type CreatePdfTemplateData,
  type UpdatePdfTemplateData,
} from '@/services/pdf-templates.service';

// ================= QUERY KEYS =================

export const pdfTemplateKeys = {
  all: ['pdfTemplates'] as const,
  lists: () => [...pdfTemplateKeys.all, 'list'] as const,
  list: (params?: QueryPdfTemplateParams) => [...pdfTemplateKeys.lists(), params] as const,
  details: () => [...pdfTemplateKeys.all, 'detail'] as const,
  detail: (id: string) => [...pdfTemplateKeys.details(), id] as const,
  generations: () => [...pdfTemplateKeys.all, 'generations'] as const,
  generation: (id: string) => [...pdfTemplateKeys.generations(), id] as const,
};

// ================= HOOKS =================

export function usePdfTemplates(params?: QueryPdfTemplateParams) {
  return useQuery({
    queryKey: pdfTemplateKeys.list(params),
    queryFn: () => pdfTemplatesService.getAll(params),
  });
}

export function usePdfTemplate(id: string | undefined) {
  return useQuery({
    queryKey: pdfTemplateKeys.detail(id || ''),
    queryFn: () => pdfTemplatesService.getById(id!),
    enabled: !!id,
  });
}

export function useCreatePdfTemplate(options?: { success?: string }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePdfTemplateData) => pdfTemplatesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pdfTemplateKeys.lists() });
      toast.success(options?.success || 'Template criado com sucesso!');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Erro ao criar template';
      toast.error(message);
    },
  });
}

export function useUpdatePdfTemplate(options?: { success?: string }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePdfTemplateData }) =>
      pdfTemplatesService.update(id, data),
    onSuccess: (updatedTemplate) => {
      queryClient.invalidateQueries({ queryKey: pdfTemplateKeys.lists() });
      queryClient.setQueryData(pdfTemplateKeys.detail(updatedTemplate.id), updatedTemplate);
      toast.success(options?.success || 'Template atualizado com sucesso!');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Erro ao atualizar template';
      toast.error(message);
    },
  });
}

export function useDeletePdfTemplate(options?: { success?: string }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => pdfTemplatesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pdfTemplateKeys.lists() });
      toast.success(options?.success || 'Template excluido com sucesso!');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Erro ao excluir template';
      toast.error(message);
    },
  });
}

export function useDuplicatePdfTemplate(options?: { success?: string }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => pdfTemplatesService.duplicate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pdfTemplateKeys.lists() });
      toast.success(options?.success || 'Template duplicado com sucesso!');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Erro ao duplicar template';
      toast.error(message);
    },
  });
}

export function usePublishPdfTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => pdfTemplatesService.publish(id),
    onSuccess: (updatedTemplate) => {
      queryClient.invalidateQueries({ queryKey: pdfTemplateKeys.lists() });
      queryClient.setQueryData(pdfTemplateKeys.detail(updatedTemplate.id), updatedTemplate);
      toast.success('Template publicado com sucesso!');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Erro ao publicar template';
      toast.error(message);
    },
  });
}

export function useUnpublishPdfTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => pdfTemplatesService.unpublish(id),
    onSuccess: (updatedTemplate) => {
      queryClient.invalidateQueries({ queryKey: pdfTemplateKeys.lists() });
      queryClient.setQueryData(pdfTemplateKeys.detail(updatedTemplate.id), updatedTemplate);
      toast.success('Template despublicado com sucesso!');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Erro ao despublicar template';
      toast.error(message);
    },
  });
}

// ================= GENERATION HOOKS =================

export function useGeneratePdf() {
  return useMutation({
    mutationFn: ({
      templateId,
      recordId,
      overrideData,
    }: {
      templateId: string;
      recordId: string;
      overrideData?: Record<string, unknown>;
    }) => pdfTemplatesService.generateSingle(templateId, recordId, overrideData),
    onSuccess: (blob) => {
      // Baixar o PDF automaticamente
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'relatorio.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('PDF gerado com sucesso!');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Erro ao gerar PDF';
      toast.error(message);
    },
  });
}

export function useGenerateBatchPdf() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      templateId,
      recordIds,
      mergePdfs,
    }: {
      templateId: string;
      recordIds: string[];
      mergePdfs?: boolean;
    }) => pdfTemplatesService.generateBatch(templateId, recordIds, mergePdfs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pdfTemplateKeys.generations() });
      toast.success('Geracao em lote iniciada! Voce sera notificado quando concluir.');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Erro ao iniciar geracao em lote';
      toast.error(message);
    },
  });
}

export function usePreviewPdf() {
  return useMutation({
    mutationFn: ({
      templateId,
      sampleData,
      recordId,
    }: {
      templateId: string;
      sampleData?: Record<string, unknown>;
      recordId?: string;
    }) => pdfTemplatesService.preview(templateId, sampleData, recordId),
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Erro ao gerar preview';
      toast.error(message);
    },
  });
}

export function usePdfGenerations(params?: {
  templateId?: string;
  status?: string;
  limit?: number;
  cursor?: string;
}) {
  return useQuery({
    queryKey: [...pdfTemplateKeys.generations(), params],
    queryFn: () => pdfTemplatesService.getGenerations(params),
  });
}

export function usePdfGeneration(id: string | undefined) {
  return useQuery({
    queryKey: pdfTemplateKeys.generation(id || ''),
    queryFn: () => pdfTemplatesService.getGeneration(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      // Refetch a cada 3s se ainda estiver processando
      const data = query.state.data;
      if (data?.status === 'PENDING' || data?.status === 'PROCESSING') {
        return 3000;
      }
      return false;
    },
  });
}

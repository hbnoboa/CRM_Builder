import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/get-error-message';
import type { SiteFooterStyle, SiteHeader, SiteLayout, SitePageData } from '@/lib/site-api';

export type SiteBlockDraft = { id?: string; type: string; [key: string]: unknown };

export interface SitePage {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  blocks: SiteBlockDraft[];
  layout: SiteLayout;
  /** Aparencia (estilo, fundo, cor, capa, frase). */
  settings?: Record<string, unknown>;
  isPublished: boolean;
  updatedAt: string;
  url: string;
}

export interface SitePageListItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  isPublished: boolean;
  updatedAt: string;
  url: string;
  kinds: Array<'form' | 'tracking'>;
}

const keys = {
  all: ['site-pages'] as const,
  detail: (id: string) => ['site-pages', id] as const,
};

export function useSitePages() {
  return useQuery({ queryKey: keys.all, queryFn: async () => (await api.get<SitePageListItem[]>('/site-pages')).data });
}

export function useSitePage(id: string | undefined) {
  return useQuery({
    queryKey: keys.detail(id || ''),
    queryFn: async () => (await api.get<SitePage>(`/site-pages/${id}`)).data,
    enabled: !!id,
  });
}

export function useCreateSitePage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { title: string; template: 'form' | 'tracking' | 'blank'; entitySlug?: string }) =>
      (await api.post<SitePage>('/site-pages', body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
    onError: (e) => toast.error(getErrorMessage(e, 'Não foi possível criar a página.')),
  });
}

export function useUpdateSitePage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Pick<SitePage, 'title' | 'slug' | 'description' | 'blocks' | 'layout' | 'settings'>>) =>
      (await api.patch<SitePage>(`/site-pages/${id}`, body)).data,
    onSuccess: (page) => {
      qc.setQueryData(keys.detail(id), page);
      qc.invalidateQueries({ queryKey: keys.all });
    },
  });
}

export function usePublishSitePage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (publish: boolean) => (await api.post<SitePage>(`/site-pages/${id}/publish`, { publish })).data,
    onSuccess: (page) => {
      qc.setQueryData(keys.detail(id), page);
      qc.invalidateQueries({ queryKey: keys.all });
      toast.success(page.isPublished ? 'Página publicada!' : 'Página tirada do ar.');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Não foi possível publicar.')),
  });
}

export function useDeleteSitePage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/site-pages/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all });
      toast.success('Página excluída.');
    },
  });
}

export async function previewSitePage(blocks: SiteBlockDraft[], title: string, settings?: Record<string, unknown>, slug?: string, site?: SiteConfigDraft, layout?: SiteLayout) {
  return (await api.post<SitePageData | { error: string }>('/site-pages/preview', { blocks, title, settings, slug, site, ...(layout ? { layout } : {}) })).data;
}

/** Link de acompanhamento de um registro (cria se ainda nao existir). */
export async function fetchTrackingLink(entitySlug: string, recordId: string) {
  return (await api.post<{ url: string; pageTitle: string }>('/record-tracking/link', { entitySlug, recordId })).data;
}

// ── Site: aparencia, menu, rodape e pagina inicial ─────────────────────────

export interface SiteConfigDraft {
  look: Record<string, unknown>;
  menu: Array<{ slug: string; label?: string }>;
  footer: Record<string, string | undefined>;
  homeSlug?: string;
  savedThemes?: Array<{ name: string; look: Record<string, unknown> }>;
  header?: SiteHeader;
  footerStyle?: SiteFooterStyle;
  /** Link "Area da equipe" no rodape. */
  teamLink?: boolean;
}
export interface SiteInfo {
  config: SiteConfigDraft;
  pages: Array<{ slug: string; title: string; isPublished: boolean; tracking: boolean }>;
}

export function useSiteConfig() {
  return useQuery({ queryKey: ['site-config'], queryFn: async () => (await api.get<SiteInfo>('/site-pages/site')).data });
}

export function useUpdateSiteConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: SiteConfigDraft) => (await api.put<SiteInfo>('/site-pages/site', body)).data,
    onSuccess: (data) => qc.setQueryData(['site-config'], data),
  });
}

'use client';

import { absoluteSiteUrl } from '@/lib/site-api';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Copy, ExternalLink, Loader2, MessageCircle, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/get-error-message';
import { fetchTrackingLink } from '@/hooks/use-site-pages';

/**
 * "Link de acompanhamento" no registro: so aparece se a tabela tiver pagina de
 * acompanhamento publicada. Gera (ou reaproveita) o link secreto para mandar ao cliente.
 */
export function TrackingLinkButton({ entitySlug, entityName, recordId }: { entitySlug: string; entityName: string; recordId: string }) {
  const { data } = useQuery({
    queryKey: ['record-tracking', 'available', entitySlug],
    queryFn: async () => (await api.get<{ available: boolean }>('/record-tracking/available', { params: { entitySlug } })).data,
    staleTime: 60_000,
    retry: false,
  });
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  if (!data?.available) return null;

  const load = async (open: boolean) => {
    if (!open || url) return;
    setLoading(true);
    try {
      const res = await fetchTrackingLink(entitySlug, recordId);
      setUrl(absoluteSiteUrl(res.url));
    } catch (error) {
      toast.error(getErrorMessage(error, 'Não foi possível gerar o link.'));
    } finally {
      setLoading(false);
    }
  };
  const message = url ? `Acompanhe seu ${entityName.toLowerCase()} por este link: ${url}` : '';

  return (
    <Popover onOpenChange={(open) => void load(open)}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0" data-testid="tracking-link-button">
          <Share2 className="mr-1.5 h-3.5 w-3.5" /> Link de acompanhamento
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <p className="text-sm font-medium">Mande para o cliente acompanhar</p>
        <p className="text-xs text-muted-foreground">Quem tem o link vê só o que a página de acompanhamento mostra, sem login.</p>
        {loading || !url ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <>
            <p className="break-all rounded-md border bg-muted/40 px-2 py-1.5 text-xs" data-testid="tracking-link-url">{url}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => { void navigator.clipboard?.writeText(url); toast.success('Link copiado!'); }}><Copy className="mr-1.5 h-3.5 w-3.5" />Copiar</Button>
              <Button size="sm" variant="outline" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')}>
                <MessageCircle className="mr-1.5 h-3.5 w-3.5" />WhatsApp
              </Button>
              <Button size="sm" variant="ghost" onClick={() => window.open(url, '_blank')}><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Abrir</Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

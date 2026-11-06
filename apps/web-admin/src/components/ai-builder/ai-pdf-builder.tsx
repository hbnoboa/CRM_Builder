'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/tenant-navigation';
import { Label } from '@/components/ui/label';
import { useEntities } from '@/hooks/use-entities';
import { pdfTemplateKeys } from '@/hooks/use-pdf-templates';
import { useAiApplyTo, type AiPdfResult } from '@/hooks/use-ai-builder';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/get-error-message';
import { AiApplyBar, AiChatPanel, AiEmptyPreview, AiWarnings, useAiConversation } from './ai-chat-panel';

const EXAMPLES = [
  'Uma ordem de serviço para entregar ao cliente, com os itens, o valor total e a assinatura no fim.',
  'Um laudo com os dados principais, as fotos em grade e o parecer.',
  'Um recibo simples com o valor, a data e uma declaração de recebimento.',
  'Uma ficha completa do registro, organizada por assunto.',
];

/**
 * "Criar PDF com IA": escolhe a tabela, conversa, ve o PDF de verdade (dados de
 * exemplo) e cria o modelo, que abre no editor para os ultimos ajustes.
 */
export function AiPdfBuilder() {
  const router = useRouter();
  const { data: entitiesPage } = useEntities({ limit: 200 });
  const entities = (entitiesPage?.data || []) as Array<{ id: string; slug: string; name: string; namePlural?: string }>;
  const [table, setTable] = useState('');
  const extra = useMemo(() => ({ table }), [table]);
  const chat = useAiConversation<AiPdfResult>('/ai-builder/pdfs/propose', extra);
  const apply = useAiApplyTo('/ai-builder/pdfs/apply', pdfTemplateKeys.all);
  const { result } = chat;
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  // A cada proposta nova, gera o PDF de verdade com dados de exemplo
  useEffect(() => {
    if (!result) return;
    let url: string | null = null;
    let cancelled = false;
    setRendering(true);
    api
      .post('/ai-builder/pdfs/preview', { proposal: result.proposal }, { responseType: 'blob', timeout: 60_000 })
      .then(({ data }) => {
        if (cancelled) return;
        url = URL.createObjectURL(data as Blob);
        setPdfUrl(url);
      })
      .catch((error) => !cancelled && toast.error(getErrorMessage(error, 'Não foi possível gerar a prévia do PDF.')))
      .finally(() => !cancelled && setRendering(false));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [result]);

  const pickTable = (slug: string) => {
    setTable(slug);
    chat.reset();
    setPdfUrl(null);
  };

  const create = async () => {
    if (!result) return;
    try {
      const res = await apply.mutateAsync(result.proposal);
      toast.success('Modelo de PDF criado! Revise e publique no editor.');
      router.push(`/gestao/pdf-templates/${res.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Não foi possível criar o modelo.'));
    }
  };

  const picker = (
    <div className="space-y-1.5">
      <Label htmlFor="ai-pdf-table">De qual tabela vêm os dados?</Label>
      <select
        id="ai-pdf-table"
        value={table}
        onChange={(e) => pickTable(e.target.value)}
        className="h-9 w-full rounded-md border bg-background px-3 text-sm"
        data-testid="ai-pdf-table"
      >
        <option value="">Escolha a tabela…</option>
        {entities.map((e) => <option key={e.id} value={e.slug}>{e.namePlural || e.name}</option>)}
      </select>
      <p className="text-[11px] text-muted-foreground">Cada PDF é de um registro dessa tabela (uma OS, um laudo, um recibo).</p>
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]" data-testid="ai-builder">
      <AiChatPanel
        messages={chat.messages}
        pending={chat.pending}
        hasResult={!!result}
        onSend={chat.send}
        header={picker}
        disabled={!table}
        subtitle="Escolha a tabela e conte como quer o documento. Nada é criado até você confirmar."
        examples={EXAMPLES}
        placeholder={table ? 'Ex.: uma OS com os itens, o total e a assinatura do cliente' : 'Escolha a tabela acima primeiro'}
        changePlaceholder='Peça uma mudança: "tire as fotos", "coloque o CPF do cliente no topo"…'
      />

      <div className="space-y-3" data-testid="ai-proposal">
        {!result ? (
          <AiEmptyPreview icon={<FileText className="h-8 w-8" />} text="O PDF aparece aqui, com dados de exemplo, para você revisar." />
        ) : (
          <>
            <AiWarnings warnings={result.warnings} />
            <div className="relative overflow-hidden rounded-xl border bg-muted/30">
              {rendering && (
                <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-background/70 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Gerando o PDF…
                </div>
              )}
              {pdfUrl ? (
                <iframe src={pdfUrl} title="Prévia do PDF" className="h-[75vh] w-full" data-testid="ai-pdf-preview" />
              ) : (
                <div className="h-[75vh]" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">Prévia com dados de exemplo. No dia a dia, o PDF sai com os dados do registro.</p>
            <AiApplyBar label="Criar o modelo de PDF" onApply={() => void create()} applying={apply.isPending} disabled={chat.pending} />
          </>
        )}
      </div>
    </div>
  );
}

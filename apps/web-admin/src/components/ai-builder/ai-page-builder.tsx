'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LayoutTemplate, Loader2, Monitor, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/tenant-navigation';
import { Button } from '@/components/ui/button';
import { SitePageView } from '@/components/site/site-page-view';
import { previewSitePage, useSiteConfig, type SiteBlockDraft, type SiteConfigDraft } from '@/hooks/use-site-pages';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/get-error-message';
import { cn } from '@/lib/utils';
import type { SiteFooterStyle, SiteHeader, SiteLayout, SitePageData } from '@/lib/site-api';
import { AiApplyBar, AiBuilderLayout, AiChatPanel, AiEmptyPreview, AiWarnings, useAiConversation } from './ai-chat-panel';

export interface AiPageResult {
  reply: string;
  warnings: string[];
  proposal: Record<string, unknown>;
  images: string[];
  page: { title: string; blocks: SiteBlockDraft[]; layout: SiteLayout; settings: Record<string, unknown> };
  header: SiteHeader | null;
  footerStyle: SiteFooterStyle | null;
}

const withoutOwnLook = (settings: Record<string, unknown>) => {
  const look = { ...settings };
  delete look.ownLook;
  return look;
};

const EXAMPLES = [
  'Um site para a minha confeitaria: bolos sob encomenda, fotos, depoimentos e um botão para pedir pelo WhatsApp.',
  'Página de uma clínica de fisioterapia, séria e acolhedora, com serviços, equipe e contato com mapa.',
  'Site de uma oficina mecânica com os serviços, números de clientes atendidos e perguntas frequentes.',
  'Copie o estilo da imagem que vou enviar, mas com o conteúdo da minha empresa.',
];

interface Props {
  /** create: cria a pagina nova; edit: devolve a proposta para o editor (onApply). */
  mode?: 'create' | 'edit';
  /** Mensagem enviada sozinha ao abrir (ex.: o que a pessoa contou no inicio). */
  autoStart?: string;
  /** Pagina atual (modo edit), no formato da IA, para ela partir do que existe. */
  current?: Record<string, unknown>;
  onCreated?: (pageId: string) => void;
  onApply?: (result: AiPageResult) => void;
  /** Sugestoes clicaveis no lugar dos exemplos (ex.: montar com o que a pessoa ja contou). */
  suggestions?: string[];
}

/**
 * "Criar pagina com IA": a pessoa conta o negocio e pode enviar imagens de modelo
 * (ou fotos da empresa); a IA monta a pagina inteira (secoes, elementos, tema, topo,
 * rodape). A previa e a pagina de verdade, no computador ou no celular.
 */
export function AiPageBuilder({ mode = 'create', autoStart, current, onCreated, onApply, suggestions }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: siteInfo } = useSiteConfig();
  const [extra, setExtra] = useState<Record<string, unknown> | undefined>(current ? { currentProposal: current } : undefined);
  const chat = useAiConversation<AiPageResult>('/ai-builder/pages/propose', extra, { multipart: true });
  const { result } = chat;
  const [creating, setCreating] = useState(false);
  const started = useRef(false);

  // A pagina atual so vale ate a primeira resposta (depois a IA parte da propria proposta)
  useEffect(() => { if (result) setExtra(undefined); }, [result]);
  useEffect(() => {
    if (!autoStart || started.current) return;
    started.current = true;
    void chat.send(autoStart);
  }, [autoStart, chat]);

  const firstPage = (siteInfo?.pages.length ?? 0) === 0;

  const create = async () => {
    if (!result || !siteInfo) return;
    setCreating(true);
    try {
      const { page, header, footerStyle } = result;
      const look = withoutOwnLook(page.settings);
      const created = (await api.post<{ id: string }>('/site-pages', { title: page.title, template: 'blank' })).data;
      if (firstPage) {
        // Primeira pagina: o visual vira o do site todo (topo e rodape tambem)
        const site: SiteConfigDraft = { ...siteInfo.config, look, ...(header ? { header } : {}), ...(footerStyle ? { footerStyle } : {}) };
        await api.put('/site-pages/site', site);
        await api.patch(`/site-pages/${created.id}`, { blocks: page.blocks, layout: page.layout, settings: {} });
      } else {
        await api.patch(`/site-pages/${created.id}`, { blocks: page.blocks, layout: page.layout, settings: { ...look, ownLook: true } });
      }
      await Promise.all([qc.invalidateQueries({ queryKey: ['site-pages'] }), qc.invalidateQueries({ queryKey: ['site-config'] })]);
      toast.success('Página criada! Troque as fotos e os contatos no editor.');
      if (onCreated) onCreated(created.id);
      else router.push(`/gestao/pages/${created.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Não foi possível criar a página.'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div data-testid="ai-page-builder">
      <AiBuilderLayout
        hasResult={!!result}
        reply={result?.reply}
        wide
        chat={(
          <AiChatPanel
            messages={chat.messages}
            pending={chat.pending}
            hasResult={!!result}
            onSend={chat.send}
            allowImages
            subtitle={mode === 'edit' ? 'Peça mudanças na página ou envie uma imagem de modelo.' : 'Conte o seu negócio e, se quiser, envie uma imagem de modelo.'}
            examples={suggestions ?? (mode === 'edit' ? ['Deixe a página mais elegante, com cores mais sóbrias.', 'Acrescente depoimentos e perguntas frequentes antes do contato.', 'Copie o estilo da imagem que vou enviar.'] : EXAMPLES)}
            placeholder="Ex.: site da minha pizzaria, alegre, com cardápio e botão de pedir pelo WhatsApp"
            changePlaceholder='Peça uma mudança: "troque as cores por verde", "tire os preços"… ou envie outra imagem'
            privacyNote="A IA vê o que você escreve, as imagens enviadas e os nomes das tabelas, nunca os seus registros."
          />
        )}
        preview={(
          <div className="space-y-3" data-testid="ai-proposal">
            {!result ? (
              <AiEmptyPreview icon={<LayoutTemplate className="h-8 w-8" />} text="A página aparece aqui, do jeito que o cliente vai ver. Nada é criado antes de você confirmar." />
            ) : (
              <>
                <AiWarnings warnings={result.warnings} />
                <PagePreview result={result} footer={siteInfo?.config.footer ?? {}} />
                {mode === 'edit' ? (
                  <AiApplyBar label="Usar esta página no editor" onApply={() => onApply?.(result)} applying={false} disabled={chat.pending} />
                ) : (
                  <AiApplyBar label={firstPage ? 'Criar a página e o visual do site' : 'Criar a página'} onApply={() => void create()} applying={creating} disabled={chat.pending || !siteInfo} />
                )}
              </>
            )}
          </div>
        )}
      />
    </div>
  );
}

/** A pagina proposta, montada pelo servidor (mesma previa do editor), em escala. */
function PagePreview({ result, footer }: { result: AiPageResult; footer: Record<string, string | undefined> }) {
  const [data, setData] = useState<SitePageData | null>(null);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  useEffect(() => {
    const { page } = result;
    const look = withoutOwnLook(page.settings);
    const site: SiteConfigDraft = { look, menu: [], footer, ...(result.header ? { header: result.header } : {}), ...(result.footerStyle ? { footerStyle: result.footerStyle } : {}) };
    let alive = true;
    previewSitePage(page.blocks, page.title, {}, undefined, site, page.layout)
      .then((res) => { if (alive && !('error' in res)) setData({ ...res, layout: page.layout }); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [result, footer]);

  const width = device === 'desktop' ? 1200 : 390;
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const b = box.current;
    const i = inner.current;
    if (!b || !i) return;
    const ro = new ResizeObserver(() => { setScale(Math.min(1, b.clientWidth / width)); setHeight(i.offsetHeight); });
    ro.observe(b);
    ro.observe(i);
    return () => ro.disconnect();
  }, [width, data]);

  const frame = useMemo(() => data, [data]);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="flex-1 truncate text-sm font-semibold" data-testid="ai-page-title">{result.page.title}</p>
        <div className="flex rounded-md border p-0.5">
          {([['desktop', Monitor, 'Computador'], ['mobile', Smartphone, 'Celular']] as const).map(([v, Icon, label]) => (
            <Button key={v} size="sm" variant={device === v ? 'secondary' : 'ghost'} className="h-7" onClick={() => setDevice(v)}>
              <Icon className="mr-1 h-3.5 w-3.5" />{label}
            </Button>
          ))}
        </div>
      </div>
      <div ref={box} className="overflow-hidden rounded-xl border bg-muted/30 p-2" data-testid="ai-page-preview">
        {!frame ? (
          <div className="flex h-60 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="mx-auto" style={{ width: width * scale, height: height ? height * scale : undefined }}>
            <div ref={inner} className={cn('origin-top-left overflow-hidden bg-white shadow-md', device === 'mobile' && 'rounded-[1.5rem] border-4 border-slate-800')}
              style={{ width, transform: scale < 1 ? `scale(${scale})` : undefined }}
              onClickCapture={(e) => { if ((e.target as HTMLElement).closest('a')) e.preventDefault(); }}>
              <SitePageView data={frame} tenantSlug="" pageSlug="" preview />
            </div>
          </div>
        )}
      </div>
      {result.images.length > 0 && (
        <p className="text-[11px] text-muted-foreground">As imagens enviadas ficaram guardadas: dá para usar nas fotos da página, no editor.</p>
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Database, GraduationCap, RotateCcw, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/tenant-navigation';
import { Button } from '@/components/ui/button';
import { HelpButton } from '@/components/help/help-button';
import { GuidedTour, type TourStep } from '@/components/help/guided-tour';
import { getErrorMessage } from '@/lib/get-error-message';
import { useEntities } from '@/hooks/use-entities';
import { previewAiTables, useAiApply, type AiProposalDraft, type AiProposeResult } from '@/hooks/use-ai-builder';
import { AiApplyBar, AiBuilderLayout, AiChatPanel, AiEmptyPreview, AiWarnings, isNarrowScreen, useAiConversation } from './ai-chat-panel';
import { EditableTableCard } from './editable-table-card';
import { SAMPLE_PROPOSAL } from './ai-sample';

const EXAMPLES = [
  'Tenho uma oficina mecânica: quero controlar clientes, carros e ordens de serviço com as peças usadas.',
  'Quero acompanhar os sinistros dos meus segurados, com fotos, documentos, prazo e o regulador responsável.',
  'Faço visitas técnicas: preciso de checklist, fotos e assinatura do cliente no fim.',
  'Funil de vendas com empresas, contatos e propostas com valor e etapa.',
];
const TOUR_KEY = 'tour:ai-assistant:v1';
const MAX_UNDO = 30;

interface AiTableBuilderProps {
  /** "Outras formas de começar" (tela Nova tabela). */
  onBack?: () => void;
  /** Abre o tutorial sozinho na primeira visita (tela principal da Administracao). */
  autoTour?: boolean;
}

/**
 * "Criar com IA": a pessoa descreve o negocio, a IA propoe as tabelas e a pessoa
 * ajusta direto na proposta (ou conversando). Nada e criado antes do botao.
 */
export function AiTableBuilder({ onBack, autoTour }: AiTableBuilderProps) {
  const router = useRouter();
  const apply = useAiApply();
  const chat = useAiConversation<AiProposeResult>('/ai-builder/propose');
  const { result, replaceResult } = chat;
  const { data: entitiesPage } = useEntities({ limit: 200 });
  const [history, setHistory] = useState<AiProposalDraft[]>([]);
  const [tourOpen, setTourOpen] = useState(false);
  const [forceTab, setForceTab] = useState<{ tab: 'chat' | 'preview'; n: number } | undefined>();
  const sampleByTour = useRef(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const draft = result?.proposal as AiProposalDraft | undefined;

  // Tabelas que ja existem (para ligar um campo a elas)
  const existingNames = useMemo(() => {
    const list = (entitiesPage?.data || []) as Array<{ slug: string; name: string; namePlural?: string }>;
    return Object.fromEntries(list.map((e) => [e.slug, e.namePlural || e.name]));
  }, [entitiesPage]);
  const names = useMemo(() => {
    const map: Record<string, string> = { ...existingNames, ...(result?.existingNames || {}) };
    for (const t of draft?.tables || []) map[t.key] = t.namePlural;
    return map;
  }, [existingNames, result?.existingNames, draft]);
  const previewByKey = useMemo(() => new Map((result?.tables || []).map((t) => [t.key, t])), [result?.tables]);

  /** Mexida a mao: atualiza na hora e confere no servidor (sem IA) logo depois. */
  const edit = useCallback((next: AiProposalDraft) => {
    if (draft) setHistory((h) => [...h.slice(-MAX_UNDO + 1), draft]);
    replaceResult((prev) => (prev ? { ...prev, proposal: next as unknown as Record<string, unknown> } : prev));
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => {
      previewAiTables(next)
        .then((p) => replaceResult((prev) => (prev ? { ...prev, tables: p.tables, warnings: p.warnings, existingNames: { ...prev.existingNames, ...p.existingNames } } : prev)))
        .catch(() => undefined);
    }, 400);
  }, [draft, replaceResult]);

  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    replaceResult((r) => (r ? { ...r, proposal: prev as unknown as Record<string, unknown> } : r));
    previewAiTables(prev).then((p) => replaceResult((r) => (r ? { ...r, tables: p.tables, warnings: p.warnings } : r))).catch(() => undefined);
  };

  const restart = useCallback(() => {
    chat.reset();
    setHistory([]);
    sampleByTour.current = false;
  }, [chat]);

  /** Exemplo do tutorial (conferido pelo servidor, sem IA). */
  const loadSample = useCallback(async () => {
    if (result) return;
    sampleByTour.current = true;
    const p = await previewAiTables(SAMPLE_PROPOSAL).catch(() => null);
    replaceResult({ reply: SAMPLE_PROPOSAL.reply, warnings: [], proposal: SAMPLE_PROPOSAL as unknown as Record<string, unknown>, tables: p?.tables || [], existingNames: p?.existingNames || {} });
  }, [result, replaceResult]);

  const closeTour = () => {
    setTourOpen(false);
    try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* sem armazenamento */ }
    // O exemplo era so para o tutorial: some, a pessoa comeca do zero
    if (sampleByTour.current) restart();
  };

  useEffect(() => {
    if (!autoTour) return;
    let seen = true;
    try { seen = localStorage.getItem(TOUR_KEY) === '1'; } catch { /* sem armazenamento */ }
    if (seen) return;
    const timer = setTimeout(() => setTourOpen(true), 800);
    return () => clearTimeout(timer);
  }, [autoTour]);

  const show = (tab: 'chat' | 'preview') => setForceTab((f) => ({ tab, n: (f?.n ?? 0) + 1 }));
  const steps: TourStep[] = [
    { title: 'Assistente de criação', text: 'Aqui você monta as tabelas da empresa (clientes, ordens de serviço, sinistros...) só contando como é o seu negócio. Nada é criado até você confirmar.' },
    { target: 'ai-chat-input', title: 'Conte o seu negócio', text: 'Escreva do seu jeito, como explicaria para um colega. A IA monta uma proposta em alguns segundos.', onEnter: () => show('chat') },
    { target: 'ai-examples', title: 'Ou comece por um exemplo', text: 'Toque num exemplo para ver o que a IA monta.', onEnter: () => show('chat') },
    { target: 'ai-proposal', title: 'A proposta aparece aqui', text: 'Vamos usar um exemplo para você ver como editar. É só um rascunho: nada é criado e não gasta a IA.', onEnter: async () => { await loadSample(); show('preview'); } },
    { target: 'ai-table-name', title: 'Renomeie a tabela', text: 'Clique no nome para trocar. Logo abaixo fica o nome de um registro (no singular) e se a tabela fica dentro de outra.', onEnter: () => show('preview') },
    { target: 'ai-field-name', title: 'Renomeie os campos', text: 'Clique no nome do campo e escreva o novo.', onEnter: () => show('preview') },
    { target: 'ai-field-type', title: 'Troque o tipo', text: 'Texto, data, lista de opções, foto, assinatura... O "?" ao lado mostra como o campo funciona de verdade.', onEnter: () => show('preview') },
    { target: 'ai-required', title: 'Obrigatório ou opcional', text: 'Clique para alternar. Campo obrigatório precisa ser preenchido para salvar.', onEnter: () => show('preview') },
    { target: 'ai-drag', title: 'Mude a ordem', text: 'Arraste pelo ⠿ ou use as setas ↑ ↓. A lixeira tira o campo.', onEnter: () => show('preview') },
    { target: 'ai-options', title: 'Opções das listas', text: 'Clique na bolinha para trocar a cor, no nome para renomear e em "+ opção" para acrescentar.', onEnter: () => show('preview') },
    { target: 'ai-add-field', title: 'Acrescente campos', text: 'Cria um campo novo no fim da lista; depois é só dar nome e tipo.', onEnter: () => show('preview') },
    { target: 'ai-settings', title: 'Ajustes da tabela', text: 'O que identifica cada registro, a situação, o prazo e o responsável. Com isso a tela inicial mostra pendências e prazos.', onEnter: () => show('preview') },
    { target: 'ai-show-form', title: 'Veja o formulário', text: 'Mostra como fica a tela de preencher, do jeito que a equipe vai ver.', onEnter: () => show('preview') },
    { target: 'ai-apply', title: 'Crie quando gostar', text: 'Só aqui as tabelas são criadas. Dá para mudar tudo depois, no editor de cada tabela.', onEnter: () => show('preview') },
    { target: 'ai-chat-input', title: 'Pedir por escrito também vale', text: 'Ex.: "junte nome e sobrenome", "coloque o CPF". A IA parte do que você já mexeu. Agora é com você!', onEnter: () => show('chat') },
  ];

  const create = async () => {
    if (!result || !draft) return;
    try {
      const res = await apply.mutateAsync(result.proposal);
      toast.success(res.tables.length === 1 ? 'Tabela criada!' : `${res.tables.length} tabelas criadas!`);
      // No celular o editor de tabela e so para computador: vai direto para os registros
      const root = res.tables.find((t) => t.id === res.rootId);
      if (isNarrowScreen() && root) router.push(`/data?entity=${root.slug}`);
      else if (res.rootId) router.push(`/gestao/entities/${res.rootId}`);
      else router.push('/gestao/entities');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Não foi possível criar as tabelas.'));
    }
  };

  const tables = draft?.tables || [];
  // O tutorial marca a primeira tabela que tem lista de opcoes (para mostrar as opcoes)
  const tourIndex = Math.max(0, tables.findIndex((x) => x.fields.some((f) => f.type === 'select' || f.type === 'multiselect')));
  return (
    <div className="space-y-4" data-testid="ai-builder">
      <div className="flex flex-wrap items-center gap-2">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Outras formas de começar
          </Button>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <HelpButton topic="ai.assistant" label="Como funciona" />
          <Button variant="ghost" size="sm" onClick={() => setTourOpen(true)} data-testid="ai-tour">
            <GraduationCap className="mr-1.5 h-4 w-4" /> Ver tutorial
          </Button>
          {result && (
            <Button variant="ghost" size="sm" onClick={restart}>
              <RotateCcw className="mr-1.5 h-4 w-4" /> Recomeçar
            </Button>
          )}
        </div>
      </div>

      <AiBuilderLayout
        hasResult={!!result}
        reply={result?.reply}
        forceTab={forceTab}
        chat={(
          <AiChatPanel
            messages={chat.messages}
            pending={chat.pending}
            hasResult={!!result}
            onSend={chat.send}
            subtitle="Conte o que você quer controlar. Nada é criado até você confirmar."
            examples={EXAMPLES}
            placeholder="Ex.: tenho uma clínica e quero controlar pacientes e consultas"
            changePlaceholder='Peça uma mudança: "tire o campo cor", "junte nome e sobrenome"…'
          />
        )}
        preview={(
          <div className="space-y-3" data-testid="ai-proposal" data-tour="ai-proposal">
            {!draft || tables.length === 0 ? (
              <AiEmptyPreview
                icon={<Database className="h-8 w-8" />}
                text={result ? 'Nenhuma tabela nova por enquanto. Veja a resposta do assistente.' : 'A proposta de tabelas aparece aqui. Você poderá editar tudo antes de criar.'}
              />
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  <span>Rascunho: clique para editar nomes, tipos e opções. Nada é criado ainda.</span>
                  <span className="flex items-center gap-1">
                    <HelpButton topic="ai.edit" />
                    <Button variant="ghost" size="sm" className="h-7" onClick={undo} disabled={history.length === 0} data-testid="ai-undo">
                      <Undo2 className="mr-1 h-3.5 w-3.5" /> Desfazer
                    </Button>
                  </span>
                </div>
                <AiWarnings warnings={result?.warnings || []} />
                {tables.map((t, i) => (
                  <EditableTableCard
                    key={t.key}
                    table={t}
                    tables={tables}
                    names={names}
                    existingNames={existingNames}
                    preview={previewByKey.get(t.key)}
                    tour={i === tourIndex}
                    onChange={(next) => edit({ ...draft, tables: tables.map((x) => (x.key === t.key ? next : x)) })}
                    onRemove={() => edit({ ...draft, tables: tables.filter((x) => x.key !== t.key).map((x) => (x.parentKey === t.key ? { ...x, parentKey: undefined } : x)) })}
                  />
                ))}
                <AiApplyBar
                  label={tables.length === 1 ? 'Criar a tabela' : `Criar as ${tables.length} tabelas`}
                  onApply={() => void create()}
                  applying={apply.isPending}
                  disabled={chat.pending}
                />
              </>
            )}
          </div>
        )}
      />
      <GuidedTour steps={steps} open={tourOpen} onClose={closeTour} />
    </div>
  );
}

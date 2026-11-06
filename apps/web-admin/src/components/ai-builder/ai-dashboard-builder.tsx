'use client';

import { useMemo } from 'react';
import { BarChart3, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/tenant-navigation';
import { Card, CardContent } from '@/components/ui/card';
import { EntityDashboard } from '@/components/dashboard-widgets/entity-dashboard';
import { useEntities } from '@/hooks/use-entities';
import { dashboardTemplateKeys } from '@/hooks/use-dashboard-templates';
import { useAiApplyTo, type AiDashboardResult } from '@/hooks/use-ai-builder';
import { getErrorMessage } from '@/lib/get-error-message';
import type { EntityField } from '@/types';
import { AiApplyBar, AiChatPanel, AiEmptyPreview, AiWarnings, useAiConversation } from './ai-chat-panel';

const EXAMPLES = [
  'Quero ver quantos registros tenho por situação e o que está com prazo vencendo.',
  'Um painel para o gerente: números do mês, gráfico por dia e as pendências de cada responsável.',
  'Um quadro para a equipe acompanhar o trabalho por etapa.',
  'Valores somados (estimado e pago) e a lista dos maiores.',
];

/**
 * "Criar painel com IA": a previa mostra os blocos de verdade, com os dados da
 * empresa (carregados aqui, na tela de quem pediu; a IA nao ve nada disso).
 */
export function AiDashboardBuilder() {
  const router = useRouter();
  const chat = useAiConversation<AiDashboardResult>('/ai-builder/dashboards/propose');
  const apply = useAiApplyTo('/ai-builder/dashboards/apply', dashboardTemplateKeys.all);
  const { data: entitiesPage } = useEntities({ limit: 200 });
  const { result } = chat;

  const entityFields = useMemo(() => {
    const list = (entitiesPage?.data || []) as Array<{ slug: string; fields?: EntityField[] }>;
    return list.find((e) => e.slug === result?.dashboard.entitySlug)?.fields || [];
  }, [entitiesPage, result?.dashboard.entitySlug]);

  const create = async () => {
    if (!result) return;
    try {
      const res = await apply.mutateAsync(result.proposal);
      toast.success('Painel criado!');
      router.push(`/gestao/dashboard-templates/${res.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Não foi possível criar o painel.'));
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,5fr)]" data-testid="ai-builder">
      <AiChatPanel
        messages={chat.messages}
        pending={chat.pending}
        hasResult={!!result}
        onSend={chat.send}
        subtitle="Conte o que você quer acompanhar. Nada é criado até você confirmar."
        examples={EXAMPLES}
        placeholder="Ex.: quero ver os sinistros por situação e os prazos da semana"
        changePlaceholder='Peça uma mudança: "troque a pizza por barras", "tire a lista"…'
      />

      <div className="space-y-3" data-testid="ai-proposal">
        {!result ? (
          <AiEmptyPreview icon={<BarChart3 className="h-8 w-8" />} text="O painel aparece aqui, já com os seus dados, para você revisar." />
        ) : (
          <>
            <AiWarnings warnings={result.warnings} />
            <Card>
              <CardContent className="space-y-1 p-4">
                <p className="font-semibold" data-testid="ai-dashboard-name">{result.dashboard.name}</p>
                {result.dashboard.description && <p className="text-xs text-muted-foreground">{result.dashboard.description}</p>}
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" /> Quem vê: {result.roleNames.length ? result.roleNames.join(', ') : 'todos os cargos'}
                </p>
              </CardContent>
            </Card>
            <div className="rounded-xl border bg-muted/20 p-3">
              <EntityDashboard
                // Remonta a cada proposta (abas e blocos mudam)
                key={JSON.stringify(result.dashboard.layout)}
                entitySlug={result.dashboard.entitySlug}
                entityFields={entityFields}
                previewTemplate={result.dashboard}
              />
            </div>
            <AiApplyBar label="Criar o painel" onApply={() => void create()} applying={apply.isPending} disabled={chat.pending} />
          </>
        )}
      </div>
    </div>
  );
}

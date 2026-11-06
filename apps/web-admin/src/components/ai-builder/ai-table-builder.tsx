'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, Database, Eye, EyeOff, Link2, ListTree, icons, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { Entity } from '@crm-builder/shared';
import { useRouter } from '@/i18n/tenant-navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { OptionBadge } from '@/components/ui/option-badge';
import { RecordFormFields } from '@/components/data/record-form-dialog';
import { fieldKind } from '@/lib/field-catalog';
import { getErrorMessage } from '@/lib/get-error-message';
import { useAiApply, type AiPreviewTable, type AiProposeResult } from '@/hooks/use-ai-builder';
import { AiApplyBar, AiBuilderLayout, AiChatPanel, AiEmptyPreview, AiWarnings, isNarrowScreen, useAiConversation } from './ai-chat-panel';

const EXAMPLES = [
  'Tenho uma oficina mecânica: quero controlar clientes, carros e ordens de serviço com as peças usadas.',
  'Quero acompanhar os sinistros dos meus segurados, com fotos, documentos, prazo e o regulador responsável.',
  'Faço visitas técnicas: preciso de checklist, fotos e assinatura do cliente no fim.',
  'Funil de vendas com empresas, contatos e propostas com valor e etapa.',
];

type Option = { value: string; label: string; color?: string };

/**
 * "Criar com IA": a pessoa descreve o negocio, a IA propoe as tabelas, a pessoa
 * ajusta conversando e so entao cria. Nada e criado antes do botao.
 */
export function AiTableBuilder({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const apply = useAiApply();
  const chat = useAiConversation<AiProposeResult>('/ai-builder/propose');
  const { result } = chat;

  const create = async () => {
    if (!result) return;
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

  const names = useMemo(() => {
    const map: Record<string, string> = { ...(result?.existingNames || {}) };
    for (const t of result?.tables || []) map[t.key] = t.namePlural;
    return map;
  }, [result]);

  return (
    <div className="space-y-4" data-testid="ai-builder">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Outras formas de começar
        </Button>
      </div>

      <AiBuilderLayout
        hasResult={!!result}
        reply={result?.reply}
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
        <div className="space-y-3" data-testid="ai-proposal">
          {!result || result.tables.length === 0 ? (
            <AiEmptyPreview
              icon={<Database className="h-8 w-8" />}
              text={result ? 'Nenhuma tabela nova por enquanto. Veja a resposta do assistente ao lado.' : 'A proposta de tabelas aparece aqui para você revisar.'}
            />
          ) : (
            <>
              <AiWarnings warnings={result.warnings} />
              {result.tables.map((t) => (
                <TablePreview key={t.key} table={t} names={names} />
              ))}
              <AiApplyBar
                label={result.tables.length === 1 ? 'Criar a tabela' : `Criar as ${result.tables.length} tabelas`}
                onApply={() => void create()}
                applying={apply.isPending}
                disabled={chat.pending}
              />
            </>
          )}
        </div>
        )}
      />
    </div>
  );
}

function TablePreview({ table, names }: { table: AiPreviewTable; names: Record<string, string> }) {
  const [showForm, setShowForm] = useState(false);
  const Icon = (icons as Record<string, LucideIcon>)[table.icon] ?? Database;
  const label = (slug?: string) => table.fields.find((f) => f.slug === slug)?.label;
  const status = table.fields.find((f) => f.slug === table.settings.statusField);
  const done = ((status?.options || []) as Option[]).filter((o) => table.settings.doneValues?.includes(o.value)).map((o) => o.label);
  const settings = [
    label(table.settings.titleField) && `Identifica cada registro pelo campo ${label(table.settings.titleField)}`,
    status && `Situação: ${status.label}${done.length ? ` (terminado quando ${done.join(' ou ')})` : ''}`,
    label(table.settings.deadlineField) && `Prazo: ${label(table.settings.deadlineField)}`,
    label(table.settings.assigneeField) && `Responsável: ${label(table.settings.assigneeField)}`,
  ].filter(Boolean) as string[];
  // Previa sem buscar dados: a ligacao vira uma lista vazia (a tabela ligada pode nem existir ainda)
  const entity = useMemo(() => {
    const fields = table.fields.map((f) =>
      f.type === 'relation'
        ? { ...f, type: 'select', options: [], placeholder: `Escolher em ${names[f.relatedEntitySlug ?? ''] ?? f.relatedEntitySlug}` }
        : f,
    );
    return { id: `ai-${table.key}`, slug: `__ai_${table.key}`, name: table.name, tenantId: '', fields, settings: table.settings } as unknown as Entity;
  }, [table, names]);

  return (
    <Card data-testid={`ai-table-${table.key}`}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `color-mix(in srgb, ${table.color} 14%, transparent)`, color: table.color }}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{table.namePlural}</p>
            {table.description && <p className="text-xs text-muted-foreground">{table.description}</p>}
            {table.parentKey && (
              <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]">
                <ListTree className="h-3 w-3" /> Lista dentro de {names[table.parentKey] ?? table.parentKey}
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? <EyeOff className="mr-1.5 h-4 w-4" /> : <Eye className="mr-1.5 h-4 w-4" />}
            {showForm ? 'Ver campos' : 'Ver formulário'}
          </Button>
        </div>

        {showForm ? (
          <div className="pointer-events-none select-none rounded-lg border bg-card p-4">
            <RecordFormFields entity={entity} hideFooter />
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {table.fields.map((f) => {
              const kind = fieldKind(f.type);
              const FieldIcon = kind.icon;
              const target = f.type === 'relation' ? f.relatedEntitySlug : f.type === 'sub-entity' ? f.subEntitySlug : undefined;
              if (f.type === 'section-title') {
                return <li key={f.slug} className="bg-muted/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{f.label}</li>;
              }
              return (
                <li key={f.slug} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-sm">
                  <FieldIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{f.label}{f.required && <span className="text-destructive"> *</span>}</span>
                  <span className="text-xs text-muted-foreground">{kind.label}</span>
                  {target && (
                    <span className="inline-flex items-center gap-1 text-xs text-primary">
                      <Link2 className="h-3 w-3" /> {names[target] ?? target}
                    </span>
                  )}
                  {((f.options || []) as Option[]).length > 0 && (
                    <span className="flex w-full flex-wrap gap-1 pl-6">
                      {((f.options || []) as Option[]).map((o) => <OptionBadge key={o.value} label={o.label} color={o.color ?? null} />)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {settings.length > 0 && (
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {settings.map((s) => <li key={s}>• {s}</li>)}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, Database, Eye, EyeOff, Link2, ListTree, Loader2, Lock, Send, Sparkles, icons, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { Entity } from '@crm-builder/shared';
import { useRouter } from '@/i18n/tenant-navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { OptionBadge } from '@/components/ui/option-badge';
import { RecordFormFields } from '@/components/data/record-form-dialog';
import { fieldKind } from '@/lib/field-catalog';
import { getErrorMessage } from '@/lib/get-error-message';
import { cn } from '@/lib/utils';
import { useAiApply, useAiPropose, type AiChatMessage, type AiPreviewTable, type AiProposeResult } from '@/hooks/use-ai-builder';

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
  const propose = useAiPropose();
  const apply = useAiApply();
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [result, setResult] = useState<AiProposeResult | null>(null);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, propose.isPending]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || propose.isPending) return;
    const next: AiChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    try {
      const res = await propose.mutateAsync({ messages: next.slice(-30), ...(result ? { currentProposal: result.proposal } : {}) });
      setResult(res);
      setMessages([...next, { role: 'assistant', content: res.reply }]);
    } catch (error) {
      setMessages(messages);
      setInput(content);
      toast.error(getErrorMessage(error, 'O assistente não conseguiu responder. Tente de novo.'));
    }
  };

  const create = async () => {
    if (!result) return;
    try {
      const res = await apply.mutateAsync(result.proposal);
      toast.success(res.tables.length === 1 ? 'Tabela criada!' : `${res.tables.length} tabelas criadas!`);
      if (res.rootId) router.push(`/gestao/entities/${res.rootId}`);
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* Conversa */}
        <Card className="flex h-fit flex-col lg:sticky lg:top-4">
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">Assistente de criação</p>
                <p className="text-xs text-muted-foreground">Conte o que você quer controlar. Nada é criado até você confirmar.</p>
              </div>
            </div>

            <div className="max-h-[52vh] min-h-[200px] space-y-3 overflow-y-auto rounded-lg bg-muted/40 p-3" data-testid="ai-messages">
              {messages.length === 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Escreva do seu jeito, como explicaria para um colega. Por exemplo:</p>
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => void send(ex)}
                      className="block w-full rounded-lg border bg-card px-3 py-2 text-left text-sm transition-colors hover:border-primary/50"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm',
                      m.role === 'user' ? 'bg-primary text-primary-foreground' : 'border bg-card',
                    )}
                    data-testid={m.role === 'assistant' ? 'ai-reply' : undefined}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {propose.isPending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Montando a proposta… (leva de 10 a 30 segundos)
                </div>
              )}
              <div ref={endRef} />
            </div>

            <div className="space-y-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                rows={3}
                maxLength={2000}
                placeholder={result ? 'Peça uma mudança: "tire o campo cor", "junte nome e sobrenome"…' : 'Ex.: tenho uma clínica e quero controlar pacientes e consultas'}
                disabled={propose.isPending}
                data-testid="ai-input"
              />
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Lock className="h-3 w-3" /> A IA vê só os nomes das tabelas e campos, nunca os seus registros.
                </p>
                <Button size="sm" onClick={() => void send(input)} disabled={propose.isPending || !input.trim()} data-testid="ai-send">
                  <Send className="mr-1.5 h-4 w-4" /> Enviar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Proposta */}
        <div className="space-y-3" data-testid="ai-proposal">
          {!result || result.tables.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center text-muted-foreground">
              <Database className="h-8 w-8" />
              <p className="text-sm">
                {result ? 'Nenhuma tabela nova por enquanto. Veja a resposta do assistente ao lado.' : 'A proposta de tabelas aparece aqui para você revisar.'}
              </p>
            </div>
          ) : (
            <>
              {result.warnings.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                  <p className="mb-1 flex items-center gap-1.5 font-medium"><AlertTriangle className="h-3.5 w-3.5" /> Ajustei algumas coisas:</p>
                  <ul className="list-inside list-disc space-y-0.5">{result.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
                </div>
              )}
              {result.tables.map((t) => (
                <TablePreview key={t.key} table={t} names={names} />
              ))}
              <Card className="sticky bottom-4 z-10 shadow-lg">
                <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">Gostou? Dá para mudar tudo depois, no editor de cada tabela.</p>
                  <Button size="lg" onClick={() => void create()} disabled={apply.isPending || propose.isPending} data-testid="ai-apply">
                    {apply.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                    {result.tables.length === 1 ? 'Criar a tabela' : `Criar as ${result.tables.length} tabelas`}
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
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

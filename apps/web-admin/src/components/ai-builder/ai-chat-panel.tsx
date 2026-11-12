'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Check, ImagePlus, Loader2, Lock, MessageSquare, Send, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/get-error-message';
import { cn } from '@/lib/utils';
import type { AiChatMessage } from '@/hooks/use-ai-builder';

/**
 * Conversa com o assistente (tabelas, paineis, PDFs): guarda as mensagens e a
 * ultima proposta, que volta para a IA a cada pedido de mudanca.
 */
export function useAiConversation<R extends { reply: string; proposal: Record<string, unknown> }>(
  endpoint: string,
  extra?: Record<string, unknown>,
  /** Envia como formulario (payload + imagens), para assistentes que aceitam imagem. */
  options?: { multipart?: boolean },
) {
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [result, setResult] = useState<R | null>(null);
  const [pending, setPending] = useState(false);

  const send = useCallback(
    async (content: string, files: File[] = []): Promise<boolean> => {
      const text = content.trim() || (files.length ? 'Use esta imagem como modelo.' : '');
      if (!text || pending) return false;
      const before = messages;
      const thumbs = files.map((f) => URL.createObjectURL(f));
      const next: AiChatMessage[] = [...before, { role: 'user', content: text, ...(thumbs.length ? { images: thumbs } : {}) }];
      setMessages(next);
      setPending(true);
      try {
        const body = {
          messages: next.slice(-30).map(({ role, content: c }) => ({ role, content: c })),
          ...(result ? { currentProposal: result.proposal } : {}),
          ...(extra || {}),
        };
        let payload: unknown = body;
        if (options?.multipart) {
          const form = new FormData();
          form.append('payload', JSON.stringify(body));
          files.forEach((f) => form.append('images', f));
          payload = form;
        }
        const { data } = await api.post<R>(endpoint, payload, {
          timeout: 240_000,
          ...(options?.multipart ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}),
        });
        setResult(data);
        setMessages([...next, { role: 'assistant', content: data.reply }]);
        return true;
      } catch (error) {
        setMessages(before);
        toast.error(getErrorMessage(error, 'O assistente não conseguiu responder. Tente de novo.'));
        return false;
      } finally {
        setPending(false);
      }
    },
    [endpoint, extra, messages, pending, result, options?.multipart],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setResult(null);
  }, []);

  /** Mexida a mao na proposta (sem IA): a proxima mensagem ja parte dela. */
  const replaceResult = useCallback((next: R | null | ((prev: R | null) => R | null)) => setResult(next), []);

  return { messages, result, pending, send, reset, replaceResult };
}

interface AiChatPanelProps {
  messages: AiChatMessage[];
  pending: boolean;
  hasResult: boolean;
  onSend: (text: string, files?: File[]) => Promise<boolean>;
  /** Deixa anexar imagens (modelo de pagina, fotos). */
  allowImages?: boolean;
  /** Texto da protecao de dados embaixo da caixa (padrao: so nomes de tabelas e campos). */
  privacyNote?: string;
  subtitle: string;
  examples: string[];
  placeholder: string;
  changePlaceholder: string;
  /** Algo acima da conversa (ex.: escolher a tabela do PDF). */
  header?: ReactNode;
  disabled?: boolean;
}

export function AiChatPanel({ messages, pending, hasResult, onSend, subtitle, examples, placeholder, changePlaceholder, header, disabled, allowImages, privacyNote }: AiChatPanelProps) {
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const addFiles = (list: FileList | File[]) => {
    const images = Array.from(list).filter((f) => /^image\/(jpeg|png|webp|gif)$/.test(f.type));
    if (images.some((f) => f.size > 5 * 1024 * 1024)) toast.error('Cada imagem pode ter até 5 MB.');
    setFiles((prev) => [...prev, ...images.filter((f) => f.size <= 5 * 1024 * 1024)].slice(0, 3));
  };
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, pending]);

  const send = async (text: string) => {
    if (disabled) return;
    const sending = files;
    setInput('');
    setFiles([]);
    const ok = await onSend(text, sending);
    if (!ok) { setInput(text); setFiles(sending); }
  };

  return (
    <Card className="flex h-fit flex-col lg:sticky lg:top-4">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Assistente de criação</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        {header}

        <div className="max-h-[52vh] min-h-[200px] space-y-3 overflow-y-auto rounded-lg bg-muted/40 p-3" data-testid="ai-messages">
          {messages.length === 0 && (
            <div className="space-y-2" data-tour="ai-examples">
              <p className="text-sm text-muted-foreground">Escreva do seu jeito, como explicaria para um colega. Por exemplo:</p>
              {examples.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  disabled={disabled || pending}
                  onClick={() => void send(ex)}
                  className="block w-full rounded-lg border bg-card px-3 py-2 text-left text-sm transition-colors hover:border-primary/50 disabled:opacity-50"
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
                {m.images && m.images.length > 0 && (
                  <span className="mb-1.5 flex flex-wrap gap-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {m.images.map((src) => <img key={src} src={src} alt="" className="h-16 w-16 rounded-md object-cover" />)}
                  </span>
                )}
                {m.content}
              </div>
            </div>
          ))}
          {pending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Montando a proposta… (leva de 10 a 30 segundos)
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="space-y-2"
          onDragOver={allowImages ? (e) => e.preventDefault() : undefined}
          onDrop={allowImages ? (e) => { e.preventDefault(); addFiles(e.dataTransfer.files); } : undefined}>
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2" data-testid="ai-attachments">
              {files.map((f, i) => (
                <span key={`${f.name}-${i}`} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={URL.createObjectURL(f)} alt={f.name} className="h-14 w-14 rounded-md border object-cover" />
                  <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Tirar imagem"
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-foreground px-1 text-[10px] leading-4 text-background">×</button>
                </span>
              ))}
            </div>
          )}
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={allowImages ? (e) => { if (e.clipboardData.files.length) { e.preventDefault(); addFiles(e.clipboardData.files); } } : undefined}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={3}
            maxLength={2000}
            placeholder={hasResult ? changePlaceholder : placeholder}
            disabled={pending || disabled}
            data-testid="ai-input"
            data-tour="ai-chat-input"
          />
          <div className={cn('flex items-center justify-between gap-2', allowImages && 'flex-col-reverse items-stretch')}>
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Lock className="h-3 w-3" /> {privacyNote ?? 'A IA vê só os nomes das tabelas e campos, nunca os seus registros.'}
            </p>
            <span className={cn('flex shrink-0 items-center gap-1.5', allowImages && 'justify-end')}>
              {allowImages && (
                <>
                  <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" data-testid="ai-image-input"
                    onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
                  <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()} disabled={pending || disabled || files.length >= 3} title="Enviar imagem de modelo ou foto (até 3)" data-testid="ai-attach">
                    <ImagePlus className="mr-1.5 h-4 w-4" /> Imagem
                  </Button>
                </>
              )}
              <Button size="sm" onClick={() => void send(input)} disabled={pending || disabled || (!input.trim() && files.length === 0)} data-testid="ai-send">
                <Send className="mr-1.5 h-4 w-4" /> Enviar
              </Button>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AiWarnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
      <p className="mb-1 flex items-center gap-1.5 font-medium"><AlertTriangle className="h-3.5 w-3.5" /> Ajustei algumas coisas:</p>
      <ul className="list-inside list-disc space-y-0.5">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
    </div>
  );
}

export function AiEmptyPreview({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center text-muted-foreground">
      {icon}
      <p className="text-sm">{text}</p>
    </div>
  );
}

export function AiApplyBar({ label, onApply, applying, disabled }: { label: string; onApply: () => void; applying: boolean; disabled?: boolean }) {
  return (
    <Card className="sticky bottom-4 z-10 shadow-lg">
      <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Gostou? Dá para mudar tudo depois, no editor.</p>
        <Button size="lg" onClick={onApply} disabled={applying || disabled} data-testid="ai-apply" data-tour="ai-apply">
          {applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
          {label}
        </Button>
      </CardContent>
    </Card>
  );
}

/** No celular a tela e estreita para conversa + proposta lado a lado. */
export function isNarrowScreen(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
}

/**
 * Conversa ao lado da proposta no computador; no celular, uma de cada vez
 * ("Conversa" / "Proposta"), indo para a proposta quando a IA responde.
 */
export function AiBuilderLayout({ chat, preview, reply, hasResult, wide, forceTab }: {
  chat: ReactNode;
  preview: ReactNode;
  /** Ultima resposta da IA, repetida acima da proposta no celular. */
  reply?: string;
  hasResult: boolean;
  /** Proposta mais larga (paineis): lado a lado so em telas bem grandes. */
  wide?: boolean;
  /** Troca a aba do celular de fora (ex.: o tutorial mostrando a proposta). */
  forceTab?: { tab: 'chat' | 'preview'; n: number };
}) {
  const [tab, setTab] = useState<'chat' | 'preview'>('chat');
  useEffect(() => {
    if (forceTab) setTab(forceTab.tab);
  }, [forceTab]);
  useEffect(() => {
    if (hasResult && reply) setTab('preview');
  }, [reply, hasResult]);
  const hideOnSmall = wide ? 'hidden xl:block' : 'hidden lg:block';
  return (
    <div className="space-y-3">
      <div className={cn('grid grid-cols-2 gap-1 rounded-lg bg-muted p-1', wide ? 'xl:hidden' : 'lg:hidden')} data-testid="ai-mobile-tabs">
        {(['chat', 'preview'] as const).map((t) => (
          <button
            key={t}
            type="button"
            disabled={t === 'preview' && !hasResult}
            onClick={() => setTab(t)}
            className={cn('rounded-md py-2 text-sm font-medium transition-colors disabled:opacity-40', tab === t ? 'bg-background shadow-sm' : 'text-muted-foreground')}
          >
            {t === 'chat' ? 'Conversa' : 'Proposta'}
          </button>
        ))}
      </div>
      <div className={cn('grid gap-4', wide ? 'xl:grid-cols-[minmax(0,2fr)_minmax(0,5fr)]' : 'lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]')}>
        <div className={cn(tab === 'chat' ? 'block' : hideOnSmall)}>{chat}</div>
        <div className={cn('min-w-0 space-y-3', tab === 'preview' ? 'block' : hideOnSmall)}>
          {reply && (
            <div className={cn('rounded-lg border bg-card p-3 text-sm', wide ? 'xl:hidden' : 'lg:hidden')}>
              <p className="whitespace-pre-wrap">{reply}</p>
              <button type="button" onClick={() => setTab('chat')} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
                <MessageSquare className="h-3.5 w-3.5" /> Responder ou pedir mudança
              </button>
            </div>
          )}
          {preview}
        </div>
      </div>
    </div>
  );
}

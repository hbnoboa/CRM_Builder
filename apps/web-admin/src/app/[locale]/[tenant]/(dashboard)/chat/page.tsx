'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Hash, Send, MessageSquare, User as UserIcon, Loader2, Slash, FileText, Settings2, ArrowLeft, Pencil, Check, X, Search } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useTenant } from '@/stores/tenant-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { RecordFormDialog } from '@/components/data/record-form-dialog';
import { QuickCaptureForm } from '@/components/chat/quick-capture-form';
import { QueryRunner } from '@/components/chat/query-runner';
import { RecordEditForm } from '@/components/chat/record-edit-form';
import { CommandManager } from '@/components/chat/command-manager';
import { CommandPickerDialog } from '@/components/chat/command-picker-dialog';
import type { Entity } from '@/types';

interface EntityLite { id: string; slug: string; name: string; fields?: unknown[] }
interface Channel { id: string; type: 'group' | 'dm'; entityId?: string | null; name?: string | null; createdById?: string; entity?: { slug: string; name: string; icon?: string; color?: string } }
interface Message { id: string; senderId: string | null; type: string; content: string | null; meta?: Record<string, unknown>; createdAt: string }
interface ChatCommand { slug: string; description?: string; targetEntitySlug?: string; actionType?: string; actionConfig?: Record<string, unknown> }
type ThreadChannel = Channel & { recordId?: string | null; entity?: { slug: string; name: string } };
type Active = { id: string; label: string; kind: 'group' | 'dm' | 'record'; entitySlug?: string; scopeRecordId?: string };

export default function ChatPage() {
  const user = useAuthStore((s) => s.user);
  const { effectiveTenantId } = useTenant();
  const searchParams = useSearchParams();
  const [tables, setTables] = useState<EntityLite[]>([]);
  const [allEntities, setAllEntities] = useState<EntityLite[]>([]);
  const [dms, setDms] = useState<Channel[]>([]);
  const [threads, setThreads] = useState<ThreadChannel[]>([]);
  const [groups, setGroups] = useState<Channel[]>([]);
  const [active, setActive] = useState<Active | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [commands, setCommands] = useState<ChatCommand[]>([]);
  const [draft, setDraft] = useState('');
  const [opening, setOpening] = useState(false);
  const [runningCmd, setRunningCmd] = useState<{ cmd: ChatCommand; entity: Entity } | null>(null);
  const [quickCmd, setQuickCmd] = useState<{ cmd: ChatCommand; entity: EntityLite; parentEntity: EntityLite | null } | null>(null);
  const [queryCmd, setQueryCmd] = useState<{ cmd: ChatCommand; entity: EntityLite } | null>(null);
  const [editCmd, setEditCmd] = useState<{ cmd: ChatCommand; entity: EntityLite } | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const [showCmdManager, setShowCmdManager] = useState(false);
  const [pickerFor, setPickerFor] = useState<{ entitySlug: string; recordId: string } | null>(null);
  const [managePicker, setManagePicker] = useState<{ channelId: string; initial: string[] } | null>(null);
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const endRef = useRef<HTMLDivElement>(null);

  const canManageCommands = (() => {
    const mp = user?.customRole?.modulePermissions as Record<string, Record<string, unknown> | boolean> | undefined;
    if (mp?.platform && (mp.platform as Record<string, unknown>).crossTenant === true) return true;
    if (mp?.allAccess === true) return true;
    return (mp?.entities as Record<string, unknown>)?.canUpdate === true
      || (mp?.roles as Record<string, unknown>)?.canManagePermissions === true;
  })();

  // Permissão dedicada de gerir canais: quem cria/renomeia canais e vê todas as tabelas.
  const canManageChat = (() => {
    const mp = user?.customRole?.modulePermissions as Record<string, Record<string, unknown> | boolean> | undefined;
    if (mp?.platform && (mp.platform as Record<string, unknown>).crossTenant === true) return true;
    if (mp?.allAccess === true) return true;
    return (mp?.chat as Record<string, unknown>)?.manage === true;
  })();

  const canReadEntity = useCallback((slug: string) => {
    const mp = user?.customRole?.modulePermissions as Record<string, Record<string, unknown> | boolean> | undefined;
    if (mp?.platform && (mp.platform as Record<string, unknown>).crossTenant === true) return true;
    if (mp?.allAccess === true) return true;
    const perms = user?.customRole?.permissions as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(perms)) return false;
    const exact = perms.find((p) => p.entitySlug === slug);
    if (exact) return exact.canRead === true;
    const wild = perms.find((p) => p.entitySlug === '*');
    if (wild) return wild.canRead === true;
    return false;
  }, [user]);

  const reloadChannels = useCallback(async () => {
    try {
      const chRes = await api.get('/chat/channels');
      setDms(chRes.data?.dms || []);
      setThreads(chRes.data?.threads || []);
      setGroups(chRes.data?.groups || []);
    } catch { /* ignore */ }
  }, []);

  // Recarrega tabelas + canais ao montar E ao TROCAR DE TENANT (limpa o canal ativo
  // para não mostrar conversa do tenant anterior). Só zera o canal ativo quando o
  // tenant REALMENTE muda — senão re-execuções do efeito apagariam a seleção.
  const lastTenantRef = useRef(effectiveTenantId);
  useEffect(() => {
    if (lastTenantRef.current !== effectiveTenantId) {
      lastTenantRef.current = effectiveTenantId;
      setActive(null);
      setThreads([]);
    }
    (async () => {
      try {
        const [entRes, chRes] = await Promise.all([api.get('/entities'), api.get('/chat/channels')]);
        const ent: EntityLite[] = entRes.data?.data || entRes.data || [];
        setAllEntities(ent);
        setTables(ent.filter((e) => canReadEntity(e.slug)));
        setDms(chRes.data?.dms || []);
        setThreads(chRes.data?.threads || []);
        setGroups(chRes.data?.groups || []);
      } catch { /* ignore */ }
    })();
  }, [canReadEntity, effectiveTenantId]);

  useEffect(() => {
    if (!canManageCommands) return;
    api.get('/custom-roles')
      .then((r) => setRoles((r.data?.data || r.data || []).map((x: { id: string; name: string }) => ({ id: x.id, name: x.name }))))
      .catch(() => setRoles([]));
  }, [canManageCommands]);

  // Fecha modo renomear / runners de comando ao trocar de canal.
  useEffect(() => { setRenaming(false); setQueryCmd(null); setEditCmd(null); }, [active?.id]);

  const loadMessages = useCallback(async (channelId: string) => {
    try { const res = await api.get(`/chat/channels/${channelId}/messages`); setMessages(res.data || []); } catch { /* ignore */ }
  }, []);

  // Mensagens do canal ativo (polling; Socket.IO numa fatia futura).
  useEffect(() => {
    if (!active) return;
    loadMessages(active.id);
    const t = setInterval(() => loadMessages(active.id), 4000);
    return () => clearInterval(t);
  }, [active, loadMessages]);

  // Comandos disponíveis para a tabela do canal de grupo ativo.
  useEffect(() => {
    if (!active || (active.kind !== 'group' && active.kind !== 'record')) { setCommands([]); return; }
    // Comandos POR CANAL: se o chat tem comandos anexados, mostra só esses; senão
    // cai no fallback do backend (grupo=tabela, thread=todos).
    api.get(`/chat/commands?channelId=${active.id}`).then((r) => setCommands(r.data || [])).catch(() => setCommands([]));
  }, [active]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function openTable(e: EntityLite) {
    setOpening(true);
    try {
      const res = await api.post(`/chat/channels/group/${e.slug}`);
      setActive({ id: res.data.id, label: e.name, kind: 'group', entitySlug: e.slug });
    } catch { /* sem acesso */ } finally { setOpening(false); }
  }

  const openThread = useCallback(async (entitySlug: string, recordId: string, commandIds?: string[]) => {
    setOpening(true);
    try {
      // Seletor SÓ na criação: se o chat ainda não existe e o usuário gerencia
      // comandos, abre o picker (a menos que já tenha vindo com commandIds do picker).
      if (commandIds === undefined && canManageCommands) {
        const meta = await api.get(`/chat/channels/record/${entitySlug}/${recordId}/meta`);
        if (!meta.data?.exists) {
          setPickerFor({ entitySlug, recordId });
          setOpening(false);
          return;
        }
      }
      const res = await api.post(
        `/chat/channels/record/${entitySlug}/${recordId}`,
        commandIds ? { commandIds } : {},
      );
      setActive({
        id: res.data.id,
        label: res.data.name || 'Registro',
        kind: 'record',
        entitySlug,
        scopeRecordId: recordId,
      });
      // Aparece na hora no sidebar (evita corrida com o fetch inicial de canais).
      setThreads((prev) =>
        prev.some((t) => t.id === res.data.id)
          ? prev
          : [{ ...res.data, entity: { slug: entitySlug, name: res.data.name } }, ...prev],
      );
      await reloadChannels();
    } catch { /* sem acesso ao registro */ } finally { setOpening(false); }
  }, [reloadChannels, canManageCommands]);

  // Abre o thread vindo da ViewPage do registro: ?thread=<entitySlug>:<recordId>
  useEffect(() => {
    const param = searchParams.get('thread');
    if (!param) return;
    const idx = param.indexOf(':');
    if (idx < 0) return;
    const entitySlug = param.slice(0, idx);
    const recordId = param.slice(idx + 1);
    if (entitySlug && recordId) void openThread(entitySlug, recordId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function openCommand(cmd: ChatCommand) {
    setDraft('');
    const entity = allEntities.find((t) => t.slug === cmd.targetEntitySlug) || tables.find((t) => t.slug === cmd.targetEntitySlug);
    if (!entity) return;
    if (cmd.actionType === 'query') { setQueryCmd({ cmd, entity }); return; }
    if (cmd.actionType === 'update_record') { setEditCmd({ cmd, entity }); return; }
    const cfg = (cmd.actionConfig || {}) as { quickFields?: string[]; parentEntitySlug?: string };
    // Captura rápida inline quando o comando tem quickFields; senão, form completo (modal).
    if (Array.isArray(cfg.quickFields) && cfg.quickFields.length > 0) {
      const parentEntity = cfg.parentEntitySlug ? tables.find((t) => t.slug === cfg.parentEntitySlug) || null : null;
      setQuickCmd({ cmd, entity, parentEntity });
    } else {
      setRunningCmd({ cmd, entity: entity as unknown as Entity });
    }
  }

  async function send(ev: React.FormEvent) {
    ev.preventDefault();
    const text = draft.trim();
    if (!text || !active) return;
    // Slash-command: /slug → abre o formulário do comando em vez de enviar texto.
    if (text.startsWith('/')) {
      const slug = text.slice(1).trim().toLowerCase();
      const cmd = commands.find((c) => c.slug.toLowerCase() === slug);
      if (cmd) { openCommand(cmd); return; }
    }
    // Bot: "@bot ..." → pergunta read-only (as_user), responde no canal.
    if (text.toLowerCase().startsWith('@bot')) {
      setDraft('');
      try { await api.post(`/chat/channels/${active.id}/bot`, { message: text }); await loadMessages(active.id); }
      catch { setDraft(text); }
      return;
    }
    setDraft('');
    try { await api.post(`/chat/channels/${active.id}/messages`, { content: text }); await loadMessages(active.id); }
    catch { setDraft(text); }
  }

  const slashMatches = draft.startsWith('/')
    ? commands.filter((c) => c.slug.toLowerCase().startsWith(draft.slice(1).toLowerCase()))
    : [];

  // Navegação por teclado nas sugestões de /comando (↑ ↓ Tab Enter Esc).
  function handleComposerKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (slashMatches.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIndex((i) => Math.min(i + 1, slashMatches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSlashIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); openCommand(slashMatches[Math.min(slashIndex, slashMatches.length - 1)]); }
    else if (e.key === 'Escape') { setDraft(''); }
  }

  // Sidebar: quem gerencia o chat vê todas as tabelas (pode criar o canal ao clicar);
  // os demais veem só as tabelas que JÁ têm canal de grupo (não criam nada novo).
  const groupSlugs = new Set(groups.map((g) => g.entity?.slug).filter(Boolean) as string[]);
  const visibleTables = canManageChat ? tables : tables.filter((t) => groupSlugs.has(t.slug));

  // Renomear: permitido para o criador do canal OU quem gerencia o chat.
  const activeChannel = active ? [...groups, ...threads, ...dms].find((c) => c.id === active.id) : undefined;
  const canRenameActive = !!active && (canManageChat || activeChannel?.createdById === user?.id);

  async function submitRename() {
    if (!active) return;
    const name = renameDraft.trim();
    if (!name) { setRenaming(false); return; }
    try {
      await api.patch(`/chat/channels/${active.id}`, { name });
      setActive({ ...active, label: name });
      await reloadChannels();
    } catch { /* ignore */ }
    setRenaming(false);
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      <aside className={cn('shrink-0 border rounded-lg overflow-y-auto bg-card', active ? 'hidden md:block md:w-64' : 'w-full md:w-64')}>
        <div className="p-3">
          {canManageCommands && (
            <Button variant="outline" size="sm" className="w-full mb-3 justify-start gap-2" onClick={() => setShowCmdManager(true)}>
              <Settings2 className="h-4 w-4" /> Comandos do bot
            </Button>
          )}
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Tabelas</div>
          <div className="space-y-0.5">
            {visibleTables.map((e) => (
              <button key={e.id} onClick={() => openTable(e)}
                className={cn('w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left hover:bg-accent transition-colors',
                  active?.entitySlug === e.slug && 'bg-accent font-medium')}>
                <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{e.name}</span>
              </button>
            ))}
            {visibleTables.length === 0 && (
              <div className="text-xs text-muted-foreground px-2 py-1">
                {canManageChat ? 'Nenhuma tabela disponível' : 'Nenhum canal disponível ainda'}
              </div>
            )}
          </div>
          {threads.length > 0 && (
            <>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mt-4 mb-1.5">Registros</div>
              <div className="space-y-0.5">
                {threads.map((c) => (
                  <button key={c.id}
                    onClick={() => setActive({ id: c.id, label: c.name || 'Registro', kind: 'record', entitySlug: c.entity?.slug, scopeRecordId: c.recordId || undefined })}
                    className={cn('w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left hover:bg-accent transition-colors',
                      active?.id === c.id && 'bg-accent font-medium')}>
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{c.name || 'Registro'}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {dms.length > 0 && (
            <>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mt-4 mb-1.5">Diretas</div>
              <div className="space-y-0.5">
                {dms.map((c) => (
                  <button key={c.id} onClick={() => setActive({ id: c.id, label: 'Conversa direta', kind: 'dm' })}
                    className={cn('w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left hover:bg-accent transition-colors',
                      active?.id === c.id && 'bg-accent font-medium')}>
                    <UserIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">Conversa direta</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </aside>

      <section className={cn('flex-1 flex-col border rounded-lg bg-card min-w-0', active ? 'flex' : 'hidden md:flex')}>
        {!active ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
            <MessageSquare className="h-8 w-8" />
            <p className="text-sm">Selecione uma tabela para abrir o canal do time.</p>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-2 px-4 py-3 border-b">
              <button className="md:hidden -ml-1 p-1 rounded hover:bg-accent shrink-0" onClick={() => setActive(null)} aria-label="Voltar">
                <ArrowLeft className="h-4 w-4" />
              </button>
              {active.kind === 'group' ? <Hash className="h-4 w-4 text-muted-foreground" /> : active.kind === 'record' ? <FileText className="h-4 w-4 text-muted-foreground" /> : <UserIcon className="h-4 w-4 text-muted-foreground" />}
              {renaming ? (
                <span className="flex items-center gap-1">
                  <Input autoFocus value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setRenaming(false); }}
                    className="h-7 text-sm w-44" />
                  <button className="p-1 rounded hover:bg-accent" onClick={submitRename} aria-label="Salvar"><Check className="h-3.5 w-3.5" /></button>
                  <button className="p-1 rounded hover:bg-accent" onClick={() => setRenaming(false)} aria-label="Cancelar"><X className="h-3.5 w-3.5" /></button>
                </span>
              ) : (
                <>
                  <span className="font-medium text-sm">{active.label}</span>
                  {canRenameActive && (
                    <button className="p-1 rounded hover:bg-accent text-muted-foreground" title="Renomear"
                      onClick={() => { setRenameDraft(active.label); setRenaming(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </>
              )}
              {opening && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              {commands.length > 0 && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Slash className="h-3 w-3" /> {commands.map((c) => '/' + c.slug).join(' ')}
                </span>
              )}
              {active.kind === 'record' && canManageCommands && active.entitySlug && active.scopeRecordId && (
                <Button
                  variant="ghost" size="sm" className="ml-auto h-7 gap-1 text-xs"
                  onClick={async () => {
                    try {
                      const meta = await api.get(`/chat/channels/record/${active.entitySlug}/${active.scopeRecordId}/meta`);
                      setManagePicker({ channelId: active.id, initial: meta.data?.commandIds || [] });
                    } catch { setManagePicker({ channelId: active.id, initial: [] }); }
                  }}
                >
                  <Settings2 className="h-3.5 w-3.5" /> Comandos
                </Button>
              )}
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && <p className="text-center text-xs text-muted-foreground py-8">Sem mensagens ainda. Diga olá 👋</p>}
              {messages.map((m) => {
                const mine = m.senderId === user?.id;
                const isBot = m.senderId === null;
                const isCard = m.type === 'form_submission';
                const isQuery = m.type === 'query_result';
                const isReport = m.type === 'report';
                const values = (m.meta?.values || {}) as Record<string, unknown>;
                const qCols = (m.meta?.columns || []) as Array<{ slug: string; label: string }>;
                const qRows = (m.meta?.rows || []) as string[][];
                return (
                  <div key={m.id} className={cn('flex flex-col', isQuery ? 'w-full max-w-full' : 'max-w-[75%]', mine ? 'ml-auto items-end' : 'items-start')}>
                    {isCard ? (
                      <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm w-full">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-primary mb-1">
                          <FileText className="h-3.5 w-3.5" /> {String(m.meta?.templateSlug ? '/' + m.meta.templateSlug : 'Registro')} · {String(m.meta?.entitySlug || '')}{m.meta?.edited ? ' · editado' : ''}
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                          {Object.entries(values).map(([k, v]) => (
                            <div key={k} className="flex gap-1 text-xs"><span className="text-muted-foreground">{k}:</span><span className="truncate">{String(v)}</span></div>
                          ))}
                        </div>
                      </div>
                    ) : isQuery ? (
                      <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm w-full overflow-x-auto">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-primary mb-1.5">
                          <Search className="h-3.5 w-3.5" /> /{String(m.meta?.templateSlug || '')} — {String(m.meta?.total ?? qRows.length)} resultado(s)
                        </div>
                        {qRows.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Nenhum resultado.</p>
                        ) : (
                          <table className="text-xs w-full">
                            <thead><tr className="text-left text-muted-foreground border-b">
                              {qCols.map((c) => <th key={c.slug} className="py-1 pr-3 font-medium whitespace-nowrap">{c.label}</th>)}
                            </tr></thead>
                            <tbody>
                              {qRows.map((r, i) => (
                                <tr key={i} className="border-b border-border/50">
                                  {r.map((cell, j) => <td key={j} className="py-1 pr-3 whitespace-nowrap max-w-[220px] truncate">{cell}</td>)}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        {Number(m.meta?.total ?? 0) > qRows.length && <p className="text-[10px] text-muted-foreground mt-1">Mostrando {qRows.length} de {String(m.meta?.total)} — gere um relatório para ver tudo.</p>}
                      </div>
                    ) : isReport ? (
                      <div className="rounded-lg border bg-emerald-500/10 border-emerald-500/30 px-3 py-2 text-sm w-full">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                          <FileText className="h-3.5 w-3.5" /> Relatório /{String(m.meta?.templateSlug || '')} — {String(m.meta?.format || '').toUpperCase()} · {String(m.meta?.total ?? 0)} registro(s)
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{String(m.meta?.filename || '')} · baixado ao gerar</p>
                      </div>
                    ) : (
                      <div className={cn('rounded-2xl px-3 py-1.5 text-sm whitespace-pre-line', mine ? 'bg-primary text-primary-foreground' : isBot ? 'bg-amber-500/15 border border-amber-500/30' : 'bg-muted')}>
                        {m.content}
                      </div>
                    )}
                    <span className="text-[10px] text-muted-foreground mt-0.5 px-1">
                      {mine ? 'Você' : isBot ? 'Bot' : 'Outro'} · {new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>

            {editCmd ? (
              <RecordEditForm
                channelId={active.id}
                cmd={editCmd.cmd}
                entity={editCmd.entity}
                scopeParentId={active.kind === 'record' ? active.scopeRecordId : undefined}
                onCancel={() => setEditCmd(null)}
                onDone={() => { setEditCmd(null); loadMessages(active.id); }}
              />
            ) : queryCmd ? (
              <QueryRunner
                channelId={active.id}
                cmd={queryCmd.cmd}
                entity={queryCmd.entity}
                onCancel={() => setQueryCmd(null)}
                onDone={() => { setQueryCmd(null); loadMessages(active.id); }}
              />
            ) : quickCmd ? (
              <QuickCaptureForm
                channelId={active.id}
                cmd={quickCmd.cmd}
                entity={quickCmd.entity}
                parentEntity={quickCmd.parentEntity}
                scopeParentId={active.kind === 'record' ? active.scopeRecordId : undefined}
                onCancel={() => setQuickCmd(null)}
                onDone={() => { setQuickCmd(null); loadMessages(active.id); }}
              />
            ) : (
              <div className="border-t">
                {/* Sugestões de slash-command */}
                {slashMatches.length > 0 && (
                  <div className="px-3 pt-2 flex flex-col gap-1">
                    {slashMatches.map((c, i) => (
                      <button key={c.slug} type="button" onMouseEnter={() => setSlashIndex(i)} onClick={() => openCommand(c)}
                        className={cn('flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-left transition-colors',
                          i === Math.min(slashIndex, slashMatches.length - 1) ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent')}>
                        <Slash className="h-3 w-3 text-primary" />
                        <span className="font-medium">/{c.slug}</span>
                        {c.description && <span className="text-muted-foreground">— {c.description}</span>}
                      </button>
                    ))}
                    <span className="text-[10px] text-muted-foreground px-1">↑↓ navegar · Tab/Enter selecionar · Esc sair</span>
                  </div>
                )}
                <form onSubmit={send} className="flex items-center gap-2 p-3">
                  <Input value={draft} onChange={(e) => { setDraft(e.target.value); setSlashIndex(0); }} onKeyDown={handleComposerKey} placeholder="Escreva uma mensagem… ou /comando" className="flex-1" />
                  <Button type="submit" size="icon" disabled={!draft.trim()}><Send className="h-4 w-4" /></Button>
                </form>
              </div>
            )}
          </>
        )}
      </section>

      {/* Formulário do slash-command (reusa o form de registro; save via executeCommand) */}
      {runningCmd && active && (
        <RecordFormDialog
          open
          onOpenChange={(o) => { if (!o) setRunningCmd(null); }}
          entity={runningCmd.entity}
          submitOverride={async (data) => {
            await api.post(`/chat/channels/${active.id}/commands/${runningCmd.cmd.slug}`, { values: data });
            setRunningCmd(null);
            await loadMessages(active.id);
          }}
        />
      )}

      {canManageCommands && (
        <CommandManager
          open={showCmdManager}
          onOpenChange={setShowCmdManager}
          entities={allEntities}
          roles={roles}
          onChanged={() => {
            if (active) {
              api.get(`/chat/commands?channelId=${active.id}`).then((r) => setCommands(r.data || [])).catch(() => {});
            }
          }}
        />
      )}

      {/* Seletor de comandos NA CRIAÇÃO do chat de registro */}
      {pickerFor && (
        <CommandPickerDialog
          open
          mode="create"
          confirmLabel="Criar e abrir"
          onOpenChange={(v) => { if (!v) setPickerFor(null); }}
          onConfirm={async (ids) => {
            const p = pickerFor;
            setPickerFor(null);
            if (p) await openThread(p.entitySlug, p.recordId, ids);
          }}
        />
      )}

      {/* Gerenciar comandos de um chat existente */}
      {managePicker && (
        <CommandPickerDialog
          open
          mode="manage"
          confirmLabel="Salvar"
          initialSelected={managePicker.initial}
          onOpenChange={(v) => { if (!v) setManagePicker(null); }}
          onConfirm={async (ids) => {
            const mp = managePicker;
            setManagePicker(null);
            if (!mp) return;
            await api.put(`/chat/channels/${mp.channelId}/commands`, { commandIds: ids });
            if (active?.id === mp.channelId) {
              api.get(`/chat/commands?channelId=${mp.channelId}`).then((r) => setCommands(r.data || [])).catch(() => {});
            }
          }}
        />
      )}
    </div>
  );
}

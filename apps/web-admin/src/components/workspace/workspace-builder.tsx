'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, BarChart3, Check, Database, FileText, History, ListChecks, Loader2, Lock, Plus, RotateCcw, ShieldCheck, Sparkles, Trash2, Undo2, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { AiBuilderLayout, AiChatPanel, AiWarnings, useAiConversation } from '@/components/ai-builder/ai-chat-panel';
import { EditableTableCard, MarkBadge } from '@/components/ai-builder/editable-table-card';
import { useLocale } from 'next-intl';
import { usePermissions } from '@/hooks/use-permissions';
import { getErrorMessage } from '@/lib/get-error-message';
import { cn } from '@/lib/utils';
import type { EntityField } from '@/types';
import type { AiPreviewTable } from '@/hooks/use-ai-builder';
import {
  EMPTY_DRAFT, EMPTY_MARKS, previewWorkspace, useWorkspaceApply, useWorkspaceHistory, useWorkspaceState,
  type WorkspaceDraft, type WorkspaceResult, type WsChange, type WsDashboard, type WsAutomation, type WsModule, type WsPdf, type WsRole, type WsTable,
} from '@/hooks/use-workspace';
import { DashboardItem, ItemShell, PdfItem } from './workspace-parts';
import { RoleItem, type RoleTableInfo } from './workspace-roles';
import { AutomationItem } from './workspace-automations';

const EXAMPLES = [
  'Quero controlar as vistorias de veículos, com fotos, não conformidades e um laudo em PDF.',
  'Coloque um campo de placa obrigatório nos veículos.',
  'Monte um painel com os números do dia e o que está atrasado.',
  'Crie o cargo Supervisor: vê os veículos e as não conformidades, mas não exclui nada.',
  'Deixe o campo Motivo obrigatório quando a situação for Reprovado.',
  'Quando uma não conformidade grave for criada, avise o gerente.',
];
const MAX_UNDO = 30;
type Tab = 'tables' | 'dashboards' | 'pdfs' | 'roles' | 'automations' | 'changes' | 'history';
const BLANK: WorkspaceResult = { reply: '', warnings: [], proposal: EMPTY_DRAFT as unknown as Record<string, unknown>, changes: [], marks: EMPTY_MARKS, preview: { tables: [], dashboards: {}, pdfs: {} } };
const KIND_LABEL = { create: 'Criar', update: 'Alterar', delete: 'Excluir' } as const;
const MODULE_LABEL: Record<WsModule, string> = { table: 'Tabela', dashboard: 'Painel', pdf: 'PDF', role: 'Cargo', automation: 'Automação' };
const newTableKey = () => `tabela-${Date.now().toString(36)}`;

/** Tira do rascunho o item (desfaz a mudanca dele). */
function withoutItem(draft: WorkspaceDraft, module: WsModule, key: string): WorkspaceDraft {
  if (module === 'table') {
    return { ...draft, tables: draft.tables.filter((t) => t.key !== key).map((t) => (t.parentKey === key && !t.existing ? { ...t, parentKey: undefined } : t)) };
  }
  if (module === 'dashboard') return { ...draft, dashboards: draft.dashboards.filter((d) => d.key !== key) };
  if (module === 'role') return { ...draft, roles: (draft.roles || []).filter((r) => r.key !== key) };
  if (module === 'automation') return { ...draft, automations: (draft.automations || []).filter((a) => a.key !== key) };
  return { ...draft, pdfs: draft.pdfs.filter((p) => p.key !== key) };
}

/**
 * Construtor da tela inicial: conversa com a IA de um lado e o sistema inteiro do
 * outro (tabelas, paineis, PDFs), com o que muda marcado. Tudo da para mexer a mao;
 * nada muda antes de "Aplicar", e cada aplicacao fica no historico.
 */
export function WorkspaceBuilder() {
  const { hasModulePermission } = usePermissions();
  const locale = useLocale();
  const { data: state, isLoading, refetch } = useWorkspaceState();
  const chat = useAiConversation<WorkspaceResult>('/ai-builder/workspace/propose');
  const { result, replaceResult } = chat;
  const applyDraft = useWorkspaceApply();
  const [tab, setTab] = useState<Tab>('tables');
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const [onlyChanges, setOnlyChanges] = useState(false);
  const [undoStack, setUndoStack] = useState<WorkspaceDraft[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [confirmRemovals, setConfirmRemovals] = useState(false);
  const [applying, setApplying] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const history = useWorkspaceHistory(tab === 'history');

  const draft = (result?.proposal as unknown as WorkspaceDraft | undefined) ?? EMPTY_DRAFT;
  const marks = result?.marks ?? EMPTY_MARKS;
  const changes = result?.changes ?? [];
  const can = {
    tableDelete: hasModulePermission('entities', 'canDelete'),
    dashboardDelete: hasModulePermission('dashboard', 'canDelete'),
    pdfDelete: hasModulePermission('templates', 'canDelete'),
    roleDelete: hasModulePermission('roles', 'canDelete'),
    roleCreate: hasModulePermission('roles', 'canCreate'),
    automationDelete: hasModulePermission('automations', 'canDelete'),
    automationCreate: hasModulePermission('automations', 'canCreate'),
  };

  /** Mexida a mao: aparece na hora e o servidor confere logo depois (sem IA). */
  const edit = useCallback((next: WorkspaceDraft) => {
    setUndoStack((h) => [...h.slice(-MAX_UNDO + 1), draft]);
    replaceResult((prev) => ({ ...(prev ?? BLANK), proposal: next as unknown as Record<string, unknown> }));
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => {
      previewWorkspace(next)
        .then((p) => replaceResult((prev) => (prev ? { ...prev, warnings: p.warnings, changes: p.changes, marks: p.marks, preview: p.preview } : prev)))
        .catch(() => undefined);
    }, 400);
  }, [draft, replaceResult]);

  const undo = () => {
    const prev = undoStack[undoStack.length - 1];
    if (!prev) return;
    setUndoStack((h) => h.slice(0, -1));
    replaceResult((r) => (r ? { ...r, proposal: prev as unknown as Record<string, unknown> } : r));
    previewWorkspace(prev).then((p) => replaceResult((r) => (r ? { ...r, warnings: p.warnings, changes: p.changes, marks: p.marks, preview: p.preview } : r))).catch(() => undefined);
  };

  const restart = () => {
    chat.reset();
    setUndoStack([]);
  };

  // ── Listas: o que existe, com o rascunho por cima ──
  const tables = useMemo(() => {
    const byKey = new Map(draft.tables.map((t) => [t.key, t]));
    return [...draft.tables.filter((t) => !t.existing), ...(state?.tables ?? []).map((b) => byKey.get(b.key) ?? b)];
  }, [draft.tables, state?.tables]);
  const newTables = useMemo(() => draft.tables.filter((t) => !t.existing), [draft.tables]);
  const existingNames = useMemo(() => Object.fromEntries((state?.tables ?? []).map((t) => [t.key, t.namePlural])), [state?.tables]);
  const existingParents = useMemo(() => Object.fromEntries(
    (state?.tables ?? []).filter((t) => !draft.tables.some((d) => d.key === t.key && d.removed)).map((t) => [t.key, t.namePlural]),
  ), [state?.tables, draft.tables]);
  const names = useMemo(() => ({ ...existingNames, ...Object.fromEntries(newTables.map((t) => [t.key, t.namePlural])) }), [existingNames, newTables]);
  const previews = useMemo(() => {
    const map = new Map<string, AiPreviewTable>((state?.previews ?? []).map((p) => [p.key, p]));
    for (const p of result?.preview.tables ?? []) map.set(p.key, p);
    return map;
  }, [state?.previews, result?.preview.tables]);
  const baseFieldKeys = useMemo(() => new Map((state?.tables ?? []).map((t) => [t.key, new Set(t.fields.map((f) => f.key))])), [state?.tables]);

  const dashboards = useMemo(() => {
    const byKey = new Map(draft.dashboards.map((d) => [d.key, d]));
    return [
      ...draft.dashboards.filter((d) => !d.existing).map((d) => ({ draft: d, payload: result?.preview.dashboards[d.key] })),
      ...(state?.dashboards ?? []).map((b) => {
        const d = byKey.get(b.draft.key);
        return { draft: d ?? b.draft, payload: d && !d.removed ? result?.preview.dashboards[d.key] ?? b.payload : b.payload };
      }),
    ];
  }, [draft.dashboards, state?.dashboards, result?.preview.dashboards]);

  const pdfs = useMemo(() => {
    const byKey = new Map(draft.pdfs.map((p) => [p.key, p]));
    return [...draft.pdfs.filter((p) => !p.existing), ...(state?.pdfs ?? []).map((b) => byKey.get(b.key) ?? b)];
  }, [draft.pdfs, state?.pdfs]);

  const roles = useMemo(() => {
    const draftRoles = draft.roles || [];
    const byKey = new Map(draftRoles.map((r) => [r.key, r]));
    return [...draftRoles.filter((r) => !r.existing), ...(state?.roles ?? []).map((b) => (byKey.get(b.key) ? { ...b, ...byKey.get(b.key)!, people: b.people } : b))];
  }, [draft.roles, state?.roles]);
  // Tabelas para as regras dos cargos: as que existem (menos as excluidas) e as novas
  const roleTables = useMemo(() => {
    const out: Record<string, RoleTableInfo> = {};
    for (const t of tables) {
      if (t.removed) continue;
      const fields = (previews.get(t.key)?.fields ?? []) as unknown as Array<{ slug: string; label?: string; name?: string; type: string; options?: Array<string | { value: string; label: string }> }>;
      out[t.key] = {
        name: t.namePlural,
        fields: fields.filter((f) => !['section-title', 'sub-entity'].includes(f.type)).map((f) => ({
          slug: f.slug, label: f.label || f.name || f.slug, type: f.type,
          options: (f.options || []).map((o) => (typeof o === 'string' ? { value: o, label: o } : { value: o.value, label: o.label })),
        })),
      };
    }
    return out;
  }, [tables, previews]);

  const automations = useMemo(() => {
    const list = draft.automations || [];
    const byKey = new Map(list.map((a) => [a.key, a]));
    return [...list.filter((a) => !a.existing), ...(state?.automations ?? []).map((b) => byKey.get(b.key) ?? b)];
  }, [draft.automations, state?.automations]);

  // ── Mudancas no rascunho ──
  const putTable = (next: WsTable) => edit({ ...draft, tables: draft.tables.some((t) => t.key === next.key) ? draft.tables.map((t) => (t.key === next.key ? next : t)) : [...draft.tables, next] });
  const putDashboard = (next: WsDashboard) => edit({ ...draft, dashboards: draft.dashboards.some((d) => d.key === next.key) ? draft.dashboards.map((d) => (d.key === next.key ? next : d)) : [...draft.dashboards, next] });
  const putPdf = (next: WsPdf) => edit({ ...draft, pdfs: draft.pdfs.some((p) => p.key === next.key) ? draft.pdfs.map((p) => (p.key === next.key ? next : p)) : [...draft.pdfs, next] });
  const putRole = (next: WsRole) => {
    const list = draft.roles || [];
    edit({ ...draft, roles: list.some((r) => r.key === next.key) ? list.map((r) => (r.key === next.key ? next : r)) : [...list, next] });
  };
  const drop = (module: WsModule, key: string) => edit(withoutItem(draft, module, key));
  const putAutomation = (next: WsAutomation) => {
    const list = draft.automations || [];
    edit({ ...draft, automations: list.some((a) => a.key === next.key) ? list.map((a) => (a.key === next.key ? next : a)) : [...list, next] });
  };
  const addAutomation = () => {
    const key = `automacao-nova-${Date.now().toString(36)}`;
    const table = Object.keys(roleTables)[0];
    if (!table) return;
    putAutomation({ key, name: 'Nova automação', table, active: true, when: { event: 'created' }, conditions: [], actions: [{ type: 'notify', person: '', title: '', message: '' }] });
    setOpened((o) => ({ ...o, [`a:${key}`]: true }));
  };
  const addRole = () => {
    const key = `cargo-novo-${Date.now().toString(36)}`;
    putRole({ key, name: 'Novo cargo', description: '', modules: { dashboard: 'read', data: 'read' }, tables: [] });
    setOpened((o) => ({ ...o, [`r:${key}`]: true }));
  };
  const isOpen = (id: string, mark?: string) => opened[id] ?? (!!mark && mark !== 'removed');
  const toggle = (id: string, mark?: string) => setOpened((o) => ({ ...o, [id]: !isOpen(id, mark) }));

  const addTable = () => {
    const key = newTableKey();
    edit({ ...draft, tables: [{ key, name: 'Registro', namePlural: 'Nova tabela', description: '', fields: [{ key: 'nome', label: 'Nome', type: 'text', required: true, width: 'half' }] }, ...draft.tables] });
    setOpened((o) => ({ ...o, [`t:${key}`]: true }));
    setTab('tables');
  };

  // ── Aplicar ──
  const removals = changes.filter((c) => c.kind === 'delete' || c.removals?.length);
  const apply = async () => {
    setApplying(true);
    try {
      const res = await applyDraft(draft, confirmRemovals, chat.messages.filter((m) => m.role === 'user').map((m) => m.content));
      let rest = draft;
      for (const a of res.applied) rest = withoutItem(rest, a.module, a.key);
      // A lista nova dentro de uma tabela que ja existe vai junto com a tabela nova
      rest = { ...rest, tables: rest.tables.filter((t) => t.existing || !res.applied.some((a) => a.module === 'table' && a.key === t.key)) };
      setConfirming(false);
      setConfirmRemovals(false);
      setUndoStack([]);
      await refetch();
      if (res.failed) {
        toast.error(`Parou em "${res.failed.name}": ${res.failed.message}. O que veio antes já foi aplicado.`);
        edit(rest);
      } else {
        toast.success(res.applied.length === 1 ? '1 mudança aplicada.' : `${res.applied.length} mudanças aplicadas.`);
        replaceResult((prev) => (prev ? { ...BLANK, reply: prev.reply } : prev));
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Não foi possível aplicar.'));
    } finally {
      setApplying(false);
    }
  };

  if (isLoading || !state) {
    return <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  const counts = { tables: tables.length, dashboards: dashboards.length, pdfs: pdfs.length };
  const tabs: Array<{ key: Tab; label: string; icon: typeof Database; count?: number }> = [
    { key: 'tables', label: 'Tabelas', icon: Database, count: counts.tables },
    { key: 'dashboards', label: 'Painéis', icon: BarChart3, count: counts.dashboards },
    { key: 'pdfs', label: 'PDFs', icon: FileText, count: counts.pdfs },
    { key: 'roles', label: 'Cargos', icon: ShieldCheck, count: roles.length },
    { key: 'automations', label: 'Automações', icon: Zap, count: automations.length },
    { key: 'changes', label: 'Mudanças', icon: ListChecks, count: changes.length },
    { key: 'history', label: 'Histórico', icon: History },
  ];
  const marked = (status?: string) => !onlyChanges || !!status;

  const canvas = (
    <div className="space-y-3" data-testid="ws-canvas">
      <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn('flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors', tab === t.key ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            data-testid={`ws-tab-${t.key}`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={cn('rounded-full px-1.5 text-[11px]', t.key === 'changes' ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/15')}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      <AiWarnings warnings={result?.warnings ?? []} />

      {(tab === 'tables' || tab === 'dashboards' || tab === 'pdfs' || tab === 'roles' || tab === 'automations') && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span>Clique para abrir e mexer. O que muda fica marcado; nada é salvo antes de aplicar.</span>
          <span className="flex items-center gap-1">
            {changes.length > 0 && (
              <label className="flex items-center gap-1.5">
                <Checkbox checked={onlyChanges} onCheckedChange={(v) => setOnlyChanges(v === true)} /> Só o que muda
              </label>
            )}
            <Button variant="ghost" size="sm" className="h-7" onClick={undo} disabled={undoStack.length === 0} data-testid="ws-undo">
              <Undo2 className="mr-1 h-3.5 w-3.5" /> Desfazer
            </Button>
          </span>
        </div>
      )}

      {tab === 'tables' && (
        <div className="space-y-2" data-testid="ws-tables">
          {hasModulePermission('entities', 'canCreate') && (
            <Button variant="outline" size="sm" className="w-full border-dashed" onClick={addTable} data-testid="ws-add-table">
              <Plus className="mr-1.5 h-4 w-4" /> Tabela nova (à mão)
            </Button>
          )}
          {tables.filter((t) => marked(marks.tables[t.key]?.status)).map((t) => {
            const m = marks.tables[t.key];
            const id = `t:${t.key}`;
            return (
              <ItemShell
                key={t.key}
                testId={`ws-table-${t.key}`}
                icon={<Database className="h-4 w-4 shrink-0 text-primary" />}
                title={t.namePlural}
                subtitle={`${t.fields.filter((f) => !f.removed).length} campos${t.parentKey ? ` · dentro de ${names[t.parentKey] ?? t.parentKey}` : ''}`}
                mark={m?.status}
                open={isOpen(id, m?.status) && !t.removed}
                onToggle={() => toggle(id, m?.status)}
                actions={t.removed ? (
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => drop('table', t.key)} data-testid="ws-table-restore"><Undo2 className="mr-1 h-3.5 w-3.5" /> Desfazer</Button>
                ) : null}
              >
                <EditableTableCard
                  table={t}
                  tables={newTables}
                  names={names}
                  existingNames={existingNames}
                  existingParents={existingParents}
                  existingKeys={t.existing ? baseFieldKeys.get(t.key) : undefined}
                  fieldMarks={m?.fields}
                  preview={previews.get(t.key)}
                  onChange={(next) => putTable(t.existing ? { ...next, existing: true } : next)}
                  onRemove={() => (t.existing ? putTable({ ...t, removed: true }) : drop('table', t.key))}
                  removeLabel={t.existing ? 'Excluir tabela' : 'Tirar tabela'}
                  canRemove={!t.existing || can.tableDelete}
                />
              </ItemShell>
            );
          })}
        </div>
      )}

      {tab === 'dashboards' && (
        <div className="space-y-2" data-testid="ws-dashboards">
          {dashboards.length === 0 && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum painel ainda. Peça um na conversa: &quot;monte um painel com...&quot;.</p>}
          {dashboards.filter((d) => marked(marks.dashboards[d.draft.key])).map(({ draft: d, payload }) => (
            <DashboardItem
              key={d.key}
              dashboard={d}
              payload={payload}
              mark={marks.dashboards[d.key]}
              open={isOpen(`d:${d.key}`, marks.dashboards[d.key])}
              onToggle={() => toggle(`d:${d.key}`, marks.dashboards[d.key])}
              onChange={(next) => putDashboard(d.existing ? { ...next, existing: true } : next)}
              onRemove={() => (d.existing ? putDashboard({ ...d, removed: true }) : drop('dashboard', d.key))}
              onRestore={() => drop('dashboard', d.key)}
              canRemove={!d.existing || can.dashboardDelete}
              entityFields={(previews.get(payload?.entitySlug ?? '')?.fields ?? []) as EntityField[]}
            />
          ))}
        </div>
      )}

      {tab === 'pdfs' && (
        <div className="space-y-2" data-testid="ws-pdfs">
          {pdfs.length === 0 && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum PDF ainda. Peça um na conversa: &quot;monte um laudo em PDF com...&quot;.</p>}
          {pdfs.filter((p) => marked(marks.pdfs[p.key])).map((p) => (
            <PdfItem
              key={p.key}
              pdf={p}
              draft={draft}
              inDraft={draft.pdfs.some((x) => x.key === p.key)}
              previewable={result?.preview.pdfs[p.key]?.previewable ?? true}
              mark={marks.pdfs[p.key]}
              open={isOpen(`p:${p.key}`, marks.pdfs[p.key])}
              onToggle={() => toggle(`p:${p.key}`, marks.pdfs[p.key])}
              onChange={(next) => putPdf(p.existing ? { ...next, existing: true } : next)}
              onRemove={() => (p.existing ? putPdf({ ...p, removed: true }) : drop('pdf', p.key))}
              onRestore={() => drop('pdf', p.key)}
              canRemove={!p.existing || can.pdfDelete}
              tableName={names[p.table] ?? p.table}
            />
          ))}
        </div>
      )}

      {tab === 'roles' && (
        <div className="space-y-2" data-testid="ws-roles">
          {can.roleCreate && (
            <Button variant="outline" size="sm" className="w-full border-dashed" onClick={addRole} data-testid="ws-add-role">
              <Plus className="mr-1.5 h-4 w-4" /> Cargo novo (à mão)
            </Button>
          )}
          {roles.filter((r) => marked(marks.roles?.[r.key])).map((r) => (
            <RoleItem
              key={r.key}
              role={r}
              mark={marks.roles?.[r.key]}
              open={isOpen(`r:${r.key}`, marks.roles?.[r.key])}
              onToggle={() => toggle(`r:${r.key}`, marks.roles?.[r.key])}
              onChange={(next) => putRole(r.existing ? { ...next, existing: true } : next)}
              onRemove={() => (r.existing ? putRole({ ...r, removed: true }) : drop('role', r.key))}
              onRestore={() => drop('role', r.key)}
              canRemove={!r.existing || (can.roleDelete && !r.system)}
              tables={roleTables}
            />
          ))}
        </div>
      )}

      {tab === 'automations' && (
        <div className="space-y-2" data-testid="ws-automations">
          {can.automationCreate && (
            <Button variant="outline" size="sm" className="w-full border-dashed" onClick={addAutomation} disabled={Object.keys(roleTables).length === 0} data-testid="ws-add-automation">
              <Plus className="mr-1.5 h-4 w-4" /> Automação nova (à mão)
            </Button>
          )}
          {automations.length === 0 && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma automação ainda. Peça na conversa: &quot;quando um veículo for concluído, avise o gerente&quot;.</p>}
          {automations.filter((a) => marked(marks.automations?.[a.key])).map((a) => (
            <AutomationItem
              key={a.key}
              automation={a}
              mark={marks.automations?.[a.key]}
              open={isOpen(`a:${a.key}`, marks.automations?.[a.key])}
              onToggle={() => toggle(`a:${a.key}`, marks.automations?.[a.key])}
              onChange={(next) => putAutomation(a.existing ? { ...next, existing: true } : next)}
              onRemove={() => (a.existing ? putAutomation({ ...a, removed: true }) : drop('automation', a.key))}
              onRestore={() => drop('automation', a.key)}
              canRemove={!a.existing || can.automationDelete}
              tables={roleTables}
              people={state.people ?? []}
            />
          ))}
        </div>
      )}

      {tab === 'changes' && <ChangeList changes={changes} draft={draft} onUndo={(c) => drop(c.module, c.key)} />}

      {tab === 'history' && (
        <div className="space-y-2" data-testid="ws-history">
          {history.isLoading && <Skeleton className="h-24 w-full" />}
          {history.data?.length === 0 && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nada aplicado pelo construtor ainda.</p>}
          {history.data?.map((h) => (
            <Card key={h.id} data-testid="ws-history-item">
              <CardContent className="space-y-1.5 p-3 text-sm">
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{h.by}</span>
                  {h.impersonatedBy && <span>(pelo suporte: {h.impersonatedBy})</span>}
                  <span>{new Date(h.at).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}</span>
                  {h.viaAi && <span className="inline-flex items-center gap-1 text-primary"><Sparkles className="h-3 w-3" /> com a IA</span>}
                </p>
                {h.request.length > 0 && (
                  <div className="rounded bg-muted/50 px-2 py-1 text-xs">
                    <span className="font-medium">Pedido: </span>{h.request.join(' · ')}
                  </div>
                )}
                <ul className="space-y-0.5 text-xs">
                  {h.changes.map((c, i) => {
                    const ok = h.applied.some((a) => a.module === c.module && a.key === c.key);
                    return (
                      <li key={i} className={cn(!ok && 'text-muted-foreground line-through')}>
                        <span className="font-medium">{KIND_LABEL[c.kind]} {MODULE_LABEL[c.module].toLowerCase()} {c.name}</span>
                        {c.details.length > 0 && <span className="text-muted-foreground"> — {c.details.join('; ')}</span>}
                      </li>
                    );
                  })}
                </ul>
                {h.failed && <p className="text-xs text-destructive">Parou em &quot;{h.failed.name}&quot;: {h.failed.message}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {changes.length > 0 && (
        <Card className="sticky bottom-4 z-10 shadow-lg">
          <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {changes.length === 1 ? '1 mudança' : `${changes.length} mudanças`} no rascunho
              {removals.length > 0 && <span className="text-destructive"> · {removals.length} {removals.length === 1 ? 'exclusão' : 'exclusões'}</span>}
            </p>
            <span className="flex gap-2">
              <Button variant="outline" onClick={() => setTab('changes')}>Revisar</Button>
              <Button onClick={() => setConfirming(true)} disabled={chat.pending || applying} data-testid="ws-apply">
                <Check className="mr-1.5 h-4 w-4" /> Aplicar
              </Button>
            </span>
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <div className="space-y-3" data-testid="ws-builder">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Converse com a IA ou mexa à mão. Nada muda no sistema até você aplicar.</p>
        {result && (
          <Button variant="ghost" size="sm" onClick={restart}><RotateCcw className="mr-1.5 h-4 w-4" /> Recomeçar</Button>
        )}
      </div>

      {state.enabled ? (
        <AiBuilderLayout
          hasResult={!!result}
          reply={result?.reply}
          wide
          previewAlways
          previewLabel="Sistema"
          chat={(
            <AiChatPanel
              messages={chat.messages}
              pending={chat.pending}
              hasResult={!!result}
              onSend={chat.send}
              subtitle="Tabelas, painéis e PDFs juntos: crie, mude ou exclua. Nada muda até você aplicar."
              examples={EXAMPLES}
              placeholder="Ex.: quero controlar as vistorias, com fotos e um laudo em PDF"
              changePlaceholder='Peça uma mudança: "tire o campo cor", "ponha a placa no laudo"…'
            />
          )}
          preview={canvas}
        />
      ) : (
        <>
          <p className="flex items-center gap-1.5 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> A conversa com a IA não está ligada aqui. Dá para montar e ajustar tudo à mão.
          </p>
          {canvas}
        </>
      )}

      <Dialog open={confirming} onOpenChange={(o) => { if (!applying) { setConfirming(o); if (!o) setConfirmRemovals(false); } }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Aplicar as mudanças?</DialogTitle>
            <DialogDescription>Confira a lista. Fica salvo no histórico quem aplicou e o que foi pedido.</DialogDescription>
          </DialogHeader>
          <ChangeList changes={changes} compact />
          {removals.length > 0 && (
            <div className="space-y-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200" data-testid="ws-removals">
              <p className="flex items-center gap-1.5 font-medium"><AlertTriangle className="h-4 w-4" /> Exclusões</p>
              <ul className="list-inside list-disc text-xs">
                {removals.map((c) => (
                  <li key={`${c.module}:${c.key}`}>
                    {c.kind === 'delete'
                      ? <>{MODULE_LABEL[c.module]} {c.name}: {c.details.join('; ')}</>
                      : <>Em {c.name}: {c.removals!.join(', ')} (os dados gravados nele deixam de aparecer)</>}
                  </li>
                ))}
              </ul>
              <label className="flex items-start gap-2 text-xs">
                <Checkbox checked={confirmRemovals} onCheckedChange={(v) => setConfirmRemovals(v === true)} data-testid="ws-confirm-removals" />
                <span>Confirmo as exclusões acima.</span>
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={applying}>Voltar</Button>
            <Button onClick={() => void apply()} disabled={applying || (removals.length > 0 && !confirmRemovals)} data-testid="ws-apply-confirm">
              {applying ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : removals.length ? <Trash2 className="mr-1.5 h-4 w-4" /> : <Check className="mr-1.5 h-4 w-4" />}
              Aplicar {changes.length === 1 ? 'a mudança' : `as ${changes.length} mudanças`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Lista do que muda (aba Mudancas e confirmacao). */
function ChangeList({ changes, draft, onUndo, compact }: { changes: WsChange[]; draft?: WorkspaceDraft; onUndo?: (c: WsChange) => void; compact?: boolean }) {
  if (changes.length === 0) {
    return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nada mudou ainda. Converse com a IA ou mexa nas abas ao lado.</p>;
  }
  const inDraft = (c: WsChange) => {
    if (!draft) return false;
    const list = c.module === 'table' ? draft.tables : c.module === 'dashboard' ? draft.dashboards : c.module === 'role' ? draft.roles || [] : c.module === 'automation' ? draft.automations || [] : draft.pdfs;
    return list.some((x) => x.key === c.key);
  };
  const mark = { create: 'new', update: 'changed', delete: 'removed' } as const;
  return (
    <ul className={cn('divide-y rounded-lg border', compact && 'text-sm')} data-testid="ws-changes">
      {changes.map((c) => (
        <li key={`${c.module}:${c.key}`} className="flex items-start gap-2 px-3 py-2" data-testid="ws-change">
          <MarkBadge mark={mark[c.kind]} className="mt-0.5" />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{MODULE_LABEL[c.module]} {c.name}</span>
            {c.details.length > 0 && (
              <span className="block text-xs text-muted-foreground">{c.details.join(' · ')}</span>
            )}
          </span>
          {onUndo && inDraft(c) && (
            <Button size="sm" variant="ghost" className="h-7 shrink-0" onClick={() => onUndo(c)} data-testid="ws-change-undo">
              <Undo2 className="mr-1 h-3.5 w-3.5" /> Desfazer
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

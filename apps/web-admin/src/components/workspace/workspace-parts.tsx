'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, BarChart3, ChevronDown, ChevronRight, ExternalLink, Eye, EyeOff, FileText, Loader2, Trash2, Undo2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/i18n/tenant-navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EntityDashboard } from '@/components/dashboard-widgets/entity-dashboard';
import { MarkBadge } from '@/components/ai-builder/editable-table-card';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/get-error-message';
import { cn } from '@/lib/utils';
import type { EntityField } from '@/types';
import {
  previewWorkspacePdf, type WorkspaceDraft, type WsDashboard, type WsDashboardPayload, type WsMark, type WsPdf, type WsPdfSection,
} from '@/hooks/use-workspace';

/** Cabecalho de um item do construtor (abre e fecha o conteudo). */
export function ItemShell({ icon, title, subtitle, mark, open, onToggle, actions, children, testId }: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  mark?: WsMark;
  open: boolean;
  onToggle: () => void;
  actions?: ReactNode;
  children?: ReactNode;
  testId?: string;
}) {
  return (
    <Card className={cn(mark === 'removed' && 'border-red-200 bg-red-50/40 dark:border-red-900 dark:bg-red-950/10')} data-testid={testId}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={open}>
          {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
          {icon}
          <span className="min-w-0">
            <span className={cn('block truncate text-sm font-medium', mark === 'removed' && 'text-muted-foreground line-through')}>{title}</span>
            {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
          </span>
        </button>
        <MarkBadge mark={mark} />
        {actions}
      </div>
      {open && children && <div className="border-t p-3">{children}</div>}
    </Card>
  );
}

const WIDGET_LABEL: Record<string, string> = {
  'kpi-card': 'Número', 'line-chart': 'Gráfico por dia', 'bar-chart': 'Barras', 'donut-chart': 'Rosca', 'pie-chart': 'Pizza',
  'funnel-chart': 'Funil', 'stat-list': 'Lista colorida', 'kanban-board': 'Quadro', 'mini-table': 'Lista curta',
  'data-table': 'Tabela completa', 'activity-feed': 'Últimas alterações', keep: 'Bloco do editor',
};
const WIDTHS = [3, 4, 6, 8, 12];
const WIDTH_LABEL: Record<number, string> = { 3: '¼', 4: '⅓', 6: '½', 8: '⅔', 12: 'inteira' };

/** Painel no construtor: nome, blocos (titulo, largura, tirar, ordem das linhas) e a previa real. */
export function DashboardItem({ dashboard, payload, mark, open, onToggle, onChange, onRemove, onRestore, canRemove, entityFields }: {
  dashboard: WsDashboard;
  payload?: WsDashboardPayload;
  mark?: WsMark;
  open: boolean;
  onToggle: () => void;
  onChange: (next: WsDashboard) => void;
  onRemove: () => void;
  onRestore: () => void;
  canRemove: boolean;
  entityFields: EntityField[];
}) {
  const [showPreview, setShowPreview] = useState(false);
  const blocks = dashboard.tabs.reduce((s, t) => s + t.rows.flat().length, 0);
  const removed = mark === 'removed';
  const setTab = (ti: number, rows: WsDashboard['tabs'][number]['rows']) =>
    onChange({ ...dashboard, tabs: dashboard.tabs.map((t, i) => (i === ti ? { ...t, rows } : t)).filter((t) => t.rows.length > 0) });
  const moveRow = (ti: number, from: number, to: number) => {
    const rows = [...dashboard.tabs[ti].rows];
    if (to < 0 || to >= rows.length) return;
    const [r] = rows.splice(from, 1);
    rows.splice(to, 0, r);
    setTab(ti, rows);
  };
  return (
    <ItemShell
      testId={`ws-dashboard-${dashboard.key}`}
      icon={<BarChart3 className="h-4 w-4 shrink-0 text-primary" />}
      title={dashboard.name}
      subtitle={`${blocks} blocos${dashboard.tabs.length > 1 ? ` · ${dashboard.tabs.length} abas` : ''}${dashboard.roles?.length ? ` · ${dashboard.roles.join(', ')}` : ''}`}
      mark={mark}
      open={open && !removed}
      onToggle={onToggle}
      actions={removed ? (
        <Button size="sm" variant="ghost" className="h-7" onClick={onRestore}><Undo2 className="mr-1 h-3.5 w-3.5" /> Desfazer</Button>
      ) : canRemove ? (
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onRemove} aria-label="Excluir painel" data-testid="ws-dashboard-remove"><Trash2 className="h-3.5 w-3.5" /></Button>
      ) : null}
    >
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={dashboard.name} onChange={(e) => onChange({ ...dashboard, name: e.target.value })} className="h-9 rounded border bg-background px-2 text-sm font-medium" aria-label="Nome do painel" />
          <input value={dashboard.description} onChange={(e) => onChange({ ...dashboard, description: e.target.value })} placeholder="Descrição" className="h-9 rounded border bg-background px-2 text-sm" aria-label="Descrição do painel" />
        </div>
        {dashboard.tabs.map((tab, ti) => (
          <div key={ti} className="space-y-1.5 rounded-lg border p-2">
            <input
              value={tab.label}
              onChange={(e) => onChange({ ...dashboard, tabs: dashboard.tabs.map((t, i) => (i === ti ? { ...t, label: e.target.value } : t)) })}
              className="w-full rounded border border-transparent bg-transparent px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:border-border focus:border-primary focus:outline-none"
              aria-label="Nome da aba"
            />
            {tab.rows.map((row, ri) => (
              <div key={ri} className="flex items-start gap-1.5">
                <div className="flex flex-col">
                  <Button size="icon" variant="ghost" className="h-6 w-6" disabled={ri === 0} onClick={() => moveRow(ti, ri, ri - 1)} aria-label="Subir linha"><ArrowUp className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" disabled={ri === tab.rows.length - 1} onClick={() => moveRow(ti, ri, ri + 1)} aria-label="Descer linha"><ArrowDown className="h-3 w-3" /></Button>
                </div>
                <div className="grid flex-1 grid-cols-12 gap-1.5">
                  {row.map((w, wi) => (
                    <div key={`${w.ref ?? ''}-${wi}`} className="col-span-12 flex items-center gap-1 rounded border bg-muted/30 px-1.5 py-1 sm:col-span-6 lg:col-span-4" data-testid="ws-block">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <input
                          value={w.title}
                          onChange={(e) => setTab(ti, tab.rows.map((r, i) => (i === ri ? r.map((x, j) => (j === wi ? { ...x, title: e.target.value } : x)) : r)))}
                          className="w-full bg-transparent text-xs font-medium focus:outline-none"
                          aria-label="Título do bloco"
                        />
                        <span className="text-[10px] text-muted-foreground">{WIDGET_LABEL[w.type] ?? 'Bloco'}</span>
                      </span>
                      <select
                        value={WIDTHS.includes(Number(w.width)) ? Number(w.width) : ''}
                        onChange={(e) => setTab(ti, tab.rows.map((r, i) => (i === ri ? r.map((x, j) => (j === wi ? { ...x, width: Number(e.target.value) } : x)) : r)))}
                        className="h-6 rounded border bg-background text-[10px]"
                        aria-label="Largura do bloco"
                      >
                        {!WIDTHS.includes(Number(w.width)) && <option value="">{w.width}/12</option>}
                        {WIDTHS.map((n) => <option key={n} value={n}>{WIDTH_LABEL[n]}</option>)}
                      </select>
                      <button
                        type="button"
                        onClick={() => setTab(ti, tab.rows.map((r, i) => (i === ri ? r.filter((_, j) => j !== wi) : r)).filter((r) => r.length > 0))}
                        aria-label="Tirar bloco"
                        data-testid="ws-block-remove"
                      >
                        <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowPreview((v) => !v)} disabled={!payload} data-testid="ws-dashboard-preview">
            {showPreview ? <EyeOff className="mr-1.5 h-4 w-4" /> : <Eye className="mr-1.5 h-4 w-4" />}
            {showPreview ? 'Esconder o painel' : 'Ver o painel com os dados'}
          </Button>
          {dashboard.existing && (
            <Button size="sm" variant="ghost" asChild>
              <Link href={`/gestao/dashboard-templates/${dashboard.key}`}><ExternalLink className="mr-1.5 h-4 w-4" />Editor completo</Link>
            </Button>
          )}
        </div>
        {showPreview && payload && (
          <div className="rounded-xl border bg-muted/20 p-3">
            <EntityDashboard key={JSON.stringify(payload.layout)} entitySlug={payload.entitySlug} entityFields={entityFields} previewTemplate={payload} />
          </div>
        )}
      </div>
    </ItemShell>
  );
}

const SECTION_LABEL: Record<WsPdfSection['kind'], string> = {
  heading: 'Subtítulo', fields: 'Campos', text: 'Texto', items: 'Lista de itens', photos: 'Fotos', signature: 'Assinatura', divider: 'Linha',
};

/** PDF no construtor: nome, partes (quando novo ou refeito) e a previa com dados de exemplo. */
export function PdfItem({ pdf, draft, inDraft, previewable, mark, open, onToggle, onChange, onRemove, onRestore, canRemove, tableName }: {
  pdf: WsPdf;
  /** Rascunho inteiro (a previa de PDF novo e montada no servidor). */
  draft: WorkspaceDraft;
  inDraft: boolean;
  previewable: boolean;
  mark?: WsMark;
  open: boolean;
  onToggle: () => void;
  onChange: (next: WsPdf) => void;
  onRemove: () => void;
  onRestore: () => void;
  canRemove: boolean;
  tableName: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const removed = mark === 'removed';
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const sections = pdf.sections || [];
  const setSection = (i: number, patch: Partial<WsPdfSection>) => onChange({ ...pdf, sections: sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const move = (from: number, to: number) => {
    if (to < 0 || to >= sections.length) return;
    const next = [...sections];
    const [s] = next.splice(from, 1);
    next.splice(to, 0, s);
    onChange({ ...pdf, sections: next });
  };
  const preview = async () => {
    if (url) { setUrl(null); return; }
    setLoading(true);
    try {
      const blob = inDraft && pdf.sections?.length
        ? await previewWorkspacePdf(draft, pdf.key)
        : (await api.post(`/pdf-templates/${pdf.key}/preview`, {}, { responseType: 'blob', timeout: 60_000 })).data as Blob;
      setUrl(URL.createObjectURL(blob));
    } catch (error) {
      toast.error(getErrorMessage(error, 'Não foi possível montar a prévia.'));
    } finally {
      setLoading(false);
    }
  };
  return (
    <ItemShell
      testId={`ws-pdf-${pdf.key}`}
      icon={<FileText className="h-4 w-4 shrink-0 text-primary" />}
      title={pdf.name}
      subtitle={`Um documento por registro de ${tableName}${pdf.sections?.length && pdf.existing ? ' · conteúdo refeito' : ''}`}
      mark={mark}
      open={open && !removed}
      onToggle={onToggle}
      actions={removed ? (
        <Button size="sm" variant="ghost" className="h-7" onClick={onRestore}><Undo2 className="mr-1 h-3.5 w-3.5" /> Desfazer</Button>
      ) : canRemove ? (
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onRemove} aria-label="Excluir PDF" data-testid="ws-pdf-remove"><Trash2 className="h-3.5 w-3.5" /></Button>
      ) : null}
    >
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={pdf.name} onChange={(e) => onChange({ ...pdf, name: e.target.value })} className="h-9 rounded border bg-background px-2 text-sm font-medium" aria-label="Nome do PDF" />
          <input value={pdf.description} onChange={(e) => onChange({ ...pdf, description: e.target.value })} placeholder="Descrição" className="h-9 rounded border bg-background px-2 text-sm" aria-label="Descrição do PDF" />
        </div>
        {sections.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {sections.map((s, i) => (
              <li key={i} className="flex items-start gap-1.5 px-2 py-1.5" data-testid="ws-pdf-section">
                <span className="mt-1 w-24 shrink-0 text-[11px] font-medium text-muted-foreground">{SECTION_LABEL[s.kind] ?? s.kind}</span>
                <span className="min-w-0 flex-1">
                  {s.kind === 'text' ? (
                    <textarea value={s.text ?? ''} onChange={(e) => setSection(i, { text: e.target.value })} rows={2} className="w-full rounded border bg-background px-1.5 py-1 text-xs" aria-label="Texto" />
                  ) : s.kind === 'divider' ? (
                    <span className="block pt-1 text-xs text-muted-foreground">—</span>
                  ) : (
                    <input value={s.title ?? ''} onChange={(e) => setSection(i, { title: e.target.value })} placeholder="Sem subtítulo" className="w-full rounded border border-transparent bg-transparent px-1 text-xs hover:border-border focus:border-primary focus:outline-none" aria-label="Subtítulo" />
                  )}
                  {s.fields && s.fields.length > 0 && <span className="block truncate px-1 text-[10px] text-muted-foreground">{s.fields.join(', ')}</span>}
                </span>
                <Button size="icon" variant="ghost" className="h-6 w-6" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label="Subir"><ArrowUp className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" disabled={i === sections.length - 1} onClick={() => move(i, i + 1)} aria-label="Descer"><ArrowDown className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => onChange({ ...pdf, sections: sections.filter((_, j) => j !== i) })} aria-label="Tirar parte"><X className="h-3 w-3" /></Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void preview()} disabled={loading || (inDraft && !!pdf.sections?.length && !previewable)} data-testid="ws-pdf-preview">
            {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : url ? <EyeOff className="mr-1.5 h-4 w-4" /> : <Eye className="mr-1.5 h-4 w-4" />}
            {url ? 'Esconder o PDF' : 'Ver o PDF com dados de exemplo'}
          </Button>
          {pdf.existing && (
            <Button size="sm" variant="ghost" asChild>
              <Link href={`/gestao/pdf-templates/${pdf.key}`}><ExternalLink className="mr-1.5 h-4 w-4" />Editor completo</Link>
            </Button>
          )}
        </div>
        {inDraft && !!pdf.sections?.length && !previewable && <p className="text-xs text-muted-foreground">A prévia aparece depois de aplicar: a tabela deste PDF ainda vai ser criada.</p>}
        {url && <iframe src={url} title="Prévia do PDF" className="h-[70vh] w-full rounded border" data-testid="ws-pdf-frame" />}
      </div>
    </ItemShell>
  );
}

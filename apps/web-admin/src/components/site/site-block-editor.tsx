'use client';

import { ArrowDown, ArrowUp, Heading, Image as ImageIcon, ListChecks, Minus, MousePointerClick, Send, Trash2, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import ImageUploadField from '@/components/form/image-upload-field';
import { fieldKind } from '@/lib/field-catalog';
import type { SiteBlockDraft } from '@/hooks/use-site-pages';

export type EditorEntity = {
  id: string;
  slug: string;
  name: string;
  namePlural?: string;
  settings?: { statusField?: string; titleField?: string } | null;
  fields?: Array<{ slug: string; name?: string; label?: string; type: string; required?: boolean; options?: unknown[]; subEntitySlug?: string; subEntityId?: string }>;
};
export type EditorPdf = { id: string; name: string; sourceEntityId?: string | null; isPublished?: boolean; templateType?: string };

/** Mesmas listas do servidor (site-blocks.ts). */
const FORM_TYPES = new Set(['text', 'textarea', 'number', 'currency', 'percentage', 'rating', 'date', 'datetime', 'time', 'select', 'multiselect', 'radio-group', 'checkbox-group', 'boolean', 'tags', 'phone', 'email', 'cpf', 'cnpj', 'cep', 'url', 'image', 'file']);
const TRACK_TYPES = new Set([...Array.from(FORM_TYPES), 'relation', 'user-select', 'formula', 'rollup', 'workflow-status']);
const NOT_REQUIRED = new Set(['section-title', 'sub-entity', 'formula', 'rollup', 'timer', 'sla-status', 'action-button', 'hidden']);

export const BLOCK_KINDS: Array<{ type: string; label: string; icon: typeof Type; hint: string }> = [
  { type: 'heading', label: 'Título', icon: Heading, hint: 'Um título em destaque' },
  { type: 'text', label: 'Texto', icon: Type, hint: 'Explicação, instruções, contato' },
  { type: 'image', label: 'Imagem', icon: ImageIcon, hint: 'Foto ou banner' },
  { type: 'button', label: 'Botão', icon: MousePointerClick, hint: 'Leva para um link (WhatsApp, site...)' },
  { type: 'divider', label: 'Linha', icon: Minus, hint: 'Separa partes da página' },
  { type: 'form', label: 'Formulário', icon: Send, hint: 'O cliente preenche e vira registro' },
  { type: 'tracking', label: 'Acompanhamento', icon: ListChecks, hint: 'O cliente acompanha o registro pelo link' },
];

const labelOf = (f: { label?: string; name?: string; slug: string }) => f.label || f.name || f.slug;

export function blockSummary(b: SiteBlockDraft, entities: EditorEntity[]): string {
  const ent = entities.find((e) => e.slug === b.entitySlug);
  switch (b.type) {
    case 'heading': case 'text': return String(b.text || '').slice(0, 60) || 'Vazio';
    case 'image': return b.url ? 'Imagem escolhida' : 'Sem imagem';
    case 'button': return String(b.label || 'Sem texto');
    case 'divider': return '';
    case 'form': return ent ? `Guarda em ${ent.namePlural || ent.name} · ${(b.fields as string[] | undefined)?.length ?? 0} campos` : 'Escolha a tabela';
    case 'tracking': return ent ? `${ent.namePlural || ent.name} · ${(b.fields as string[] | undefined)?.length ?? 0} campos` : 'Escolha a tabela';
    default: return '';
  }
}

interface BlockCardProps {
  block: SiteBlockDraft;
  open: boolean;
  onToggle: () => void;
  onChange: (patch: Record<string, unknown>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  first: boolean;
  last: boolean;
  entities: EditorEntity[];
  pdfs: EditorPdf[];
}

export function BlockCard({ block, open, onToggle, onChange, onMove, onRemove, first, last, entities, pdfs }: BlockCardProps) {
  const kind = BLOCK_KINDS.find((k) => k.type === block.type);
  const Icon = kind?.icon ?? Type;
  return (
    <div className="rounded-lg border bg-card" data-testid={`block-${block.type}`}>
      <div className="flex items-center gap-2 p-2.5">
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted"><Icon className="h-4 w-4" /></span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">{kind?.label ?? block.type}</span>
            <span className="block truncate text-xs text-muted-foreground">{blockSummary(block, entities)}</span>
          </span>
        </button>
        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={first} onClick={() => onMove(-1)} aria-label="Subir"><ArrowUp className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={last} onClick={() => onMove(1)} aria-label="Descer"><ArrowDown className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onRemove} aria-label="Remover"><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
      {open && <div className="space-y-3 border-t p-3"><BlockFields block={block} onChange={onChange} entities={entities} pdfs={pdfs} /></div>}
    </div>
  );
}

function BlockFields({ block, onChange, entities, pdfs }: { block: SiteBlockDraft; onChange: (patch: Record<string, unknown>) => void; entities: EditorEntity[]; pdfs: EditorPdf[] }) {
  switch (block.type) {
    case 'heading':
      return (
        <>
          <Input value={String(block.text ?? '')} onChange={(e) => onChange({ text: e.target.value })} placeholder="Ex.: Avise seu sinistro" />
          <div className="flex gap-2">
            {(['lg', 'md'] as const).map((s) => (
              <Button key={s} size="sm" variant={(block.size ?? 'lg') === s ? 'default' : 'outline'} onClick={() => onChange({ size: s })}>{s === 'lg' ? 'Grande' : 'Médio'}</Button>
            ))}
          </div>
        </>
      );
    case 'text':
      return <Textarea rows={4} value={String(block.text ?? '')} onChange={(e) => onChange({ text: e.target.value })} placeholder="Ex.: Em caso de dúvida, chame no WhatsApp (11) 99999-0000." />;
    case 'image':
      return (
        <>
          <ImageUploadField value={String(block.url ?? '')} onChange={(v) => onChange({ url: Array.isArray(v) ? v[0] : v })} mode="image" folder="site" />
          <Input value={String(block.alt ?? '')} onChange={(e) => onChange({ alt: e.target.value })} placeholder="Descrição da imagem (opcional)" />
        </>
      );
    case 'button':
      return (
        <>
          <Input value={String(block.label ?? '')} onChange={(e) => onChange({ label: e.target.value })} placeholder="Texto do botão. Ex.: Fale no WhatsApp" />
          <Input value={String(block.url ?? '')} onChange={(e) => onChange({ url: e.target.value })} placeholder="Link. Ex.: https://wa.me/5511999990000" />
        </>
      );
    case 'divider':
      return <p className="text-xs text-muted-foreground">Uma linha fina separando as partes da página.</p>;
    case 'form':
      return <FormFields block={block} onChange={onChange} entities={entities} />;
    case 'tracking':
      return <TrackingFields block={block} onChange={onChange} entities={entities} pdfs={pdfs} />;
    default:
      return null;
  }
}

function TableSelect({ value, entities, onChange }: { value: unknown; entities: EditorEntity[]; onChange: (slug: string) => void }) {
  return (
    <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
      <option value="">Escolha a tabela…</option>
      {entities.map((e) => <option key={e.slug} value={e.slug}>{e.namePlural || e.name}</option>)}
    </select>
  );
}

function FieldChecklist({ fields, selected, locked, onToggle }: {
  fields: NonNullable<EditorEntity['fields']>; selected: string[]; locked?: Set<string>; onToggle: (slug: string, on: boolean) => void;
}) {
  return (
    <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
      {fields.map((f) => {
        const Icon = fieldKind(f.type).icon;
        const isLocked = locked?.has(f.slug);
        return (
          <label key={f.slug} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted/50">
            <input type="checkbox" className="h-4 w-4" checked={selected.includes(f.slug) || !!isLocked} disabled={isLocked} onChange={(e) => onToggle(f.slug, e.target.checked)} />
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="flex-1">{labelOf(f)}</span>
            {isLocked && <span className="text-[10px] text-muted-foreground">obrigatório</span>}
          </label>
        );
      })}
    </div>
  );
}

function FormFields({ block, onChange, entities }: { block: SiteBlockDraft; onChange: (patch: Record<string, unknown>) => void; entities: EditorEntity[] }) {
  const entity = entities.find((e) => e.slug === block.entitySlug);
  const fields = (entity?.fields || []).filter((f) => FORM_TYPES.has(f.type));
  const statusSlug = entity?.settings?.statusField;
  const required = new Set((entity?.fields || []).filter((f) => f.required && !NOT_REQUIRED.has(f.type) && f.slug !== statusSlug).map((f) => f.slug));
  const selected = Array.from(new Set([...((block.fields as string[] | undefined) || []), ...Array.from(required)]));
  const status = statusSlug ? entity?.fields?.find((f) => f.slug === statusSlug) : undefined;
  const firstStatus = status?.options?.[0] as { label?: string } | string | undefined;
  const pickTable = (slug: string) => {
    const e = entities.find((x) => x.slug === slug);
    const req = (e?.fields || []).filter((f) => f.required && !NOT_REQUIRED.has(f.type) && f.slug !== e?.settings?.statusField).map((f) => f.slug);
    onChange({ entitySlug: slug, fields: req });
  };
  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs">Onde as respostas são guardadas</Label>
        <TableSelect value={block.entitySlug} entities={entities} onChange={pickTable} />
      </div>
      {entity && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Campos que o cliente preenche</Label>
            <FieldChecklist fields={fields} selected={selected} locked={required}
              onToggle={(slug, on) => onChange({ fields: on ? [...selected, slug] : selected.filter((s) => s !== slug) })} />
            {status && !selected.includes(status.slug) && firstStatus && (
              <p className="text-[11px] text-muted-foreground">
                {labelOf(status)} começa como “{typeof firstStatus === 'string' ? firstStatus : firstStatus.label}”.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Texto do botão</Label>
            <Input value={String(block.submitLabel ?? 'Enviar')} onChange={(e) => onChange({ submitLabel: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Mensagem depois de enviar</Label>
            <Textarea rows={2} value={String(block.successMessage ?? '')} onChange={(e) => onChange({ successMessage: e.target.value })} placeholder="Recebemos suas informações. Obrigado!" />
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>
              Mostrar o link de acompanhamento depois de enviar
              <span className="block text-[11px] text-muted-foreground">Precisa de uma página de acompanhamento publicada para {entity.namePlural || entity.name}.</span>
            </span>
            <Switch checked={block.showTrackingLink !== false} onCheckedChange={(v) => onChange({ showTrackingLink: v })} />
          </label>
        </>
      )}
    </>
  );
}

function TrackingFields({ block, onChange, entities, pdfs }: { block: SiteBlockDraft; onChange: (patch: Record<string, unknown>) => void; entities: EditorEntity[]; pdfs: EditorPdf[] }) {
  const entity = entities.find((e) => e.slug === block.entitySlug);
  const all = entity?.fields || [];
  const shown = all.filter((f) => TRACK_TYPES.has(f.type) && !['image', 'file'].includes(f.type));
  const subs = all.filter((f) => f.type === 'sub-entity');
  const files = all.filter((f) => f.type === 'image' || f.type === 'file');
  const selected = (block.fields as string[] | undefined) || [];
  const uploads = (block.uploadFields as string[] | undefined) || [];
  const entityPdfs = pdfs.filter((p) => p.sourceEntityId === entity?.id && p.isPublished !== false && p.templateType !== 'batch');
  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs">O cliente acompanha</Label>
        <TableSelect value={block.entitySlug} entities={entities} onChange={(slug) => onChange({ entitySlug: slug, fields: [], uploadFields: [], timelineField: undefined, pdfTemplateId: undefined })} />
      </div>
      {entity && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">O que o cliente vê (a situação aparece sempre em destaque)</Label>
            <FieldChecklist fields={shown} selected={selected} onToggle={(slug, on) => onChange({ fields: on ? [...selected, slug] : selected.filter((s) => s !== slug) })} />
          </div>
          {subs.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Histórico</Label>
              <select value={String(block.timelineField ?? '')} onChange={(e) => onChange({ timelineField: e.target.value || undefined })} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">Não mostrar</option>
                {subs.map((f) => <option key={f.slug} value={f.slug}>{labelOf(f)}</option>)}
              </select>
            </div>
          )}
          {files.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">O cliente pode enviar</Label>
              <FieldChecklist fields={files} selected={uploads} onToggle={(slug, on) => onChange({ uploadFields: on ? [...uploads, slug] : uploads.filter((s) => s !== slug) })} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Documento para baixar (PDF publicado)</Label>
            <select value={String(block.pdfTemplateId ?? '')} onChange={(e) => onChange({ pdfTemplateId: e.target.value || undefined })} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">Nenhum</option>
              {entityPdfs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </>
      )}
    </>
  );
}

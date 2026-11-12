'use client';

import {
  BadgeDollarSign, Building2, CircleHelp, GalleryHorizontalEnd, Hash, Heading, Image as ImageIcon, LayoutGrid, ListChecks, Map as MapIcon,
  MessageSquareQuote, Minus, MousePointerClick, MoveVertical, Plus, Quote, Send, Shapes, Share2, Store, Trash2, Type, Video, Wallpaper,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import ImageUploadField from '@/components/form/image-upload-field';
import { fieldKind } from '@/lib/field-catalog';
import type { SiteBlockDraft } from '@/hooks/use-site-pages';
import type { SiteAppearance, SiteTheme } from '@/lib/site-api';

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
const MATCH_TYPES = new Set(['text', 'cpf', 'cnpj', 'email', 'phone']);

/** Tabela "de cima" (a que tem esta como lista dentro). */
export function parentOf(entity: EditorEntity | undefined, entities: EditorEntity[]): EditorEntity | undefined {
  if (!entity) return undefined;
  return entities.find((e) => (e.fields || []).some((f) => f.type === 'sub-entity' && (f.subEntitySlug === entity.slug || f.subEntityId === entity.id)));
}

function requiredOf(e: EditorEntity | undefined): string[] {
  return (e?.fields || []).filter((f) => f.required && !NOT_REQUIRED.has(f.type) && f.slug !== e?.settings?.statusField).map((f) => f.slug);
}

function suggestMatch(e: EditorEntity): string | undefined {
  const fields = e.fields || [];
  return fields.find((f) => f.type === 'cpf')?.slug ?? fields.find((f) => f.type === 'cnpj')?.slug
    ?? fields.find((f) => f.type === 'text' && /cpf|cnpj|documento/i.test(`${f.slug} ${f.label ?? ''}`))?.slug
    ?? fields.find((f) => f.type === 'email')?.slug;
}

export const BLOCK_KINDS: Array<{ type: string; label: string; icon: typeof Type; hint: string }> = [
  { type: 'hero', label: 'Destaque com foto', icon: Wallpaper, hint: 'Foto grande com título e botão por cima' },
  { type: 'heading', label: 'Título', icon: Heading, hint: 'Um título em destaque' },
  { type: 'text', label: 'Texto', icon: Type, hint: 'Explicação, instruções, contato' },
  { type: 'image', label: 'Imagem', icon: ImageIcon, hint: 'Foto ou banner' },
  { type: 'button', label: 'Botão', icon: MousePointerClick, hint: 'Leva para um link (WhatsApp, site...)' },
  { type: 'gallery', label: 'Galeria de fotos', icon: GalleryHorizontalEnd, hint: 'Várias fotos: polaroide, grade ou mosaico' },
  { type: 'cards', label: 'Cartões', icon: LayoutGrid, hint: 'Destaques em colunas, com foto e texto' },
  { type: 'quote', label: 'Citação', icon: Quote, hint: 'Uma frase em destaque (depoimento, lema)' },
  { type: 'catalog', label: 'Vitrine de uma tabela', icon: Store, hint: 'Mostra os itens de uma tabela (cardápio, produtos)' },
  { type: 'divider', label: 'Linha', icon: Minus, hint: 'Separa partes da página' },
  { type: 'video', label: 'Vídeo', icon: Video, hint: 'YouTube, Vimeo ou vídeo do computador' },
  { type: 'map', label: 'Mapa', icon: MapIcon, hint: 'Mapa do Google com o endereço' },
  { type: 'faq', label: 'Perguntas', icon: CircleHelp, hint: 'Perguntas frequentes que abrem e fecham' },
  { type: 'icons', label: 'Ícones com texto', icon: Shapes, hint: 'Serviços ou vantagens com ícone' },
  { type: 'stats', label: 'Números', icon: Hash, hint: 'Ex.: +500 clientes, 10 anos' },
  { type: 'pricing', label: 'Preços', icon: BadgeDollarSign, hint: 'Planos ou pacotes lado a lado' },
  { type: 'testimonials', label: 'Depoimentos', icon: MessageSquareQuote, hint: 'O que os clientes dizem' },
  { type: 'logos', label: 'Logos', icon: Building2, hint: 'Clientes, parceiros, marcas' },
  { type: 'social', label: 'Redes sociais', icon: Share2, hint: 'Instagram, WhatsApp, Facebook…' },
  { type: 'spacer', label: 'Espaço', icon: MoveVertical, hint: 'Um respiro entre partes da página' },
  { type: 'form', label: 'Formulário', icon: Send, hint: 'O cliente preenche e vira registro' },
  { type: 'tracking', label: 'Acompanhamento', icon: ListChecks, hint: 'O cliente acompanha o registro pelo link' },
];

const labelOf = (f: { label?: string; name?: string; slug: string }) => f.label || f.name || f.slug;

export function BlockFields({ block, onChange, entities, pdfs }: { block: SiteBlockDraft; onChange: (patch: Record<string, unknown>) => void; entities: EditorEntity[]; pdfs: EditorPdf[] }) {
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
          <Input value={String(block.url ?? '')} onChange={(e) => onChange({ url: e.target.value })} placeholder="Link: https://wa.me/55119…, ou o endereço de outra página (ex.: cardapio)" />
        </>
      );
    case 'divider':
      return <p className="text-xs text-muted-foreground">Uma linha fina separando as partes da página.</p>;
    case 'hero':
      return (
        <>
          <ImagePick value={block.imageUrl} onChange={(url) => onChange({ imageUrl: url })} />
          <Input value={String(block.title ?? '')} onChange={(e) => onChange({ title: e.target.value })} placeholder="Título. Ex.: Bem-vindo, mestre!" />
          <Textarea rows={2} value={String(block.text ?? '')} onChange={(e) => onChange({ text: e.target.value })} placeholder="Frase de apoio (opcional)" />
          <div className="grid grid-cols-2 gap-2">
            <Input value={String(block.buttonLabel ?? '')} onChange={(e) => onChange({ buttonLabel: e.target.value })} placeholder="Texto do botão" />
            <Input value={String(block.buttonUrl ?? '')} onChange={(e) => onChange({ buttonUrl: e.target.value })} placeholder="Link do botão" />
          </div>
        </>
      );
    case 'gallery':
      return <GalleryFields block={block} onChange={onChange} />;
    case 'cards':
      return <CardsFields block={block} onChange={onChange} />;
    case 'quote':
      return (
        <>
          <Textarea rows={3} value={String(block.text ?? '')} onChange={(e) => onChange({ text: e.target.value })} placeholder="Ex.: O melhor chá da tarde da cidade!" />
          <Input value={String(block.author ?? '')} onChange={(e) => onChange({ author: e.target.value })} placeholder="Quem disse (opcional)" />
        </>
      );
    case 'catalog':
      return <CatalogFields block={block} onChange={onChange} entities={entities} />;
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
  const top = parentOf(entity, entities);
  const parent = (block.parent as { fields?: string[]; matchField?: string; title?: string } | undefined) || {};
  const topRequired = new Set(requiredOf(top));
  const parentSelected = Array.from(new Set([...(parent.fields || []), ...Array.from(topRequired)]));
  const setParent = (patch: Record<string, unknown>) => onChange({ parent: { ...parent, entitySlug: top?.slug, fields: parentSelected, ...patch } });
  const pickTable = (slug: string) => {
    const e = entities.find((x) => x.slug === slug);
    const up = parentOf(e, entities);
    onChange({
      entitySlug: slug,
      fields: requiredOf(e),
      parent: up ? { entitySlug: up.slug, fields: requiredOf(up), matchField: suggestMatch(up) } : undefined,
    });
  };
  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs">Onde as respostas são guardadas</Label>
        <TableSelect value={block.entitySlug} entities={entities} onChange={pickTable} />
      </div>
      {entity && top && (
        <div className="space-y-2 rounded-md border border-dashed p-2.5" data-testid="form-parent">
          <p className="text-xs font-medium">
            {entity.namePlural || entity.name} fica dentro de {top.namePlural || top.name}: o cliente preenche também os dados de {top.name.toLowerCase()}.
          </p>
          <FieldChecklist fields={(top.fields || []).filter((f) => FORM_TYPES.has(f.type))} selected={parentSelected} locked={topRequired}
            onToggle={(slug, on) => setParent({ fields: on ? [...parentSelected, slug] : parentSelected.filter((x) => x !== slug) })} />
          <div className="space-y-1">
            <Label className="text-xs">Se já existir {top.name.toLowerCase()} com o mesmo…</Label>
            <select value={parent.matchField ?? ''} onChange={(e) => setParent({ matchField: e.target.value || undefined })} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">Sempre criar um novo</option>
              {(top.fields || []).filter((f) => MATCH_TYPES.has(f.type) && parentSelected.includes(f.slug)).map((f) => (
                <option key={f.slug} value={f.slug}>{labelOf(f)} (usa o mesmo, sem alterar os dados dele)</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Título dessa parte</Label>
            <Input value={parent.title ?? ''} onChange={(e) => setParent({ title: e.target.value })} placeholder="Seus dados" />
          </div>
        </div>
      )}
      {entity && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Campos {top ? `de ${entity.name.toLowerCase()}` : ''} que o cliente preenche</Label>
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

/** Foto: enviar do computador ou colar o link. */
export function ImagePick({ value, onChange }: { value: unknown; onChange: (url: string) => void }) {
  const url = String(value ?? '');
  return (
    <div className="space-y-1.5">
      <ImageUploadField value={url} onChange={(v) => onChange(String(Array.isArray(v) ? v[0] ?? '' : v))} mode="image" folder="site" />
      <Input value={url} onChange={(e) => onChange(e.target.value.trim())} placeholder="…ou cole o link da imagem (https://…)" className="h-8 text-xs" />
    </div>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <Button key={String(o.value)} type="button" size="sm" variant={value === o.value ? 'default' : 'outline'} onClick={() => onChange(o.value)}>{o.label}</Button>
      ))}
    </div>
  );
}

type GalleryImage = { url: string; caption?: string };

function GalleryFields({ block, onChange }: { block: SiteBlockDraft; onChange: (patch: Record<string, unknown>) => void }) {
  const images = (block.images as GalleryImage[] | undefined) || [];
  const setImages = (next: GalleryImage[]) => onChange({ images: next });
  return (
    <>
      <Input value={String(block.title ?? '')} onChange={(e) => onChange({ title: e.target.value })} placeholder="Título da galeria (opcional)" />
      <div className="space-y-1.5">
        <Label className="text-xs">Jeito de mostrar</Label>
        <Segmented value={(block.layout as string) || 'polaroid'} onChange={(v) => onChange({ layout: v })}
          options={[{ value: 'polaroid', label: 'Polaroide' }, { value: 'mosaic', label: 'Mosaico' }, { value: 'grid', label: 'Grade' }]} />
      </div>
      {images.map((img, i) => (
        <div key={i} className="space-y-1.5 rounded-md border p-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Foto {i + 1}</span>
            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => setImages(images.filter((_, x) => x !== i))} aria-label="Remover foto"><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
          <ImagePick value={img.url} onChange={(url) => setImages(images.map((x, n) => (n === i ? { ...x, url } : x)))} />
          <Input value={img.caption ?? ''} onChange={(e) => setImages(images.map((x, n) => (n === i ? { ...x, caption: e.target.value } : x)))} placeholder="Legenda (opcional)" className="h-8" />
        </div>
      ))}
      {images.length < 24 && (
        <Button type="button" variant="outline" size="sm" className="w-full border-dashed" onClick={() => setImages([...images, { url: '' }])}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar foto
        </Button>
      )}
    </>
  );
}

type CardDraft = { title: string; text?: string; imageUrl?: string; badge?: string };

function CardsFields({ block, onChange }: { block: SiteBlockDraft; onChange: (patch: Record<string, unknown>) => void }) {
  const items = (block.items as CardDraft[] | undefined) || [];
  const setItems = (next: CardDraft[]) => onChange({ items: next });
  const patch = (i: number, p: Partial<CardDraft>) => setItems(items.map((x, n) => (n === i ? { ...x, ...p } : x)));
  return (
    <>
      <Input value={String(block.title ?? '')} onChange={(e) => onChange({ title: e.target.value })} placeholder="Título da seção (opcional)" />
      <div className="space-y-1.5">
        <Label className="text-xs">Colunas (no computador; no celular fica um embaixo do outro)</Label>
        <Segmented value={Number(block.columns) || 3} onChange={(v) => onChange({ columns: v })}
          options={[{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }]} />
      </div>
      {items.map((item, i) => (
        <div key={i} className="space-y-1.5 rounded-md border p-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Cartão {i + 1}</span>
            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => setItems(items.filter((_, x) => x !== i))} aria-label="Remover cartão"><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
          <ImagePick value={item.imageUrl} onChange={(url) => patch(i, { imageUrl: url })} />
          <Input value={item.title} onChange={(e) => patch(i, { title: e.target.value })} placeholder="Título" className="h-8" />
          <Textarea rows={2} value={item.text ?? ''} onChange={(e) => patch(i, { text: e.target.value })} placeholder="Texto (opcional)" />
          <Input value={item.badge ?? ''} onChange={(e) => patch(i, { badge: e.target.value })} placeholder="Selo (opcional). Ex.: Novo!" className="h-8" />
        </div>
      ))}
      {items.length < 12 && (
        <Button type="button" variant="outline" size="sm" className="w-full border-dashed" onClick={() => setItems([...items, { title: '' }])}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar cartão
        </Button>
      )}
    </>
  );
}

function FieldSelect({ label, value, fields, onChange, emptyLabel = 'Nenhum' }: {
  label: string; value: unknown; fields: NonNullable<EditorEntity['fields']>; onChange: (slug: string | undefined) => void; emptyLabel?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value || undefined)} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
        <option value="">{emptyLabel}</option>
        {fields.map((f) => <option key={f.slug} value={f.slug}>{labelOf(f)}</option>)}
      </select>
    </div>
  );
}

function CatalogFields({ block, onChange, entities }: { block: SiteBlockDraft; onChange: (patch: Record<string, unknown>) => void; entities: EditorEntity[] }) {
  // So tabelas principais (as de dentro de outra nao fazem sentido sozinhas)
  const tops = entities.filter((e) => !parentOf(e, entities));
  const entity = tops.find((e) => e.slug === block.entitySlug);
  const fields = entity?.fields || [];
  const ofType = (...types: string[]) => fields.filter((f) => types.includes(f.type));
  const pick = (slug: string) => {
    const e = tops.find((x) => x.slug === slug);
    const fs = e?.fields || [];
    const first = (...types: string[]) => fs.find((f) => types.includes(f.type))?.slug;
    onChange({
      entitySlug: slug,
      titleField: e?.settings?.titleField || first('text'),
      imageField: first('image'),
      priceField: first('currency'),
      descriptionField: first('textarea'),
      groupField: first('select'),
      onlyField: first('boolean'),
    });
  };
  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs">Tabela que aparece</Label>
        <TableSelect value={block.entitySlug} entities={tops} onChange={pick} />
        <p className="text-[11px] text-muted-foreground">Fica público: só os campos escolhidos abaixo. Use para o que pode ser visto por todos (cardápio, produtos, serviços).</p>
      </div>
      {entity && (
        <>
          <Input value={String(block.title ?? '')} onChange={(e) => onChange({ title: e.target.value })} placeholder={`Título (padrão: ${entity.namePlural || entity.name})`} />
          <FieldSelect label="Nome do item" value={block.titleField} fields={ofType('text', 'textarea', 'select')} onChange={(v) => onChange({ titleField: v })} emptyLabel="Escolha…" />
          <div className="grid grid-cols-2 gap-2">
            <FieldSelect label="Foto" value={block.imageField} fields={ofType('image')} onChange={(v) => onChange({ imageField: v })} />
            <FieldSelect label="Preço" value={block.priceField} fields={ofType('currency', 'number')} onChange={(v) => onChange({ priceField: v })} />
            <FieldSelect label="Descrição" value={block.descriptionField} fields={ofType('text', 'textarea')} onChange={(v) => onChange({ descriptionField: v })} />
            <FieldSelect label="Separar por" value={block.groupField} fields={ofType('select', 'radio-group')} onChange={(v) => onChange({ groupField: v })} />
          </div>
          <FieldSelect label="Mostrar só os marcados em" value={block.onlyField} fields={ofType('boolean')} onChange={(v) => onChange({ onlyField: v })} emptyLabel="Mostrar todos" />
        </>
      )}
    </>
  );
}

// ── Aparencia da pagina ──────────────────────────────────────────────────

export type SiteLookDraft = {
  ownLook?: boolean; style?: 'classic' | 'scrapbook'; background?: SiteAppearance['background']; accent?: string; coverUrl?: string; tagline?: string;
  theme?: SiteTheme;
};


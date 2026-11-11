'use client';

import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import ImageUploadField from '@/components/form/image-upload-field';
import { ImagePick, Segmented } from '@/components/site/site-block-editor';
import { SITE_ICON_IDS, SITE_ICON_MAP, SOCIALS } from '@/lib/site-icons';
import type { SiteBlockDraft } from '@/hooks/use-site-pages';
import { cn } from '@/lib/utils';

type Patch = (patch: Record<string, unknown>) => void;
type Row = Record<string, unknown>;

/** Lista editavel (perguntas, planos, depoimentos...): subir, descer, tirar, adicionar. */
function ListEditor({ items, onChange, max, addLabel, itemLabel, blank, render }: {
  items: Row[]; onChange: (items: Row[]) => void; max: number; addLabel: string; itemLabel: string; blank: Row;
  render: (item: Row, set: (p: Row) => void) => ReactNode;
}) {
  const move = (i: number, d: -1 | 1) => {
    const next = [...items];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="space-y-1.5 rounded-md border p-2">
          <div className="flex items-center gap-1">
            <span className="flex-1 text-xs font-medium">{itemLabel} {i + 1}</span>
            <Button size="icon" variant="ghost" className="h-6 w-6" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir"><ArrowUp className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Descer"><ArrowDown className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => onChange(items.filter((_, x) => x !== i))} aria-label="Remover"><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
          {render(item, (p) => onChange(items.map((x, n) => (n === i ? { ...x, ...p } : x))))}
        </div>
      ))}
      {items.length < max && (
        <Button type="button" variant="outline" size="sm" className="w-full border-dashed" onClick={() => onChange([...items, { ...blank }])}>
          <Plus className="mr-1 h-3.5 w-3.5" /> {addLabel}
        </Button>
      )}
    </div>
  );
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const list = (v: unknown) => (Array.isArray(v) ? (v as Row[]) : []);

function TitleInput({ block, onChange, placeholder = 'Título (opcional)' }: { block: SiteBlockDraft; onChange: Patch; placeholder?: string }) {
  return <Input value={str(block.title)} onChange={(e) => onChange({ title: e.target.value })} placeholder={placeholder} />;
}

function Range({ label, value, min, max, step = 1, suffix, onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (v: number) => void }) {
  return (
    <label className="block space-y-1 text-xs">
      <span className="flex justify-between"><span>{label}</span><span className="text-muted-foreground">{value}{suffix}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
    </label>
  );
}

/** Campos dos elementos a mais (video, mapa, perguntas, icones, redes, espaco, numeros, precos, depoimentos, logos). */
export function ExtraBlockFields({ block, onChange }: { block: SiteBlockDraft; onChange: Patch }) {
  switch (block.type) {
    case 'video':
      return (
        <>
          <Input value={str(block.url)} onChange={(e) => onChange({ url: e.target.value.trim() })} placeholder="Link do YouTube ou Vimeo (https://youtu.be/…)" data-testid="field-video-url" />
          <p className="text-[11px] text-muted-foreground">YouTube e Vimeo aparecem com a capa e o botão de play, que abre o vídeo. Vídeo enviado do computador toca na própria página.</p>
          <p className="text-[11px] text-muted-foreground">…ou envie um vídeo do computador (mp4/webm):</p>
          <ImageUploadField value={str(block.url)} onChange={(v) => onChange({ url: String(Array.isArray(v) ? v[0] ?? '' : v) })} mode="file" accept="video/mp4,video/webm" folder="site" />
          <Input value={str(block.caption)} onChange={(e) => onChange({ caption: e.target.value })} placeholder="Legenda (opcional)" />
        </>
      );
    case 'map':
      return (
        <>
          <Input value={str(block.address)} onChange={(e) => onChange({ address: e.target.value })} placeholder="Endereço. Ex.: Av. Paulista, 1000, São Paulo" data-testid="field-map-address" />
          <Range label="Altura" value={Number(block.height) || 320} min={160} max={360} step={20} suffix="px" onChange={(height) => onChange({ height })} />
          <p className="text-[11px] text-muted-foreground">Na página aparece o endereço com os botões “Ver no mapa” e “Como chegar” (Google Maps).</p>
        </>
      );
    case 'faq':
      return (
        <>
          <TitleInput block={block} onChange={onChange} placeholder="Título. Ex.: Perguntas frequentes" />
          <ListEditor items={list(block.items)} onChange={(items) => onChange({ items })} max={30} addLabel="Adicionar pergunta" itemLabel="Pergunta" blank={{ q: '', a: '' }}
            render={(it, set) => (
              <>
                <Input value={str(it.q)} onChange={(e) => set({ q: e.target.value })} placeholder="Pergunta" className="h-8" />
                <Textarea rows={2} value={str(it.a)} onChange={(e) => set({ a: e.target.value })} placeholder="Resposta" />
              </>
            )} />
        </>
      );
    case 'icons':
      return (
        <>
          <TitleInput block={block} onChange={onChange} />
          <div className="space-y-1.5">
            <Label className="text-xs">Colunas</Label>
            <Segmented value={Number(block.columns) || 3} onChange={(columns) => onChange({ columns })} options={[1, 2, 3, 4].map((n) => ({ value: n, label: String(n) }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ícone</Label>
            <Segmented value={block.layout === 'side' ? 'side' : 'top'} onChange={(layout) => onChange({ layout })} options={[{ value: 'top', label: 'Em cima' }, { value: 'side', label: 'Ao lado' }]} />
          </div>
          <ListEditor items={list(block.items)} onChange={(items) => onChange({ items })} max={16} addLabel="Adicionar item" itemLabel="Item" blank={{ icon: 'star', title: '' }}
            render={(it, set) => (
              <>
                <IconPicker value={str(it.icon) || 'star'} onChange={(icon) => set({ icon })} />
                <Input value={str(it.title)} onChange={(e) => set({ title: e.target.value })} placeholder="Título" className="h-8" />
                <Textarea rows={2} value={str(it.text)} onChange={(e) => set({ text: e.target.value })} placeholder="Texto (opcional)" />
              </>
            )} />
        </>
      );
    case 'social':
      return (
        <>
          <Segmented value={block.style === 'labels' ? 'labels' : 'icons'} onChange={(style) => onChange({ style })} options={[{ value: 'icons', label: 'Só ícones' }, { value: 'labels', label: 'Ícone e nome' }]} />
          <ListEditor items={list(block.links)} onChange={(links) => onChange({ links })} max={12} addLabel="Adicionar rede" itemLabel="Link" blank={{ network: 'instagram', url: '' }}
            render={(it, set) => (
              <>
                <select value={str(it.network) || 'instagram'} onChange={(e) => set({ network: e.target.value })} className="h-8 w-full rounded-md border bg-background px-2 text-sm">
                  {Object.entries(SOCIALS).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
                </select>
                <Input value={str(it.url)} onChange={(e) => set({ url: e.target.value })} placeholder={SOCIALS[str(it.network) || 'instagram']?.placeholder} className="h-8" />
              </>
            )} />
        </>
      );
    case 'spacer':
      return <Range label="Altura do espaço" value={Number(block.height) || 48} min={8} max={400} step={8} suffix="px" onChange={(height) => onChange({ height })} />;
    case 'stats':
      return (
        <ListEditor items={list(block.items)} onChange={(items) => onChange({ items })} max={8} addLabel="Adicionar número" itemLabel="Número" blank={{ value: '', label: '' }}
          render={(it, set) => (
            <div className="grid grid-cols-[90px_1fr] gap-1.5">
              <Input value={str(it.value)} onChange={(e) => set({ value: e.target.value })} placeholder="+500" className="h-8" />
              <Input value={str(it.label)} onChange={(e) => set({ label: e.target.value })} placeholder="clientes felizes" className="h-8" />
            </div>
          )} />
      );
    case 'pricing':
      return (
        <>
          <TitleInput block={block} onChange={onChange} placeholder="Título. Ex.: Planos" />
          <ListEditor items={list(block.plans)} onChange={(plans) => onChange({ plans })} max={6} addLabel="Adicionar plano" itemLabel="Plano" blank={{ name: '', price: '', features: [] }}
            render={(it, set) => (
              <>
                <Input value={str(it.name)} onChange={(e) => set({ name: e.target.value })} placeholder="Nome do plano" className="h-8" />
                <div className="grid grid-cols-2 gap-1.5">
                  <Input value={str(it.price)} onChange={(e) => set({ price: e.target.value })} placeholder="R$ 99" className="h-8" />
                  <Input value={str(it.period)} onChange={(e) => set({ period: e.target.value })} placeholder="/mês (opcional)" className="h-8" />
                </div>
                <Textarea rows={3} value={(Array.isArray(it.features) ? it.features : []).join('\n')} onChange={(e) => set({ features: e.target.value.split('\n') })} placeholder={'O que inclui (um por linha)'} />
                <div className="grid grid-cols-2 gap-1.5">
                  <Input value={str(it.buttonLabel)} onChange={(e) => set({ buttonLabel: e.target.value })} placeholder="Texto do botão" className="h-8" />
                  <Input value={str(it.buttonUrl)} onChange={(e) => set({ buttonUrl: e.target.value })} placeholder="Link do botão" className="h-8" />
                </div>
                <label className="flex items-center justify-between text-xs">Destacar (mais escolhido) <Switch checked={it.highlight === true} onCheckedChange={(v) => set({ highlight: v })} /></label>
              </>
            )} />
        </>
      );
    case 'testimonials':
      return (
        <>
          <TitleInput block={block} onChange={onChange} placeholder="Título. Ex.: O que dizem os clientes" />
          <ListEditor items={list(block.items)} onChange={(items) => onChange({ items })} max={12} addLabel="Adicionar depoimento" itemLabel="Depoimento" blank={{ text: '', author: '' }}
            render={(it, set) => (
              <>
                <Textarea rows={3} value={str(it.text)} onChange={(e) => set({ text: e.target.value })} placeholder="O que a pessoa disse" />
                <div className="grid grid-cols-2 gap-1.5">
                  <Input value={str(it.author)} onChange={(e) => set({ author: e.target.value })} placeholder="Nome" className="h-8" />
                  <Input value={str(it.role)} onChange={(e) => set({ role: e.target.value })} placeholder="Cidade, cargo… (opcional)" className="h-8" />
                </div>
                <ImagePick value={it.photo} onChange={(photo) => set({ photo })} />
              </>
            )} />
        </>
      );
    case 'logos':
      return (
        <>
          <TitleInput block={block} onChange={onChange} placeholder="Título. Ex.: Quem confia na gente" />
          <label className="flex items-center justify-between text-sm">Logos em cinza (coloridos ao passar o mouse) <Switch checked={block.gray !== false} onCheckedChange={(gray) => onChange({ gray })} /></label>
          <ListEditor items={list(block.images)} onChange={(images) => onChange({ images })} max={24} addLabel="Adicionar logo" itemLabel="Logo" blank={{ url: '' }}
            render={(it, set) => (
              <>
                <ImagePick value={it.url} onChange={(url) => set({ url })} />
                <Input value={str(it.alt)} onChange={(e) => set({ alt: e.target.value })} placeholder="Nome da empresa (opcional)" className="h-8" />
              </>
            )} />
        </>
      );
    default:
      return null;
  }
}

function IconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  return (
    <div className="grid max-h-28 grid-cols-9 gap-1 overflow-y-auto rounded-md border p-1">
      {SITE_ICON_IDS.map((id) => {
        const Icon = SITE_ICON_MAP[id];
        return (
          <button key={id} type="button" onClick={() => onChange(id)} title={id} aria-label={id}
            className={cn('flex h-7 items-center justify-center rounded hover:bg-muted', value === id && 'bg-primary/15 text-primary ring-1 ring-primary')}>
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}

'use client';

import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bold, CaseUpper, ChevronDown, Italic, Loader2, Save, Trash2, Upload, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import ImageUploadField from '@/components/form/image-upload-field';
import { ImagePick, Segmented, type SiteLookDraft } from '@/components/site/site-block-editor';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/get-error-message';
import { cn } from '@/lib/utils';
import type { SiteAppearance, SiteTextStyle, SiteTheme } from '@/lib/site-api';
import {
  FONT_KINDS, SITE_FONTS, THEME_PRESETS, fontStack, mix, readableOn, resolveTheme,
  type SiteCustomFont, type ThemePreset,
} from '@/lib/site-theme';

export type SavedTheme = { name: string; look: SiteLookDraft };

export function useSiteFonts() {
  return useQuery({ queryKey: ['site-fonts'], queryFn: async () => (await api.get<SiteCustomFont[]>('/site-pages/fonts')).data });
}

interface Props {
  look: SiteLookDraft;
  brandColor: string | null;
  onChange: (patch: SiteLookDraft) => void;
  saved: SavedTheme[];
  onSaved: (list: SavedTheme[]) => void;
}

const PATTERNS: Array<{ value: SiteAppearance['background']; label: string }> = [
  { value: 'plain', label: 'Liso' }, { value: 'dots', label: 'Bolinhas' }, { value: 'hearts', label: 'Corações' },
  { value: 'stars', label: 'Estrelas' }, { value: 'stripes', label: 'Listras' }, { value: 'grid', label: 'Caderno' },
];
const TEXT_STYLES: Array<{ key: 'h1' | 'h2' | 'h3' | 'body'; label: string; sample: string }> = [
  { key: 'h1', label: 'Título 1', sample: 'Título principal' }, { key: 'h2', label: 'Título 2', sample: 'Título de seção' },
  { key: 'h3', label: 'Título 3', sample: 'Subtítulo' }, { key: 'body', label: 'Parágrafo', sample: 'Texto dos parágrafos da página.' },
];

/** Tema do site: tudo que define a cara das paginas, editavel peca por peca. */
export function ThemeFields({ look, brandColor, onChange, saved, onSaved }: Props) {
  const brand = brandColor || '#2563eb';
  const th = resolveTheme(look as SiteAppearance, brand);
  const { data: customFonts = [] } = useSiteFonts();
  const theme: SiteTheme = look.theme ?? {};
  const setTheme = (patch: Partial<SiteTheme>) => onChange({ theme: { ...theme, ...patch, preset: undefined } });

  const applyPreset = (p: ThemePreset) => onChange({ style: p.style, background: p.background, accent: p.accent, theme: p.theme });
  const applySaved = (t: SavedTheme) => onChange({ style: t.look.style, background: t.look.background, accent: t.look.accent, theme: t.look.theme ?? {} });
  const saveCurrent = () => {
    const name = window.prompt('Nome do seu tema:', 'Meu tema')?.trim();
    if (!name) return;
    const entry: SavedTheme = { name: name.slice(0, 40), look: { style: look.style, background: look.background, accent: look.accent, theme: look.theme } };
    onSaved([...saved.filter((s) => s.name !== entry.name), entry].slice(-12));
    toast.success('Tema guardado em "Meus temas". Salve a página para gravar.');
  };

  return (
    <div className="space-y-2" data-testid="theme-fields">
      <Group title="Temas prontos" hint="Ponto de partida: depois mude o que quiser" open>
        <div className="grid grid-cols-2 gap-2">
          {THEME_PRESETS.map((p) => {
            const r = resolveTheme({ style: p.style, background: p.background, accent: p.accent, theme: p.theme }, brand);
            return (
              <PresetCard key={p.id} name={p.name} hint={p.hint} active={theme.preset === p.id} onClick={() => applyPreset(p)} testId={`theme-preset-${p.id}`}
                bg={r.colors.bg} text={r.colors.text} accent={r.colors.accent} accent2={r.colors.accent2}
                heading={fontStack(r.text.h1.font, customFonts)} body={fontStack(r.text.body.font, customFonts)} />
            );
          })}
        </div>
        <div className="space-y-1.5 border-t pt-3">
          <p className="text-xs font-medium">Meus temas</p>
          {saved.length === 0 && <p className="text-[11px] text-muted-foreground">Monte o visual do seu jeito e guarde aqui para usar de novo.</p>}
          {saved.map((t, i) => (
            <div key={t.name} className="flex items-center gap-2 rounded-md border p-1.5">
              <button type="button" className="min-w-0 flex-1 truncate text-left text-sm hover:underline" onClick={() => applySaved(t)}>{t.name}</button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" aria-label={`Apagar ${t.name}`} onClick={() => onSaved(saved.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
          <Button size="sm" variant="outline" className="w-full" onClick={saveCurrent} data-testid="theme-save-mine"><Save className="mr-1.5 h-3.5 w-3.5" />Guardar este visual como meu tema</Button>
        </div>
      </Group>

      <Group title="Cores" hint="Fundo, textos e destaques">
        <ColorRow label="Destaque (botões, links)" value={th.colors.accent} onChange={(v) => onChange({ accent: v, theme: { ...theme, preset: undefined } })} testId="theme-color-accent" />
        <ColorRow label="Destaque 2" value={th.colors.accent2} onChange={(v) => setTheme({ colors: { ...theme.colors, accent2: v } })} />
        <ColorRow label="Fundo da página" value={th.colors.bg} onChange={(v) => setTheme({ colors: { ...theme.colors, bg: v } })} testId="theme-color-bg" />
        <ColorRow label="Caixas e cartões" value={th.colors.surface} onChange={(v) => setTheme({ colors: { ...theme.colors, surface: v } })} />
        <ColorRow label="Texto" value={th.colors.text} onChange={(v) => setTheme({ colors: { ...theme.colors, text: v } })} />
        <ColorRow label="Texto suave" value={th.colors.muted} onChange={(v) => setTheme({ colors: { ...theme.colors, muted: v } })} />
        <Button size="sm" variant="outline" className="w-full" onClick={() => onChange({
          accent: brand,
          theme: { ...theme, preset: undefined, colors: { bg: mix(brand, '#ffffff', 6), surface: '#ffffff', text: mix(brand, '#0b0b0f', 18), muted: mix(brand, '#64748b', 20), accent2: mix(brand, '#ffffff', 30) } },
        })}><Wand2 className="mr-1.5 h-3.5 w-3.5" />Criar cores a partir da cor da empresa</Button>
      </Group>

      <Group title="Fontes" hint="Títulos e textos, ou envie a sua">
        <FontSelect label="Fonte dos títulos" value={theme.fonts?.heading ?? th.fonts.heading} custom={customFonts}
          onChange={(v) => setTheme({ fonts: { ...theme.fonts, heading: v } })} sample="Título da página" testId="theme-font-heading" />
        <FontSelect label="Fonte dos textos" value={theme.fonts?.body ?? th.fonts.body} custom={customFonts}
          onChange={(v) => setTheme({ fonts: { ...theme.fonts, body: v } })} sample="Um texto de exemplo, como os parágrafos da página." testId="theme-font-body" />
        <FontUpload fonts={customFonts} />
      </Group>

      <Group title="Estilos de texto" hint="Como os estilos do Word: mudou aqui, muda no site todo">
        {TEXT_STYLES.map((s) => (
          <TextStyleRow key={s.key} label={s.label} sample={s.sample} value={theme.text?.[s.key] ?? {}} resolved={th.text[s.key]} custom={customFonts}
            onChange={(v) => setTheme({ text: { ...theme.text, [s.key]: v } })} />
        ))}
      </Group>

      <Group title="Botões, cantos e sombras">
        <Field label="Formato dos botões">
          <Segmented value={th.buttons.shape} onChange={(v) => setTheme({ buttons: { ...theme.buttons, shape: v } })}
            options={[{ value: 'square', label: 'Reto' }, { value: 'rounded', label: 'Arredondado' }, { value: 'pill', label: 'Pílula' }]} />
        </Field>
        <Field label="Preenchimento dos botões">
          <Segmented value={th.buttons.fill} onChange={(v) => setTheme({ buttons: { ...theme.buttons, fill: v } })}
            options={[{ value: 'solid', label: 'Cheio' }, { value: 'outline', label: 'Contorno' }, { value: 'soft', label: 'Suave' }, { value: 'shadow', label: 'Com sombra' }]} />
        </Field>
        <ButtonPreview shape={th.buttons.shape} fill={th.buttons.fill} accent={th.colors.accent} />
        <Field label="Cantos de caixas e fotos">
          <Segmented value={th.radius} onChange={(v) => setTheme({ radius: v })}
            options={[{ value: 'none', label: 'Retos' }, { value: 'sm', label: 'Leves' }, { value: 'md', label: 'Médios' }, { value: 'lg', label: 'Grandes' }, { value: 'xl', label: 'Bem redondos' }]} />
        </Field>
        <Field label="Sombras">
          <Segmented value={th.shadow} onChange={(v) => setTheme({ shadow: v })}
            options={[{ value: 'none', label: 'Sem' }, { value: 'soft', label: 'Leves' }, { value: 'strong', label: 'Fortes' }]} />
        </Field>
        <Field label="Espaço entre as seções">
          <Segmented value={th.spacing} onChange={(v) => setTheme({ spacing: v })}
            options={[{ value: 'compact', label: 'Compacto' }, { value: 'normal', label: 'Normal' }, { value: 'airy', label: 'Arejado' }]} />
        </Field>
      </Group>

      <Group title="Fundo da página" hint="Cor, padrão, foto ou vídeo do seu computador">
        <Field label="Padrão por cima da cor">
          <Segmented value={look.background || th.pattern} options={PATTERNS} onChange={(v) => onChange({ background: v })} />
        </Field>
        <Field label="Foto de fundo">
          <ImagePick value={theme.bgImage} onChange={(url) => setTheme({ bgImage: url || undefined })} />
        </Field>
        <Field label="Vídeo de fundo (mp4 ou webm)" hint="Toca sem som, em repetição. Prefira vídeos curtos e leves.">
          <ImageUploadField value={theme.bgVideo ?? ''} onChange={(v) => setTheme({ bgVideo: String(Array.isArray(v) ? v[0] ?? '' : v) || undefined })}
            mode="file" accept="video/mp4,video/webm" folder="site" />
          <Input value={theme.bgVideo ?? ''} onChange={(e) => setTheme({ bgVideo: e.target.value.trim() || undefined })} placeholder="…ou cole o link do vídeo (https://…mp4)" className="h-8 text-xs" />
        </Field>
        {(theme.bgImage || theme.bgVideo) && (
          <Field label={`Suavizar a foto/vídeo: ${theme.bgDim ?? 0}%`} hint="Cobre o fundo com a cor da página para o texto ler melhor.">
            <input type="range" min={0} max={80} step={5} value={theme.bgDim ?? 0} onChange={(e) => setTheme({ bgDim: Number(e.target.value) })} className="w-full" />
          </Field>
        )}
      </Group>

      <Group title="Enfeites">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Enfeites de scrapbook<span className="block text-[11px] text-muted-foreground">Fitas, polaroides tortinhas, corações e bordas tracejadas.</span></span>
          <Switch checked={look.style === 'scrapbook'} onCheckedChange={(v) => onChange({ style: v ? 'scrapbook' : 'classic' })} data-testid="theme-decor" />
        </label>
      </Group>
    </div>
  );
}

function Group({ title, hint, open: startOpen, children }: { title: string; hint?: string; open?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(!!startOpen);
  return (
    <div className="rounded-lg border">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{title}</span>
          {hint && <span className="block truncate text-[11px] text-muted-foreground">{hint}</span>}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="space-y-3 border-t p-3">{children}</div>}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ColorRow({ label, value, onChange, testId }: { label: string; value: string; onChange: (v: string) => void; testId?: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded border bg-background" data-testid={testId} />
      <span className="flex-1">{label}</span>
      <span className="font-mono text-[11px] text-muted-foreground">{value}</span>
    </label>
  );
}

function PresetCard({ name, hint, active, onClick, bg, text, accent, accent2, heading, body, testId }: {
  name: string; hint: string; active: boolean; onClick: () => void; bg: string; text: string; accent: string; accent2: string;
  heading?: string; body?: string; testId?: string;
}) {
  return (
    <button type="button" onClick={onClick} data-testid={testId} title={hint}
      className={cn('overflow-hidden rounded-lg border text-left transition-shadow hover:shadow-md', active && 'ring-2 ring-primary')}>
      <div className="px-2.5 pb-2 pt-2.5" style={{ backgroundColor: bg, color: text }}>
        <div className="truncate text-xl leading-tight" style={{ fontFamily: heading }}>Aa</div>
        <div className="truncate text-[10px] opacity-75" style={{ fontFamily: body }}>{hint}</div>
        <div className="mt-1.5 flex gap-1">
          <span className="h-3 w-6 rounded-full" style={{ backgroundColor: accent }} />
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: accent2 }} />
        </div>
      </div>
      <div className="border-t bg-background px-2.5 py-1 text-xs font-medium">{name}</div>
    </button>
  );
}

function FontSelect({ label, value, custom, onChange, sample, testId, allowDefault }: {
  label?: string; value: string; custom: SiteCustomFont[]; onChange: (v: string | undefined) => void; sample?: string; testId?: string; allowDefault?: string;
}) {
  const select = (
    <select value={value} onChange={(e) => onChange(e.target.value || undefined)} className="h-9 w-full rounded-md border bg-background px-2 text-sm" data-testid={testId}>
      {allowDefault && <option value="">{allowDefault}</option>}
      {FONT_KINDS.map((k) => (
        <optgroup key={k.kind} label={k.label}>
          {SITE_FONTS.filter((f) => f.kind === k.kind).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </optgroup>
      ))}
      {custom.length > 0 && <optgroup label="Suas fontes">{custom.map((f) => <option key={f.id} value={`custom:${f.id}`}>{f.name}</option>)}</optgroup>}
    </select>
  );
  if (!label) return select;
  return (
    <Field label={label}>
      {select}
      {sample && <p className="truncate rounded bg-muted/50 px-2 py-1 text-lg" style={{ fontFamily: fontStack(value, custom) }}>{sample}</p>}
    </Field>
  );
}

/** Enviar uma fonte do computador (.woff2, .woff, .ttf, .otf). */
function FontUpload({ fonts }: { fonts: SiteCustomFont[] }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const send = async (file: File) => {
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      await api.post('/site-pages/fonts', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      await qc.invalidateQueries({ queryKey: ['site-fonts'] });
      toast.success('Fonte enviada! Ela aparece em "Suas fontes".');
    } catch (e) {
      toast.error(getErrorMessage(e, 'Não foi possível enviar a fonte.'));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: string) => {
    if (!window.confirm('Apagar esta fonte? Textos que usam ela voltam para a fonte do tema.')) return;
    await api.delete(`/site-pages/fonts/${id}`);
    await qc.invalidateQueries({ queryKey: ['site-fonts'] });
  };
  return (
    <div className="space-y-1.5 border-t pt-3">
      <p className="text-xs font-medium">Suas fontes</p>
      {fonts.map((f) => (
        <div key={f.id} className="flex items-center gap-2 rounded-md border p-1.5">
          <span className="min-w-0 flex-1 truncate text-base" style={{ fontFamily: fontStack(`custom:${f.id}`, fonts) }}>{f.name}</span>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" aria-label={`Apagar ${f.name}`} onClick={() => void remove(f.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      ))}
      <input ref={input} type="file" accept=".woff2,.woff,.ttf,.otf" className="hidden" data-testid="theme-font-file"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void send(f); e.target.value = ''; }} />
      <Button size="sm" variant="outline" className="w-full" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}Enviar fonte do computador
      </Button>
      <p className="text-[11px] text-muted-foreground">.woff2, .woff, .ttf ou .otf, até 2 MB. Use só fontes que você tem direito de usar no site.</p>
    </div>
  );
}

function TextStyleRow({ label, sample, value, resolved, custom, onChange }: {
  label: string; sample: string; value: SiteTextStyle; resolved: ReturnType<typeof resolveTheme>['text']['h1']; custom: SiteCustomFont[];
  onChange: (v: SiteTextStyle) => void;
}) {
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<SiteTextStyle>) => onChange(Object.fromEntries(Object.entries({ ...value, ...patch }).filter(([, v]) => v !== undefined)) as SiteTextStyle);
  const preview: CSSProperties = {
    fontFamily: fontStack(resolved.font, custom), fontSize: Math.min(resolved.size, 34), fontWeight: resolved.bold ? 700 : 400,
    fontStyle: resolved.italic ? 'italic' : 'normal', textTransform: resolved.upper ? 'uppercase' : 'none',
    letterSpacing: `${resolved.spacing / 100}em`, color: resolved.color,
  };
  return (
    <div className="rounded-md border">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-2.5 py-2 text-left">
        <span className="w-16 shrink-0 text-[11px] text-muted-foreground">{label}</span>
        <span className="min-w-0 flex-1 truncate leading-tight" style={preview}>{sample}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="space-y-2 border-t p-2.5">
          <FontSelect value={value.font ?? ''} custom={custom} onChange={(v) => set({ font: v })} allowDefault="Fonte do tema" />
          <div className="flex flex-wrap items-center gap-1.5">
            <Input type="number" min={10} max={120} value={value.size ?? resolved.size} onChange={(e) => set({ size: Number(e.target.value) || undefined })} className="h-8 w-20" aria-label="Tamanho" />
            <span className="text-xs text-muted-foreground">px</span>
            <Toggle on={resolved.bold} title="Negrito" onClick={() => set({ bold: !resolved.bold })}><Bold className="h-3.5 w-3.5" /></Toggle>
            <Toggle on={resolved.italic} title="Itálico" onClick={() => set({ italic: !resolved.italic })}><Italic className="h-3.5 w-3.5" /></Toggle>
            <Toggle on={resolved.upper} title="Maiúsculas" onClick={() => set({ upper: !resolved.upper })}><CaseUpper className="h-3.5 w-3.5" /></Toggle>
            <label className="flex items-center gap-1 text-xs" title="Cor">
              <input type="color" value={value.color ?? resolved.color ?? '#111111'} onChange={(e) => set({ color: e.target.value })} className="h-8 w-9 cursor-pointer rounded border" />
              {value.color && <button type="button" className="text-[11px] text-muted-foreground underline" onClick={() => set({ color: undefined })}>cor do tema</button>}
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-[11px] text-muted-foreground">Espaço entre letras
              <input type="range" min={-5} max={40} value={value.spacing ?? resolved.spacing} onChange={(e) => set({ spacing: Number(e.target.value) })} className="w-full" />
            </label>
            <label className="space-y-1 text-[11px] text-muted-foreground">Altura da linha
              <input type="range" min={90} max={250} step={5} value={value.line ?? resolved.line} onChange={(e) => set({ line: Number(e.target.value) })} className="w-full" />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ on, title, onClick, children }: { on: boolean; title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" title={title} aria-label={title} aria-pressed={on} onClick={onClick}
      className={cn('flex h-8 w-8 items-center justify-center rounded border', on ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted')}>
      {children}
    </button>
  );
}

function ButtonPreview({ shape, fill, accent }: { shape: string; fill: string; accent: string }) {
  const radius = shape === 'pill' ? 999 : shape === 'rounded' ? 10 : 2;
  const on = readableOn(accent);
  const style: CSSProperties = fill === 'outline'
    ? { border: `2px solid ${accent}`, color: accent }
    : fill === 'soft'
      ? { backgroundColor: mix(accent, '#ffffff', 15), color: accent }
      : { backgroundColor: accent, color: on, border: `2px solid ${accent}`, ...(fill === 'shadow' ? { boxShadow: `0 4px 0 ${mix(accent, '#000000', 70)}` } : {}) };
  return (
    <div className="rounded-md bg-muted/40 p-3 text-center">
      <span className="inline-flex px-5 py-2 text-sm font-semibold" style={{ ...style, borderRadius: radius }}>Botão de exemplo</span>
    </div>
  );
}

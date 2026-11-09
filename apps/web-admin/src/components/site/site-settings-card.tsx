'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Home, LayoutTemplate, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AppearanceFields, type SiteLookDraft } from '@/components/site/site-block-editor';
import { useSiteConfig, useUpdateSiteConfig, type SiteConfigDraft } from '@/hooks/use-site-pages';
import { useTenant } from '@/stores/tenant-context';
import { cn } from '@/lib/utils';

const FOOTER_FIELDS: Array<{ key: string; label: string; placeholder: string }> = [
  { key: 'address', label: 'Endereço', placeholder: 'Rua das Flores, 10 - Centro, São Paulo' },
  { key: 'hours', label: 'Horários', placeholder: 'Terça a domingo, 13h às 21h' },
  { key: 'whatsapp', label: 'WhatsApp', placeholder: '(11) 99999-0000' },
  { key: 'phone', label: 'Telefone', placeholder: '(11) 3333-0000' },
  { key: 'instagram', label: 'Instagram', placeholder: '@suaempresa' },
  { key: 'email', label: 'E-mail', placeholder: 'contato@suaempresa.com.br' },
];

/**
 * O site da empresa: aparencia comum, menu entre as paginas, pagina inicial e
 * rodape com contato. Cada pagina pode ter aparencia propria (no editor dela).
 */
export function SiteSettingsCard() {
  const { data, isLoading } = useSiteConfig();
  const save = useUpdateSiteConfig();
  const { tenant } = useTenant();
  const brandColor = (tenant?.settings as { theme?: { brandColor?: string } } | undefined)?.theme?.brandColor ?? null;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SiteConfigDraft | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data && !dirty) setDraft(data.config);
  }, [data, dirty]);

  if (isLoading || !data || !draft) return null;

  // Paginas que podem ir no menu (acompanhamento so abre pelo link do cliente)
  const menuable = data.pages.filter((p) => !p.tracking);
  const chosen = draft.menu.length ? draft.menu : [];
  const inMenu = (slug: string) => chosen.some((m) => m.slug === slug);
  const change = (patch: Partial<SiteConfigDraft>) => { setDraft({ ...draft, ...patch }); setDirty(true); };
  const ordered = [
    ...chosen.map((m) => menuable.find((p) => p.slug === m.slug)).filter(Boolean),
    ...menuable.filter((p) => !inMenu(p.slug)),
  ] as typeof menuable;
  const toggle = (slug: string, on: boolean) => change({ menu: on ? [...chosen, { slug }] : chosen.filter((m) => m.slug !== slug) });
  const move = (slug: string, dir: -1 | 1) => {
    const i = chosen.findIndex((m) => m.slug === slug);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= chosen.length) return;
    const next = [...chosen];
    [next[i], next[j]] = [next[j], next[i]];
    change({ menu: next });
  };

  return (
    <Card data-testid="site-settings">
      <CardContent className="p-0">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 p-4 text-left">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><LayoutTemplate className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Site da empresa</span>
            <span className="block text-sm text-muted-foreground">Aparência comum, menu entre as páginas, página inicial e rodapé com contato.</span>
          </span>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>
        {open && (
          <div className="grid gap-6 border-t p-4 lg:grid-cols-2">
            <div className="space-y-3">
              <p className="text-sm font-medium">Aparência de todas as páginas</p>
              <AppearanceFields look={draft.look as SiteLookDraft} brandColor={brandColor} onChange={(p) => change({ look: { ...draft.look, ...p } })} />
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-sm font-medium">Menu</p>
                <p className="text-xs text-muted-foreground">
                  Marque as páginas que aparecem no menu e a ordem. Sem nenhuma marcada, entram todas as publicadas.
                  O menu aparece quando há 2 ou mais páginas.
                </p>
                <div className="space-y-1.5" data-testid="site-menu-editor">
                  {ordered.length === 0 && <p className="text-xs text-muted-foreground">Crie páginas para montar o menu.</p>}
                  {ordered.map((p) => {
                    const item = chosen.find((m) => m.slug === p.slug);
                    return (
                      <div key={p.slug} className="flex items-center gap-2 rounded-md border p-1.5">
                        <input type="checkbox" className="h-4 w-4" checked={!!item} onChange={(e) => toggle(p.slug, e.target.checked)} aria-label={`Mostrar ${p.title} no menu`} />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {p.title}
                          {!p.isPublished && <span className="ml-1.5 text-[10px] text-muted-foreground">(rascunho)</span>}
                        </span>
                        {item && (
                          <>
                            <Input value={item.label ?? ''} placeholder="Nome no menu" className="h-7 w-32 text-xs"
                              onChange={(e) => change({ menu: chosen.map((m) => (m.slug === p.slug ? { ...m, label: e.target.value } : m)) })} />
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(p.slug, -1)} aria-label="Subir"><ArrowUp className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(p.slug, 1)} aria-label="Descer"><ArrowDown className="h-3.5 w-3.5" /></Button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-sm"><Home className="h-3.5 w-3.5" /> Página inicial</Label>
                <select value={draft.homeSlug ?? ''} onChange={(e) => change({ homeSlug: e.target.value || undefined })} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">A página com endereço “inicio”</option>
                  {menuable.map((p) => <option key={p.slug} value={p.slug}>{p.title}</option>)}
                </select>
                <p className="text-[11px] text-muted-foreground">É a que abre no endereço principal da empresa.</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Rodapé (em todas as páginas)</p>
                <Textarea rows={2} value={draft.footer.text ?? ''} placeholder="Uma frase sobre a empresa (opcional)"
                  onChange={(e) => change({ footer: { ...draft.footer, text: e.target.value } })} />
                <div className="grid gap-2 sm:grid-cols-2">
                  {FOOTER_FIELDS.map((f) => (
                    <div key={f.key} className="space-y-1">
                      <Label className="text-xs">{f.label}</Label>
                      <Input value={draft.footer[f.key] ?? ''} placeholder={f.placeholder} className="h-8"
                        onChange={(e) => change({ footer: { ...draft.footer, [f.key]: e.target.value } })} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => save.mutate(draft, { onSuccess: () => setDirty(false) })} disabled={!dirty || save.isPending} data-testid="site-save">
                  {save.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                  {dirty ? 'Salvar site' : 'Salvo'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

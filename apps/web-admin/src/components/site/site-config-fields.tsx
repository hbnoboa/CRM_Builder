'use client';

import { ArrowDown, ArrowUp, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { SiteConfigDraft, SiteInfo } from '@/hooks/use-site-pages';

const FOOTER_FIELDS: Array<{ key: string; label: string; placeholder: string }> = [
  { key: 'address', label: 'Endereço', placeholder: 'Rua das Flores, 10 - Centro, São Paulo' },
  { key: 'hours', label: 'Horários', placeholder: 'Terça a domingo, 13h às 21h' },
  { key: 'whatsapp', label: 'WhatsApp', placeholder: '(11) 99999-0000' },
  { key: 'phone', label: 'Telefone', placeholder: '(11) 3333-0000' },
  { key: 'instagram', label: 'Instagram', placeholder: '@suaempresa' },
  { key: 'email', label: 'E-mail', placeholder: 'contato@suaempresa.com.br' },
];

type SitePages = SiteInfo['pages'];

/**
 * Menu entre as paginas do site (quais entram, nome e ordem) e a pagina inicial.
 * Vale para todas as paginas; usado no editor visual (clique no topo da pagina).
 */
export function SiteMenuFields({ site, pages, onChange }: { site: SiteConfigDraft; pages: SitePages; onChange: (patch: Partial<SiteConfigDraft>) => void }) {
  // Paginas que podem ir no menu (acompanhamento so abre pelo link do cliente)
  const menuable = pages.filter((p) => !p.tracking);
  const chosen = site.menu;
  const inMenu = (slug: string) => chosen.some((m) => m.slug === slug);
  const ordered = [
    ...chosen.map((m) => menuable.find((p) => p.slug === m.slug)).filter(Boolean),
    ...menuable.filter((p) => !inMenu(p.slug)),
  ] as typeof menuable;
  const toggle = (slug: string, on: boolean) => onChange({ menu: on ? [...chosen, { slug }] : chosen.filter((m) => m.slug !== slug) });
  const move = (slug: string, dir: -1 | 1) => {
    const i = chosen.findIndex((m) => m.slug === slug);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= chosen.length) return;
    const next = [...chosen];
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ menu: next });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Marque as páginas do menu e a ordem. Sem nenhuma marcada, entram todas as publicadas. O menu aparece com 2 ou mais páginas.
        </p>
        <div className="space-y-1.5" data-testid="site-menu-editor">
          {ordered.length === 0 && <p className="text-xs text-muted-foreground">Crie páginas para montar o menu.</p>}
          {ordered.map((p) => {
            const item = chosen.find((m) => m.slug === p.slug);
            return (
              <div key={p.slug} className="space-y-1.5 rounded-md border p-1.5">
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="h-4 w-4" checked={!!item} onChange={(e) => toggle(p.slug, e.target.checked)} aria-label={`Mostrar ${p.title} no menu`} />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {p.title}
                    {!p.isPublished && <span className="ml-1.5 text-[10px] text-muted-foreground">(rascunho)</span>}
                  </span>
                  {item && (
                    <>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(p.slug, -1)} aria-label="Subir"><ArrowUp className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(p.slug, 1)} aria-label="Descer"><ArrowDown className="h-3.5 w-3.5" /></Button>
                    </>
                  )}
                </div>
                {item && (
                  <Input value={item.label ?? ''} placeholder="Nome no menu (opcional)" className="h-7 text-xs"
                    onChange={(e) => onChange({ menu: chosen.map((m) => (m.slug === p.slug ? { ...m, label: e.target.value } : m)) })} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5 text-xs"><Home className="h-3.5 w-3.5" /> Página inicial do site</Label>
        <select value={site.homeSlug ?? ''} onChange={(e) => onChange({ homeSlug: e.target.value || undefined })} className="h-9 w-full rounded-md border bg-background px-3 text-sm" data-testid="site-home-select">
          <option value="">A página com endereço “inicio”</option>
          {menuable.map((p) => <option key={p.slug} value={p.slug}>{p.title}</option>)}
        </select>
        <p className="text-[11px] text-muted-foreground">É a que abre no endereço principal da empresa.</p>
      </div>
    </div>
  );
}

/** Rodape com contato, igual em todas as paginas do site. */
export function SiteFooterFields({ footer, onChange }: { footer: SiteConfigDraft['footer']; onChange: (footer: SiteConfigDraft['footer']) => void }) {
  return (
    <div className="space-y-2" data-testid="site-footer-editor">
      <Textarea rows={2} value={footer.text ?? ''} placeholder="Uma frase sobre a empresa (opcional)"
        onChange={(e) => onChange({ ...footer, text: e.target.value })} />
      {FOOTER_FIELDS.map((f) => (
        <div key={f.key} className="space-y-1">
          <Label className="text-xs">{f.label}</Label>
          <Input value={footer[f.key] ?? ''} placeholder={f.placeholder} className="h-8"
            onChange={(e) => onChange({ ...footer, [f.key]: e.target.value })} data-testid={`site-footer-${f.key}`} />
        </div>
      ))}
    </div>
  );
}

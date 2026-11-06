'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, FileText, ListChecks, Loader2, Send } from 'lucide-react';
import { Link, useRouter } from '@/i18n/tenant-navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RequireRole } from '@/components/auth/require-role';
import { useEntities } from '@/hooks/use-entities';
import { useCreateSitePage } from '@/hooks/use-site-pages';
import { cn } from '@/lib/utils';

type Kind = 'form' | 'tracking' | 'blank';

const KINDS: Array<{ value: Kind; icon: typeof Send; title: string; example: string }> = [
  { value: 'form', icon: Send, title: 'Formulário para o cliente', example: 'O cliente preenche e vira registro. Ex.: Avise seu sinistro, Agende sua vistoria, Peça um orçamento.' },
  { value: 'tracking', icon: ListChecks, title: 'Acompanhamento pelo link', example: 'O cliente vê a situação, o histórico, envia documentos e baixa o PDF. Ex.: Acompanhe seu sinistro.' },
  { value: 'blank', icon: FileText, title: 'Em branco', example: 'Só textos, imagens e botões. Você monta do zero.' },
];

function NewPageContent() {
  const router = useRouter();
  const create = useCreateSitePage();
  const { data: entitiesPage } = useEntities({ limit: 200 });
  const [kind, setKind] = useState<Kind>('form');
  const [entitySlug, setEntitySlug] = useState('');
  const [title, setTitle] = useState('');

  const entities = useMemo(() => {
    const list = (entitiesPage?.data || []) as Array<{ id: string; slug: string; name: string; namePlural?: string; fields?: Array<{ type: string; subEntityId?: string; subEntitySlug?: string }> }>;
    // Formulario so em tabela principal (lista dentro de outra precisa do registro de cima)
    const childSlugs = new Set(list.flatMap((e) => (e.fields || []).filter((f) => f.type === 'sub-entity').map((f) => f.subEntitySlug || list.find((x) => x.id === f.subEntityId)?.slug)));
    return kind === 'form' ? list.filter((e) => !childSlugs.has(e.slug)) : list;
  }, [entitiesPage, kind]);
  const entity = entities.find((e) => e.slug === entitySlug);
  const suggested = entity ? (kind === 'form' ? `Formulário — ${entity.name}` : kind === 'tracking' ? `Acompanhamento — ${entity.name}` : '') : '';

  const submit = async () => {
    const page = await create.mutateAsync({ title: (title || suggested || 'Minha página').trim(), template: kind, ...(kind !== 'blank' ? { entitySlug } : {}) });
    router.push(`/gestao/pages/${page.id}`);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="Voltar"><Link href="/gestao/pages"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nova página para clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">A página já vem montada a partir da tabela; depois você ajusta textos e campos.</p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">1. Que tipo de página?</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {KINDS.map((k) => (
            <button key={k.value} type="button" onClick={() => setKind(k.value)} data-testid={`page-kind-${k.value}`}
              className={cn('flex flex-col gap-2 rounded-xl border bg-card p-4 text-left transition-colors', kind === k.value ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/40')}>
              <k.icon className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">{k.title}</span>
              <span className="text-xs text-muted-foreground">{k.example}</span>
            </button>
          ))}
        </div>
      </section>

      {kind !== 'blank' && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">2. {kind === 'form' ? 'Onde as respostas vão ser guardadas?' : 'O cliente vai acompanhar o quê?'}</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="page-entity-picker">
            {entities.map((e) => (
              <button key={e.slug} type="button" onClick={() => setEntitySlug(e.slug)}
                className={cn('rounded-lg border bg-card px-3 py-2.5 text-left text-sm', entitySlug === e.slug ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/40')}>
                {e.namePlural || e.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <Card className="sticky bottom-4 shadow-lg">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="page-title">Título da página</Label>
            <Input id="page-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={suggested || 'Ex.: Avise seu sinistro'} data-testid="page-title" />
          </div>
          <Button size="lg" onClick={() => void submit()} disabled={create.isPending || (kind !== 'blank' && !entitySlug)} data-testid="page-create">
            {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
            Criar e montar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewSitePagePage() {
  return (
    <RequireRole module="publicLinks">
      <NewPageContent />
    </RequireRole>
  );
}

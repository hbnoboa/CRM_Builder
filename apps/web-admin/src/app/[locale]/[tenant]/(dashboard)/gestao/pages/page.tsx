'use client';

import { absoluteSiteUrl } from '@/lib/site-api';
import { useState } from 'react';
import { Copy, ExternalLink, Globe, ListChecks, Loader2, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/i18n/tenant-navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { RequireRole } from '@/components/auth/require-role';
import { GestaoPageHeader } from '@/components/gestao/gestao-ui';
import { useDeleteSitePage, useSitePages, type SitePageListItem } from '@/hooks/use-site-pages';
import { cn } from '@/lib/utils';

function PagesContent() {
  const { data: pages, isLoading } = useSitePages();
  const remove = useDeleteSitePage();
  const [deleting, setDeleting] = useState<SitePageListItem | null>(null);
  const fullUrl = (p: SitePageListItem) => absoluteSiteUrl(p.url);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <GestaoPageHeader
        title="Páginas para clientes"
        subtitle="Páginas que seus clientes abrem sem login: um formulário que vira registro (ex.: Avise seu sinistro) ou o acompanhamento de um registro pelo link que você manda."
        actions={<Button asChild><Link href="/gestao/pages/new"><Plus className="mr-1.5 h-4 w-4" />Nova página</Link></Button>}
      />

      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : !pages?.length ? (
        <Card>
          <CardContent className="grid gap-6 p-8 md:grid-cols-2">
            <div className="space-y-2">
              <Send className="h-8 w-8 text-primary" />
              <p className="font-semibold">Formulário para o cliente</p>
              <p className="text-sm text-muted-foreground">O cliente preenche (com fotos e documentos) e vira um registro na sua tabela, com as automações de sempre. Ex.: Avise seu sinistro, Agende sua vistoria.</p>
            </div>
            <div className="space-y-2">
              <ListChecks className="h-8 w-8 text-primary" />
              <p className="font-semibold">Acompanhamento pelo link</p>
              <p className="text-sm text-muted-foreground">Cada registro ganha um link secreto. O cliente vê a situação, o histórico, envia documentos e baixa o PDF, sem criar conta.</p>
            </div>
            <div className="md:col-span-2">
              <Button asChild><Link href="/gestao/pages/new"><Plus className="mr-1.5 h-4 w-4" />Criar a primeira página</Link></Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2" data-testid="site-pages-list">
          {pages.map((p) => (
            <Card key={p.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Globe className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.url}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                      <span className={cn('rounded-full px-2 py-0.5 font-medium', p.isPublished ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-muted text-muted-foreground')}>
                        {p.isPublished ? 'No ar' : 'Rascunho'}
                      </span>
                      {p.kinds.includes('form') && <span className="rounded-full bg-muted px-2 py-0.5">Formulário</span>}
                      {p.kinds.includes('tracking') && <span className="rounded-full bg-muted px-2 py-0.5">Acompanhamento</span>}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm"><Link href={`/gestao/pages/${p.id}`}><Pencil className="mr-1.5 h-3.5 w-3.5" />Editar</Link></Button>
                  {p.isPublished && !p.kinds.includes('tracking') && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => window.open(fullUrl(p), '_blank')}><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Abrir</Button>
                      <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard?.writeText(fullUrl(p)); toast.success('Link copiado!'); }}>
                        <Copy className="mr-1.5 h-3.5 w-3.5" />Copiar link
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" className="ml-auto text-destructive" onClick={() => setDeleting(p)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button>
                </div>
                {p.kinds.includes('tracking') && (
                  <p className="text-xs text-muted-foreground">O link de cada cliente sai do registro: abra o registro e use “Link de acompanhamento”.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir a página “{deleting?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>O endereço deixa de funcionar e os links de acompanhamento enviados por esta página param de abrir. Os registros continuam na tabela.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && remove.mutate(deleting.id)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function SitePagesPage() {
  return (
    <RequireRole module="publicLinks">
      <PagesContent />
    </RequireRole>
  );
}

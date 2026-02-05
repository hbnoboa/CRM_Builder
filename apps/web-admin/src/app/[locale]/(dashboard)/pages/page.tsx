'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RequireRole } from '@/components/auth/require-role';
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash,
  Eye,
  FileText,
  Copy,
  ExternalLink,
  Loader2,
  Globe,
  GlobeLock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { usePages, useDeletePage, usePublishPage, useUnpublishPage, useCreatePage } from '@/hooks/use-pages';
import { useAuthStore } from '@/stores/auth-store';
import type { Page } from '@/services/pages.service';

function PagesPageContent() {
  const { user: currentUser } = useAuthStore();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [pageToDelete, setPageToDelete] = useState<Page | null>(null);

  const { data, isLoading, refetch } = usePages();
  const deletePage = useDeletePage();
  const publishPage = usePublishPage();
  const unpublishPage = useUnpublishPage();
  const createPage = useCreatePage();

  // Garante que pages e sempre um array
  const pages: Page[] = (() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.data && Array.isArray(data.data)) return data.data;
    return [];
  })();

  const filteredPages = pages.filter((page) =>
    (page.title || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async () => {
    if (!pageToDelete) return;
    try {
      await deletePage.mutateAsync(pageToDelete.id);
      setPageToDelete(null);
    } catch (error) {
      // Error handled by hook
    }
  };

  const handlePublish = async (page: Page) => {
    try {
      if (page.isPublished) {
        await unpublishPage.mutateAsync(page.id);
      } else {
        await publishPage.mutateAsync(page.id);
      }
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleDuplicate = async (page: Page) => {
    try {
      await createPage.mutateAsync({
        title: `${page.title} (Copia)`,
        slug: `${page.slug}-copy-${Date.now()}`,
        description: page.description,
        content: page.content,
        isPublished: false,
      });
    } catch (error) {
      // Error handled by hook
    }
  };

  // Contadores seguros
  const totalPages = pages.length;
  const publishedPages = pages.filter((p) => p.isPublished).length;
  const draftPages = pages.filter((p) => !p.isPublished).length;

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="mb-2 flex items-center gap-2 text-sm text-muted-foreground" aria-label="breadcrumb">
        <Link href="/dashboard" className="hover:underline">Dashboard</Link>
        <span>/</span>
        <span className="font-semibold text-foreground">Paginas</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Paginas</h1>
          <p className="text-muted-foreground mt-1">
            Crie e gerencie paginas customizadas
          </p>
        </div>
        <Link href="/pages/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nova Pagina
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{totalPages}</div>
            <p className="text-sm text-muted-foreground">Total de Paginas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{publishedPages}</div>
            <p className="text-sm text-muted-foreground">Publicadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">{draftPages}</div>
            <p className="text-sm text-muted-foreground">Rascunhos</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar paginas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Pages Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-6 bg-muted rounded w-1/2 mb-4" />
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredPages.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma pagina encontrada</h3>
            <p className="text-muted-foreground mb-4">
              {search
                ? 'Nenhuma pagina corresponde a sua busca.'
                : 'Crie paginas customizadas para seu CRM.'}
            </p>
            {!search && (
              <Link href="/pages/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeira Pagina
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPages.map((page) => (
            <Card key={page.id} className="group hover:border-primary/50 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{page.title}</h3>
                        {/* Exibe o tenant apenas para SuperAdmin */}
                        {currentUser?.role === 'PLATFORM_ADMIN' && (
                          <span className="ml-2 px-2 py-0.5 text-xs rounded bg-gray-200 text-gray-700" title={page.tenantId}>
                            {page.tenant?.name ? page.tenant.name : page.tenantId}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">/{page.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full flex items-center gap-1 ${
                        page.isPublished
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {page.isPublished ? (
                        <>
                          <Globe className="h-3 w-3" />
                          Publicada
                        </>
                      ) : (
                        <>
                          <GlobeLock className="h-3 w-3" />
                          Rascunho
                        </>
                      )}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/pages/${page.id}/edit`)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => window.open(`/preview/${page.slug}`, '_blank')}>
                          <Eye className="h-4 w-4 mr-2" />
                          Visualizar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(page)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handlePublish(page)}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          {page.isPublished ? 'Despublicar' : 'Publicar'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setPageToDelete(page)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {page.description && (
                  <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                    {page.description}
                  </p>
                )}

                <div className="text-xs text-muted-foreground mt-4">
                  Atualizado em {new Date(page.updatedAt).toLocaleDateString('pt-BR')}
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <Link href={`/pages/${page.id}/edit`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Pencil className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`/preview/${page.slug}`, '_blank')}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Preview
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDuplicate(page)}
                    disabled={createPage.isPending}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!pageToDelete} onOpenChange={() => setPageToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pagina?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a pagina "{pageToDelete?.title}"?
              Esta acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePage.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletePage.isPending}
            >
              {deletePage.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function PagesPage() {
  return (
    <RequireRole adminOnly message="Apenas administradores podem gerenciar paginas.">
      <PagesPageContent />
    </RequireRole>
  );
}

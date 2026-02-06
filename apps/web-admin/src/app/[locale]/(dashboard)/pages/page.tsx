'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Eye,
  FileText,
  Copy,
  Globe,
  GlobeLock,
  Loader2,
  RefreshCw,
  ExternalLink,
  LayoutDashboard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { PageFormDialog } from '@/components/pages/page-form-dialog';
import type { Page } from '@/services/pages.service';

export default function PagesPage() {
  const { user: currentUser } = useAuthStore();
  const router = useRouter();
  const locale = useLocale();

  const isAdmin = currentUser?.role === 'PLATFORM_ADMIN' || currentUser?.role === 'ADMIN';

  const [search, setSearch] = useState('');
  const [selectedPage, setSelectedPage] = useState<Page | null>(null);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<Page | null>(null);
  const [pageToDelete, setPageToDelete] = useState<Page | null>(null);

  const { data, isLoading, refetch } = usePages();
  const deletePage = useDeletePage();
  const publishPage = usePublishPage();
  const unpublishPage = useUnpublishPage();
  const createPageMutation = useCreatePage();

  // Garante que pages e sempre um array
  const pages: Page[] = (() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.data && Array.isArray(data.data)) return data.data;
    return [];
  })();

  // Para USER/VIEWER, mostra apenas publicadas
  const visiblePages = isAdmin ? pages : pages.filter(p => p.isPublished);

  const filteredPages = visiblePages.filter((page) =>
    (page.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (page.slug || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async () => {
    if (!pageToDelete) return;
    try {
      await deletePage.mutateAsync(pageToDelete.id);
      if (selectedPage?.id === pageToDelete.id) {
        setSelectedPage(null);
      }
      setPageToDelete(null);
    } catch (error) {
      // tratado pelo hook
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
      // tratado pelo hook
    }
  };

  const handleDuplicate = async (page: Page) => {
    try {
      await createPageMutation.mutateAsync({
        title: `${page.title} (Copia)`,
        slug: `${page.slug}-copia-${Date.now()}`,
        description: page.description,
        content: page.content,
        isPublished: false,
      });
    } catch (error) {
      // tratado pelo hook
    }
  };

  const handleNewPage = () => {
    setEditingPage(null);
    setFormDialogOpen(true);
  };

  const handleEditMeta = (page: Page) => {
    setEditingPage(page);
    setFormDialogOpen(true);
  };

  const handleFormSuccess = () => {
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:underline">Dashboard</Link>
        <span>/</span>
        <span className="font-semibold text-foreground">Paginas</span>
      </nav>

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Paginas</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as paginas do seu sistema
          </p>
        </div>
        {isAdmin && (
          <Button onClick={handleNewPage}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Pagina
          </Button>
        )}
      </div>

      <div className="flex gap-6">
        {/* Sidebar de Paginas */}
        <div className="w-72 space-y-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              Paginas
            </h3>
            <span className="text-xs text-muted-foreground">{filteredPages.length}</span>
          </div>

          {/* Busca */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : filteredPages.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {search ? 'Nenhuma pagina encontrada' : 'Nenhuma pagina criada'}
                </p>
                {!search && isAdmin && (
                  <Button variant="link" size="sm" onClick={handleNewPage}>
                    Criar primeira pagina
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1">
              {filteredPages.map(page => (
                <button
                  key={page.id}
                  onClick={() => setSelectedPage(page)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                    selectedPage?.id === page.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  <FileText className="h-4 w-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{page.title}</div>
                    <div className="text-xs opacity-70 truncate">/{page.slug}</div>
                  </div>
                  {page.isPublished ? (
                    <Globe className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                  ) : (
                    <GlobeLock className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Area Principal */}
        <div className="flex-1">
          {selectedPage ? (
            <Card>
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {selectedPage.title}
                      {currentUser?.role === 'PLATFORM_ADMIN' && selectedPage.tenant && (
                        <span className="text-xs font-normal px-2 py-0.5 rounded bg-gray-200 text-gray-700">
                          {selectedPage.tenant.name || selectedPage.tenantId}
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-3 mt-1">
                      <span>/preview/{selectedPage.slug}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                        selectedPage.isPublished
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {selectedPage.isPublished ? (
                          <><Globe className="h-3 w-3" /> Publicada</>
                        ) : (
                          <><GlobeLock className="h-3 w-3" /> Rascunho</>
                        )}
                      </span>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`/${locale}/preview/${selectedPage.slug}`, '_blank')}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Preview
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => refetch()}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {/* Info da pagina */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="text-xs text-muted-foreground">Slug</div>
                    <div className="text-sm font-medium mt-1">{selectedPage.slug}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="text-xs text-muted-foreground">Status</div>
                    <div className="text-sm font-medium mt-1">
                      {selectedPage.isPublished ? 'Publicada' : 'Rascunho'}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="text-xs text-muted-foreground">Criado em</div>
                    <div className="text-sm font-medium mt-1">
                      {new Date(selectedPage.createdAt).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="text-xs text-muted-foreground">Atualizado em</div>
                    <div className="text-sm font-medium mt-1">
                      {new Date(selectedPage.updatedAt).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                </div>

                {selectedPage.description && (
                  <div className="mb-6 p-3 rounded-lg bg-muted/50">
                    <div className="text-xs text-muted-foreground mb-1">Descricao</div>
                    <div className="text-sm">{selectedPage.description}</div>
                  </div>
                )}

                {/* Acoes */}
                {isAdmin && (
                  <div className="flex flex-wrap gap-2 pt-4 border-t">
                    <Link href={`/pages/${selectedPage.id}/edit`}>
                      <Button variant="default" size="sm">
                        <LayoutDashboard className="h-4 w-4 mr-2" />
                        Editor Visual
                      </Button>
                    </Link>
                    <Button variant="outline" size="sm" onClick={() => handleEditMeta(selectedPage)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar Dados
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handlePublish(selectedPage)}>
                      {selectedPage.isPublished ? (
                        <><GlobeLock className="h-4 w-4 mr-2" /> Despublicar</>
                      ) : (
                        <><Globe className="h-4 w-4 mr-2" /> Publicar</>
                      )}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDuplicate(selectedPage)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setPageToDelete(selectedPage)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </Button>
                  </div>
                )}

                {/* Visualizacao User/Viewer - apenas link para preview */}
                {!isAdmin && (
                  <div className="pt-4 border-t">
                    <Button
                      onClick={() => window.open(`/${locale}/preview/${selectedPage.slug}`, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir Pagina
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-96">
                <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-medium mb-2">Selecione uma Pagina</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  Escolha uma pagina na lista a esquerda para ver seus detalhes e gerencia-la
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialog de formulario */}
      <PageFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        page={editingPage}
        onSuccess={handleFormSuccess}
      />

      {/* Dialog de confirmacao de exclusao */}
      <AlertDialog open={!!pageToDelete} onOpenChange={() => setPageToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pagina?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a pagina &quot;{pageToDelete?.title}&quot;?
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

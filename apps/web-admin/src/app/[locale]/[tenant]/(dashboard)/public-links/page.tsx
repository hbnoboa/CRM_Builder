'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Plus, Search, MoreVertical, Pencil, Trash2, ExternalLink,
  Copy, Shield, Link2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { usePublicLinks, useUpdatePublicLink, useDeletePublicLink } from '@/hooks/use-public-links';
import { usePermissions } from '@/hooks/use-permissions';
import { PublicLinkFormDialog } from '@/components/public-links/public-link-form-dialog';
import type { PublicLink } from '@/services/public-link.service';
import { toast } from 'sonner';

export default function PublicLinksPage() {
  const t = useTranslations('common');
  const { hasModulePermission } = usePermissions();

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<PublicLink | null>(null);

  const { data, isLoading, refetch } = usePublicLinks({ search: search || undefined });
  const links: PublicLink[] = Array.isArray(data?.data) ? data.data : [];
  const updateLink = useUpdatePublicLink();
  const deleteLink = useDeletePublicLink();

  const canManage = hasModulePermission('publicLinks', 'canRead');
  const canCreate = hasModulePermission('publicLinks', 'canCreate');
  const canUpdate = hasModulePermission('publicLinks', 'canUpdate');
  const canDelete = hasModulePermission('publicLinks', 'canDelete');

  if (!canManage) {
    return (
      <div className="max-w-3xl mx-auto mt-8 px-2">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-16 w-16 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Acesso restrito</h2>
            <p className="text-muted-foreground text-center">
              Você não tem permissão para gerenciar links públicos.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleToggleActive = async (link: PublicLink) => {
    await updateLink.mutateAsync({
      id: link.id,
      data: { isActive: !link.isActive },
    });
  };

  const handleDelete = async () => {
    if (!selectedLink) return;
    await deleteLink.mutateAsync(selectedLink.id);
    setDeleteOpen(false);
    setSelectedLink(null);
  };

  const copyUrl = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/p/${slug}`);
    toast.success('Link copiado!');
  };

  const isExpired = (link: PublicLink) =>
    link.expiresAt && new Date(link.expiresAt) < new Date();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Link2 className="h-6 w-6" />
            Links Publicos
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gere links para acesso externo a formularios
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => { setSelectedLink(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Link
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar links..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : links.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Link2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum link criado</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Crie um link publico para permitir acesso externo a formularios.
            </p>
            {canCreate && (
              <Button onClick={() => { setSelectedLink(null); setFormOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Criar primeiro link
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {links.map((link) => (
            <Card key={link.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium truncate">{link.name}</h3>
                    {!link.isActive && <Badge variant="secondary">Inativo</Badge>}
                    {isExpired(link) && <Badge variant="destructive">Expirado</Badge>}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>{link.entity?.name || link.entitySlug}</span>
                    <span>·</span>
                    <span>{link.registrationCount} registros</span>
                    {link.maxUsers && (
                      <>
                        <span>·</span>
                        <span>max {link.maxUsers}</span>
                      </>
                    )}
                  </div>
                  <div className="mt-1">
                    <code className="text-xs text-muted-foreground">
                      /p/{link.slug}
                    </code>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {canUpdate && (
                    <Switch
                      checked={link.isActive}
                      onCheckedChange={() => handleToggleActive(link)}
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyUrl(link.slug)}
                    title="Copiar link"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        window.open(`/p/${link.slug}`, '_blank');
                      }}>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Abrir link
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => copyUrl(link.slug)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar URL
                      </DropdownMenuItem>
                      {(canUpdate || canDelete) && <DropdownMenuSeparator />}
                      {canUpdate && (
                        <DropdownMenuItem onClick={() => {
                          setSelectedLink(link);
                          setFormOpen(true);
                        }}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                      )}
                      {canDelete && (
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedLink(link);
                            setDeleteOpen(true);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <PublicLinkFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        link={selectedLink}
        onSuccess={() => refetch()}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir link publico</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o link &ldquo;{selectedLink?.name}&rdquo;?
              Usuarios registrados por este link nao serao afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

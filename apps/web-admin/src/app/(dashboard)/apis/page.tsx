'use client';

import { useState } from 'react';
import Link from 'next/link';
import { RequireRole } from '@/components/auth/require-role';
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Code,
  Play,
  Pause,
  Copy,
  Zap,
  PlayCircle,
  PauseCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useCustomApis, useActivateCustomApi, useDeactivateCustomApi } from '@/hooks/use-custom-apis';
import { CustomApiFormDialog, DeleteCustomApiDialog } from '@/components/custom-apis';
import type { CustomApi } from '@/services/custom-apis.service';

const methodColors: Record<string, string> = {
  GET: 'bg-green-100 text-green-800',
  POST: 'bg-blue-100 text-blue-800',
  PUT: 'bg-yellow-100 text-yellow-800',
  PATCH: 'bg-orange-100 text-orange-800',
  DELETE: 'bg-red-100 text-red-800',
};

function ApisPageContent() {
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedApi, setSelectedApi] = useState<CustomApi | null>(null);

  const { data: apis = [], isLoading, refetch } = useCustomApis();
  const activateApi = useActivateCustomApi();
  const deactivateApi = useDeactivateCustomApi();

  const filteredApis = apis.filter(
    (api) =>
      (api.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (api.path || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateApi = () => {
    setSelectedApi(null);
    setFormOpen(true);
  };

  const handleEditApi = (api: CustomApi) => {
    setSelectedApi(api);
    setFormOpen(true);
  };

  const handleDeleteApi = (api: CustomApi) => {
    setSelectedApi(api);
    setDeleteOpen(true);
  };

  const handleToggleActive = async (api: CustomApi) => {
    try {
      if (api.isActive) {
        await deactivateApi.mutateAsync(api.id);
      } else {
        await activateApi.mutateAsync(api.id);
      }
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(`/api/x/[workspace]${path}`);
    toast.success('Path copiado para a area de transferencia');
  };

  const handleSuccess = () => {
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="mb-2 flex items-center gap-2 text-sm text-muted-foreground" aria-label="breadcrumb">
        <Link href="/dashboard" className="hover:underline">Dashboard</Link>
        <span>/</span>
        <span className="font-semibold text-foreground">APIs</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">APIs Personalizadas</h1>
          <p className="text-muted-foreground mt-1">
            Crie endpoints personalizados para seu CRM
          </p>
        </div>
        <Button onClick={handleCreateApi}>
          <Plus className="h-4 w-4 mr-2" />
          Nova API
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{apis.length}</div>
            <p className="text-sm text-muted-foreground">Total de APIs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {apis.filter((a) => a.isActive).length}
            </div>
            <p className="text-sm text-muted-foreground">Ativas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">
              {apis.filter((a) => a.method === 'GET').length}
            </div>
            <p className="text-sm text-muted-foreground">Endpoints GET</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">
              {apis.filter((a) => a.method === 'POST').length}
            </div>
            <p className="text-sm text-muted-foreground">Endpoints POST</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar APIs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* APIs List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-6 bg-muted rounded w-1/3 mb-4" />
                <div className="h-4 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredApis.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Code className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma API encontrada</h3>
            <p className="text-muted-foreground mb-4">
              {search
                ? 'Nenhuma API corresponde a sua busca.'
                : 'Crie sua primeira API personalizada para comecar.'}
            </p>
            {!search && (
              <Button onClick={handleCreateApi}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeira API
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredApis.map((apiItem) => (
            <Card
              key={apiItem.id}
              className="hover:border-primary/50 transition-colors"
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{apiItem.name}</h3>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded ${
                            methodColors[apiItem.method]
                          }`}
                        >
                          {apiItem.method}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${
                            apiItem.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {apiItem.isActive ? 'Ativa' : 'Inativa'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          /api/x/[workspace]{apiItem.path}
                        </code>
                        <button
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => handleCopyPath(apiItem.path)}
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                      {apiItem.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {apiItem.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm">
                      <Play className="h-4 w-4 mr-1" />
                      Testar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEditApi(apiItem)}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditApi(apiItem)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCopyPath(apiItem.path)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Copiar Path
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {apiItem.isActive ? (
                          <DropdownMenuItem
                            onClick={() => handleToggleActive(apiItem)}
                            className="text-yellow-600 focus:text-yellow-600"
                          >
                            <PauseCircle className="h-4 w-4 mr-2" />
                            Desativar
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => handleToggleActive(apiItem)}
                            className="text-green-600 focus:text-green-600"
                          >
                            <PlayCircle className="h-4 w-4 mr-2" />
                            Ativar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteApi(apiItem)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <CustomApiFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        customApi={selectedApi}
        onSuccess={handleSuccess}
      />
      <DeleteCustomApiDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        customApi={selectedApi}
        onSuccess={handleSuccess}
      />
    </div>
  );
}

export default function ApisPage() {
  return (
    <RequireRole adminOnly message="Apenas administradores podem gerenciar APIs.">
      <ApisPageContent />
    </RequireRole>
  );
}

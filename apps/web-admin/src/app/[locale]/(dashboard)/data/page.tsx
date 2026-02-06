'use client';

import { useState, useEffect, useMemo } from 'react';
import { Link } from '@/i18n/navigation';
import {
  Database,
  Plus,
  Search,
  Edit,
  Trash2,
  RefreshCw,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { api } from '@/lib/api';
import { useTenant } from '@/stores/tenant-context';
import { useAuthStore } from '@/stores/auth-store';
import { RecordFormDialog } from '@/components/data/record-form-dialog';
import { useDeleteEntityData } from '@/hooks/use-data';
import type { EntityField } from '@/types';

interface Entity {
  id: string;
  name: string;
  slug: string;
  description?: string;
  fields?: EntityField[];
  _count?: {
    records: number;
  };
}

interface DataRecord {
  id: string;
  tenantId?: string;
  tenant?: {
    id: string;
    name: string;
    slug: string;
  };
  data: { [key: string]: unknown };
  createdAt: string;
  updatedAt: string;
}

// Helper para formatar valores de select/multiselect
function formatCellValue(val: unknown): string {
  if (val === null || val === undefined) return '-';
  if (typeof val === 'object' && val !== null) {
    if ('label' in (val as Record<string, unknown>)) {
      return String((val as Record<string, unknown>).label);
    }
    if ('value' in (val as Record<string, unknown>)) {
      return String((val as Record<string, unknown>).value);
    }
    if (Array.isArray(val)) {
      return val.map(v => formatCellValue(v)).join(', ');
    }
    return JSON.stringify(val);
  }
  return String(val);
}

export default function DataPage() {
  const { user: currentUser } = useAuthStore();
  const { tenantId, loading: tenantLoading } = useTenant();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [records, setRecords] = useState<DataRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<DataRecord | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<DataRecord | null>(null);

  const deleteRecord = useDeleteEntityData();

  useEffect(() => {
    fetchEntities();
  }, []);

  const fetchEntities = async () => {
    try {
      const response = await api.get('/entities');
      const list = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setEntities(list);
      if (list.length > 0 && !selectedEntity) {
        setSelectedEntity(list[0]);
        fetchRecords(list[0].slug);
      }
    } catch (error) {
      console.error('Erro ao carregar entidades:', error);
      setEntities([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecords = async (entitySlug: string): Promise<DataRecord[]> => {
    if (!tenantId) return [];
    setLoadingRecords(true);
    try {
      const response = await api.get(`/data/${entitySlug}`);
      const list = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setRecords(list);
      return list;
    } catch (error) {
      console.error('Erro ao carregar registros:', error);
      setRecords([]);
      return [];
    } finally {
      setLoadingRecords(false);
    }
  };

  const handleEntitySelect = async (entity: Entity) => {
    if (!entity.fields) {
      try {
        const res = await api.get(`/entities/${entity.id}`);
        entity = { ...entity, ...res.data };
        setEntities(prev => prev.map(e => (e.id === entity.id ? entity : e)));
      } catch {}
    }
    setSelectedEntity(entity);
    const data = await fetchRecords(entity.slug);
    if (data.length === 0 && tenantId) {
      setSelectedRecord(null);
      setFormDialogOpen(true);
    }
  };

  const handleNewRecord = () => {
    setSelectedRecord(null);
    setFormDialogOpen(true);
  };

  const handleEditRecord = (record: DataRecord) => {
    setSelectedRecord(record);
    setFormDialogOpen(true);
  };

  const handleDeleteClick = (record: DataRecord) => {
    setRecordToDelete(record);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete || !selectedEntity || !tenantId) return;
    try {
      await deleteRecord.mutateAsync({
        entitySlug: selectedEntity.slug,
        id: recordToDelete.id,
      });
      setRecords(prev => prev.filter(r => r.id !== recordToDelete.id));
    } catch {
      // Erro tratado pelo hook
    } finally {
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    }
  };

  const handleFormSuccess = () => {
    if (selectedEntity) fetchRecords(selectedEntity.slug);
  };

  const columns = useMemo(() => {
    if (records.length === 0) return [];
    return Object.keys(records[0].data || {});
  }, [records]);

  // Filtro de busca nos registros
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const term = searchTerm.toLowerCase();
    return records.filter(r =>
      columns.some(col => formatCellValue(r.data[col]).toLowerCase().includes(term))
    );
  }, [records, searchTerm, columns]);

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="mb-2 flex items-center gap-2 text-sm text-muted-foreground" aria-label="breadcrumb" data-testid="breadcrumb">
        <Link href="/dashboard" className="hover:underline">Dashboard</Link>
        <span>/</span>
        <span className="font-semibold text-foreground">Dados</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold" data-testid="page-title">Dados</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Visualize e gerencie os registros das suas entidades
          </p>
        </div>
        {selectedEntity && (
          <Button
            onClick={handleNewRecord}
            disabled={tenantLoading || !tenantId}
            data-testid="new-record-btn"
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Registro
          </Button>
        )}
      </div>

      {/* Mobile: Select de Entidades */}
      <div className="lg:hidden">
        {loading ? (
          <div className="animate-pulse h-10 bg-muted rounded-lg" />
        ) : entities.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center">
              <Database className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma entidade criada</p>
              <Link href="/entities">
                <Button variant="link" size="sm" data-testid="create-entity-btn-mobile">
                  Criar Entidade
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Select
            value={selectedEntity?.id || ''}
            onValueChange={(value) => {
              const entity = entities.find(e => e.id === value);
              if (entity) handleEntitySelect(entity);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione uma entidade">
                {selectedEntity && (
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    <span>{selectedEntity.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      ({selectedEntity._count?.records || 0})
                    </span>
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {entities.map(entity => (
                <SelectItem key={entity.id} value={entity.id}>
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    <span>{entity.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      ({entity._count?.records || 0})
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* Sidebar de Entidades - Desktop */}
        <div className="hidden lg:block w-64 space-y-2 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              Entidades
            </h3>
            <span className="text-xs text-muted-foreground">{entities.length}</span>
          </div>
          {loading ? (
            <div className="animate-pulse space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-muted rounded-lg" />
              ))}
            </div>
          ) : entities.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Database className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma entidade criada
                </p>
                <Link href="/entities">
                  <Button variant="link" size="sm" data-testid="create-entity-btn">
                    Criar Entidade
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1">
              {entities.map(entity => (
                <button
                  key={entity.id}
                  onClick={() => handleEntitySelect(entity)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${
                    selectedEntity?.id === entity.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Database className="h-4 w-4" />
                    <span className="font-medium">{entity.name}</span>
                  </div>
                  <span className="text-xs opacity-70">
                    {entity._count?.records || 0}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tabela de Registros */}
        <div className="flex-1">
          {selectedEntity ? (
            <Card>
              <CardHeader className="border-b p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg sm:text-xl">{selectedEntity.name}</CardTitle>
                    <CardDescription>
                      {filteredRecords.length} registro(s)
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 sm:flex-none">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-9 w-full sm:w-48 md:w-64"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => fetchRecords(selectedEntity.slug)}
                      className="flex-shrink-0"
                    >
                      <RefreshCw className={`h-4 w-4 ${loadingRecords ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingRecords ? (
                  <div className="flex items-center justify-center h-48 sm:h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : filteredRecords.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 sm:h-64 text-center p-4">
                    <Database className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-4" />
                    <h3 className="font-medium mb-1 text-sm sm:text-base">Nenhum registro</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                      {searchTerm ? 'Nenhum resultado para a busca' : 'Comece adicionando dados a esta entidade'}
                    </p>
                    {!searchTerm && (
                      <Button
                        onClick={handleNewRecord}
                        disabled={tenantLoading || !tenantId}
                        data-testid="add-record-btn"
                        size="sm"
                        className="sm:size-default"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Registro
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px]">
                      <thead className="bg-muted/50">
                        <tr>
                          {columns.map(col => (
                            <th
                              key={col}
                              className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-medium text-muted-foreground capitalize whitespace-nowrap"
                            >
                              {col}
                            </th>
                          ))}
                          {currentUser?.role === 'PLATFORM_ADMIN' && (
                            <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-medium text-muted-foreground whitespace-nowrap">
                              Tenant
                            </th>
                          )}
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-medium text-muted-foreground whitespace-nowrap">
                            Criado em
                          </th>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-medium text-muted-foreground sticky right-0 bg-muted/50">
                            Acoes
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredRecords.map(record => (
                          <tr key={record.id} className="hover:bg-muted/30">
                            {columns.map(col => (
                              <td key={col} className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm max-w-[200px] truncate">
                                {formatCellValue(record.data[col])}
                              </td>
                            ))}
                            {currentUser?.role === 'PLATFORM_ADMIN' && (
                              <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">
                                <span className="px-2 py-0.5 text-xs rounded bg-gray-200 text-gray-700" title={record.tenantId}>
                                  {record.tenant?.name || record.tenantId || '-'}
                                </span>
                              </td>
                            )}
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                              {new Date(record.createdAt).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-right sticky right-0 bg-background">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleEditRecord(record)}
                                  data-testid={`edit-record-btn-${record.id}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => handleDeleteClick(record)}
                                  data-testid={`delete-record-btn-${record.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64 sm:h-96 p-4">
                <Database className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg sm:text-xl font-medium mb-2 text-center">Selecione uma Entidade</h3>
                <p className="text-muted-foreground text-center text-sm sm:text-base max-w-md">
                  Escolha uma entidade {entities.length > 0 ? 'acima' : 'na lista'} para visualizar e gerenciar seus registros
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialog de formulario para criar/editar registro */}
      {selectedEntity && tenantId && (
        <RecordFormDialog
          open={formDialogOpen}
          onOpenChange={setFormDialogOpen}
          entity={{
            id: selectedEntity.id,
            name: selectedEntity.name,
            slug: selectedEntity.slug,
            fields: selectedEntity.fields || [],
          }}
          record={selectedRecord}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* Dialog de confirmacao de exclusao */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este registro? Esta acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRecord.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

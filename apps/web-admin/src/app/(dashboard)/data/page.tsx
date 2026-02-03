'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Database,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Download,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
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
  data: { [key: string]: unknown };
  createdAt: string;
  updatedAt: string;
}

export default function DataPage() {
  const { organizationId, loading: orgLoading } = useTenant();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [records, setRecords] = useState<DataRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Estado para o dialog de formulario
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<DataRecord | null>(null);

  // Estado para o dialog de exclusao
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<DataRecord | null>(null);

  const deleteRecord = useDeleteEntityData();

  useEffect(() => {
    fetchEntities();
  }, []);

  const fetchEntities = async () => {
    try {
      const response = await api.get('/entities');
      // A API pode retornar { data: [...], meta: {...} } ou um array direto
      const entitiesDate = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setEntities(entitiesDate);
      if (entitiesDate.length > 0 && !selectedEntity) {
        setSelectedEntity(entitiesDate[0]);
        fetchRecords(entitiesDate[0].slug);
      }
    } catch (error) {
      console.error('Error fetching entities:', error);
      setEntities([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecords = async (entitySlug: string) => {
    if (!organizationId) return;
    setLoadingRecords(true);
    try {
      const response = await api.get(`/data/${organizationId}/${entitySlug}`);
      const recordsData = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setRecords(recordsData);
    } catch (error) {
      console.error('Error fetching records:', error);
      setRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  };

  const fetchEntityDetails = async (entityId: string): Promise<Entity | null> => {
    try {
      const response = await api.get(`/entities/${entityId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching entity details:', error);
      return null;
    }
  };

  const handleEntitySelect = async (entity: Entity) => {
    // Se a entidade nao tem fields, busca os detalhes
    if (!entity.fields) {
      const details = await fetchEntityDetails(entity.id);
      if (details) {
        entity = { ...entity, ...details };
        // Atualiza na lista
        setEntities((prev) =>
          prev.map((e) => (e.id === entity.id ? entity : e))
        );
      }
    }
    setSelectedEntity(entity);
    fetchRecords(entity.slug);
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
    if (!recordToDelete || !selectedEntity || !organizationId) return;
    try {
      await deleteRecord.mutateAsync({
        organizationId: organizationId,
        entitySlug: selectedEntity.slug,
        id: recordToDelete.id,
      });
      // Remove da lista local
      setRecords((prev) => prev.filter((r) => r.id !== recordToDelete.id));
    } catch (error) {
      // Erro tratado pelo hook
    } finally {
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    }
  };

  const handleFormSuccess = () => {
    // Recarrega os registros apos criar/editar
    if (selectedEntity) {
      fetchRecords(selectedEntity.slug);
    }
  };

  const getColumns = () => {
    if (records.length === 0) return [];
    const firstRecord = records[0];
    return Object.keys(firstRecord.data || {});
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="mb-2 flex items-center gap-2 text-sm text-muted-foreground" aria-label="breadcrumb" data-testid="breadcrumb">
        <a href="/dashboard" className="hover:underline">Dashboard</a>
        <span>/</span>
        <span className="font-semibold text-foreground">Date</span>
      </nav>
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold" data-testid="page-title">Date</h1>
          <p className="text-muted-foreground mt-1">
            View and manage your entities' data
          </p>
        </div>
        {selectedEntity && (
          <div className="flex gap-2">
            <Button variant="outline" data-testid="export-btn">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button
              onClick={handleNewRecord}
              disabled={orgLoading || !organizationId}
              data-testid="new-record-btn"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Record
            </Button>
          </div>
        )}
      </div>

      <div className="flex gap-6">
        {/* Entity Sidebar */}
        <div className="w-64 space-y-2">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">
            Entities
          </h3>
          {loading ? (
            <div className="animate-pulse space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-muted rounded-lg" />
              ))}
            </div>
          ) : entities.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Database className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No entity created
                </p>
                <Link href="/entities">
                  <Button variant="link" size="sm" data-testid="create-entity-btn">
                    Create Entity
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            entities.map((entity) => (
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
            ))
          )}
        </div>

        {/* Date Table */}
        <div className="flex-1">
          {selectedEntity ? (
            <Card>
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedEntity.name}</CardTitle>
                    <CardDescription>
                      {records.length} record(s)
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 w-64"
                      />
                    </div>
                    <Button variant="outline" size="icon">
                      <Filter className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => fetchRecords(selectedEntity.slug)}
                    >
                      <RefreshCw className={`h-4 w-4 ${loadingRecords ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingRecords ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : records.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center">
                    <Database className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="font-medium mb-1">No records</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Start adding data to this entity
                    </p>
                    <Button
                      onClick={handleNewRecord}
                      disabled={orgLoading || !organizationId}
                      data-testid="add-record-btn"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Record
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                            ID
                          </th>
                          {getColumns().map((col) => (
                            <th
                              key={col}
                              className="px-4 py-3 text-left text-sm font-medium text-muted-foreground capitalize"
                            >
                              {col}
                            </th>
                          ))}
                          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                            Created at
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {records.map((record) => (
                          <tr key={record.id} className="hover:bg-muted/30">
                            <td className="px-4 py-3 text-sm font-mono">
                              {record.id.slice(0, 8)}...
                            </td>
                            {getColumns().map((col) => {
                              const cellValue = record.data[col];
                              // Helper para formatar valores de select/multiselect
                              const formatValue = (val: unknown): string => {
                                if (val === null || val === undefined) return '-';
                                if (typeof val === 'object' && val !== null) {
                                  // Handle {color, label, value} objects
                                  if ('label' in (val as Record<string, unknown>)) {
                                    return String((val as Record<string, unknown>).label);
                                  }
                                  if ('value' in (val as Record<string, unknown>)) {
                                    return String((val as Record<string, unknown>).value);
                                  }
                                  // Arrays (multiselect)
                                  if (Array.isArray(val)) {
                                    return val.map(v => formatValue(v)).join(', ');
                                  }
                                  return JSON.stringify(val);
                                }
                                return String(val);
                              };
                              return (
                                <td key={col} className="px-4 py-3 text-sm">
                                  {formatValue(cellValue)}
                                </td>
                              );
                            })}
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                              {new Date(record.createdAt).toLocaleDateString('en-US')}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditRecord(record)}
                                  data-testid={`view-record-btn-${record.id}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditRecord(record)}
                                  data-testid={`edit-record-btn-${record.id}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive"
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
              <CardContent className="flex flex-col items-center justify-center h-96">
                <Database className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-medium mb-2">Select an Entity</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  Choose an entity from the list on the left to view and manage its data
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialog de formulario para criar/editar registro */}
      {selectedEntity && organizationId && (
        <RecordFormDialog
          open={formDialogOpen}
          onOpenChange={setFormDialogOpen}
          entity={{
            id: selectedEntity.id,
            name: selectedEntity.name,
            slug: selectedEntity.slug,
            fields: selectedEntity.fields || [],
          }}
          organizationId={organizationId}
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

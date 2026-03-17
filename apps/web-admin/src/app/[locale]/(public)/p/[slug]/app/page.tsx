'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { Loader2, Plus, LogOut, ChevronRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePublicAuthStore } from '@/stores/public-auth-store';
import api from '@/lib/api';
import { RecordFormDialog } from '@/components/data/record-form-dialog';
import type { EntityField } from '@/types';

interface EntityInfo {
  id: string;
  name: string;
  namePlural?: string;
  slug: string;
  fields: EntityField[];
  settings?: Record<string, unknown>;
}

interface RecordItem {
  id: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export default function PublicAppPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const { user, isAuthenticated, logout } = usePublicAuthStore();

  const [entity, setEntity] = useState<EntityInfo | null>(null);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<RecordItem | null>(null);

  // Auth check
  useEffect(() => {
    if (!isAuthenticated) {
      router.push(`/p/${slug}`);
    }
  }, [isAuthenticated, slug, router]);

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);

    // First, get the link info to know entitySlug
    try {
      const linkRes = await api.get(`/p/${slug}`);
      const entitySlug = linkRes.data.entitySlug;

      // Fetch records (JWT scope=own will filter automatically)
      const dataRes = await api.get(`/data/${entitySlug}`, {
        params: { limit: 100 },
      });

      setEntity(dataRes.data.entity);
      setRecords(dataRes.data.data || []);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        logout();
        router.push(`/p/${slug}`);
        return;
      }
      setError(err?.response?.data?.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, slug, logout, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogout = () => {
    logout();
    router.push(`/p/${slug}`);
  };

  const handleFormSuccess = () => {
    setFormOpen(false);
    setSelectedRecord(null);
    fetchData();
  };

  // Get display value for a record — show first non-empty text field
  const getRecordLabel = (record: RecordItem): string => {
    if (!entity?.fields) return `Registro #${record.id.slice(-6)}`;

    for (const field of entity.fields) {
      const value = record.data[field.slug];
      if (value && typeof value === 'string' && value.trim()) {
        return value;
      }
      if (value && typeof value === 'number') {
        return String(value);
      }
    }
    return `Registro #${record.id.slice(-6)}`;
  };

  // Get subtitle — show second non-empty field or date
  const getRecordSubtitle = (record: RecordItem): string => {
    if (!entity?.fields) return '';
    let found = 0;
    for (const field of entity.fields) {
      const value = record.data[field.slug];
      if (value && (typeof value === 'string' || typeof value === 'number')) {
        found++;
        if (found === 2) {
          return `${field.name}: ${value}`;
        }
      }
    }
    return new Date(record.createdAt).toLocaleDateString('pt-BR');
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-4 h-14 max-w-2xl mx-auto">
          <h1 className="text-lg font-semibold truncate">
            {entity?.namePlural || entity?.name || 'Carregando...'}
          </h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={fetchData} title="Atualizar">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 pb-24">
        {/* Welcome */}
        <p className="text-sm text-muted-foreground mb-4">
          Ola, {user?.name}
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-destructive mb-4">{error}</p>
              <Button onClick={fetchData}>Tentar novamente</Button>
            </CardContent>
          </Card>
        ) : records.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">
                Nenhum registro encontrado. Crie seu primeiro registro.
              </p>
              <Button onClick={() => { setSelectedRecord(null); setFormOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Novo registro
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {records.map((record) => (
              <Card
                key={record.id}
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => { setSelectedRecord(record); setFormOpen(true); }}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{getRecordLabel(record)}</p>
                    <p className="text-sm text-muted-foreground truncate">{getRecordSubtitle(record)}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* FAB — New Record */}
      {entity && !loading && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            size="lg"
            className="rounded-full h-14 w-14 shadow-lg"
            onClick={() => { setSelectedRecord(null); setFormOpen(true); }}
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      )}

      {/* Record Form */}
      {entity && (
        <RecordFormDialog
          open={formOpen}
          onOpenChange={(open) => {
            setFormOpen(open);
            if (!open) setSelectedRecord(null);
          }}
          entity={entity}
          record={selectedRecord}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useRouter } from '@/i18n/navigation';
import { Loader2 } from 'lucide-react';
import { RequireRole } from '@/components/auth/require-role';
import { usePermissions } from '@/hooks/use-permissions';
import { useDeleteEntity } from '@/hooks/use-entities';
import { toast } from 'sonner';
import api from '@/lib/api';
import type { Entity } from '@/types';

const GrapeJSEntityEditor = dynamic(
  () => import('@/components/entity-editor/grapejs-editor'),
  { ssr: false, loading: () => <div className="h-screen flex items-center justify-center text-muted-foreground">Carregando editor visual...</div> },
);

function GrapeJSEditorWrapper() {
  const params = useParams();
  const router = useRouter();
  const [entity, setEntity] = useState<Entity | null>(null);
  const [loading, setLoading] = useState(true);
  const { hasModulePermission } = usePermissions();
  const deleteEntity = useDeleteEntity({
    success: 'Tabela excluida com sucesso',
    error: 'Erro ao excluir tabela',
  });

  const canDelete = hasModulePermission('entities', 'canDelete');

  useEffect(() => {
    if (params.id) {
      api.get(`/entities/${params.id}`)
        .then((res) => setEntity(res.data))
        .catch(() => { toast.error('Entidade nao encontrada'); router.push('/data'); })
        .finally(() => setLoading(false));
    }
  }, [params.id]);

  if (loading || !entity) {
    return <div className="h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <GrapeJSEntityEditor
      entity={entity}
      onSave={async ({ name, description, fields, settings }) => {
        const res = await api.patch(`/entities/${params.id}`, {
          name,
          description,
          fields,
          settings,
        });
        setEntity(res.data);
      }}
      onCancel={() => router.back()}
      onDelete={canDelete ? async () => {
        await deleteEntity.mutateAsync(entity.id);
        router.push('/data');
      } : undefined}
    />
  );
}

export default function EntityDetailPage() {
  return (
    <RequireRole module="entities">
      <GrapeJSEditorWrapper />
    </RequireRole>
  );
}

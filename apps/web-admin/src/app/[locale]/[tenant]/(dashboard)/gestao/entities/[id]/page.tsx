'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useRouter } from '@/i18n/tenant-navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { RequireRole } from '@/components/auth/require-role';
import { DesktopOnlyEditor } from '@/components/layout/desktop-only-editor';
import { usePermissions } from '@/hooks/use-permissions';
import { useDeleteEntity, entityKeys } from '@/hooks/use-entities';
import { toast } from 'sonner';
import api from '@/lib/api';
import type { Entity } from '@/types';

// Editor de campos React (WYSIWYG, componentes reais, react-grid-layout). GrapeJS removido.
//  default      → variante react-grid-layout (fluida, igual ao dashboard)
//  ?editor=dnd  → variante dnd-kit (alternativa)
const ReactFormBuilderGrid = dynamic(
  () => import('@/components/entity-editor/react-form-builder-grid'),
  { ssr: false, loading: () => <div className="h-screen flex items-center justify-center text-muted-foreground">Carregando editor...</div> },
);
const ReactFormBuilderDnd = dynamic(
  () => import('@/components/entity-editor/react-form-builder'),
  { ssr: false, loading: () => <div className="h-screen flex items-center justify-center text-muted-foreground">Carregando editor...</div> },
);

function EntityEditorWrapper() {
  const params = useParams();
  const searchParams = useSearchParams();
  const editorParam = searchParams.get('editor');
  const router = useRouter();
  const [entity, setEntity] = useState<Entity | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
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

  // Editor React é o único agora (GrapeJS removido).
  const EditorComponent = editorParam === 'dnd' ? ReactFormBuilderDnd : ReactFormBuilderGrid;

  return (
    <EditorComponent
      entity={entity}
      onSave={async ({ name, description, fields, settings }) => {
        const res = await api.patch(`/entities/${params.id}`, {
          name,
          description,
          fields,
          settings,
        });
        setEntity(res.data);
        // Invalidate all entity caches so data pages pick up changes immediately
        queryClient.invalidateQueries({ queryKey: entityKeys.all });
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
      <DesktopOnlyEditor action="editar tabelas">
        <EntityEditorWrapper />
      </DesktopOnlyEditor>
    </RequireRole>
  );
}

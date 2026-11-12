'use client';

import { useParams } from 'next/navigation';
import { RequireRole } from '@/components/auth/require-role';
import { DesktopOnlyEditor } from '@/components/layout/desktop-only-editor';
import { SitePageEditor } from '@/components/site/editor/page-editor';

export default function SitePageEditorPage() {
  const params = useParams<{ id: string }>();
  return (
    <RequireRole module="publicLinks">
      <DesktopOnlyEditor action="editar páginas">
        <SitePageEditor id={params.id} />
      </DesktopOnlyEditor>
    </RequireRole>
  );
}

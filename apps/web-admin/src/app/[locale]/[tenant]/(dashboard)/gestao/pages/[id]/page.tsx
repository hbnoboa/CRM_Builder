'use client';

import { useParams } from 'next/navigation';
import { RequireRole } from '@/components/auth/require-role';
import { SitePageEditor } from '@/components/site/editor/page-editor';

export default function SitePageEditorPage() {
  const params = useParams<{ id: string }>();
  return (
    <RequireRole module="publicLinks">
      <SitePageEditor id={params.id} />
    </RequireRole>
  );
}

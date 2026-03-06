'use client';

import { Loader2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { RequireRole } from '@/components/auth/require-role';
import { usePdfTemplate } from '@/hooks/use-pdf-templates';
import { PdfVisualEditor } from '@/components/pdf-editor/pdf-visual-editor';

interface PageProps {
  params: { id: string };
}

function EditPdfTemplatePageContent({ params }: PageProps) {
  const { id } = params;
  const { data: template, isLoading, error } = usePdfTemplate(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Template nao encontrado</p>
        <Link href="/pdf-templates">
          <Button variant="outline">Voltar para lista</Button>
        </Link>
      </div>
    );
  }

  return <PdfVisualEditor template={template} />;
}

export default function EditPdfTemplatePage({ params }: PageProps) {
  return (
    <RequireRole module="pdfTemplates" action="canUpdate">
      <EditPdfTemplatePageContent params={params} />
    </RequireRole>
  );
}

'use client';

import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/tenant-navigation';
import { Button } from '@/components/ui/button';
import { RequireRole } from '@/components/auth/require-role';
import { GestaoPageHeader } from '@/components/gestao/gestao-ui';
import { AiPageBuilder } from '@/components/ai-builder/ai-page-builder';
import { useAiBuilderStatus } from '@/hooks/use-ai-builder';

/** Criar pagina com IA: conversa (e imagens de modelo) -> pagina pronta para editar. */
export default function AiSitePage() {
  const { data: status } = useAiBuilderStatus();
  return (
    <RequireRole module="publicLinks">
      <div className="mx-auto max-w-7xl space-y-4">
        <GestaoPageHeader
          title="Criar página com IA"
          subtitle="Conte como é o seu negócio e, se quiser, envie a imagem de um site que você gosta: a IA monta a página inteira. Depois você ajusta tudo no editor."
          actions={<Button asChild variant="ghost"><Link href="/gestao/pages"><ArrowLeft className="mr-1.5 h-4 w-4" />Voltar</Link></Button>}
        />
        {status && !status.enabled
          ? <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">O assistente de IA não está ligado nesta conta.</p>
          : <AiPageBuilder />}
      </div>
    </RequireRole>
  );
}

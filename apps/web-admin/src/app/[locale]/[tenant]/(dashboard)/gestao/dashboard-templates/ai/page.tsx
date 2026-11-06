'use client';

import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/tenant-navigation';
import { Button } from '@/components/ui/button';
import { RequireRole } from '@/components/auth/require-role';
import { AiDashboardBuilder } from '@/components/ai-builder/ai-dashboard-builder';

export default function AiDashboardPage() {
  return (
    <RequireRole module="dashboard" action="canCreate">
        <div className="space-y-4 py-2">
          <div className="flex items-start gap-3">
            <Button asChild variant="ghost" size="icon" aria-label="Voltar">
              <Link href="/gestao/dashboard-templates"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Criar painel com IA</h1>
              <p className="text-sm text-muted-foreground">Conte o que você quer acompanhar; a IA monta o painel com os seus dados e você ajusta antes de criar.</p>
            </div>
          </div>
          <AiDashboardBuilder />
        </div>
    </RequireRole>
  );
}

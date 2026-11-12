'use client';

import { useState } from 'react';
import { BarChart3, Check, Database, ExternalLink, LayoutTemplate, SkipForward } from 'lucide-react';
import { Link } from '@/i18n/tenant-navigation';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/use-permissions';
import { cn } from '@/lib/utils';
import { AiTableBuilder } from './ai-table-builder';
import { AiDashboardBuilder } from './ai-dashboard-builder';
import { AiPageBuilder } from './ai-page-builder';

type Step = 'tables' | 'dashboard' | 'site' | 'done';

/**
 * "Monte sua empresa com IA" de ponta a ponta: tabelas, depois o painel e o site,
 * tudo no mesmo lugar. O que a pessoa contou no comeco (inclusive pedidos de
 * painel e de site) segue para os proximos passos.
 */
export function AiCompanyBuilder() {
  const { hasModulePermission } = usePermissions();
  const canDashboard = hasModulePermission('dashboard', 'canCreate');
  const canSite = hasModulePermission('publicLinks', 'canRead');
  const [step, setStep] = useState<Step>('tables');
  const [description, setDescription] = useState('');
  const [made, setMade] = useState<{ tables?: { id: string; count: number }; dashboard?: string; page?: string }>({});

  const steps: Array<{ key: Step; label: string; icon: typeof Database; enabled: boolean }> = [
    { key: 'tables', label: 'Tabelas', icon: Database, enabled: true },
    { key: 'dashboard', label: 'Painel', icon: BarChart3, enabled: canDashboard },
    { key: 'site', label: 'Site', icon: LayoutTemplate, enabled: canSite },
  ];
  const order = steps.filter((s) => s.enabled).map((s) => s.key);
  const next = (from: Step) => setStep((order[order.indexOf(from) + 1] as Step | undefined) ?? 'done');
  const current = order.indexOf(step);

  return (
    <div className="space-y-4" data-testid="ai-company-builder">
      <ol className="flex flex-wrap items-center gap-2 text-sm" data-testid="ai-steps">
        {steps.filter((s) => s.enabled).map((s, i) => {
          const done = step === 'done' || i < current;
          const active = s.key === step;
          return (
            <li key={s.key} className="flex items-center gap-2">
              {i > 0 && <span className="h-px w-6 bg-border" />}
              <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1', active && 'border-primary bg-primary/10 font-semibold text-primary', done && 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300')}>
                {done ? <Check className="h-3.5 w-3.5" /> : <s.icon className="h-3.5 w-3.5" />}
                {i + 1}. {s.label}
              </span>
            </li>
          );
        })}
        {step !== 'tables' && step !== 'done' && (
          <li className="ml-auto">
            <Button size="sm" variant="ghost" onClick={() => next(step)} data-testid="ai-skip-step"><SkipForward className="mr-1.5 h-4 w-4" />Pular esta etapa</Button>
          </li>
        )}
      </ol>

      {step === 'tables' && (
        <AiTableBuilder
          autoTour
          onCreated={(res, text) => {
            setDescription(text);
            setMade((m) => ({ ...m, tables: { id: res.rootId ?? res.tables[0]?.id ?? '', count: res.tables.length } }));
            next('tables');
          }}
        />
      )}

      {step === 'dashboard' && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Tabelas criadas! Agora o painel para acompanhar o negócio: a IA já começou com o que você contou.</p>
          <AiDashboardBuilder
            autoStart={`Monte o painel principal para acompanhar este negócio, com o que for mais útil no dia a dia. O que a pessoa contou:\n${description}`.slice(0, 2000)}
            onCreated={(id) => { setMade((m) => ({ ...m, dashboard: id })); next('dashboard'); }}
          />
        </div>
      )}

      {step === 'site' && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Por fim, o site da empresa (a página que os clientes abrem). Envie uma imagem de um site que você gosta para a IA seguir o estilo, ou peça para montar com o que você já contou.
          </p>
          <AiPageBuilder
            suggestions={[
              `Monte a página inicial do site da empresa. O que a pessoa contou sobre o negócio:\n${description}`.slice(0, 2000),
            ]}
            onCreated={(id) => { setMade((m) => ({ ...m, page: id })); next('site'); }}
          />
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-3 rounded-xl border bg-card p-5" data-testid="ai-company-done">
          <p className="text-lg font-semibold">Pronto! Sua empresa está montada.</p>
          <div className="flex flex-wrap gap-2">
            {made.tables?.id && <Button asChild variant="outline"><Link href={`/gestao/entities/${made.tables.id}`}><Database className="mr-1.5 h-4 w-4" />Ver as tabelas</Link></Button>}
            {made.dashboard && <Button asChild variant="outline"><Link href={`/gestao/dashboard-templates/${made.dashboard}`}><BarChart3 className="mr-1.5 h-4 w-4" />Ver o painel</Link></Button>}
            {made.page && <Button asChild variant="outline"><Link href={`/gestao/pages/${made.page}`}><LayoutTemplate className="mr-1.5 h-4 w-4" />Editar o site</Link></Button>}
            <Button asChild><Link href="/data"><ExternalLink className="mr-1.5 h-4 w-4" />Começar a usar</Link></Button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setStep('tables'); setDescription(''); setMade({}); }}>Montar mais coisas com a IA</Button>
        </div>
      )}
    </div>
  );
}

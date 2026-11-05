'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { SOLUTION_CATALOG } from '@crm-builder/shared';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { USE_CASES } from './content';
import { SolutionIcon } from './solution-icon';

const TABS = [
  { key: 'segmentos', label: 'Por segmento' },
  { key: 'areas', label: 'Por área' },
] as const;

/** Casos de uso em abas; cada cartao leva ao modelo mais proximo (ou a comecar em branco). */
export function UseCases() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('segmentos');

  return (
    <div>
      <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 text-sm" role="tablist" aria-label="Casos de uso">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn('rounded-full px-4 py-1.5 transition-colors', tab === t.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900')}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="tabpanel">
        {USE_CASES[tab].map((item) => {
          const solution = item.solution ? SOLUTION_CATALOG.find((s) => s.slug === item.solution) : undefined;
          return (
            <Link
              key={item.title}
              href={solution ? `/solucoes/${solution.slug}` : '/register'}
              className="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md"
            >
              <h3 className="font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-1 flex-1 text-sm text-slate-600">{item.text}</p>
              <span className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-slate-500 group-hover:text-orange-600">
                {solution ? (
                  <>
                    <SolutionIcon name={solution.icon} className="h-4 w-4" style={{ color: solution.color }} />
                    Modelo {solution.name}
                  </>
                ) : (
                  'Começar em branco'
                )}
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

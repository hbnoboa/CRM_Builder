'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ArrowRight, FileText, LayoutDashboard, MessageSquare, Table2, Users } from 'lucide-react';
import { SOLUTION_CATALOG } from '@crm-builder/shared';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SolutionIcon } from './solution-icon';

/** Vitrine dos modelos: escolhe a esquerda (ou em abas no celular), ve o painel real a direita. */
export function SolutionsShowcase() {
  const [active, setActive] = useState(SOLUTION_CATALOG[0].slug);
  const current = SOLUTION_CATALOG.find((s) => s.slug === active) ?? SOLUTION_CATALOG[0];

  const includes = [
    { icon: Table2, label: 'Tabelas', items: current.includes.tables },
    { icon: Users, label: 'Cargos', items: current.includes.roles },
    { icon: LayoutDashboard, label: 'Painéis', items: current.includes.dashboards },
    { icon: FileText, label: 'Documentos', items: current.includes.documents },
    { icon: MessageSquare, label: 'Comandos no chat', items: current.includes.commands },
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]">
      <div className="flex flex-col gap-2" role="tablist" aria-label="Modelos">
        {SOLUTION_CATALOG.map((s) => (
          <button
            key={s.slug}
            type="button"
            role="tab"
            aria-selected={s.slug === active}
            onClick={() => setActive(s.slug)}
            className={cn(
              'rounded-xl border p-4 text-left transition-all',
              s.slug === active ? 'border-slate-900 bg-white shadow-sm' : 'border-transparent hover:bg-white/70',
            )}
          >
            <span className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${s.color}1a` }}>
                <SolutionIcon name={s.icon} className="h-5 w-5" style={{ color: s.color }} />
              </span>
              <span className="font-semibold text-slate-900">{s.name}</span>
            </span>
            <span className="mt-2 block text-sm text-slate-600">{s.tagline}</span>
            {s.slug === active && <span className="mt-1 block text-xs text-slate-500">Para: {s.audience}</span>}
          </button>
        ))}
      </div>

      <div className="min-w-0" role="tabpanel" aria-label={current.name}>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
          <div className="flex items-center gap-1.5 border-b border-slate-100 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
            <span className="ml-3 truncate text-xs text-slate-400">{current.includes.dashboards[0]}</span>
          </div>
          <Image
            key={current.slug}
            src={current.image}
            alt={`Painel do modelo ${current.name} com dados de exemplo`}
            width={1400}
            height={946}
            className="h-auto w-full"
            sizes="(min-width: 1024px) 640px, 100vw"
          />
        </div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {includes.map(({ icon: Icon, label, items }) => (
            <div key={label}>
              <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Icon className="h-3.5 w-3.5" /> {label}
              </dt>
              <dd className="mt-1 text-sm text-slate-800">{items.join(' · ')}</dd>
            </div>
          ))}
        </dl>
        <Button asChild className="mt-6 bg-orange-600 text-white hover:bg-orange-700">
          <Link href={`/register?modelo=${current.slug}`}>
            Usar o modelo {current.name} <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

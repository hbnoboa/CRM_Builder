'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { PLANS } from './plans';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function Pricing({ showCompareLink = false }: { showCompareLink?: boolean }) {
  const [yearly, setYearly] = useState(true);

  return (
    <div>
      <div className="flex justify-center">
        <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 text-sm" role="group" aria-label="Período de cobrança">
          {[
            { value: false, label: 'Mensal' },
            { value: true, label: 'Anual (−20%)' },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              aria-pressed={yearly === opt.value}
              onClick={() => setYearly(opt.value)}
              className={cn(
                'rounded-full px-4 py-1.5 transition-colors',
                yearly === opt.value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={cn(
              'relative flex flex-col rounded-2xl border bg-white p-6',
              plan.highlight ? 'border-orange-600 shadow-xl shadow-orange-600/10' : 'border-slate-200',
            )}
          >
            {plan.highlight && (
              <span className="absolute -top-3 left-6 rounded-full bg-orange-600 px-3 py-0.5 text-xs font-semibold text-white">
                Mais escolhido
              </span>
            )}
            <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
            <p className="mt-1 text-sm text-slate-600">{plan.description}</p>
            <p className="mt-6 flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight text-slate-900">{brl(yearly ? plan.yearly : plan.monthly)}</span>
              <span className="text-sm text-slate-500">/usuário/mês</span>
            </p>
            <p className="mt-1 h-4 text-xs text-slate-500">
              {yearly ? `cobrado anualmente · ${brl(plan.monthly)} no mensal` : 'sem fidelidade'}
            </p>
            <ul className="mt-6 flex-1 space-y-2.5 text-sm text-slate-700">
              {plan.summary.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" /> {f}
                </li>
              ))}
            </ul>
            <Button
              asChild
              variant={plan.highlight ? 'default' : 'outline'}
              className={cn('mt-8', plan.highlight ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-white text-slate-900 border-slate-300 hover:bg-slate-50 hover:text-slate-900')}
            >
              <Link href="/register">Testar grátis</Link>
            </Button>
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-slate-500">
        Todos os planos começam com teste grátis, sem cartão de crédito.
      </p>
      {showCompareLink && (
        <p className="mt-3 text-center">
          <Link href="/precos" className="text-sm font-medium text-orange-600 hover:underline">Comparar tudo o que vem em cada plano →</Link>
        </p>
      )}
    </div>
  );
}

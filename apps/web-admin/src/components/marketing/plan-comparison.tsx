'use client';

import { useState } from 'react';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COMPARISON, PLANS, type PlanKey } from './plans';

function CellValue({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="mx-auto h-4 w-4 text-orange-600" aria-label="Incluído" />;
  if (value === false) return <Minus className="mx-auto h-4 w-4 text-slate-300" aria-label="Não incluído" />;
  return <>{value}</>;
}

/** "O que vem em cada plano": tabela completa no computador; no celular, um plano por vez. */
export function PlanComparison() {
  const [mobilePlan, setMobilePlan] = useState<PlanKey>('profissional');

  return (
    <>
      {/* Celular: escolhe o plano e ve recurso x valor */}
      <div className="sm:hidden">
        <div className="grid grid-cols-3 rounded-full border border-slate-200 bg-white p-1 text-sm" role="group" aria-label="Plano">
          {PLANS.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={mobilePlan === p.key}
              onClick={() => setMobilePlan(p.key)}
              className={cn('rounded-full py-1.5 transition-colors', mobilePlan === p.key ? 'bg-slate-900 text-white' : 'text-slate-600')}
            >
              {p.name}
            </button>
          ))}
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {COMPARISON.map((group) => (
            <div key={group.group}>
              <p className="bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{group.group}</p>
              {group.rows.map((row) => (
                <div key={row.label} className="flex items-center gap-4 border-t border-slate-100 px-4 py-3 text-sm">
                  <span className="flex-1 text-slate-700">
                    {row.label}
                    {row.hint && <span className="block text-xs text-slate-400">{row.hint}</span>}
                  </span>
                  <span className="w-24 shrink-0 text-center text-slate-700">
                    <CellValue value={row.values[mobilePlan]} />
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Computador: todos os planos lado a lado */}
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white sm:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th scope="col" className="w-[40%] p-4 text-left font-medium text-slate-500">Recurso</th>
              {PLANS.map((p) => (
                <th key={p.key} scope="col" className={cn('p-4 text-center font-semibold', p.highlight ? 'text-orange-600' : 'text-slate-900')}>
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          {COMPARISON.map((group) => (
            <tbody key={group.group}>
              <tr className="bg-slate-50">
                <th scope="colgroup" colSpan={PLANS.length + 1} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {group.group}
                </th>
              </tr>
              {group.rows.map((row) => (
                <tr key={row.label} className="border-t border-slate-100">
                  <th scope="row" className="p-4 text-left font-normal text-slate-700">
                    {row.label}
                    {row.hint && <span className="block text-xs text-slate-400">{row.hint}</span>}
                  </th>
                  {PLANS.map((p) => (
                    <td key={p.key} className="p-4 text-center text-slate-700">
                      <CellValue value={row.values[p.key]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </>
  );
}

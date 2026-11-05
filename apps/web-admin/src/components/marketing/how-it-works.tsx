'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HOW_IT_WORKS } from './content';

/** "Como funciona": abas com a tela real de cada parte da montagem. */
export function HowItWorks() {
  const [active, setActive] = useState<string>(HOW_IT_WORKS[0].id);
  const current = HOW_IT_WORKS.find((h) => h.id === active) ?? HOW_IT_WORKS[0];

  return (
    <div>
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-1 border-b border-slate-200 sm:w-auto" role="tablist" aria-label="Partes do sistema">
          {HOW_IT_WORKS.map((h) => (
            <button
              key={h.id}
              type="button"
              role="tab"
              aria-selected={h.id === active}
              onClick={() => setActive(h.id)}
              className={cn(
                '-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition-colors',
                h.id === active ? 'border-orange-600 font-medium text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900',
              )}
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 grid items-start gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]" role="tabpanel" aria-label={current.label}>
        <div>
          <h3 className="text-2xl font-bold tracking-tight text-slate-900">{current.title}</h3>
          <p className="mt-3 text-slate-600">{current.text}</p>
          <ul className="mt-6 space-y-2.5 text-sm text-slate-700">
            {current.bullets.map((b) => (
              <li key={b} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" /> {b}
              </li>
            ))}
          </ul>
        </div>
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-xl shadow-slate-900/5">
          <div className="relative aspect-[1776/1200]">
            <Image
              key={current.id}
              src={current.image}
              alt={`Tela do CRM Builder: ${current.title}`}
              fill
              className="object-contain"
              sizes="(min-width: 1024px) 640px, 100vw"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Check, X, Minus } from 'lucide-react';

export interface PricingFeature {
  name: string;
  included: boolean | 'partial';
  tooltip?: string;
}

export interface PricingPlan {
  name: string;
  description?: string;
  price: string | number;
  priceUnit?: string;
  billingPeriod?: string;
  features?: PricingFeature[];
  cta?: string;
  ctaHref?: string;
  highlighted?: boolean;
  badge?: string;
}

export interface PricingTableProps {
  plans: PricingPlan[];
  variant?: 'cards' | 'comparison';
  columns?: 2 | 3 | 4;
}

export function PricingTable({
  plans,
  variant = 'cards',
  columns = 3,
}: PricingTableProps) {
  const safePlans = Array.isArray(plans) ? plans : [];

  const gridCols = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-2 lg:grid-cols-3',
    4: 'md:grid-cols-2 lg:grid-cols-4',
  };

  if (safePlans.length === 0) {
    return (
      <div className="border rounded-lg p-8 bg-muted/50 text-center">
        <p className="text-muted-foreground">💰 Configure os planos de preço</p>
      </div>
    );
  }

  if (variant === 'comparison') {
    const allFeatures = Array.from(
      new Set(safePlans.flatMap((p) => (p.features || []).map((f) => f.name)))
    );

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left p-4 border-b">Recursos</th>
              {safePlans.map((plan, idx) => (
                <th
                  key={idx}
                  className={cn(
                    'p-4 border-b text-center',
                    plan.highlighted && 'bg-primary/5'
                  )}
                >
                  {plan.badge && (
                    <span className="inline-block px-2 py-0.5 text-xs bg-primary text-primary-foreground rounded-full mb-2">
                      {plan.badge}
                    </span>
                  )}
                  <div className="font-semibold">{plan.name}</div>
                  <div className="text-2xl font-bold mt-1">
                    {typeof plan.price === 'number' ? `R$ ${plan.price}` : plan.price}
                    {plan.billingPeriod && (
                      <span className="text-sm font-normal text-muted-foreground">
                        /{plan.billingPeriod}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allFeatures.map((featureName, idx) => (
              <tr key={idx} className="hover:bg-muted/50">
                <td className="p-4 border-b text-sm">{featureName}</td>
                {safePlans.map((plan, planIdx) => {
                  const feature = (plan.features || []).find((f) => f.name === featureName);
                  return (
                    <td
                      key={planIdx}
                      className={cn(
                        'p-4 border-b text-center',
                        plan.highlighted && 'bg-primary/5'
                      )}
                    >
                      {feature?.included === true && (
                        <Check className="h-5 w-5 text-green-500 mx-auto" />
                      )}
                      {feature?.included === false && (
                        <X className="h-5 w-5 text-muted-foreground/50 mx-auto" />
                      )}
                      {feature?.included === 'partial' && (
                        <Minus className="h-5 w-5 text-yellow-500 mx-auto" />
                      )}
                      {!feature && (
                        <X className="h-5 w-5 text-muted-foreground/50 mx-auto" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="p-4"></td>
              {safePlans.map((plan, idx) => (
                <td
                  key={idx}
                  className={cn('p-4 text-center', plan.highlighted && 'bg-primary/5')}
                >
                  <button
                    className={cn(
                      'px-4 py-2 rounded-lg font-medium text-sm w-full',
                      plan.highlighted
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'border hover:bg-muted'
                    )}
                  >
                    {plan.cta || 'Selecionar'}
                  </button>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  // Cards variant
  return (
    <div className={cn('grid gap-4', gridCols[columns])}>
      {safePlans.map((plan, idx) => (
        <div
          key={idx}
          className={cn(
            'rounded-xl border p-6 flex flex-col',
            plan.highlighted && 'border-primary shadow-lg relative'
          )}
        >
          {plan.badge && (
            <span className="absolute -top-3 left-1/2 transform -translate-x-1/2 px-3 py-1 text-xs bg-primary text-primary-foreground rounded-full">
              {plan.badge}
            </span>
          )}
          
          <div className="text-center mb-6">
            <h3 className="font-semibold text-lg">{plan.name}</h3>
            {plan.description && (
              <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
            )}
            <div className="mt-4">
              <span className="text-4xl font-bold">
                {typeof plan.price === 'number' ? `R$ ${plan.price}` : plan.price}
              </span>
              {plan.billingPeriod && (
                <span className="text-muted-foreground">/{plan.billingPeriod}</span>
              )}
            </div>
          </div>

          <ul className="space-y-3 flex-1 mb-6">
            {(plan.features || []).map((feature, fIdx) => (
              <li key={fIdx} className="flex items-center gap-2 text-sm">
                {feature.included === true && (
                  <Check className="h-4 w-4 text-green-500 shrink-0" />
                )}
                {feature.included === false && (
                  <X className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                )}
                {feature.included === 'partial' && (
                  <Minus className="h-4 w-4 text-yellow-500 shrink-0" />
                )}
                <span className={cn(!feature.included && 'text-muted-foreground')}>
                  {feature.name}
                </span>
              </li>
            ))}
          </ul>

          <button
            className={cn(
              'w-full py-2 rounded-lg font-medium text-sm',
              plan.highlighted
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'border hover:bg-muted'
            )}
          >
            {plan.cta || 'Selecionar'}
          </button>
        </div>
      ))}
    </div>
  );
}

export function PricingTablePreview({ variant }: PricingTableProps) {
  return (
    <div className="border rounded-lg p-3 bg-background">
      {variant === 'comparison' ? (
        <div className="text-xs">
          <div className="flex border-b pb-1 mb-1">
            <div className="flex-1">Recurso</div>
            <div className="w-12 text-center">Basic</div>
            <div className="w-12 text-center">Pro</div>
          </div>
          <div className="flex">
            <div className="flex-1">Feature 1</div>
            <div className="w-12 text-center"><Check className="h-3 w-3 text-green-500 inline" /></div>
            <div className="w-12 text-center"><Check className="h-3 w-3 text-green-500 inline" /></div>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="flex-1 border rounded p-2 text-center">
            <div className="text-xs font-medium">Basic</div>
            <div className="text-sm font-bold">R$ 29</div>
          </div>
          <div className="flex-1 border-2 border-primary rounded p-2 text-center">
            <div className="text-xs font-medium">Pro</div>
            <div className="text-sm font-bold">R$ 99</div>
          </div>
        </div>
      )}
    </div>
  );
}

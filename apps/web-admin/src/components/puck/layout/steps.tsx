'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

export interface StepsProps {
  steps: {
    title: string;
    description?: string;
    status?: 'completed' | 'current' | 'pending' | 'error';
  }[];
  direction?: 'horizontal' | 'vertical';
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'simple' | 'dots';
  currentStep?: number;
}

export function Steps({
  steps,
  direction = 'horizontal',
  size = 'md',
  variant = 'default',
  currentStep = 0,
}: StepsProps) {
  const safeSteps = Array.isArray(steps) ? steps : [];

  const getStatus = (index: number, step: StepsProps['steps'][0]) => {
    if (step.status) return step.status;
    if (index < currentStep) return 'completed';
    if (index === currentStep) return 'current';
    return 'pending';
  };

  const sizes = {
    sm: { circle: 'w-6 h-6 text-xs', title: 'text-xs', desc: 'text-xs' },
    md: { circle: 'w-8 h-8 text-sm', title: 'text-sm', desc: 'text-xs' },
    lg: { circle: 'w-10 h-10 text-base', title: 'text-base', desc: 'text-sm' },
  };

  const statusStyles = {
    completed: 'bg-primary text-primary-foreground border-primary',
    current: 'bg-primary text-primary-foreground border-primary ring-2 ring-primary/30',
    pending: 'bg-muted text-muted-foreground border-muted-foreground/30',
    error: 'bg-destructive text-destructive-foreground border-destructive',
  };

  const lineStyles = {
    completed: 'bg-primary',
    current: 'bg-gradient-to-r from-primary to-muted-foreground/30',
    pending: 'bg-muted-foreground/30',
    error: 'bg-destructive',
  };

  if (safeSteps.length === 0) {
    return (
      <div className="border rounded-lg p-8 bg-muted/50 text-center">
        <p className="text-muted-foreground">📋 Configure os passos</p>
      </div>
    );
  }

  if (direction === 'vertical') {
    return (
      <div className="flex flex-col">
        {safeSteps.map((step, idx) => {
          const status = getStatus(idx, step);
          const isLast = idx === safeSteps.length - 1;

          return (
            <div key={idx} className="flex">
              <div className="flex flex-col items-center mr-4">
                <div
                  className={cn(
                    'rounded-full flex items-center justify-center border-2',
                    sizes[size].circle,
                    statusStyles[status]
                  )}
                >
                  {status === 'completed' ? (
                    <Check className="h-4 w-4" />
                  ) : variant === 'dots' ? null : (
                    idx + 1
                  )}
                </div>
                {!isLast && (
                  <div className={cn('w-0.5 flex-1 min-h-8', lineStyles[status])} />
                )}
              </div>
              <div className={cn('pb-8', isLast && 'pb-0')}>
                <p className={cn('font-medium', sizes[size].title, status === 'pending' && 'text-muted-foreground')}>
                  {step.title}
                </p>
                {step.description && (
                  <p className={cn('text-muted-foreground mt-1', sizes[size].desc)}>
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Horizontal layout
  return (
    <div className="flex items-start">
      {safeSteps.map((step, idx) => {
        const status = getStatus(idx, step);
        const isLast = idx === safeSteps.length - 1;

        return (
          <React.Fragment key={idx}>
            <div className="flex flex-col items-center flex-1">
              <div
                className={cn(
                  'rounded-full flex items-center justify-center border-2',
                  sizes[size].circle,
                  statusStyles[status]
                )}
              >
                {status === 'completed' ? (
                  <Check className="h-4 w-4" />
                ) : variant === 'dots' ? null : (
                  idx + 1
                )}
              </div>
              <div className="text-center mt-2">
                <p className={cn('font-medium', sizes[size].title, status === 'pending' && 'text-muted-foreground')}>
                  {step.title}
                </p>
                {step.description && (
                  <p className={cn('text-muted-foreground mt-0.5', sizes[size].desc)}>
                    {step.description}
                  </p>
                )}
              </div>
            </div>
            {!isLast && (
              <div className={cn('h-0.5 flex-1 mt-4', lineStyles[status])} style={{ maxWidth: '100px' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export function StepsPreview({ direction }: StepsProps) {
  return (
    <div className="border rounded-lg p-3 bg-background">
      {direction === 'vertical' ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
              <Check className="h-3 w-3 text-white" />
            </div>
            <span className="text-xs">Passo 1</span>
          </div>
          <div className="w-0.5 h-3 bg-primary ml-2.5" />
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center">
              2
            </div>
            <span className="text-xs font-medium">Passo 2</span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <Check className="h-3 w-3 text-white" />
          </div>
          <div className="h-0.5 w-6 bg-primary" />
          <div className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center">
            2
          </div>
          <div className="h-0.5 w-6 bg-muted-foreground/30" />
          <div className="w-5 h-5 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center">
            3
          </div>
        </div>
      )}
    </div>
  );
}

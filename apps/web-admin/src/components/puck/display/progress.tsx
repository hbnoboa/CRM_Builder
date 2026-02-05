'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface ProgressProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
  type?: 'bar' | 'circle';
}

export function Progress({
  value,
  max = 100,
  label,
  showValue = true,
  variant = 'default',
  size = 'md',
  type = 'bar',
}: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const variantColors = {
    default: 'bg-primary',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
  };

  const sizes = {
    sm: { bar: 'h-1', circle: 60, stroke: 4 },
    md: { bar: 'h-2', circle: 80, stroke: 6 },
    lg: { bar: 'h-3', circle: 100, stroke: 8 },
  };

  const sizeConfig = sizes[size];

  if (type === 'circle') {
    const circleSize = sizeConfig.circle;
    const strokeWidth = sizeConfig.stroke;
    const radius = (circleSize - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    return (
      <div className="flex flex-col items-center gap-2">
        <div className="relative" style={{ width: circleSize, height: circleSize }}>
          <svg className="transform -rotate-90" width={circleSize} height={circleSize}>
            {/* Background circle */}
            <circle
              cx={circleSize / 2}
              cy={circleSize / 2}
              r={radius}
              strokeWidth={strokeWidth}
              className="fill-none stroke-muted"
            />
            {/* Progress circle */}
            <circle
              cx={circleSize / 2}
              cy={circleSize / 2}
              r={radius}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className={cn('fill-none transition-all duration-500', variantColors[variant])}
              style={{ stroke: 'currentColor' }}
            />
          </svg>
          {showValue && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={cn(
                'font-semibold',
                size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base'
              )}>
                {Math.round(percentage)}%
              </span>
            </div>
          )}
        </div>
        {label && (
          <span className="text-sm text-muted-foreground">{label}</span>
        )}
      </div>
    );
  }

  return (
    <div className="w-full space-y-1">
      {(label || showValue) && (
        <div className="flex justify-between text-sm">
          {label && <span className="text-muted-foreground">{label}</span>}
          {showValue && <span className="font-medium">{Math.round(percentage)}%</span>}
        </div>
      )}
      <div className={cn('w-full bg-muted rounded-full overflow-hidden', sizeConfig.bar)}>
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            variantColors[variant]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export function ProgressPreview({ value, label, variant, type }: ProgressProps) {
  return (
    <div className="border rounded-lg p-4 bg-muted/50">
      <p className="text-center text-muted-foreground mb-2">
        📊 Progress ({type || 'bar'})
      </p>
      <div className="flex justify-center">
        {type === 'circle' ? (
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent flex items-center justify-center text-xs font-medium">
            {value || 50}%
          </div>
        ) : (
          <div className="w-full max-w-32 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${value || 50}%` }}
            />
          </div>
        )}
      </div>
      {label && (
        <p className="text-center text-xs text-muted-foreground mt-2">{label}</p>
      )}
    </div>
  );
}

'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: number;
  changeLabel?: string;
  icon?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error';
}

export function MetricCard({
  title,
  value,
  subtitle,
  change,
  changeLabel,
  icon,
  variant = 'default',
}: MetricCardProps) {
  const getTrendIcon = () => {
    if (!change || change === 0) return <Minus className="h-4 w-4 text-muted-foreground" />;
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  };

  const getTrendColor = () => {
    if (!change || change === 0) return 'text-muted-foreground';
    if (change > 0) return 'text-green-500';
    return 'text-red-500';
  };

  const variants = {
    default: 'border',
    primary: 'bg-primary text-primary-foreground border-primary',
    success: 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900',
    warning: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-900',
    error: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900',
  };

  return (
    <div className={cn('rounded-lg p-4', variants[variant])}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={cn(
            'text-sm font-medium',
            variant === 'primary' ? 'text-primary-foreground/80' : 'text-muted-foreground'
          )}>
            {title}
          </p>
          <p className={cn(
            'text-2xl font-bold mt-1',
            variant === 'primary' && 'text-primary-foreground'
          )}>
            {value}
          </p>
          {subtitle && (
            <p className={cn(
              'text-sm mt-1',
              variant === 'primary' ? 'text-primary-foreground/70' : 'text-muted-foreground'
            )}>
              {subtitle}
            </p>
          )}
        </div>
        {icon && (
          <div className={cn(
            'text-3xl',
            variant === 'primary' ? 'text-primary-foreground/30' : 'text-muted-foreground/30'
          )}>
            {icon}
          </div>
        )}
      </div>
      
      {change !== undefined && (
        <div className="flex items-center gap-1 mt-3">
          {getTrendIcon()}
          <span className={cn('text-sm font-medium', getTrendColor())}>
            {change > 0 ? '+' : ''}{change}%
          </span>
          {changeLabel && (
            <span className={cn(
              'text-sm',
              variant === 'primary' ? 'text-primary-foreground/70' : 'text-muted-foreground'
            )}>
              {changeLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export interface MetricGridProps {
  metrics: MetricCardProps[];
  columns?: 2 | 3 | 4;
}

export function MetricGrid({ metrics, columns = 4 }: MetricGridProps) {
  const safeMetrics = Array.isArray(metrics) ? metrics : [];

  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  if (safeMetrics.length === 0) {
    return (
      <div className="border rounded-lg p-8 bg-muted/50 text-center">
        <p className="text-muted-foreground">📊 Configure as métricas</p>
      </div>
    );
  }

  return (
    <div className={cn('grid gap-4', gridCols[columns])}>
      {safeMetrics.map((metric, idx) => (
        <MetricCard key={idx} {...metric} />
      ))}
    </div>
  );
}

export function MetricCardPreview({ title, value, change }: MetricCardProps) {
  return (
    <div className="border rounded-lg p-3 bg-background">
      <p className="text-xs text-muted-foreground">{title || 'Métrica'}</p>
      <p className="text-lg font-bold">{value || '100'}</p>
      {change !== undefined && (
        <p className={cn(
          'text-xs',
          change > 0 ? 'text-green-500' : change < 0 ? 'text-red-500' : 'text-muted-foreground'
        )}>
          {change > 0 ? '+' : ''}{change}%
        </p>
      )}
    </div>
  );
}

'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps {
  text: string;
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export function Badge({ text, variant = 'default', size = 'md' }: BadgeProps) {
  const variants = {
    default: 'bg-muted text-muted-foreground',
    primary: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    outline: 'border bg-background text-foreground',
  };

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-0.5',
    lg: 'text-sm px-3 py-1',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        variants[variant],
        sizes[size]
      )}
    >
      {text}
    </span>
  );
}

export interface BadgeGroupProps {
  badges: { text: string; variant?: BadgeProps['variant'] }[];
  size?: BadgeProps['size'];
}

export function BadgeGroup({ badges, size = 'md' }: BadgeGroupProps) {
  const safeBadges = Array.isArray(badges) ? badges : [];

  return (
    <div className="flex flex-wrap gap-2">
      {safeBadges.map((badge, idx) => (
        <Badge key={idx} text={badge.text} variant={badge.variant} size={size} />
      ))}
    </div>
  );
}

export function BadgePreview({ text, variant }: BadgeProps) {
  return (
    <div className="border rounded-lg p-4 bg-muted/50 flex justify-center">
      <Badge text={text || 'Badge'} variant={variant} />
    </div>
  );
}

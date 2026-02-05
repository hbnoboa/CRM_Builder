'use client';

import { Zap } from 'lucide-react';
import { ComponentEvent } from '@/lib/page-events';

export interface ActionButtonProps {
  text: string;
  variant: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size: 'sm' | 'md' | 'lg';
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  events?: ComponentEvent[];
  puck?: { isEditing?: boolean };
}

export function ActionButton({
  text,
  variant,
  size,
  disabled,
  loading,
  events,
  puck,
}: ActionButtonProps) {
  const variants: Record<string, string> = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    outline: 'border border-input bg-background hover:bg-accent',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  };

  const sizes: Record<string, string> = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4',
    lg: 'h-12 px-6 text-lg',
  };

  const hasEvents = events && events.length > 0;
  const isEditing = puck?.isEditing;

  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]}`}
      data-events={hasEvents ? JSON.stringify(events) : undefined}
    >
      {loading && (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {text}
      {hasEvents && isEditing && (
        <Zap className="h-3 w-3 text-yellow-500" />
      )}
    </button>
  );
}

export function ActionButtonPreview({
  text,
  variant,
  size,
  events,
}: ActionButtonProps) {
  const variants: Record<string, string> = {
    primary: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    outline: 'border border-input bg-background',
    ghost: 'bg-accent/50',
    destructive: 'bg-destructive text-destructive-foreground',
  };

  const sizes: Record<string, string> = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4',
    lg: 'h-12 px-6 text-lg',
  };

  const hasEvents = events && events.length > 0;

  return (
    <div
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium ${variants[variant]} ${sizes[size]}`}
    >
      {text}
      {hasEvents && (
        <Zap className="h-3 w-3 text-yellow-500" />
      )}
    </div>
  );
}

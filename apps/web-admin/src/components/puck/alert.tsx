'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

export interface AlertProps {
  title?: string;
  description: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  dismissible?: boolean;
}

export function Alert({ title, description, variant = 'default', dismissible }: AlertProps) {
  const [isVisible, setIsVisible] = React.useState(true);

  if (!isVisible) return null;

  const variants = {
    default: {
      container: 'bg-background border',
      icon: <Info className="h-5 w-5 text-foreground" />,
    },
    success: {
      container: 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900',
      icon: <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />,
    },
    warning: {
      container: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-900',
      icon: <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />,
    },
    error: {
      container: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900',
      icon: <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />,
    },
    info: {
      container: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900',
      icon: <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
    },
  };

  const style = variants[variant];

  return (
    <div className={cn('relative border rounded-lg p-4', style.container)}>
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          {style.icon}
        </div>
        <div className="flex-1">
          {title && (
            <h5 className="font-medium mb-1">{title}</h5>
          )}
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {dismissible && (
          <button
            onClick={() => setIsVisible(false)}
            className="flex-shrink-0 p-1 hover:bg-muted rounded transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}

export function AlertPreview({ title, description, variant }: AlertProps) {
  const variantColors = {
    default: 'border-gray-300',
    success: 'border-green-300 bg-green-50',
    warning: 'border-yellow-300 bg-yellow-50',
    error: 'border-red-300 bg-red-50',
    info: 'border-blue-300 bg-blue-50',
  };

  return (
    <div className={cn('border rounded-lg p-3', variantColors[variant || 'default'])}>
      <div className="flex items-start gap-2">
        <AlertCircle className="h-4 w-4 mt-0.5" />
        <div>
          {title && <p className="font-medium text-sm">{title}</p>}
          <p className="text-xs text-muted-foreground">
            {description || 'Alert message...'}
          </p>
        </div>
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { ExternalLink, Mail, Phone, MapPin, Calendar, User } from 'lucide-react';

export interface DetailViewProps {
  layout?: 'horizontal' | 'vertical' | 'card';
  fields: {
    label: string;
    value: string;
    type?: 'text' | 'email' | 'phone' | 'url' | 'date' | 'user';
    span?: 1 | 2 | 3;
  }[];
  columns?: 2 | 3 | 4;
  showBorders?: boolean;
  title?: string;
}

export function DetailView({
  layout = 'horizontal',
  fields,
  columns = 2,
  showBorders = true,
  title,
}: DetailViewProps) {
  const safeFields = Array.isArray(fields) ? fields : [];

  const getIcon = (type?: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4 text-muted-foreground" />;
      case 'phone':
        return <Phone className="h-4 w-4 text-muted-foreground" />;
      case 'url':
        return <ExternalLink className="h-4 w-4 text-muted-foreground" />;
      case 'date':
        return <Calendar className="h-4 w-4 text-muted-foreground" />;
      case 'user':
        return <User className="h-4 w-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const formatValue = (value: string, type?: string) => {
    switch (type) {
      case 'email':
        return (
          <a href={`mailto:${value}`} className="text-primary hover:underline flex items-center gap-1">
            {getIcon(type)} {value}
          </a>
        );
      case 'phone':
        return (
          <a href={`tel:${value}`} className="text-primary hover:underline flex items-center gap-1">
            {getIcon(type)} {value}
          </a>
        );
      case 'url':
        return (
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
            {getIcon(type)} {value}
          </a>
        );
      default:
        return <span className="flex items-center gap-1">{getIcon(type)} {value}</span>;
    }
  };

  const gridCols = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4',
  };

  if (safeFields.length === 0) {
    return (
      <div className="border rounded-lg p-8 bg-muted/50 text-center">
        <p className="text-muted-foreground">📋 Configure os campos a exibir</p>
      </div>
    );
  }

  if (layout === 'card') {
    return (
      <div className={cn('border rounded-lg overflow-hidden', !showBorders && 'border-0')}>
        {title && (
          <div className="bg-muted/50 px-4 py-3 border-b">
            <h3 className="font-semibold">{title}</h3>
          </div>
        )}
        <div className={cn('grid gap-0', gridCols[columns])}>
          {safeFields.map((field, idx) => {
            const spanClass = field.span === 2 ? 'md:col-span-2' : field.span === 3 ? 'md:col-span-3' : '';
            return (
              <div
                key={idx}
                className={cn(
                  'p-4',
                  showBorders && 'border-b border-r last:border-r-0',
                  spanClass
                )}
              >
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  {field.label}
                </p>
                <div className="text-sm">{formatValue(field.value || '-', field.type)}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (layout === 'vertical') {
    return (
      <div className={cn(showBorders && 'border rounded-lg', 'divide-y')}>
        {title && (
          <div className="bg-muted/50 px-4 py-3">
            <h3 className="font-semibold">{title}</h3>
          </div>
        )}
        {safeFields.map((field, idx) => (
          <div key={idx} className="p-3">
            <p className="text-xs text-muted-foreground mb-1">{field.label}</p>
            <div className="text-sm">{formatValue(field.value || '-', field.type)}</div>
          </div>
        ))}
      </div>
    );
  }

  // Horizontal layout (default)
  return (
    <div className={cn(showBorders && 'border rounded-lg', 'divide-y')}>
      {title && (
        <div className="bg-muted/50 px-4 py-3">
          <h3 className="font-semibold">{title}</h3>
        </div>
      )}
      {safeFields.map((field, idx) => (
        <div key={idx} className="flex items-center p-3">
          <p className="text-sm text-muted-foreground w-1/3 shrink-0">{field.label}</p>
          <div className="text-sm flex-1">{formatValue(field.value || '-', field.type)}</div>
        </div>
      ))}
    </div>
  );
}

export function DetailViewPreview({ title, layout }: DetailViewProps) {
  return (
    <div className="border rounded-lg p-3 bg-background">
      <p className="text-sm font-semibold mb-2">{title || 'Detalhes'}</p>
      <div className="space-y-1">
        <div className={cn(
          'text-xs',
          layout === 'horizontal' ? 'flex gap-2' : ''
        )}>
          <span className="text-muted-foreground">Campo:</span>
          <span>Valor</span>
        </div>
        <div className={cn(
          'text-xs',
          layout === 'horizontal' ? 'flex gap-2' : ''
        )}>
          <span className="text-muted-foreground">Email:</span>
          <span className="text-primary">email@ex.com</span>
        </div>
      </div>
    </div>
  );
}

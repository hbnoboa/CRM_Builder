'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Circle, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export interface TimelineItem {
  title: string;
  description?: string;
  date?: string;
  status?: 'completed' | 'current' | 'pending' | 'error';
  icon?: string;
}

export interface TimelineProps {
  items: TimelineItem[];
  variant?: 'default' | 'alternate' | 'compact';
}

export function Timeline({ items, variant = 'default' }: TimelineProps) {
  const safeItems = Array.isArray(items) ? items : [];

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'current':
        return <Clock className="h-5 w-5 text-blue-500 animate-pulse" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'current':
        return 'bg-blue-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-muted-foreground/30';
    }
  };

  if (safeItems.length === 0) {
    return (
      <div className="border rounded-lg p-8 bg-muted/50 text-center">
        <p className="text-muted-foreground">
          ⏱️ Configure os itens da Timeline
        </p>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="space-y-3">
        {safeItems.map((item, idx) => (
          <div key={idx} className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {getStatusIcon(item.status)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">{item.title}</p>
                {item.date && (
                  <span className="text-xs text-muted-foreground">{item.date}</span>
                )}
              </div>
              {item.description && (
                <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn(
      'relative',
      variant === 'alternate' && 'max-w-3xl mx-auto'
    )}>
      {safeItems.map((item, idx) => {
        const isAlternate = variant === 'alternate';
        const isLeft = isAlternate && idx % 2 === 0;
        const isLast = idx === safeItems.length - 1;

        return (
          <div
            key={idx}
            className={cn(
              'relative flex',
              isAlternate ? 'justify-center' : 'gap-4',
              !isLast && 'pb-8'
            )}
          >
            {/* Connector Line */}
            {!isLast && (
              <div
                className={cn(
                  'absolute w-0.5 h-full top-6',
                  getStatusColor(item.status),
                  isAlternate ? 'left-1/2 -translate-x-1/2' : 'left-[9px]'
                )}
              />
            )}

            {/* Content for alternate layout */}
            {isAlternate && (
              <>
                <div className={cn('w-5/12', isLeft ? 'text-right pr-8' : 'invisible')}>
                  {isLeft && (
                    <>
                      <p className="font-medium">{item.title}</p>
                      {item.date && (
                        <p className="text-xs text-muted-foreground">{item.date}</p>
                      )}
                      {item.description && (
                        <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                      )}
                    </>
                  )}
                </div>
                <div className="flex-shrink-0 z-10 bg-background">
                  {getStatusIcon(item.status)}
                </div>
                <div className={cn('w-5/12', !isLeft ? 'pl-8' : 'invisible')}>
                  {!isLeft && (
                    <>
                      <p className="font-medium">{item.title}</p>
                      {item.date && (
                        <p className="text-xs text-muted-foreground">{item.date}</p>
                      )}
                      {item.description && (
                        <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                      )}
                    </>
                  )}
                </div>
              </>
            )}

            {/* Content for default layout */}
            {!isAlternate && (
              <>
                <div className="flex-shrink-0 z-10 bg-background">
                  {getStatusIcon(item.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{item.title}</p>
                    {item.date && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {item.date}
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function TimelinePreview({ items, variant }: TimelineProps) {
  const safeItems = Array.isArray(items) ? items : [];

  return (
    <div className="border rounded-lg p-4 bg-muted/50">
      <p className="text-center text-muted-foreground mb-3">
        ⏱️ Timeline ({variant || 'default'})
      </p>
      <div className="flex flex-col gap-2 items-center">
        {safeItems.length > 0 ? (
          safeItems.slice(0, 3).map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs">
              <div className={cn(
                'w-2 h-2 rounded-full',
                item.status === 'completed' ? 'bg-green-500' :
                item.status === 'current' ? 'bg-blue-500' :
                'bg-muted-foreground/50'
              )} />
              <span>{item.title}</span>
            </div>
          ))
        ) : (
          <>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>Item 1</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Item 2</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
              <span>Item 3</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';

export interface TabsProps {
  tabs: { label: string; content?: string }[];
  defaultTab?: number;
  variant?: 'default' | 'pills' | 'underline';
}

export function Tabs({ tabs, defaultTab = 0, variant = 'default' }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const safeTabs = Array.isArray(tabs) ? tabs : [];

  const variants = {
    default: {
      list: 'border-b',
      tab: 'border-b-2 border-transparent data-[active=true]:border-primary',
      content: 'pt-4',
    },
    pills: {
      list: 'bg-muted p-1 rounded-lg',
      tab: 'rounded-md data-[active=true]:bg-background data-[active=true]:shadow-sm',
      content: 'pt-4',
    },
    underline: {
      list: '',
      tab: 'border-b-2 border-transparent data-[active=true]:border-primary data-[active=true]:text-primary',
      content: 'pt-4',
    },
  };

  const style = variants[variant];

  return (
    <div className="w-full">
      <div className={cn('flex gap-2', style.list)}>
        {safeTabs.map((tab, idx) => (
          <button
            key={idx}
            data-active={idx === activeTab}
            onClick={() => setActiveTab(idx)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-all',
              'hover:text-primary',
              idx === activeTab ? 'text-foreground' : 'text-muted-foreground',
              style.tab
            )}
          >
            {tab?.label || `Tab ${idx + 1}`}
          </button>
        ))}
      </div>
      <div className={style.content}>
        {safeTabs[activeTab]?.content && (
          <p className="text-muted-foreground">{safeTabs[activeTab].content}</p>
        )}
      </div>
    </div>
  );
}

export function TabsPreview({ tabs, variant }: TabsProps) {
  const safeTabs = Array.isArray(tabs) ? tabs : [];
  
  return (
    <div className="border rounded-lg p-4 bg-muted/50">
      <p className="text-center text-muted-foreground mb-2">
        📑 Tabs ({variant || 'default'})
      </p>
      <div className="flex gap-2 justify-center">
        {safeTabs.map((tab, idx) => (
          <span
            key={idx}
            className={cn(
              'px-3 py-1 text-xs rounded',
              idx === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted'
            )}
          >
            {tab?.label || `Tab ${idx + 1}`}
          </span>
        ))}
      </div>
    </div>
  );
}

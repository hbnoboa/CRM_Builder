'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

export interface AccordionItem {
  title: string;
  content: string;
  icon?: string;
}

export interface AccordionProps {
  items: AccordionItem[];
  allowMultiple?: boolean;
  variant?: 'default' | 'bordered' | 'separated';
}

export function Accordion({ items, allowMultiple = false, variant = 'default' }: AccordionProps) {
  const safeItems = Array.isArray(items) ? items : [];
  const [openItems, setOpenItems] = useState<number[]>([0]);

  const toggleItem = (index: number) => {
    if (allowMultiple) {
      setOpenItems((prev) =>
        prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
      );
    } else {
      setOpenItems((prev) => (prev.includes(index) ? [] : [index]));
    }
  };

  if (safeItems.length === 0) {
    return (
      <div className="border rounded-lg p-8 bg-muted/50 text-center">
        <p className="text-muted-foreground">📋 Configure os itens do Accordion</p>
      </div>
    );
  }

  const variants = {
    default: {
      container: 'border rounded-lg divide-y',
      item: '',
      header: 'px-4 py-3 hover:bg-muted/50',
      content: 'px-4 pb-3',
    },
    bordered: {
      container: 'space-y-0 divide-y border rounded-lg',
      item: '',
      header: 'px-4 py-3 hover:bg-muted/50',
      content: 'px-4 pb-3 border-t',
    },
    separated: {
      container: 'space-y-2',
      item: 'border rounded-lg',
      header: 'px-4 py-3 hover:bg-muted/50 rounded-lg',
      content: 'px-4 pb-3',
    },
  };

  const style = variants[variant];

  return (
    <div className={style.container}>
      {safeItems.map((item, idx) => {
        const isOpen = openItems.includes(idx);
        return (
          <div key={idx} className={style.item}>
            <button
              onClick={() => toggleItem(idx)}
              className={cn(
                'w-full flex items-center justify-between text-left transition-colors',
                style.header
              )}
            >
              <span className="font-medium">{item.title}</span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-muted-foreground transition-transform',
                  isOpen && 'rotate-180'
                )}
              />
            </button>
            {isOpen && (
              <div className={style.content}>
                <p className="text-sm text-muted-foreground">{item.content}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function AccordionPreview({ items, variant }: AccordionProps) {
  const safeItems = Array.isArray(items) ? items : [];

  return (
    <div className="border rounded-lg p-4 bg-muted/50">
      <p className="text-center text-muted-foreground mb-2">
        📋 Accordion ({variant || 'default'})
      </p>
      <div className="space-y-1">
        {(safeItems.length > 0 ? safeItems.slice(0, 3) : [{ title: 'Item 1' }, { title: 'Item 2' }, { title: 'Item 3' }]).map((item, idx) => (
          <div
            key={idx}
            className={cn(
              'flex items-center justify-between px-2 py-1 text-xs bg-background rounded',
              idx === 0 && 'ring-1 ring-primary/50'
            )}
          >
            <span>{item.title}</span>
            <ChevronDown className={cn('h-3 w-3', idx === 0 && 'rotate-180')} />
          </div>
        ))}
      </div>
    </div>
  );
}

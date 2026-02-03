'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccordionContextValue {
  value: string | undefined;
  onValueChange: (value: string | undefined) => void;
}

const AccordionContext = React.createContext<AccordionContextValue | null>(null);

interface AccordionProps {
  type?: 'single' | 'multiple';
  collapsible?: boolean;
  value?: string;
  onValueChange?: (value: string | undefined) => void;
  children: React.ReactNode;
  className?: string;
}

export function Accordion({
  type = 'single',
  collapsible = true,
  value,
  onValueChange,
  children,
  className,
}: AccordionProps) {
  const [internalValue, setInternalValue] = React.useState<string | undefined>(value);

  const handleValueChange = React.useCallback(
    (newValue: string | undefined) => {
      if (collapsible && newValue === internalValue) {
        setInternalValue(undefined);
        onValueChange?.(undefined);
      } else {
        setInternalValue(newValue);
        onValueChange?.(newValue);
      }
    },
    [collapsible, internalValue, onValueChange]
  );

  return (
    <AccordionContext.Provider
      value={{ value: value ?? internalValue, onValueChange: handleValueChange }}
    >
      <div className={cn('space-y-1', className)}>{children}</div>
    </AccordionContext.Provider>
  );
}

interface AccordionItemProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export function AccordionItem({ value, children, className }: AccordionItemProps) {
  return (
    <div className={cn('border rounded-lg', className)} data-value={value}>
      {children}
    </div>
  );
}

interface AccordionTriggerProps {
  children: React.ReactNode;
  className?: string;
}

export function AccordionTrigger({ children, className }: AccordionTriggerProps) {
  const context = React.useContext(AccordionContext);
  const itemElement = React.useRef<HTMLButtonElement>(null);

  const itemValue = React.useMemo(() => {
    if (typeof window !== 'undefined' && itemElement.current) {
      const item = itemElement.current.closest('[data-value]');
      return item?.getAttribute('data-value') || undefined;
    }
    return undefined;
  }, []);

  const [localValue, setLocalValue] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    if (itemElement.current) {
      const item = itemElement.current.closest('[data-value]');
      setLocalValue(item?.getAttribute('data-value') || undefined);
    }
  }, []);

  const isOpen = context?.value === localValue;

  return (
    <button
      ref={itemElement}
      type="button"
      onClick={() => context?.onValueChange(localValue)}
      className={cn(
        'flex w-full items-center justify-between p-4 text-sm font-medium transition-all hover:bg-muted/50 [&[data-state=open]>svg]:rotate-180',
        className
      )}
      data-state={isOpen ? 'open' : 'closed'}
    >
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
    </button>
  );
}

interface AccordionContentProps {
  children: React.ReactNode;
  className?: string;
}

export function AccordionContent({ children, className }: AccordionContentProps) {
  const context = React.useContext(AccordionContext);
  const contentElement = React.useRef<HTMLDivElement>(null);

  const [localValue, setLocalValue] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    if (contentElement.current) {
      const item = contentElement.current.closest('[data-value]');
      setLocalValue(item?.getAttribute('data-value') || undefined);
    }
  }, []);

  const isOpen = context?.value === localValue;

  if (!isOpen) return null;

  return (
    <div
      ref={contentElement}
      className={cn('overflow-hidden px-4 pb-4 pt-0 text-sm', className)}
    >
      {children}
    </div>
  );
}

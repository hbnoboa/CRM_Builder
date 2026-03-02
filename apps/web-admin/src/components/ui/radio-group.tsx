'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}

const RadioGroupContext = React.createContext<{
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  name: string;
}>({ name: '' });

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, value, onValueChange, disabled, children, ...props }, ref) => {
    const name = React.useId();
    return (
      <RadioGroupContext.Provider value={{ value, onValueChange, disabled, name }}>
        <div
          ref={ref}
          role="radiogroup"
          className={cn('grid gap-2', className)}
          {...props}
        >
          {children}
        </div>
      </RadioGroupContext.Provider>
    );
  }
);
RadioGroup.displayName = 'RadioGroup';

interface RadioGroupItemProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  value: string;
}

const RadioGroupItem = React.forwardRef<HTMLInputElement, RadioGroupItemProps>(
  ({ className, value, id, ...props }, ref) => {
    const context = React.useContext(RadioGroupContext);
    const isChecked = context.value === value;

    return (
      <div className="relative">
        <input
          ref={ref}
          type="radio"
          id={id}
          name={context.name}
          value={value}
          checked={isChecked}
          onChange={() => context.onValueChange?.(value)}
          disabled={context.disabled || props.disabled}
          className="sr-only peer"
          {...props}
        />
        <div
          className={cn(
            'aspect-square h-4 w-4 rounded-full border border-primary ring-offset-background',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
            'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
            isChecked && 'border-primary',
            className
          )}
        >
          {isChecked && (
            <div className="flex items-center justify-center h-full w-full">
              <div className="h-2.5 w-2.5 rounded-full bg-primary" />
            </div>
          )}
        </div>
      </div>
    );
  }
);
RadioGroupItem.displayName = 'RadioGroupItem';

export { RadioGroup, RadioGroupItem };

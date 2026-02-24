'use client';

import * as React from 'react';
import { useState, useRef } from 'react';
import { Check, ChevronsUpDown, Loader2, X, PenLine } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';

export interface SelectOption {
  value: string;
  label: string;
  color?: string;
  data?: Record<string, unknown>;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  allowCustom?: boolean;
  emptyMessage?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  multiple = false,
  placeholder,
  disabled = false,
  loading = false,
  allowCustom = true,
  emptyMessage,
}: SearchableSelectProps) {
  const t = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const customInputRef = useRef<HTMLInputElement>(null);

  const selectedValues: string[] = multiple
    ? (Array.isArray(value) ? value : [])
    : (value ? [String(value)] : []);

  const getLabel = (val: string): string => {
    const opt = options.find(o => o.value === val);
    return opt?.label || val;
  };

  const handleSelect = (optValue: string) => {
    if (multiple) {
      const current = Array.isArray(value) ? value : [];
      if (current.includes(optValue)) {
        onChange(current.filter(v => v !== optValue));
      } else {
        onChange([...current, optValue]);
      }
    } else {
      onChange(optValue === value ? '' : optValue);
      setOpen(false);
    }
  };

  const handleRemove = (val: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (multiple) {
      const current = Array.isArray(value) ? value : [];
      onChange(current.filter(v => v !== val));
    } else {
      onChange('');
    }
  };

  const handleCustomConfirm = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;

    if (multiple) {
      const current = Array.isArray(value) ? value : [];
      if (!current.includes(trimmed)) {
        onChange([...current, trimmed]);
      }
    } else {
      onChange(trimmed);
      setOpen(false);
    }
    setCustomInput('');
    setCustomMode(false);
  };

  const handleCustomKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCustomConfirm();
    } else if (e.key === 'Escape') {
      setCustomMode(false);
      setCustomInput('');
    }
  };

  // Display text for trigger
  const renderTriggerContent = () => {
    if (loading) {
      return (
        <span className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('loading')}
        </span>
      );
    }

    if (multiple && selectedValues.length > 0) {
      return (
        <div className="flex flex-wrap gap-1 max-w-full overflow-hidden">
          {selectedValues.slice(0, 3).map(val => (
            <Badge key={val} variant="secondary" className="text-xs gap-1 max-w-[120px]">
              <span className="truncate">{getLabel(val)}</span>
              <button
                type="button"
                className="hover:text-destructive transition-colors"
                onClick={(e) => handleRemove(val, e)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {selectedValues.length > 3 && (
            <Badge variant="secondary" className="text-xs">
              +{selectedValues.length - 3}
            </Badge>
          )}
        </div>
      );
    }

    if (!multiple && selectedValues.length === 1) {
      const opt = options.find(o => o.value === selectedValues[0]);
      return (
        <span className="flex items-center gap-2 truncate">
          {opt?.color && (
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: opt.color }} />
          )}
          <span className="truncate">{getLabel(selectedValues[0])}</span>
        </span>
      );
    }

    return <span className="text-muted-foreground">{placeholder || t('select')}</span>;
  };

  return (
    <Popover open={open} onOpenChange={(o) => {
      setOpen(o);
      if (!o) {
        setCustomMode(false);
        setCustomInput('');
      }
    }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || loading}
          className={cn(
            'w-full justify-between font-normal h-auto min-h-10',
            !selectedValues.length && 'text-muted-foreground'
          )}
        >
          {renderTriggerContent()}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        {customMode ? (
          <div className="p-3 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{t('typeCustomValue')}</p>
            <div className="flex gap-2">
              <input
                ref={customInputRef}
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={handleCustomKeyDown}
                placeholder={t('typeCustomValue')}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                autoFocus
              />
              <Button
                type="button"
                size="sm"
                className="h-9 px-3"
                onClick={handleCustomConfirm}
                disabled={!customInput.trim()}
              >
                {t('confirm')}
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => {
                setCustomMode(false);
                setCustomInput('');
              }}
            >
              {t('back')}
            </Button>
          </div>
        ) : (
          <Command>
            <CommandInput placeholder={t('search')} />
            <CommandList>
              <CommandEmpty>{emptyMessage || t('noResults')}</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => {
                  const isSelected = selectedValues.includes(opt.value);
                  return (
                    <CommandItem
                      key={opt.value}
                      value={opt.label}
                      onSelect={() => handleSelect(opt.value)}
                      className="cursor-pointer"
                    >
                      <div className={cn(
                        'mr-2 h-4 w-4 rounded border flex items-center justify-center flex-shrink-0',
                        isSelected
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-muted-foreground/30'
                      )}>
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      {opt.color && (
                        <span className="w-3 h-3 rounded-full flex-shrink-0 mr-2" style={{ backgroundColor: opt.color }} />
                      )}
                      <span className="truncate">{opt.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              {allowCustom && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      value="__custom__"
                      onSelect={() => {
                        setCustomMode(true);
                        setTimeout(() => customInputRef.current?.focus(), 50);
                      }}
                      className="cursor-pointer"
                    >
                      <PenLine className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{t('other')}</span>
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}

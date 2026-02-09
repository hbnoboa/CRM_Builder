'use client';

import { X, Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ArrayFieldProps {
  value?: string[];
  onChange?: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function ArrayField({ value = [], onChange, placeholder, disabled }: ArrayFieldProps) {
  const t = useTranslations('arrayField');
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    const trimmed = input.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange?.([...value, trimmed]);
      setInput('');
      inputRef.current?.focus();
    }
  };

  const handleRemove = (idx: number) => {
    onChange?.(value.filter((_, i) => i !== idx));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
    // Backspace on empty input removes last item
    if (e.key === 'Backspace' && !input && value.length > 0) {
      handleRemove(value.length - 1);
    }
  };

  return (
    <div
      className={`
        flex flex-wrap items-center gap-1.5 min-h-[40px] w-full rounded-md border border-input bg-background px-3 py-2
        ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-text'}
      `}
      onClick={() => !disabled && inputRef.current?.focus()}
    >
      {value.map((item, idx) => (
        <span
          key={`${item}-${idx}`}
          className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary px-2 py-0.5 text-sm font-medium transition-colors hover:bg-primary/20"
        >
          {item}
          {!disabled && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleRemove(idx); }}
              className="rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive transition-colors"
              aria-label={t('remove')}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (input.trim()) handleAdd(); }}
        placeholder={value.length === 0 ? (placeholder || t('placeholder')) : ''}
        disabled={disabled}
        className="flex-1 min-w-[120px] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
      />
      {input.trim() && (
        <Button
          type="button"
          onClick={handleAdd}
          disabled={disabled}
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { X, Check, Loader2, MapPin, RotateCcw, ChevronDown, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { api } from '@/lib/api';
import { useTenant } from '@/stores/tenant-context';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ZoneConfig {
  id: string;
  label: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  optionsSource: 'manual' | 'entity';
  options?: string[];
  sourceEntitySlug?: string;
  sourceFieldSlug?: string;
}

interface ZoneDiagramFieldProps {
  /** Current value: Record or string depending on saveMode */
  value?: Record<string, string> | string;
  /** Callback when value changes */
  onChange?: (value: Record<string, string> | string) => void;
  /** Save mode: 'object' saves Record<zone,option>, 'text' saves just the option string */
  saveMode?: 'object' | 'text';
  /** Background image URL (uploaded by admin) */
  diagramImage?: string;
  /** Zone configurations */
  zones?: ZoneConfig[];
  /** Label */
  label?: string;
  /** Read-only mode */
  readOnly?: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ZoneDiagramField({
  value,
  onChange,
  saveMode = 'object',
  diagramImage,
  zones = [],
  label,
  readOnly = false,
}: ZoneDiagramFieldProps) {
  const t = useTranslations('zoneDiagram');
  const tCommon = useTranslations('common');
  const tUpload = useTranslations('upload');
  const { tenantId } = useTenant();
  const displayLabel = label || t('title');
  const [activeZone, setActiveZone] = useState<string | null>(null);
  const [entityOptions, setEntityOptions] = useState<Record<string, string[]>>({});
  const [loadingEntity, setLoadingEntity] = useState<Record<string, boolean>>({});
  const [customMode, setCustomMode] = useState<string | null>(null); // zone id in custom mode
  const [customInput, setCustomInput] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // ─── Normalize value to Record for internal use ─────────────────────

  const internalValue: Record<string, string> = useMemo(() => {
    if (!value) return {};
    if (typeof value === 'string' && value) {
      // Text mode: find which zone has this option
      for (const zone of zones) {
        const opts = zone.optionsSource === 'entity'
          ? (entityOptions[zone.id] || [])
          : (zone.options || []);
        if (opts.includes(value)) {
          return { [zone.label]: value };
        }
      }
      // Fallback: assign to first zone
      if (zones.length > 0) return { [zones[0].label]: value };
      return {};
    }
    if (typeof value === 'object') return value as Record<string, string>;
    return {};
  }, [value, zones, entityOptions]);

  // ─── Load entity-based options ──────────────────────────────────────

  const loadEntityOptions = useCallback(async (zone: ZoneConfig) => {
    if (zone.optionsSource !== 'entity' || !zone.sourceEntitySlug || !zone.sourceFieldSlug) return;
    if (entityOptions[zone.id] || loadingEntity[zone.id]) return;

    setLoadingEntity(prev => ({ ...prev, [zone.id]: true }));
    try {
      const res = await api.get(`/data/${zone.sourceEntitySlug}`, {
        params: { tenantId, limit: 500 },
      });
      const records = res.data?.data || [];
      const fieldSlug = zone.sourceFieldSlug;
      const opts: string[] = [];
      const seen = new Set<string>();

      records.forEach((rec: { data: Record<string, unknown> }) => {
        const val = rec.data[fieldSlug];
        if (val !== null && val !== undefined) {
          const str = typeof val === 'object' && 'label' in (val as Record<string, unknown>)
            ? String((val as Record<string, unknown>).label)
            : String(val);
          if (str && !seen.has(str)) {
            seen.add(str);
            opts.push(str);
          }
        }
      });

      setEntityOptions(prev => ({ ...prev, [zone.id]: opts.sort() }));
    } catch (err) {
      console.error(`Error loading options for zone ${zone.id}:`, err);
      setEntityOptions(prev => ({ ...prev, [zone.id]: [] }));
    } finally {
      setLoadingEntity(prev => ({ ...prev, [zone.id]: false }));
    }
  }, [tenantId, entityOptions, loadingEntity]);

  // Pre-load entity options for all entity-source zones
  useEffect(() => {
    zones.forEach(zone => {
      if (zone.optionsSource === 'entity' && !entityOptions[zone.id] && !loadingEntity[zone.id]) {
        loadEntityOptions(zone);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones]);

  // ─── Helpers ──────────────────────────────────────────────────────

  const getOptionsForZone = (zone: ZoneConfig): string[] => {
    if (zone.optionsSource === 'entity') {
      return entityOptions[zone.id] || [];
    }
    return zone.options || [];
  };

  const isZoneLoading = (zone: ZoneConfig): boolean => {
    return zone.optionsSource === 'entity' && (loadingEntity[zone.id] || false);
  };

  // ─── Value handlers ────────────────────────────────────────────────

  const handleSelect = (zoneLabel: string, option: string) => {
    if (readOnly || !onChange) return;

    if (saveMode === 'text') {
      // Text mode: save just the option string (or clear if same)
      const currentSelected = internalValue[zoneLabel];
      onChange(currentSelected === option ? '' : option);
    } else {
      // Object mode: original behavior
      const newValue = { ...internalValue };
      if (newValue[zoneLabel] === option) {
        delete newValue[zoneLabel];
      } else {
        newValue[zoneLabel] = option;
      }
      onChange(newValue);
    }
    setActiveZone(null);
  };

  const handleClearZone = (zoneLabel: string) => {
    if (readOnly || !onChange) return;
    if (saveMode === 'text') {
      onChange('');
    } else {
      const newValue = { ...internalValue };
      delete newValue[zoneLabel];
      onChange(newValue);
    }
  };

  const handleClearAll = () => {
    if (readOnly || !onChange) return;
    onChange(saveMode === 'text' ? '' : {});
  };

  const filledCount = zones.filter(z => internalValue[z.label]).length;

  // ─── No zones configured ─────────────────────────────────────────

  if (!zones || zones.length === 0) {
    return (
      <div className="border-2 border-dashed rounded-xl p-6 text-center text-muted-foreground bg-muted/20">
        <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm font-medium">{t('title')}</p>
        <p className="text-xs mt-1">{t('noZonesConfigured')}</p>
      </div>
    );
  }

  // ─── Zone option list (shared between image and list modes) ─────

  const renderZonePopoverContent = (zone: ZoneConfig) => {
    const isSelected = !!internalValue[zone.label];
    const options = getOptionsForZone(zone);
    const loading = isZoneLoading(zone);

    const handleCustomConfirm = () => {
      const trimmed = customInput.trim();
      if (!trimmed) return;
      handleSelect(zone.label, trimmed);
      setCustomInput('');
      setCustomMode(null);
    };

    return (
      <>
        <div className="border-b px-3 py-2 bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{zone.label}</span>
            {isSelected && !readOnly && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearZone(zone.label);
                  setActiveZone(null);
                }}
              >
                <X className="h-3 w-3 mr-1" />
                {t('clear')}
              </Button>
            )}
          </div>
          {isSelected && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">
              {internalValue[zone.label]}
            </p>
          )}
        </div>

        {readOnly ? (
          <div className="p-3 text-sm text-muted-foreground">
            {isSelected ? internalValue[zone.label] : t('noSelection')}
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center p-4 gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">{t('loadingOptions')}</span>
          </div>
        ) : customMode === zone.id ? (
          <div className="p-3 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{tCommon('typeCustomValue')}</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); handleCustomConfirm(); }
                  else if (e.key === 'Escape') { setCustomMode(null); setCustomInput(''); }
                }}
                placeholder={tCommon('typeCustomValue')}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                autoFocus
              />
              <Button type="button" size="sm" className="h-9 px-3" onClick={handleCustomConfirm} disabled={!customInput.trim()}>
                {tCommon('confirm')}
              </Button>
            </div>
            <Button type="button" variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setCustomMode(null); setCustomInput(''); }}>
              {tCommon('back')}
            </Button>
          </div>
        ) : options.length === 0 ? (
          <div className="p-3 space-y-2">
            <div className="text-sm text-muted-foreground text-center">{t('noOptionsAvailable')}</div>
            <CommandSeparator />
            <button
              type="button"
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent cursor-pointer"
              onClick={() => setCustomMode(zone.id)}
            >
              <PenLine className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{tCommon('other')}</span>
            </button>
          </div>
        ) : (
          <Command>
            {options.length > 6 && <CommandInput placeholder={t('searchOption')} />}
            <CommandList className="max-h-48">
              <CommandEmpty>{t('noOptionsFound')}</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt}
                    value={opt}
                    onSelect={() => handleSelect(zone.label, opt)}
                    className="cursor-pointer"
                  >
                    <div className={`mr-2 h-4 w-4 rounded-full border flex items-center justify-center ${
                      internalValue[zone.label] === opt
                        ? 'bg-emerald-500 border-emerald-600'
                        : 'border-muted-foreground/30'
                    }`}>
                      {internalValue[zone.label] === opt && <Check className="h-2.5 w-2.5 text-white" />}
                    </div>
                    <span className="text-sm">{opt}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  value="__custom__"
                  onSelect={() => setCustomMode(zone.id)}
                  className="cursor-pointer"
                >
                  <PenLine className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{tCommon('other')}</span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </>
    );
  };

  // ─── Fallback: list mode (no image) ───────────────────────────────

  if (!diagramImage) {
    return (
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{displayLabel}</span>
            {filledCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {filledCount}/{zones.length}
              </Badge>
            )}
          </div>
          {!readOnly && filledCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-destructive"
              onClick={handleClearAll}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              {t('clearAll')}
            </Button>
          )}
        </div>

        {/* Zones as collapsible cards */}
        <div className="space-y-1 border rounded-lg overflow-hidden">
          {zones.map(zone => {
            const isSelected = !!internalValue[zone.label];
            const isOpen = activeZone === zone.id;
            const options = getOptionsForZone(zone);
            const loading = isZoneLoading(zone);

            return (
              <Collapsible
                key={zone.id}
                open={isOpen}
                onOpenChange={(open) => {
                  setActiveZone(open ? zone.id : null);
                  if (open && zone.optionsSource === 'entity' && !readOnly) {
                    loadEntityOptions(zone);
                  }
                }}
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50 ${
                      isSelected ? 'bg-emerald-50 dark:bg-emerald-950/20' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isSelected ? (
                        <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border border-muted-foreground/30 flex-shrink-0" />
                      )}
                      <span className="font-medium truncate">{zone.label}</span>
                      {isSelected && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 truncate">
                          — {internalValue[zone.label]}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">{options.length}</span>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t bg-muted/10">
                    {readOnly ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        {isSelected ? internalValue[zone.label] : t('noSelection')}
                      </div>
                    ) : loading ? (
                      <div className="flex items-center justify-center p-3 gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">{t('loadingOptions')}</span>
                      </div>
                    ) : customMode === zone.id ? (
                      <div className="px-3 py-2 space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">{tCommon('typeCustomValue')}</p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={customInput}
                            onChange={(e) => setCustomInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const trimmed = customInput.trim();
                                if (trimmed) { handleSelect(zone.label, trimmed); setCustomInput(''); setCustomMode(null); }
                              } else if (e.key === 'Escape') { setCustomMode(null); setCustomInput(''); }
                            }}
                            placeholder={tCommon('typeCustomValue')}
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            autoFocus
                          />
                          <Button type="button" size="sm" className="h-9 px-3" onClick={() => {
                            const trimmed = customInput.trim();
                            if (trimmed) { handleSelect(zone.label, trimmed); setCustomInput(''); setCustomMode(null); }
                          }} disabled={!customInput.trim()}>
                            {tCommon('confirm')}
                          </Button>
                        </div>
                        <Button type="button" variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setCustomMode(null); setCustomInput(''); }}>
                          {tCommon('back')}
                        </Button>
                      </div>
                    ) : options.length === 0 ? (
                      <div className="px-3 py-2 space-y-2">
                        <div className="text-sm text-muted-foreground text-center">{t('noOptionsAvailable')}</div>
                        <button
                          type="button"
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent cursor-pointer"
                          onClick={() => setCustomMode(zone.id)}
                        >
                          <PenLine className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{tCommon('other')}</span>
                        </button>
                      </div>
                    ) : (
                      <Command>
                        {options.length > 6 && <CommandInput placeholder={t('searchOption')} />}
                        <CommandList className="max-h-48">
                          <CommandEmpty>{t('noOptionsFound')}</CommandEmpty>
                          <CommandGroup>
                            {options.map((opt) => (
                              <CommandItem
                                key={opt}
                                value={opt}
                                onSelect={() => handleSelect(zone.label, opt)}
                                className="cursor-pointer"
                              >
                                <div className={`mr-2 h-4 w-4 rounded-full border flex items-center justify-center ${
                                  internalValue[zone.label] === opt
                                    ? 'bg-emerald-500 border-emerald-600'
                                    : 'border-muted-foreground/30'
                                }`}>
                                  {internalValue[zone.label] === opt && <Check className="h-2.5 w-2.5 text-white" />}
                                </div>
                                <span className="text-sm">{opt}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                          <CommandSeparator />
                          <CommandGroup>
                            <CommandItem
                              value="__custom__"
                              onSelect={() => setCustomMode(zone.id)}
                              className="cursor-pointer"
                            >
                              <PenLine className="mr-2 h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">{tCommon('other')}</span>
                            </CommandItem>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>

        {/* Selected value summary */}
        {saveMode === 'text' && typeof value === 'string' && value && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300">
              {value}
              {!readOnly && (
                <button
                  type="button"
                  className="ml-1 hover:text-destructive transition-colors"
                  onClick={() => handleClearAll()}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          </div>
        )}
      </div>
    );
  }

  // ─── Render with image ────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{displayLabel}</span>
          <Badge variant="secondary" className="text-xs">
            {filledCount}/{zones.length}
          </Badge>
        </div>
        {!readOnly && filledCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-destructive"
            onClick={handleClearAll}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            {t('clearAll')}
          </Button>
        )}
      </div>

      {/* Diagram Container */}
      <div ref={containerRef} className="relative w-full max-w-lg mx-auto select-none">
        <div className="relative rounded-xl border-2 border-border overflow-hidden bg-muted/10">
          {/* Background image */}
          <img
            src={diagramImage}
            alt="Diagrama"
            className="w-full h-auto block"
            draggable={false}
            onError={(e) => {
              const img = e.currentTarget;
              img.style.minHeight = '300px';
              img.style.background = 'repeating-conic-gradient(#80808015 0% 25%, transparent 0% 50%) 50% / 20px 20px';
              img.alt = tUpload('imageNotFound');
            }}
          />

          {/* Zone buttons overlay */}
          {zones.map(zone => {
            const isSelected = !!internalValue[zone.label];
            const isActive = activeZone === zone.id;

            return (
              <Popover
                key={zone.id}
                open={isActive}
                onOpenChange={(open) => {
                  setActiveZone(open ? zone.id : null);
                  if (open && zone.optionsSource === 'entity' && !readOnly) {
                    loadEntityOptions(zone);
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={`
                      absolute transform -translate-x-1/2 -translate-y-1/2 z-10
                      min-w-[32px] h-8 px-1.5 rounded-full flex items-center justify-center
                      text-xs font-bold shadow-lg transition-all duration-200 border-2
                      ${readOnly && !isSelected ? 'cursor-default opacity-50' : 'cursor-pointer hover:scale-110'}
                      ${isSelected
                        ? 'bg-emerald-500 text-white border-emerald-600 shadow-emerald-500/30'
                        : isActive
                          ? 'bg-primary text-primary-foreground border-primary scale-110 ring-2 ring-primary/30'
                          : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border-zinc-300 dark:border-zinc-600 hover:border-primary hover:shadow-md'
                      }
                    `}
                    style={{
                      left: `${zone.x}%`,
                      top: `${zone.y}%`,
                    }}
                    title={
                      isSelected
                        ? `${zone.label}: ${internalValue[zone.label]}`
                        : `${zone.label} — ${t('clickToSelect')}`
                    }
                  >
                    {isSelected ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <span className="truncate max-w-[60px]">{zone.label}</span>
                    )}
                  </button>
                </PopoverTrigger>

                <PopoverContent
                  className="w-64 p-0"
                  side="top"
                  align="center"
                  sideOffset={8}
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  {renderZonePopoverContent(zone)}
                </PopoverContent>
              </Popover>
            );
          })}
        </div>
      </div>

      {/* Summary of selected zones */}
      {filledCount > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">{t('selections')}</p>
          <div className="flex flex-wrap gap-1.5">
            {zones
              .filter(z => internalValue[z.label])
              .map(zone => (
                <Badge
                  key={zone.id}
                  variant="secondary"
                  className="text-xs gap-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                >
                  <span className="font-bold">{zone.label}:</span> {internalValue[zone.label]}
                  {!readOnly && (
                    <button
                      type="button"
                      className="ml-0.5 hover:text-destructive transition-colors"
                      onClick={() => handleClearZone(zone.label)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

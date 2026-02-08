'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Check, Loader2, MapPin, RotateCcw } from 'lucide-react';
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
} from '@/components/ui/command';
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
  /** Current value: Record<zoneLabel, selectedOption> — keyed by zone name */
  value?: Record<string, string>;
  /** Callback when value changes */
  onChange?: (value: Record<string, string>) => void;
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
  value = {},
  onChange,
  diagramImage,
  zones = [],
  label = 'Diagrama de Zonas',
  readOnly = false,
}: ZoneDiagramFieldProps) {
  const { tenantId } = useTenant();
  const [activeZone, setActiveZone] = useState<string | null>(null);
  const [entityOptions, setEntityOptions] = useState<Record<string, string[]>>({});
  const [loadingEntity, setLoadingEntity] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);

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

  // ─── Value handlers — keyed by zone.label (zone name) ────────────

  const handleSelect = (zoneLabel: string, option: string) => {
    if (readOnly || !onChange) return;
    const newValue = { ...value };
    if (newValue[zoneLabel] === option) {
      delete newValue[zoneLabel]; // Deselect if same option clicked
    } else {
      newValue[zoneLabel] = option;
    }
    onChange(newValue);
    setActiveZone(null);
  };

  const handleClearZone = (zoneLabel: string) => {
    if (readOnly || !onChange) return;
    const newValue = { ...value };
    delete newValue[zoneLabel];
    onChange(newValue);
  };

  const handleClearAll = () => {
    if (readOnly || !onChange) return;
    onChange({});
  };

  const filledCount = zones.filter(z => value[z.label]).length;

  // ─── No image configured ─────────────────────────────────────────

  if (!diagramImage) {
    return (
      <div className="border-2 border-dashed rounded-xl p-6 text-center text-muted-foreground bg-muted/20">
        <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm font-medium">Diagrama de Zonas</p>
        <p className="text-xs mt-1">Nenhuma imagem configurada. Configure no editor de entidade.</p>
      </div>
    );
  }

  // ─── No zones configured ─────────────────────────────────────────

  if (!zones || zones.length === 0) {
    return (
      <div className="border-2 border-dashed rounded-xl p-6 text-center text-muted-foreground bg-muted/20">
        <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm font-medium">Diagrama de Zonas</p>
        <p className="text-xs mt-1">Nenhuma zona configurada. Configure as zonas no editor de entidade.</p>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{label}</span>
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
            Limpar tudo
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
              img.alt = 'Imagem não encontrada';
            }}
          />

          {/* Zone buttons overlay */}
          {zones.map(zone => {
            const isSelected = !!value[zone.label];
            const isActive = activeZone === zone.id;
            const options = getOptionsForZone(zone);
            const loading = isZoneLoading(zone);

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
                        ? `${zone.label}: ${value[zone.label]}`
                        : `${zone.label} — Clique para selecionar`
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
                          Limpar
                        </Button>
                      )}
                    </div>
                    {isSelected && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">
                        ✓ {value[zone.label]}
                      </p>
                    )}
                  </div>

                  {readOnly ? (
                    <div className="p-3 text-sm text-muted-foreground">
                      {isSelected ? value[zone.label] : 'Nenhuma seleção'}
                    </div>
                  ) : loading ? (
                    <div className="flex items-center justify-center p-4 gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Carregando opções...</span>
                    </div>
                  ) : options.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground text-center">
                      Nenhuma opção disponível
                    </div>
                  ) : (
                    <Command>
                      {options.length > 6 && <CommandInput placeholder="Buscar opção..." />}
                      <CommandList className="max-h-48">
                        <CommandEmpty>Nenhuma opção encontrada</CommandEmpty>
                        <CommandGroup>
                          {options.map((opt) => (
                            <CommandItem
                              key={opt}
                              value={opt}
                              onSelect={() => handleSelect(zone.label, opt)}
                              className="cursor-pointer"
                            >
                              <div className={`mr-2 h-4 w-4 rounded-full border flex items-center justify-center ${
                                value[zone.label] === opt
                                  ? 'bg-emerald-500 border-emerald-600'
                                  : 'border-muted-foreground/30'
                              }`}>
                                {value[zone.label] === opt && <Check className="h-2.5 w-2.5 text-white" />}
                              </div>
                              <span className="text-sm">{opt}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  )}
                </PopoverContent>
              </Popover>
            );
          })}
        </div>
      </div>

      {/* Summary of selected zones */}
      {filledCount > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Seleções:</p>
          <div className="flex flex-wrap gap-1.5">
            {zones
              .filter(z => value[z.label])
              .map(zone => (
                <Badge
                  key={zone.id}
                  variant="secondary"
                  className="text-xs gap-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                >
                  <span className="font-bold">{zone.label}:</span> {value[zone.label]}
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

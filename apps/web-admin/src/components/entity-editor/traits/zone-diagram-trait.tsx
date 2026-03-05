'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, X } from 'lucide-react';
import api from '@/lib/api';
import ImageUploadField from '@/components/form/image-upload-field';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ZoneConfig {
  id: string;
  label: string;
  x: number;
  y: number;
  optionsSource: 'manual' | 'entity';
  options?: string[];
  sourceEntitySlug?: string;
  sourceFieldSlug?: string;
}

interface EntityOption {
  id: string;
  name: string;
  slug: string;
  fields?: Array<{ slug: string; name: string; label?: string; type: string }>;
}

interface ZoneDiagramTraitEditorProps {
  imageValue: string;
  zonesValue: string;
  saveModeValue: string;
  onChangeImage: (value: string) => void;
  onChangeZones: (value: string) => void;
  onChangeSaveMode: (value: string) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ZoneDiagramTraitEditor({
  imageValue,
  zonesValue,
  saveModeValue,
  onChangeImage,
  onChangeZones,
  onChangeSaveMode,
}: ZoneDiagramTraitEditorProps) {
  const [placingZone, setPlacingZone] = useState(false);
  const [repositioningIdx, setRepositioningIdx] = useState<number | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [newOption, setNewOption] = useState('');
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [entitiesLoaded, setEntitiesLoaded] = useState(false);

  // Parse zones from JSON string
  const zones: ZoneConfig[] = (() => {
    try {
      const parsed = JSON.parse(zonesValue || '[]');
      return Array.isArray(parsed) ? parsed.map((z: ZoneConfig) => ({
        ...z,
        optionsSource: z.optionsSource || 'manual',
      })) : [];
    } catch {
      return [];
    }
  })();

  const updateZones = useCallback((newZones: ZoneConfig[]) => {
    onChangeZones(JSON.stringify(newZones));
  }, [onChangeZones]);

  // Fetch entities (lazy, only when needed for entity-linked options)
  const loadEntities = useCallback(() => {
    if (entitiesLoaded) return;
    setEntitiesLoaded(true);
    api.get('/entities')
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setEntities(list);
      })
      .catch(() => setEntities([]));
  }, [entitiesLoaded]);

  // ─── Zone CRUD ──────────────────────────────────────────────────────

  const addZone = (x: number, y: number) => {
    const newId = `zone_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const nextNum = zones.length + 1;
    const newZone: ZoneConfig = {
      id: newId,
      label: `Zona ${nextNum}`,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      optionsSource: 'manual',
      options: [],
    };
    const updated = [...zones, newZone];
    updateZones(updated);
    setEditingIdx(updated.length - 1);
  };

  const updateZone = (idx: number, updates: Partial<ZoneConfig>) => {
    const updated = zones.map((z, i) => i === idx ? { ...z, ...updates } : z);
    updateZones(updated);
  };

  const removeZone = (idx: number) => {
    const updated = zones.filter((_, i) => i !== idx);
    updateZones(updated);
    if (editingIdx === idx) setEditingIdx(null);
    else if (editingIdx !== null && editingIdx > idx) setEditingIdx(editingIdx - 1);
  };

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (repositioningIdx !== null) {
      updateZone(repositioningIdx, {
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
      });
      setRepositioningIdx(null);
      return;
    }

    if (placingZone) {
      addZone(x, y);
      setPlacingZone(false);
      return;
    }
  };

  const isImageInteractive = placingZone || repositioningIdx !== null;

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Save mode */}
      <div className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Modo de salvamento</span>
        <select
          value={saveModeValue || 'object'}
          onChange={(e) => onChangeSaveMode(e.target.value)}
          className="w-full h-7 text-xs border rounded-md px-2 bg-background"
        >
          <option value="object">Objeto completo</option>
          <option value="text">Apenas texto</option>
        </select>
      </div>

      {/* Image Upload */}
      <div className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Imagem do diagrama</span>
        <ImageUploadField
          value={imageValue || ''}
          onChange={(url) => onChangeImage(typeof url === 'string' ? url : (Array.isArray(url) ? url[0] || '' : ''))}
          mode="image"
          multiple={false}
          accept="image/*"
          placeholder="Enviar imagem do diagrama"
          folder="diagrams"
        />
      </div>

      {/* Interactive image preview + zone placement */}
      {imageValue ? (
        <div className="space-y-2">
          <div className="flex items-center gap-1 flex-wrap">
            <Button
              type="button"
              size="sm"
              variant={placingZone ? 'default' : 'outline'}
              className="h-6 text-[10px] px-2"
              onClick={() => {
                setPlacingZone(!placingZone);
                setRepositioningIdx(null);
              }}
            >
              {placingZone ? 'Clique na imagem...' : '+ Zona'}
            </Button>
            {repositioningIdx !== null && (
              <span className="text-[10px] text-primary font-medium animate-pulse">Clique para reposicionar</span>
            )}
            {(placingZone || repositioningIdx !== null) && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 text-[10px] px-2"
                onClick={() => { setPlacingZone(false); setRepositioningIdx(null); }}
              >
                Cancelar
              </Button>
            )}
            <span className="text-[10px] text-muted-foreground ml-auto">{zones.length} zonas</span>
          </div>

          <div
            className={`relative rounded-md border-2 overflow-hidden ${
              isImageInteractive ? 'border-primary cursor-crosshair ring-2 ring-primary/20' : 'border-border'
            }`}
            onClick={handleImageClick}
          >
            <img
              src={imageValue}
              alt="Diagrama"
              className="w-full h-auto block pointer-events-none select-none"
              draggable={false}
            />
            {/* Zone markers */}
            {zones.map((zone, idx) => (
              <button
                key={zone.id}
                type="button"
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 min-w-[22px] h-[22px] px-1 rounded-full flex items-center justify-center text-[9px] font-bold border-2 shadow transition-all ${
                  repositioningIdx === idx
                    ? 'bg-orange-500 text-white border-orange-600 scale-110 ring-2 ring-orange-300 animate-pulse'
                    : editingIdx === idx
                      ? 'bg-primary text-primary-foreground border-primary scale-110 ring-2 ring-primary/30'
                      : zone.options && zone.options.length > 0
                        ? 'bg-emerald-500 text-white border-emerald-600 hover:scale-110'
                        : zone.optionsSource === 'entity' && zone.sourceEntitySlug
                          ? 'bg-blue-500 text-white border-blue-600 hover:scale-110'
                          : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border-zinc-400 hover:scale-110'
                }`}
                style={{ left: `${zone.x}%`, top: `${zone.y}%` }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (repositioningIdx !== null || placingZone) return;
                  setEditingIdx(editingIdx === idx ? null : idx);
                }}
                title={`${zone.label} (${zone.x.toFixed(0)}%, ${zone.y.toFixed(0)}%)`}
              >
                {zone.label.length > 3 ? zone.label.substring(0, 2) + '..' : zone.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed rounded-md p-4 text-center text-muted-foreground">
          <p className="text-xs">Envie uma imagem para configurar as zonas</p>
        </div>
      )}

      {/* Zone editor panel */}
      {editingIdx !== null && zones[editingIdx] && (() => {
        const zone = zones[editingIdx];
        return (
          <div className="p-2 border rounded-md bg-muted/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">{zone.label}</span>
              <div className="flex gap-1">
                <Button type="button" size="sm" variant="ghost" className="h-5 text-[10px] px-1" onClick={() => setEditingIdx(null)}>Fechar</Button>
                <Button type="button" size="sm" variant="ghost" className="h-5 text-[10px] px-1 text-destructive hover:text-destructive" onClick={() => removeZone(editingIdx)}>Remover</Button>
              </div>
            </div>

            {/* Label */}
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground">Nome</span>
              <Input
                className="h-6 text-xs"
                value={zone.label}
                onChange={(e) => updateZone(editingIdx, { label: e.target.value })}
                placeholder="Nome da zona"
              />
            </div>

            {/* Position + Reposition */}
            <div className="flex items-center gap-1 flex-wrap">
              <div className="flex items-center gap-0.5">
                <span className="text-[10px] text-muted-foreground">X:</span>
                <Input
                  className="h-6 text-xs w-14"
                  type="number"
                  min={0} max={100} step={0.1}
                  value={zone.x}
                  onChange={(e) => updateZone(editingIdx, { x: parseFloat(e.target.value) || 0 })}
                />
                <span className="text-[10px] text-muted-foreground">%</span>
              </div>
              <div className="flex items-center gap-0.5">
                <span className="text-[10px] text-muted-foreground">Y:</span>
                <Input
                  className="h-6 text-xs w-14"
                  type="number"
                  min={0} max={100} step={0.1}
                  value={zone.y}
                  onChange={(e) => updateZone(editingIdx, { y: parseFloat(e.target.value) || 0 })}
                />
                <span className="text-[10px] text-muted-foreground">%</span>
              </div>
              <Button
                type="button"
                size="sm"
                variant={repositioningIdx === editingIdx ? 'default' : 'outline'}
                className="h-6 text-[10px] px-2"
                onClick={() => {
                  setPlacingZone(false);
                  setRepositioningIdx(repositioningIdx === editingIdx ? null : editingIdx);
                }}
              >
                {repositioningIdx === editingIdx ? 'Clique...' : 'Reposicionar'}
              </Button>
            </div>

            {/* Options Source */}
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground">Fonte das opcoes</span>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={zone.optionsSource === 'manual' ? 'default' : 'outline'}
                  className="h-6 text-[10px] px-2 flex-1"
                  onClick={() => updateZone(editingIdx, { optionsSource: 'manual' })}
                >
                  Manual
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={zone.optionsSource === 'entity' ? 'default' : 'outline'}
                  className="h-6 text-[10px] px-2 flex-1"
                  onClick={() => {
                    updateZone(editingIdx, { optionsSource: 'entity' });
                    loadEntities();
                  }}
                >
                  Entidade
                </Button>
              </div>
            </div>

            {/* Manual options */}
            {zone.optionsSource === 'manual' && (
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground">Opcoes ({(zone.options || []).length})</span>
                <div className="flex flex-wrap gap-1 min-h-[20px]">
                  {(zone.options || []).map((opt, oIdx) => (
                    <span key={oIdx} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                      {opt}
                      <button type="button" className="hover:text-destructive" onClick={() => {
                        const updated = (zone.options || []).filter((_, i) => i !== oIdx);
                        updateZone(editingIdx, { options: updated });
                      }}>
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-1">
                  <Input
                    className="h-6 text-xs flex-1"
                    placeholder="Nova opcao"
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newOption.trim()) {
                        e.preventDefault();
                        updateZone(editingIdx, { options: [...(zone.options || []), newOption.trim()] });
                        setNewOption('');
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] px-2"
                    disabled={!newOption.trim()}
                    onClick={() => {
                      if (newOption.trim()) {
                        updateZone(editingIdx, { options: [...(zone.options || []), newOption.trim()] });
                        setNewOption('');
                      }
                    }}
                  >
                    +
                  </Button>
                </div>
              </div>
            )}

            {/* Entity source config */}
            {zone.optionsSource === 'entity' && (
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground">Entidade</span>
                <select
                  value={zone.sourceEntitySlug || ''}
                  onChange={(e) => updateZone(editingIdx, { sourceEntitySlug: e.target.value, sourceFieldSlug: '' })}
                  className="w-full h-6 text-[10px] border rounded px-1 bg-background"
                >
                  <option value="">Selecionar...</option>
                  {entities.map(e => (
                    <option key={e.slug} value={e.slug}>{e.name}</option>
                  ))}
                </select>
                {zone.sourceEntitySlug && (
                  <>
                    <span className="text-[10px] text-muted-foreground">Campo</span>
                    <select
                      value={zone.sourceFieldSlug || ''}
                      onChange={(e) => updateZone(editingIdx, { sourceFieldSlug: e.target.value })}
                      className="w-full h-6 text-[10px] border rounded px-1 bg-background"
                    >
                      <option value="">Selecionar...</option>
                      {(entities.find(e => e.slug === zone.sourceEntitySlug)?.fields || []).map(f => (
                        <option key={f.slug || f.name} value={f.slug || f.name}>
                          {f.label || f.name}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Zone list summary */}
      {zones.length > 0 && editingIdx === null && (
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground">Zonas configuradas</span>
          <div className="flex flex-wrap gap-1">
            {zones.map((z, i) => (
              <button
                key={z.id}
                type="button"
                className={`px-1.5 py-0.5 rounded-full text-[10px] transition-colors ${
                  z.optionsSource === 'entity'
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                    : (z.options || []).length > 0
                      ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                      : 'bg-muted text-muted-foreground'
                }`}
                onClick={() => setEditingIdx(i)}
              >
                {z.label}: {z.optionsSource === 'entity' ? `${z.sourceEntitySlug || '?'}` : `${(z.options || []).length} opts`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

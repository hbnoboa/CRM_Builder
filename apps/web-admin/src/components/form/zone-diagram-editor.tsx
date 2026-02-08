'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

interface RelatedEntity {
  id: string;
  name: string;
  slug: string;
  fields?: { name: string; slug: string; type: string; label?: string }[];
}

interface ZoneDiagramEditorProps {
  diagramImage?: string;
  diagramZones?: ZoneConfig[];
  allEntities: RelatedEntity[];
  onUpdate: (updates: Record<string, unknown>) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ZoneDiagramEditor({
  diagramImage,
  diagramZones,
  allEntities,
  onUpdate,
}: ZoneDiagramEditorProps) {
  const currentZones: ZoneConfig[] = (diagramZones || []).map(z => ({
    ...z,
    optionsSource: z.optionsSource || 'manual',
  }));
  const [editingZoneIdx, setEditingZoneIdx] = useState<number | null>(null);
  const [newOption, setNewOption] = useState('');
  const [placingZone, setPlacingZone] = useState(false);
  const [repositioningZoneIdx, setRepositioningZoneIdx] = useState<number | null>(null);

  // ─── Zone CRUD ──────────────────────────────────────────────────────

  const addZone = (x: number, y: number) => {
    const newId = `zone_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const nextNum = currentZones.length + 1;
    const newZone: ZoneConfig = {
      id: newId,
      label: `Zona ${nextNum}`,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      optionsSource: 'manual',
      options: [],
    };
    const updated = [...currentZones, newZone];
    onUpdate({ diagramZones: updated });
    setEditingZoneIdx(updated.length - 1);
  };

  const updateZone = (zIdx: number, updates: Partial<ZoneConfig>) => {
    const updated = currentZones.map((z, i) => i === zIdx ? { ...z, ...updates } : z);
    onUpdate({ diagramZones: updated });
  };

  const removeZone = (zIdx: number) => {
    const updated = currentZones.filter((_, i) => i !== zIdx);
    // Keep user-defined labels — don't renumber
    onUpdate({ diagramZones: updated });
    if (editingZoneIdx === zIdx) setEditingZoneIdx(null);
    else if (editingZoneIdx !== null && editingZoneIdx > zIdx) setEditingZoneIdx(editingZoneIdx - 1);
  };

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Repositioning an existing zone
    if (repositioningZoneIdx !== null) {
      updateZone(repositioningZoneIdx, {
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
      });
      setRepositioningZoneIdx(null);
      return;
    }

    // Placing a new zone
    if (placingZone) {
      addZone(x, y);
      setPlacingZone(false);
      return;
    }
  };

  const isImageInteractive = placingZone || repositioningZoneIdx !== null;

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-3 mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
      <Label className="text-sm font-medium text-emerald-700 dark:text-emerald-300">🗺️ Configuração do Diagrama de Zonas</Label>
      <p className="text-xs text-muted-foreground">
        Faça upload de uma imagem, depois clique nela para posicionar zonas. Cada zona terá um select com opções.
      </p>

      {/* Image Upload */}
      <div className="space-y-1">
        <Label className="text-xs">Imagem de Fundo</Label>
        <ImageUploadField
          value={diagramImage || ''}
          onChange={(url) => onUpdate({ diagramImage: typeof url === 'string' ? url : (Array.isArray(url) ? url[0] || '' : '') })}
          mode="image"
          multiple={false}
          accept="image/*"
          placeholder="Arraste uma imagem ou clique para fazer upload"
          folder="diagrams"
        />
      </div>

      {/* Interactive image preview + zone placement (only when image exists) */}
      {diagramImage ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              size="sm"
              variant={placingZone ? 'default' : 'outline'}
              className="h-7 text-xs"
              onClick={() => {
                setPlacingZone(!placingZone);
                setRepositioningZoneIdx(null);
              }}
            >
              {placingZone ? '🎯 Clique na imagem...' : '➕ Adicionar Zona'}
            </Button>
            {repositioningZoneIdx !== null && (
              <span className="text-xs text-primary font-medium animate-pulse">📍 Clique na imagem para reposicionar...</span>
            )}
            {(placingZone || repositioningZoneIdx !== null) && (
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setPlacingZone(false); setRepositioningZoneIdx(null); }}>
                Cancelar
              </Button>
            )}
            <span className="text-xs text-muted-foreground ml-auto">{currentZones.length} zona(s)</span>
          </div>

          <div
            className={`relative rounded-lg border-2 overflow-hidden max-w-md mx-auto ${
              isImageInteractive ? 'border-primary cursor-crosshair ring-2 ring-primary/20' : 'border-border'
            }`}
            onClick={handleImageClick}
          >
            <img
              src={diagramImage}
              alt="Diagrama"
              className="w-full h-auto block pointer-events-none select-none"
              draggable={false}
            />
            {/* Zone markers */}
            {currentZones.map((zone, zIdx) => (
              <button
                key={zone.id}
                type="button"
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 min-w-[28px] h-7 px-1.5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 shadow transition-all ${
                  repositioningZoneIdx === zIdx
                    ? 'bg-orange-500 text-white border-orange-600 scale-110 ring-2 ring-orange-300 animate-pulse'
                    : editingZoneIdx === zIdx
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
                  if (repositioningZoneIdx !== null || placingZone) return;
                  setEditingZoneIdx(editingZoneIdx === zIdx ? null : zIdx);
                }}
                title={`${zone.label} (${zone.x.toFixed(0)}%, ${zone.y.toFixed(0)}%)`}
              >
                {zone.label.length > 4 ? zone.label.substring(0, 3) + '…' : zone.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed rounded-lg p-6 text-center text-muted-foreground">
          <p className="text-sm">📷 Faça upload de uma imagem acima para começar a posicionar as zonas</p>
        </div>
      )}

      {/* Zone editor panel */}
      {editingZoneIdx !== null && currentZones[editingZoneIdx] && (() => {
        const zone = currentZones[editingZoneIdx];
        return (
          <div className="p-3 border rounded-lg bg-background space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">⚙️ Editando: {zone.label}</Label>
              <div className="flex gap-1">
                <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingZoneIdx(null)}>Fechar</Button>
                <Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => removeZone(editingZoneIdx)}>Remover</Button>
              </div>
            </div>

            {/* Label / Nome */}
            <div className="space-y-1">
              <Label className="text-xs">Nome da Zona</Label>
              <Input
                className="h-8 text-sm"
                value={zone.label}
                onChange={(e) => updateZone(editingZoneIdx, { label: e.target.value })}
                placeholder="Ex: Parachoque Dianteiro"
              />
              <p className="text-xs text-muted-foreground">Este nome será a chave no JSON dos dados</p>
            </div>

            {/* Position — editable inputs + reposition button */}
            <div className="space-y-1">
              <Label className="text-xs">Posição</Label>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground w-3">X:</span>
                  <Input
                    className="h-7 text-sm w-20"
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={zone.x}
                    onChange={(e) => updateZone(editingZoneIdx, { x: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground w-3">Y:</span>
                  <Input
                    className="h-7 text-sm w-20"
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={zone.y}
                    onChange={(e) => updateZone(editingZoneIdx, { y: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={repositioningZoneIdx === editingZoneIdx ? 'default' : 'outline'}
                  className="h-7 text-xs"
                  onClick={() => {
                    setPlacingZone(false);
                    setRepositioningZoneIdx(repositioningZoneIdx === editingZoneIdx ? null : editingZoneIdx);
                  }}
                >
                  📍 {repositioningZoneIdx === editingZoneIdx ? 'Clique na imagem...' : 'Reposicionar'}
                </Button>
              </div>
            </div>

            {/* Options Source */}
            <div className="space-y-1">
              <Label className="text-xs">Fonte das Opções</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={zone.optionsSource === 'manual' ? 'default' : 'outline'}
                  className="h-7 text-xs flex-1"
                  onClick={() => updateZone(editingZoneIdx, { optionsSource: 'manual' })}
                >
                  ✏️ Manual
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={zone.optionsSource === 'entity' ? 'default' : 'outline'}
                  className="h-7 text-xs flex-1"
                  onClick={() => updateZone(editingZoneIdx, { optionsSource: 'entity' })}
                >
                  🗃️ De outra Entidade
                </Button>
              </div>
            </div>

            {/* Manual options editor */}
            {zone.optionsSource === 'manual' && (
              <div className="space-y-2">
                <Label className="text-xs">Opções ({(zone.options || []).length})</Label>
                <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                  {(zone.options || []).map((opt, oIdx) => (
                    <span key={oIdx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                      {opt}
                      <button type="button" className="hover:text-destructive" onClick={() => {
                        const updated = (zone.options || []).filter((_, i) => i !== oIdx);
                        updateZone(editingZoneIdx, { options: updated });
                      }}>×</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-1">
                  <Input
                    className="h-7 text-sm flex-1"
                    placeholder="Nova opção..."
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newOption.trim()) {
                        e.preventDefault();
                        updateZone(editingZoneIdx, { options: [...(zone.options || []), newOption.trim()] });
                        setNewOption('');
                      }
                    }}
                  />
                  <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={!newOption.trim()} onClick={() => {
                    if (newOption.trim()) {
                      updateZone(editingZoneIdx, { options: [...(zone.options || []), newOption.trim()] });
                      setNewOption('');
                    }
                  }}>
                    +
                  </Button>
                </div>
              </div>
            )}

            {/* Entity source config */}
            {zone.optionsSource === 'entity' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Entidade</Label>
                  <Select
                    value={zone.sourceEntitySlug || ''}
                    onValueChange={(val) => updateZone(editingZoneIdx, { sourceEntitySlug: val, sourceFieldSlug: '' })}
                  >
                    <SelectTrigger className="h-7 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {allEntities.map(e => (
                        <SelectItem key={e.slug} value={e.slug}>
                          {e.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Campo (opções)</Label>
                  <Select
                    value={zone.sourceFieldSlug || ''}
                    onValueChange={(val) => updateZone(editingZoneIdx, { sourceFieldSlug: val })}
                  >
                    <SelectTrigger className="h-7 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {(allEntities.find(e => e.slug === zone.sourceEntitySlug)?.fields || []).map((f: { name: string; slug: string; label?: string }) => (
                        <SelectItem key={f.slug || f.name} value={f.slug || f.name}>
                          {f.label || f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Os valores deste campo serão as opções do select</p>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Zone list summary */}
      {currentZones.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs">Zonas configuradas:</Label>
          <div className="flex flex-wrap gap-1">
            {currentZones.map((z, i) => (
              <button
                key={z.id}
                type="button"
                className={`px-2 py-0.5 rounded-full text-xs transition-colors ${
                  editingZoneIdx === i
                    ? 'bg-primary text-primary-foreground'
                    : z.optionsSource === 'entity'
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                      : (z.options || []).length > 0
                        ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                        : 'bg-muted text-muted-foreground'
                }`}
                onClick={() => setEditingZoneIdx(editingZoneIdx === i ? null : i)}
              >
                {z.label}: {z.optionsSource === 'entity' ? `🗃️ ${z.sourceEntitySlug || '?'}` : `${(z.options || []).length} opç.`}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 rounded p-2">
        💡 Faça upload da imagem, clique em &quot;Adicionar Zona&quot; e depois clique na imagem para posicionar. Clique em uma zona para editar nome, posição e opções.
      </div>
    </div>
  );
}

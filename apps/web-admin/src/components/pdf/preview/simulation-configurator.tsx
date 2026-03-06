'use client';

import { useState, useCallback } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Settings2,
  AlertTriangle,
  Play,
  Plus,
  Trash2,
  Link2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type {
  PdfTemplate,
  SimulationConfig,
  SimulationSubEntityConfig,
} from '@/services/pdf-templates.service';

interface SimulationConfiguratorProps {
  template: PdfTemplate;
  onGenerate: (config: SimulationConfig) => void;
  isGenerating: boolean;
}

export function SimulationConfigurator({
  template,
  onGenerate,
  isGenerating,
}: SimulationConfiguratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isBatch = template.templateType === 'batch';

  // Batch state
  const [totalRecords, setTotalRecords] = useState(10);

  // Sub-entity distribution state
  const subEntityFields = (template.sourceEntity?.fields || []).filter(
    (f) => f.type === 'sub-entity' && f.subEntityId,
  );
  const [subEntityConfigs, setSubEntityConfigs] = useState<
    Record<string, { recordsWithItems: number; minItems: number; maxItems: number }>
  >(() => {
    const initial: Record<string, { recordsWithItems: number; minItems: number; maxItems: number }> = {};
    for (const field of subEntityFields) {
      initial[field.slug] = { recordsWithItems: 3, minItems: 1, maxItems: 3 };
    }
    return initial;
  });

  // Field variety state (batch mode: independent fields)
  const [fieldVariety, setFieldVariety] = useState<Record<string, string>>({});

  // Field profiles state (batch mode: related field combinations)
  const [profileFields, setProfileFields] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>[]>([]);

  // Single-record field overrides
  const [fieldOverrides, setFieldOverrides] = useState<Record<string, string>>({});

  // Sub-entity quantity for single mode
  const [singleSubEntityCounts, setSingleSubEntityCounts] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const field of subEntityFields) {
      initial[field.slug] = 2;
    }
    return initial;
  });

  const parentFields = (template.sourceEntity?.fields || []).filter(
    (f) => f.type !== 'sub-entity' && f.type !== 'section-title' && f.type !== 'hidden',
  );

  // Fields NOT in profiles (available for independent variety)
  const independentFields = parentFields.filter((f) => !profileFields.includes(f.slug));

  const handleGenerate = () => {
    const config: SimulationConfig = {};

    if (isBatch) {
      config.totalRecords = totalRecords;
      if (subEntityFields.length > 0) {
        config.subEntityDistribution = subEntityFields.map((field) => {
          const c = subEntityConfigs[field.slug];
          return {
            fieldSlug: field.slug,
            recordsWithItems: c?.recordsWithItems ?? 3,
            minItemsPerRecord: c?.minItems ?? 1,
            maxItemsPerRecord: c?.maxItems ?? 3,
          } satisfies SimulationSubEntityConfig;
        });
      }
      // Field variety (independent fields only)
      const variety: Record<string, number> = {};
      for (const [slug, val] of Object.entries(fieldVariety)) {
        const num = Number(val);
        if (num > 0 && !profileFields.includes(slug)) variety[slug] = num;
      }
      if (Object.keys(variety).length > 0) {
        config.fieldVariety = variety;
      }
      // Field profiles (related combinations)
      if (profiles.length > 0) {
        // Only send non-empty values
        const cleanProfiles = profiles
          .map((p) => {
            const clean: Record<string, string> = {};
            for (const [k, v] of Object.entries(p)) {
              if (v?.trim()) clean[k] = v.trim();
            }
            return clean;
          })
          .filter((p) => Object.keys(p).length > 0);
        if (cleanProfiles.length > 0) {
          config.fieldProfiles = cleanProfiles;
        }
      }
    } else {
      // Single mode
      const overrides: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(fieldOverrides)) {
        if (value.trim()) overrides[key] = value;
      }
      if (Object.keys(overrides).length > 0) {
        config.fieldOverrides = overrides;
      }
      if (subEntityFields.length > 0) {
        config.subEntityDistribution = subEntityFields.map((field) => {
          const count = singleSubEntityCounts[field.slug] ?? 2;
          return {
            fieldSlug: field.slug,
            recordsWithItems: 1,
            minItemsPerRecord: count,
            maxItemsPerRecord: count,
          } satisfies SimulationSubEntityConfig;
        });
      }
    }

    onGenerate(config);
  };

  const updateSubEntityConfig = (
    slug: string,
    key: 'recordsWithItems' | 'minItems' | 'maxItems',
    value: number,
  ) => {
    setSubEntityConfigs((prev) => ({
      ...prev,
      [slug]: { ...prev[slug], [key]: value },
    }));
  };

  const toggleProfileField = useCallback((slug: string) => {
    setProfileFields((prev) => {
      if (prev.includes(slug)) {
        // Remove field from profiles too
        setProfiles((pp) => pp.map((p) => {
          const next = { ...p };
          delete next[slug];
          return next;
        }));
        return prev.filter((s) => s !== slug);
      }
      return [...prev, slug];
    });
  }, []);

  const addProfile = useCallback(() => {
    const newProfile: Record<string, string> = {};
    for (const slug of profileFields) {
      newProfile[slug] = '';
    }
    setProfiles((prev) => [...prev, newProfile]);
  }, [profileFields]);

  const removeProfile = useCallback((index: number) => {
    setProfiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateProfileValue = useCallback((index: number, slug: string, value: string) => {
    setProfiles((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [slug]: value };
      return next;
    });
  }, []);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-between">
          <span className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Configurar Simulacao
          </span>
          {isOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-3 space-y-4">
        {isBatch ? (
          /* ─── Batch Mode ─── */
          <>
            <div className="space-y-2">
              <Label htmlFor="totalRecords" className="text-xs font-medium">
                Total de Registros
              </Label>
              <Input
                id="totalRecords"
                type="number"
                min={1}
                max={1000}
                value={totalRecords}
                onChange={(e) => setTotalRecords(Math.min(1000, Math.max(1, Number(e.target.value) || 1)))}
                className="h-8 text-sm"
              />
              {totalRecords > 200 && (
                <p className="flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle className="h-3 w-3" />
                  Acima de 200 registros pode demorar
                </p>
              )}
            </div>

            {/* ─── Combinacoes de Dados Relacionados ─── */}
            {parentFields.length > 1 && (
              <div className="border rounded-md p-3 space-y-3">
                <div className="flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-semibold text-muted-foreground">
                    Combinacoes (dados relacionados)
                  </p>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Selecione campos que devem ter valores vinculados. Ex: marca + modelo.
                  Os registros serao distribuidos entre as combinacoes definidas.
                </p>

                {/* Field selector */}
                <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                  {parentFields.map((field) => (
                    <label
                      key={field.slug}
                      className="flex items-center gap-1.5 cursor-pointer"
                    >
                      <Checkbox
                        checked={profileFields.includes(field.slug)}
                        onCheckedChange={() => toggleProfileField(field.slug)}
                        className="h-3.5 w-3.5"
                      />
                      <span className="text-[11px] text-muted-foreground">
                        {field.label || field.name}
                      </span>
                    </label>
                  ))}
                </div>

                {/* Profile cards */}
                {profileFields.length > 0 && (
                  <div className="space-y-2">
                    {profiles.map((profile, idx) => (
                      <div
                        key={idx}
                        className="border rounded p-2 space-y-1.5 bg-muted/30 relative group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-medium text-muted-foreground">
                            Combinacao {idx + 1}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeProfile(idx)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                        {profileFields.map((slug) => {
                          const field = parentFields.find((f) => f.slug === slug);
                          if (!field) return null;
                          return (
                            <div key={slug} className="flex items-center gap-2">
                              <Label
                                className="text-[10px] text-muted-foreground w-20 flex-shrink-0 truncate"
                                title={field.label || field.name}
                              >
                                {field.label || field.name}
                              </Label>
                              <Input
                                value={profile[slug] || ''}
                                onChange={(e) => updateProfileValue(idx, slug, e.target.value)}
                                placeholder={field.label || field.name}
                                className="h-6 text-[11px]"
                              />
                            </div>
                          );
                        })}
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-7 text-xs"
                      onClick={addProfile}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Adicionar Combinacao
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* ─── Variedade de dados independentes ─── */}
            {independentFields.length > 0 && (
              <div className="border rounded-md p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  Variedade (campos independentes)
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Quantos valores distintos. Vazio = todos diferentes.
                </p>
                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                  {independentFields.map((field) => (
                    <div key={field.slug} className="flex items-center gap-2">
                      <Label
                        className="text-[10px] text-muted-foreground w-28 flex-shrink-0 truncate"
                        title={field.label || field.name}
                      >
                        {field.label || field.name}
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        max={totalRecords}
                        placeholder="Auto"
                        value={fieldVariety[field.slug] || ''}
                        onChange={(e) =>
                          setFieldVariety((prev) => ({
                            ...prev,
                            [field.slug]: e.target.value,
                          }))
                        }
                        className="h-6 text-[11px] w-16"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Sub-entidades ─── */}
            {subEntityFields.map((field) => {
              const subEntity = template.subEntities?.[field.slug];
              const c = subEntityConfigs[field.slug] || { recordsWithItems: 3, minItems: 1, maxItems: 3 };
              return (
                <div key={field.slug} className="border rounded-md p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {subEntity?.name || field.name || field.slug}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">
                        Registros com itens
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        max={totalRecords}
                        value={c.recordsWithItems}
                        onChange={(e) =>
                          updateSubEntityConfig(
                            field.slug,
                            'recordsWithItems',
                            Math.min(totalRecords, Math.max(0, Number(e.target.value) || 0)),
                          )
                        }
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Min itens</Label>
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        value={c.minItems}
                        onChange={(e) =>
                          updateSubEntityConfig(
                            field.slug,
                            'minItems',
                            Math.max(1, Number(e.target.value) || 1),
                          )
                        }
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Max itens</Label>
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        value={c.maxItems}
                        onChange={(e) =>
                          updateSubEntityConfig(
                            field.slug,
                            'maxItems',
                            Math.max(1, Number(e.target.value) || 1),
                          )
                        }
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          /* ─── Single Mode ─── */
          <>
            {parentFields.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  Sobrescrever campos (opcional)
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {parentFields.slice(0, 15).map((field) => (
                    <div key={field.slug} className="flex items-center gap-2">
                      <Label className="text-[10px] text-muted-foreground w-24 flex-shrink-0 truncate" title={field.label || field.name}>
                        {field.label || field.name}
                      </Label>
                      <Input
                        placeholder="Auto-gerado"
                        value={fieldOverrides[field.slug] || ''}
                        onChange={(e) =>
                          setFieldOverrides((prev) => ({
                            ...prev,
                            [field.slug]: e.target.value,
                          }))
                        }
                        className="h-7 text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {subEntityFields.map((field) => {
              const subEntity = template.subEntities?.[field.slug];
              return (
                <div key={field.slug} className="border rounded-md p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {subEntity?.name || field.name || field.slug}
                  </p>
                  <div className="flex items-center gap-2">
                    <Label className="text-[10px] text-muted-foreground w-24 flex-shrink-0">
                      Qtd de itens
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={50}
                      value={singleSubEntityCounts[field.slug] ?? 2}
                      onChange={(e) =>
                        setSingleSubEntityCounts((prev) => ({
                          ...prev,
                          [field.slug]: Math.max(0, Number(e.target.value) || 0),
                        }))
                      }
                      className="h-7 text-xs w-20"
                    />
                  </div>
                </div>
              );
            })}
          </>
        )}

        <Button
          onClick={handleGenerate}
          disabled={isGenerating}
          size="sm"
          className="w-full"
        >
          <Play className="h-4 w-4 mr-1.5" />
          {isGenerating ? 'Gerando...' : 'Gerar Preview com Simulacao'}
        </Button>
      </CollapsibleContent>
    </Collapsible>
  );
}

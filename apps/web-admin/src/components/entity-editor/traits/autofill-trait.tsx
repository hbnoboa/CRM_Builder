'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import api from '@/lib/api';

interface AutoFillMapping {
  sourceField: string;
  targetField: string;
}

interface OnChangeMapping {
  targetField: string;
  sourceField?: string;
  apiEndpoint?: string;
  valueTemplate?: string;
}

interface FieldOption {
  slug: string;
  label: string;
  type?: string;
}

interface EntityFields {
  id: string;
  name: string;
  slug: string;
  fields?: Array<{ slug: string; name: string; label?: string; type: string }>;
}

// ─── autoFillFields Editor (api-select) ────────────────────────────────────

interface AutoFillTraitEditorProps {
  value: string;
  onChange: (value: string) => void;
  targetFields: FieldOption[];
  sourceFieldsJson?: string; // fieldApiFields JSON (string[])
}

export function AutoFillTraitEditor({
  value,
  onChange,
  targetFields,
  sourceFieldsJson,
}: AutoFillTraitEditorProps) {
  const [mappings, setMappings] = useState<AutoFillMapping[]>([]);

  // Parse source fields from API fields config
  const sourceFields: string[] = (() => {
    if (!sourceFieldsJson) return [];
    try {
      const parsed = JSON.parse(sourceFieldsJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  useEffect(() => {
    try {
      const parsed = JSON.parse(value || '[]');
      if (Array.isArray(parsed)) setMappings(parsed);
    } catch {
      setMappings([]);
    }
  }, [value]);

  const update = (newMappings: AutoFillMapping[]) => {
    setMappings(newMappings);
    onChange(JSON.stringify(newMappings));
  };

  const addMapping = () => {
    update([...mappings, { sourceField: '', targetField: '' }]);
  };

  const removeMapping = (index: number) => {
    update(mappings.filter((_, i) => i !== index));
  };

  const updateMapping = (index: number, field: keyof AutoFillMapping, val: string) => {
    const updated = [...mappings];
    updated[index] = { ...updated[index], [field]: val };
    update(updated);
  };

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-muted-foreground">Auto-preenchimento</span>
      <p className="text-[10px] text-muted-foreground">
        Ao selecionar, copia campos da API para o formulario.
      </p>

      {mappings.map((mapping, i) => (
        <div key={i} className="flex items-center gap-1 text-xs">
          {sourceFields.length > 0 ? (
            <select
              value={mapping.sourceField}
              onChange={(e) => updateMapping(i, 'sourceField', e.target.value)}
              className="flex-1 h-7 text-xs border rounded px-1 bg-background min-w-0"
            >
              <option value="">Origem...</option>
              {sourceFields.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={mapping.sourceField}
              onChange={(e) => updateMapping(i, 'sourceField', e.target.value)}
              placeholder="Campo origem"
              className="flex-1 h-7 text-xs border rounded px-2 bg-background min-w-0"
            />
          )}
          <span className="text-muted-foreground shrink-0">&rarr;</span>
          <select
            value={mapping.targetField}
            onChange={(e) => updateMapping(i, 'targetField', e.target.value)}
            className="flex-1 h-7 text-xs border rounded px-1 bg-background min-w-0"
          >
            <option value="">Destino...</option>
            {targetFields.map((f) => (
              <option key={f.slug} value={f.slug}>
                {f.label || f.slug}
              </option>
            ))}
          </select>
          <button
            onClick={() => removeMapping(i)}
            className="shrink-0 p-1 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}

      <button
        onClick={addMapping}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <Plus className="h-3 w-3" /> Adicionar mapeamento
      </button>
    </div>
  );
}

// ─── onChangeAutoFill Editor (any field type) ──────────────────────────────

interface OnChangeAutoFillTraitEditorProps {
  value: string;
  onChange: (value: string) => void;
  targetFields: FieldOption[];
  relatedEntityId?: string; // To fetch source fields from related entity
}

export function OnChangeAutoFillTraitEditor({
  value,
  onChange,
  targetFields,
  relatedEntityId,
}: OnChangeAutoFillTraitEditorProps) {
  const [mappings, setMappings] = useState<OnChangeMapping[]>([]);
  const [sourceFields, setSourceFields] = useState<FieldOption[]>([]);
  const [loadingSource, setLoadingSource] = useState(false);

  // Fetch related entity fields if relatedEntityId is set
  useEffect(() => {
    if (!relatedEntityId) {
      setSourceFields([]);
      return;
    }
    setLoadingSource(true);
    api.get(`/entities/${relatedEntityId}`)
      .then((res) => {
        const entity = res.data;
        if (entity?.fields && Array.isArray(entity.fields)) {
          setSourceFields(
            entity.fields.map((f: { slug: string; name: string; label?: string; type: string }) => ({
              slug: f.slug,
              label: f.label || f.name,
              type: f.type,
            })),
          );
        }
      })
      .catch(() => setSourceFields([]))
      .finally(() => setLoadingSource(false));
  }, [relatedEntityId]);

  useEffect(() => {
    try {
      const parsed = JSON.parse(value || '[]');
      if (Array.isArray(parsed)) setMappings(parsed);
    } catch {
      setMappings([]);
    }
  }, [value]);

  const update = (newMappings: OnChangeMapping[]) => {
    setMappings(newMappings);
    // Clean empty optional fields before saving
    const cleaned = newMappings.map((m) => {
      const obj: OnChangeMapping = { targetField: m.targetField };
      if (m.sourceField) obj.sourceField = m.sourceField;
      if (m.apiEndpoint) obj.apiEndpoint = m.apiEndpoint;
      if (m.valueTemplate) obj.valueTemplate = m.valueTemplate;
      return obj;
    });
    onChange(JSON.stringify(cleaned));
  };

  const getMode = (m: OnChangeMapping): 'copy' | 'template' | 'api' => {
    if (m.apiEndpoint) return 'api';
    if (m.valueTemplate) return 'template';
    return 'copy';
  };

  const addMapping = () => {
    update([...mappings, { targetField: '', sourceField: '' }]);
  };

  const removeMapping = (index: number) => {
    update(mappings.filter((_, i) => i !== index));
  };

  const updateMappingField = (index: number, field: string, val: string) => {
    const updated = [...mappings];
    updated[index] = { ...updated[index], [field]: val };
    update(updated);
  };

  const changeMode = (index: number, mode: 'copy' | 'template' | 'api') => {
    const updated = [...mappings];
    const m = { targetField: updated[index].targetField } as OnChangeMapping;
    if (mode === 'copy') m.sourceField = '';
    if (mode === 'template') m.valueTemplate = '';
    if (mode === 'api') m.apiEndpoint = '';
    updated[index] = m;
    update(updated);
  };

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-muted-foreground">Ao mudar, preencher</span>
      <p className="text-[10px] text-muted-foreground">
        Quando o valor mudar, preenche outros campos automaticamente.
      </p>

      {loadingSource && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Carregando campos...
        </div>
      )}

      {mappings.map((mapping, i) => {
        const mode = getMode(mapping);
        return (
          <div key={i} className="border rounded p-2 space-y-1.5">
            {/* Target field */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground shrink-0 w-12">Destino:</span>
              <select
                value={mapping.targetField}
                onChange={(e) => updateMappingField(i, 'targetField', e.target.value)}
                className="flex-1 h-6 text-xs border rounded px-1 bg-background"
              >
                <option value="">Selecionar campo...</option>
                {targetFields.map((f) => (
                  <option key={f.slug} value={f.slug}>
                    {f.label || f.slug}
                  </option>
                ))}
              </select>
              <button
                onClick={() => removeMapping(i)}
                className="shrink-0 p-0.5 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>

            {/* Mode selector */}
            <div className="flex gap-1">
              {(['copy', 'template', 'api'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => changeMode(i, m)}
                  className={`text-[10px] px-1.5 py-0.5 rounded border ${
                    mode === m
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-input hover:bg-muted'
                  }`}
                >
                  {m === 'copy' ? 'Copiar' : m === 'template' ? 'Template' : 'API'}
                </button>
              ))}
            </div>

            {/* Mode-specific input */}
            {mode === 'copy' && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground shrink-0 w-12">Origem:</span>
                {sourceFields.length > 0 ? (
                  <select
                    value={mapping.sourceField || ''}
                    onChange={(e) => updateMappingField(i, 'sourceField', e.target.value)}
                    className="flex-1 h-6 text-xs border rounded px-1 bg-background"
                  >
                    <option value="">Selecionar campo...</option>
                    {sourceFields.map((f) => (
                      <option key={f.slug} value={f.slug}>
                        {f.label || f.slug}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={mapping.sourceField || ''}
                    onChange={(e) => updateMappingField(i, 'sourceField', e.target.value)}
                    placeholder="nome_do_campo"
                    className="flex-1 h-6 text-xs border rounded px-2 bg-background"
                  />
                )}
              </div>
            )}
            {mode === 'template' && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground shrink-0 w-12">Valor:</span>
                <select
                  value={mapping.valueTemplate || ''}
                  onChange={(e) => updateMappingField(i, 'valueTemplate', e.target.value)}
                  className="flex-1 h-6 text-xs border rounded px-1 bg-background"
                >
                  <option value="">Selecionar...</option>
                  <option value="{{now}}">Data/hora atual</option>
                  <option value="{{today}}">Data de hoje</option>
                  <option value="{{timestamp}}">Timestamp</option>
                </select>
              </div>
            )}
            {mode === 'api' && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground shrink-0 w-12">API:</span>
                <input
                  type="text"
                  value={mapping.apiEndpoint || ''}
                  onChange={(e) => updateMappingField(i, 'apiEndpoint', e.target.value)}
                  placeholder="/endpoint"
                  className="flex-1 h-6 text-xs border rounded px-2 bg-background"
                />
              </div>
            )}
          </div>
        );
      })}

      <button
        onClick={addMapping}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <Plus className="h-3 w-3" /> Adicionar regra
      </button>
    </div>
  );
}

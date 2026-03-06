'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';

interface EntityOption {
  id: string;
  name: string;
  slug: string;
  fields?: Array<{ slug: string; name: string; label?: string; type: string }>;
}

interface EntitySelectTraitProps {
  entityIdValue: string;
  entitySlugValue: string;
  displayFieldValue: string;
  onChangeEntityId: (value: string) => void;
  onChangeEntitySlug: (value: string) => void;
  onChangeDisplayField: (value: string) => void;
}

export function EntitySelectTraitEditor({
  entityIdValue,
  entitySlugValue,
  displayFieldValue,
  onChangeEntityId,
  onChangeEntitySlug,
  onChangeDisplayField,
}: EntitySelectTraitProps) {
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<EntityOption | null>(null);

  // Fetch entities list
  useEffect(() => {
    api.get('/entities')
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setEntities(list);
      })
      .catch(() => setEntities([]))
      .finally(() => setLoading(false));
  }, []);

  // Resolve selected entity when entities load or entityIdValue changes
  useEffect(() => {
    if (!entityIdValue) {
      setSelectedEntity(null);
      return;
    }
    if (entities.length === 0) return;

    const found = entities.find((e) => e.id === entityIdValue);
    if (found) {
      setSelectedEntity(found);
    } else {
      // Entity not in list — fetch it directly
      api.get(`/entities/${entityIdValue}`)
        .then((res) => {
          const entity = res.data;
          if (entity?.id) {
            setSelectedEntity(entity);
          }
        })
        .catch(() => {
          // Can't find entity — show slug fallback
          if (entitySlugValue) {
            setSelectedEntity({ id: entityIdValue, name: entitySlugValue, slug: entitySlugValue });
          }
        });
    }
  }, [entityIdValue, entities.length, entitySlugValue]);

  const handleSelect = (entity: EntityOption) => {
    setSelectedEntity(entity);
    onChangeEntityId(entity.id);
    onChangeEntitySlug(entity.slug);
    // Auto-set display field to first text-like field
    if (entity.fields && entity.fields.length > 0 && !displayFieldValue) {
      const textField = entity.fields.find(
        (f) => f.type === 'text' || f.type === 'email' || f.type === 'cpf',
      );
      const field = textField || entity.fields[0];
      onChangeDisplayField(field.slug);
    }
  };

  const filteredEntities = entities.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.slug.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-muted-foreground">Entidade relacionada</span>

      {selectedEntity ? (
        <div className="flex items-center justify-between p-2 bg-muted rounded-md">
          <div>
            <p className="text-sm font-medium">{selectedEntity.name}</p>
            <p className="text-xs text-muted-foreground font-mono">{selectedEntity.slug}</p>
          </div>
          <button
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setSelectedEntity(null);
              onChangeEntityId('');
              onChangeEntitySlug('');
              onChangeDisplayField('');
            }}
          >
            Trocar
          </button>
        </div>
      ) : (
        <>
          {/* Show slug hint when ID exists but entity not resolved yet */}
          {entitySlugValue && loading && (
            <div className="p-2 bg-muted rounded-md text-xs text-muted-foreground font-mono">
              {entitySlugValue}
            </div>
          )}

          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar entidade..."
            className="h-7 text-xs"
          />

          {loading ? (
            <div className="flex justify-center py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="max-h-40 overflow-y-auto border rounded-md divide-y">
              {filteredEntities.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2 text-center">Nenhuma entidade encontrada</p>
              ) : (
                filteredEntities.map((entity) => (
                  <button
                    key={entity.id}
                    className="w-full text-left px-2 py-1.5 hover:bg-muted transition-colors"
                    onClick={() => handleSelect(entity)}
                  >
                    <p className="text-xs font-medium">{entity.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{entity.slug}</p>
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Display field selector */}
      {selectedEntity && selectedEntity.fields && selectedEntity.fields.length > 0 && (
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Campo de exibicao</span>
          <select
            value={displayFieldValue}
            onChange={(e) => onChangeDisplayField(e.target.value)}
            className="w-full h-7 text-xs border rounded-md px-2 bg-background"
          >
            <option value="">Selecionar...</option>
            {selectedEntity.fields.map((f) => (
              <option key={f.slug} value={f.slug}>
                {f.label || f.name} ({f.type})
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

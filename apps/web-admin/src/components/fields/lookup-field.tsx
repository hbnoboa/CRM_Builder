'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Search, X, Plus, Loader2, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { useDebounce } from '@/hooks/use-debounce';

interface LookupConfig {
  sourceEntity: string;
  searchFields: string[];
  displayFields: string[];
  previewFields?: string[];
  filterConditions?: Array<{
    field: string;
    operator: string;
    value: unknown;
  }>;
  allowCreate?: boolean;
}

interface LookupFieldProps {
  value?: string | null;
  onChange: (value: string | null) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  config: LookupConfig;
  placeholder?: string;
}

interface RecordOption {
  id: string;
  data: Record<string, unknown>;
}

export function LookupField({
  value,
  onChange,
  label,
  required,
  disabled,
  config,
  placeholder,
}: LookupFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [options, setOptions] = useState<RecordOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<RecordOption | null>(null);
  const [hoveredRecord, setHoveredRecord] = useState<RecordOption | null>(null);

  const debouncedSearch = useDebounce(searchTerm, 300);

  // Buscar registro selecionado
  useEffect(() => {
    if (value && !selectedRecord) {
      api
        .get(`/entities/${config.sourceEntity}/data/${value}`)
        .then((res) => {
          setSelectedRecord(res.data);
        })
        .catch(() => {
          setSelectedRecord(null);
        });
    } else if (!value) {
      setSelectedRecord(null);
    }
  }, [value, config.sourceEntity, selectedRecord]);

  // Buscar opcoes
  const searchRecords = useCallback(async () => {
    if (!isOpen) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', '20');

      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      }

      // Adicionar filtros
      if (config.filterConditions && config.filterConditions.length > 0) {
        params.append('filters', JSON.stringify(config.filterConditions));
      }

      const response = await api.get(
        `/entities/${config.sourceEntity}/data?${params.toString()}`
      );

      setOptions(response.data.data || []);
    } catch (error) {
      console.error('Erro ao buscar registros:', error);
      setOptions([]);
    } finally {
      setIsLoading(false);
    }
  }, [config.sourceEntity, config.filterConditions, debouncedSearch, isOpen]);

  useEffect(() => {
    searchRecords();
  }, [searchRecords]);

  const getDisplayValue = (record: RecordOption) => {
    return config.displayFields
      .map((field) => record.data[field])
      .filter(Boolean)
      .join(' - ');
  };

  const getPreviewValue = (record: RecordOption, field: string) => {
    const value = record.data[field];
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Sim' : 'Nao';
    if (value instanceof Date) return new Date(value).toLocaleDateString();
    return String(value);
  };

  const handleSelect = (record: RecordOption) => {
    setSelectedRecord(record);
    onChange(record.id);
    setIsOpen(false);
  };

  const handleClear = () => {
    setSelectedRecord(null);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      {label && (
        <Label>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}

      <div className="flex gap-2">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="flex-1 justify-start font-normal"
              disabled={disabled}
            >
              {selectedRecord ? (
                <span className="truncate">{getDisplayValue(selectedRecord)}</span>
              ) : (
                <span className="text-muted-foreground">
                  {placeholder || 'Selecionar...'}
                </span>
              )}
              <Search className="ml-auto h-4 w-4 opacity-50" />
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Buscar {config.sourceEntity}</DialogTitle>
            </DialogHeader>

            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={`Buscar por ${config.searchFields.join(', ')}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  autoFocus
                />
              </div>
              {config.allowCreate && (
                <Button variant="outline" size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
              {/* Lista de resultados */}
              <div className="flex-1 overflow-y-auto border rounded-lg">
                {isLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : options.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-muted-foreground">
                    Nenhum registro encontrado
                  </div>
                ) : (
                  <div className="divide-y">
                    {options.map((record) => (
                      <div
                        key={record.id}
                        className={`p-3 cursor-pointer hover:bg-muted transition-colors ${
                          hoveredRecord?.id === record.id ? 'bg-muted' : ''
                        } ${selectedRecord?.id === record.id ? 'bg-primary/10' : ''}`}
                        onClick={() => handleSelect(record)}
                        onMouseEnter={() => setHoveredRecord(record)}
                      >
                        <div className="font-medium">{getDisplayValue(record)}</div>
                        {config.displayFields.length > 1 && (
                          <div className="text-sm text-muted-foreground mt-1">
                            ID: {record.id.slice(0, 8)}...
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Preview do registro */}
              {config.previewFields && config.previewFields.length > 0 && hoveredRecord && (
                <Card className="w-72 flex-shrink-0">
                  <CardContent className="pt-4">
                    <div className="text-sm font-medium mb-3 flex items-center gap-2">
                      <ExternalLink className="h-4 w-4" />
                      Preview
                    </div>
                    <div className="space-y-2">
                      {config.previewFields.map((field) => (
                        <div key={field}>
                          <div className="text-xs text-muted-foreground">{field}</div>
                          <div className="text-sm font-medium truncate">
                            {getPreviewValue(hoveredRecord, field)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {selectedRecord && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Preview inline do registro selecionado */}
      {selectedRecord && config.previewFields && config.previewFields.length > 0 && (
        <Card className="bg-muted/50">
          <CardContent className="pt-3 pb-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              {config.previewFields.slice(0, 4).map((field) => (
                <div key={field}>
                  <span className="text-muted-foreground">{field}: </span>
                  <span className="font-medium">{getPreviewValue(selectedRecord, field)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

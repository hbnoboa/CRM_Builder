'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PdfHeader, HeaderRow } from '@/services/pdf-templates.service';
import { HeaderRowEditor } from './header-row-editor';
import { LegacyHeaderEditor } from './legacy-header-editor';

interface HeaderTabProps {
  header?: PdfHeader;
  onChange: (header: PdfHeader) => void;
  availableFields?: Array<{ slug: string; name: string; label?: string; type: string }>;
}

export function HeaderTab({ header, onChange, availableFields = [] }: HeaderTabProps) {
  // Determinar se usa modo legado ou flexivel
  const hasLegacyContent = !!(header?.logo || header?.title || header?.subtitle);
  const hasFlexibleContent = !!(header?.rows && header.rows.length > 0);

  // Default para modo flexivel se nao tem conteudo
  const [mode, setMode] = useState<'flexible' | 'legacy'>(
    hasFlexibleContent ? 'flexible' : hasLegacyContent ? 'legacy' : 'flexible'
  );

  const handleRowsChange = (rows: HeaderRow[]) => {
    onChange({
      ...header,
      rows,
      // Limpar campos legados quando usa modo flexivel
      logo: undefined,
      title: undefined,
      subtitle: undefined,
    });
  };

  const handleLegacyChange = (updates: Partial<PdfHeader>) => {
    onChange({
      ...header,
      ...updates,
      // Limpar rows quando usa modo legado
      rows: undefined,
    });
  };

  const handleModeChange = (newMode: 'flexible' | 'legacy') => {
    setMode(newMode);
    // Ao trocar de modo, limpar o conteudo do outro
    if (newMode === 'flexible') {
      onChange({
        showOnAllPages: header?.showOnAllPages ?? true,
        showDivider: header?.showDivider ?? true,
        rows: [],
      });
    } else {
      onChange({
        showOnAllPages: header?.showOnAllPages ?? true,
        showDivider: header?.showDivider ?? true,
        logo: undefined,
        title: undefined,
        subtitle: undefined,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Info */}
      <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Cabecalho do PDF</p>
            <p className="mt-1 opacity-80">
              O modo <strong>Flexivel</strong> permite criar headers complexos com multiplas linhas e elementos.
              O modo <strong>Simples</strong> oferece um layout basico com logo, titulo e subtitulo.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs de modo */}
      <Tabs value={mode} onValueChange={(v) => handleModeChange(v as 'flexible' | 'legacy')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="flexible">Flexivel</TabsTrigger>
          <TabsTrigger value="legacy">Simples</TabsTrigger>
        </TabsList>

        <TabsContent value="flexible" className="mt-4 space-y-4">
          <HeaderRowEditor
            rows={header?.rows || []}
            onChange={handleRowsChange}
            availableFields={availableFields}
          />
        </TabsContent>

        <TabsContent value="legacy" className="mt-4">
          <LegacyHeaderEditor
            header={header}
            onChange={handleLegacyChange}
            availableFields={availableFields}
          />
        </TabsContent>
      </Tabs>

      {/* Opcoes globais */}
      <div className="border-t pt-4 space-y-3">
        <div className="flex items-center gap-2">
          <Switch
            checked={header?.showOnAllPages ?? true}
            onCheckedChange={(checked) => onChange({ ...header, showOnAllPages: checked })}
          />
          <Label>Mostrar cabecalho em todas as paginas</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={header?.showDivider ?? true}
            onCheckedChange={(checked) => onChange({ ...header, showDivider: checked })}
          />
          <Label>Mostrar linha divisoria apos cabecalho</Label>
        </div>
      </div>
    </div>
  );
}

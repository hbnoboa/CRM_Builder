'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DataTab } from '@/components/pdf/template-editor/data-tab';
import type {
  ComputedField,
  PdfTemplateSettings,
} from '@/services/pdf-templates.service';

interface ComputedFieldsDialogProps {
  open: boolean;
  onClose: () => void;
  computedFields: ComputedField[];
  onChange: (computedFields: ComputedField[]) => void;
  availableFields: Array<{ slug: string; name: string; label?: string; type: string }>;
  templateType?: string;
  subEntities?: Record<string, {
    id: string;
    name: string;
    slug: string;
    fields?: Array<{ slug: string; name: string; label?: string; type: string }>;
  }>;
  settings?: PdfTemplateSettings;
  onSettingsChange?: (settings: PdfTemplateSettings) => void;
}

export function ComputedFieldsDialog({
  open,
  onClose,
  computedFields,
  onChange,
  availableFields,
  templateType,
  subEntities,
  settings,
  onSettingsChange,
}: ComputedFieldsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Campos Computados e Configuracoes</DialogTitle>
        </DialogHeader>

        <DataTab
          computedFields={computedFields}
          onChange={onChange}
          availableFields={availableFields}
          templateType={templateType}
          subEntities={subEntities}
          settings={settings}
          onSettingsChange={onSettingsChange}
        />
      </DialogContent>
    </Dialog>
  );
}

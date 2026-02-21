'use client';

import { useState } from 'react';
import { FileText, Loader2, Download, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePdfTemplates, useGeneratePdf, useGenerateBatchPdf } from '@/hooks/use-pdf-templates';
import type { PdfTemplate } from '@/services/pdf-templates.service';

interface GeneratePdfButtonProps {
  entityId: string;
  recordId: string;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'icon';
  showLabel?: boolean;
}

export function GeneratePdfButton({
  entityId,
  recordId,
  variant = 'ghost',
  size = 'icon',
  showLabel = false,
}: GeneratePdfButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PdfTemplate | null>(null);

  const { data: templatesData, isLoading: isLoadingTemplates } = usePdfTemplates({
    sourceEntityId: entityId,
    isPublished: true,
    templateType: 'single',
  });

  const generatePdf = useGeneratePdf();

  const templates = templatesData?.data || [];

  const handleGeneratePdf = async (template: PdfTemplate) => {
    try {
      await generatePdf.mutateAsync({
        templateId: template.id,
        recordId,
      });
    } catch {
      // Error handled by hook
    }
  };

  // Se nao houver templates publicados, nao mostrar o botao
  if (templates.length === 0 && !isLoadingTemplates) {
    return null;
  }

  // Se houver apenas 1 template, gerar direto
  if (templates.length === 1) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={() => handleGeneratePdf(templates[0])}
        disabled={generatePdf.isPending}
        title={`Gerar PDF: ${templates[0].name}`}
      >
        {generatePdf.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
        {showLabel && <span className="ml-2">PDF</span>}
      </Button>
    );
  }

  // Se houver multiplos templates, mostrar dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={generatePdf.isPending || isLoadingTemplates}
          title="Gerar PDF"
        >
          {generatePdf.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          {showLabel && <span className="ml-2">PDF</span>}
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {templates.map((template) => (
          <DropdownMenuItem
            key={template.id}
            onClick={() => handleGeneratePdf(template)}
          >
            <Download className="h-4 w-4 mr-2" />
            {template.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface GenerateBatchPdfButtonProps {
  entityId: string;
  recordIds: string[];
  disabled?: boolean;
}

export function GenerateBatchPdfButton({
  entityId,
  recordIds,
  disabled = false,
}: GenerateBatchPdfButtonProps) {
  const { data: templatesData, isLoading: isLoadingTemplates } = usePdfTemplates({
    sourceEntityId: entityId,
    isPublished: true,
    templateType: 'batch',
  });

  const generateBatchPdf = useGenerateBatchPdf();
  const templates = templatesData?.data || [];

  // Se nao houver templates de lote publicados, nao mostrar
  if (templates.length === 0 && !isLoadingTemplates) {
    return null;
  }

  const handleGenerate = async (templateId: string) => {
    try {
      await generateBatchPdf.mutateAsync({ templateId, recordIds });
    } catch {
      // Error handled by hook
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || recordIds.length === 0 || isLoadingTemplates || generateBatchPdf.isPending}
        >
          {generateBatchPdf.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <FileText className="h-4 w-4 mr-2" />
          )}
          Gerar PDF ({recordIds.length})
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {templates.map((template) => (
          <DropdownMenuItem
            key={template.id}
            onClick={() => handleGenerate(template.id)}
          >
            <Download className="h-4 w-4 mr-2" />
            {template.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

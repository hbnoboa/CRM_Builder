'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, FileText, AlertCircle, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePreviewPdf } from '@/hooks/use-pdf-templates';
import type { PdfTemplate, PdfTemplateContent, SimulationConfig } from '@/services/pdf-templates.service';
import { SimulationConfigurator } from './simulation-configurator';

interface PdfPreviewProps {
  template: PdfTemplate;
  content: PdfTemplateContent | null;
}

export function PdfPreview({ template, content }: PdfPreviewProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [simulationConfig, setSimulationConfig] = useState<SimulationConfig | null>(null);
  const previewPdf = usePreviewPdf();
  const isGeneratingRef = useRef(false);
  const contentKeyRef = useRef<string>('');

  const handleGeneratePreview = useCallback(async (simulation?: SimulationConfig | null) => {
    if (isGeneratingRef.current || !content) return;
    isGeneratingRef.current = true;
    try {
      const activeSimulation = simulation !== undefined ? simulation : simulationConfig;
      const blob = await previewPdf.mutateAsync({
        templateId: template.id,
        content: content || undefined,
        ...(activeSimulation ? { simulation: activeSimulation } : {}),
      });
      const url = URL.createObjectURL(blob);
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch {
      // Error handled by hook
    } finally {
      isGeneratingRef.current = false;
    }
  }, [template.id, content, simulationConfig, previewPdf]);

  const handleSimulationGenerate = useCallback((config: SimulationConfig) => {
    setSimulationConfig(config);
    handleGeneratePreview(config);
  }, [handleGeneratePreview]);

  // Auto-gerar preview com debounce quando content muda
  useEffect(() => {
    if (!content) return;

    const key = JSON.stringify(content);
    if (key === contentKeyRef.current) return;
    contentKeyRef.current = key;

    const timer = setTimeout(() => {
      handleGeneratePreview();
    }, 1500);

    return () => clearTimeout(timer);
  }, [content]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup URLs ao desmontar
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!content) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Configure o template para ver o preview</p>
      </div>
    );
  }

  if (previewPdf.isError && !pdfUrl) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Erro ao gerar preview. Verifique se a API esta rodando.
          </AlertDescription>
        </Alert>
        <Button onClick={() => handleGeneratePreview()} variant="outline" className="w-full">
          <RefreshCw className="h-4 w-4 mr-2" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Simulation Configurator */}
      {template.sourceEntityId && (
        <SimulationConfigurator
          template={template}
          onGenerate={handleSimulationGenerate}
          isGenerating={previewPdf.isPending}
        />
      )}

      <div className="flex items-center justify-between">
        {previewPdf.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {simulationConfig ? 'Gerando simulacao...' : 'Atualizando...'}
          </div>
        )}
        {!previewPdf.isPending && pdfUrl && (
          <span className="text-xs text-muted-foreground">
            {simulationConfig ? 'Simulacao ativa' : 'Atualiza automaticamente'}
          </span>
        )}
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={() => handleGeneratePreview()} disabled={previewPdf.isPending}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Atualizar
          </Button>
          {pdfUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={pdfUrl} download={`${template.slug}-preview.pdf`}>
                <Download className="h-4 w-4 mr-1" />
                Baixar
              </a>
            </Button>
          )}
        </div>
      </div>

      {pdfUrl ? (
        <div
          className="border rounded-lg overflow-hidden bg-gray-100"
          style={{ height: '600px' }}
        >
          <iframe
            src={pdfUrl}
            className="w-full h-full"
            title="PDF Preview"
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 border rounded-lg bg-gray-50">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
          <p className="text-sm text-muted-foreground">Gerando preview...</p>
        </div>
      )}
    </div>
  );
}

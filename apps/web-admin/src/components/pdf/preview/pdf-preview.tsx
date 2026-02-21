'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, FileText, AlertCircle, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePreviewPdf } from '@/hooks/use-pdf-templates';
import type { PdfTemplate, PdfTemplateContent } from '@/services/pdf-templates.service';

interface PdfPreviewProps {
  template: PdfTemplate;
  content: PdfTemplateContent | null;
}

// Dados de exemplo para preview
const SAMPLE_DATA = {
  chassi: 'ABC123456789',
  placa: 'ABC-1234',
  modelo: 'Modelo X',
  marca: 'Marca Y',
  ano: '2024',
  cor: 'Branco',
  observacao: 'Observacao de exemplo para teste do template',
  data: new Date().toLocaleDateString('pt-BR'),
  dataHora: new Date().toLocaleString('pt-BR'),
  navio: 'NAVIO EXEMPLO',
  viagem: 'V-2024-001',
  local: 'Porto de Santos',
  naoConformidades: [
    { peca: 'Para-choque', local: 'Frontal', quadrante: 'Superior', medida: '5cm', tipo: 'Amassado' },
    { peca: 'Porta', local: 'Lateral D', quadrante: 'Inferior', medida: '3cm', tipo: 'Arranhao' },
    { peca: 'Capo', local: 'Frontal', quadrante: 'Central', medida: '2cm', tipo: 'Mancha' },
  ],
  imagens: [
    '/placeholder.jpg',
    '/placeholder.jpg',
    '/placeholder.jpg',
    '/placeholder.jpg',
  ],
};

export function PdfPreview({ template, content }: PdfPreviewProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const previewPdf = usePreviewPdf();
  const isGeneratingRef = useRef(false);
  const contentKeyRef = useRef<string>('');

  const handleGeneratePreview = useCallback(async () => {
    if (isGeneratingRef.current || !content) return;
    isGeneratingRef.current = true;
    try {
      const blob = await previewPdf.mutateAsync({
        templateId: template.id,
        sampleData: SAMPLE_DATA,
        content: content || undefined,
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
  }, [template.id, content, previewPdf]);

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
        <Button onClick={handleGeneratePreview} variant="outline" className="w-full">
          <RefreshCw className="h-4 w-4 mr-2" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {previewPdf.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Atualizando...
          </div>
        )}
        {!previewPdf.isPending && pdfUrl && (
          <span className="text-xs text-muted-foreground">Atualiza automaticamente</span>
        )}
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={handleGeneratePreview} disabled={previewPdf.isPending}>
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

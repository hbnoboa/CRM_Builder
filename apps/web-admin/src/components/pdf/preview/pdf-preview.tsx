'use client';

import { useState } from 'react';
import { Loader2, FileText, AlertCircle, Download } from 'lucide-react';
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

  const handleGeneratePreview = async () => {
    try {
      const blob = await previewPdf.mutateAsync({
        templateId: template.id,
        sampleData: SAMPLE_DATA,
      });
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch {
      // Error handled by hook
    }
  };

  if (!content) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Configure o template para ver o preview</p>
      </div>
    );
  }

  if (previewPdf.isPending) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        <p className="text-sm text-muted-foreground">Gerando preview...</p>
      </div>
    );
  }

  if (previewPdf.isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Erro ao gerar preview. Verifique se a API esta rodando.
        </AlertDescription>
      </Alert>
    );
  }

  if (pdfUrl) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handleGeneratePreview}>
            Atualizar
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={pdfUrl} download={`${template.slug}-preview.pdf`}>
              <Download className="h-4 w-4 mr-1" />
              Baixar
            </a>
          </Button>
        </div>
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
      </div>
    );
  }

  // Preview visual simplificado (antes de gerar o PDF real)
  return (
    <div className="space-y-4">
      <Button onClick={handleGeneratePreview} className="w-full">
        Gerar Preview do PDF
      </Button>

      <div className="border rounded-lg p-4 bg-white min-h-[400px] space-y-4 text-xs">
        {/* Header simulado */}
        {content.header && (
          <div className="border-b pb-2">
            <div className="flex items-center gap-4">
              {content.header.logo?.url && (
                <div className="w-20 h-10 bg-gray-200 rounded flex items-center justify-center text-gray-400">
                  LOGO
                </div>
              )}
              <div>
                {content.header.title?.text && (
                  <p className={content.header.title.bold ? 'font-bold' : ''}>
                    {content.header.title.text}
                  </p>
                )}
                {content.header.subtitle?.text && (
                  <p className="text-gray-500">{content.header.subtitle.text}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Body elements simulados */}
        <div className="space-y-3">
          {content.body?.map((element, index) => (
            <div key={element.id || index} className="border-l-2 border-primary/30 pl-2">
              <span className="text-[10px] text-muted-foreground uppercase">
                {element.type}
              </span>
              {element.type === 'text' && (
                <p>{(element as { content: string }).content}</p>
              )}
              {element.type === 'field-group' && (
                <div className="flex gap-4 flex-wrap">
                  {(element as { fields: Array<{ label: string; binding: string }> }).fields?.map(
                    (field, i) => (
                      <span key={i}>
                        <strong>{field.label}</strong> {field.binding}
                      </span>
                    )
                  )}
                </div>
              )}
              {element.type === 'table' && (
                <div className="border rounded mt-1">
                  <div className="bg-gray-100 p-1 font-medium text-center">
                    Tabela: {(element as { title?: string }).title || 'Sem titulo'}
                  </div>
                  <div className="p-2 text-center text-gray-400">
                    [{(element as { columns: unknown[] }).columns?.length || 0} colunas]
                  </div>
                </div>
              )}
              {element.type === 'image-grid' && (
                <div className="grid grid-cols-4 gap-1 mt-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="aspect-[4/3] bg-gray-200 rounded flex items-center justify-center text-gray-400"
                    >
                      IMG
                    </div>
                  ))}
                </div>
              )}
              {element.type === 'divider' && (
                <hr className="border-gray-300 my-2" />
              )}
              {element.type === 'spacer' && (
                <div
                  className="bg-gray-100"
                  style={{ height: (element as { height: number }).height || 20 }}
                />
              )}
              {element.type === 'statistics' && (
                <div className="border rounded mt-1 p-2 bg-gray-50 text-center">
                  Estatisticas: {(element as { title: string }).title}
                </div>
              )}
            </div>
          ))}

          {(!content.body || content.body.length === 0) && (
            <p className="text-center text-gray-400 py-8">
              Nenhum elemento adicionado
            </p>
          )}
        </div>

        {/* Footer simulado */}
        {content.footer && (
          <div className="border-t pt-2 mt-auto text-center text-gray-500">
            {content.footer.text}
            {content.footer.showPageNumbers && ' - Pagina 1 de 1'}
          </div>
        )}
      </div>
    </div>
  );
}

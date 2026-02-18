import { Injectable, Logger } from '@nestjs/common';

interface ReportExecuteResult {
  report: {
    id: string;
    name: string;
    description?: string;
  };
  components: Array<{
    id: string;
    type: string;
    title: string;
    data: any;
    error?: string;
  }>;
  generatedAt: Date;
}

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  /**
   * Exportar para CSV
   */
  async toCsv(result: ReportExecuteResult): Promise<Buffer> {
    const lines: string[] = [];

    // Header do relatorio
    lines.push(`Relatorio: ${result.report.name}`);
    lines.push(`Gerado em: ${result.generatedAt.toISOString()}`);
    lines.push('');

    // Cada componente
    for (const component of result.components) {
      lines.push(`--- ${component.title} ---`);

      if (component.error) {
        lines.push(`Erro: ${component.error}`);
        lines.push('');
        continue;
      }

      if (!component.data || !Array.isArray(component.data)) {
        lines.push('Sem dados');
        lines.push('');
        continue;
      }

      // Se for array de objetos, criar tabela CSV
      if (component.data.length > 0 && typeof component.data[0] === 'object') {
        const headers = Object.keys(component.data[0]);
        lines.push(headers.join(','));

        for (const row of component.data) {
          const values = headers.map((h) => {
            const val = row[h];
            if (val === null || val === undefined) return '';
            if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
              return `"${val.replace(/"/g, '""')}"`;
            }
            return String(val);
          });
          lines.push(values.join(','));
        }
      } else {
        // Valor simples
        lines.push(JSON.stringify(component.data));
      }

      lines.push('');
    }

    return Buffer.from(lines.join('\n'), 'utf-8');
  }

  /**
   * Exportar para Excel
   * Nota: Em producao, usar biblioteca 'xlsx' para gerar Excel real
   */
  async toExcel(result: ReportExecuteResult): Promise<Buffer> {
    // Simplificado: retorna CSV com extensao xlsx
    // Em producao, usar: import * as XLSX from 'xlsx';
    this.logger.warn('Excel export usando CSV simplificado. Instale xlsx para Excel real.');

    // Por enquanto, retorna CSV
    return this.toCsv(result);

    /* Exemplo com xlsx:
    import * as XLSX from 'xlsx';

    const workbook = XLSX.utils.book_new();

    for (const component of result.components) {
      if (component.data && Array.isArray(component.data)) {
        const worksheet = XLSX.utils.json_to_sheet(component.data);
        XLSX.utils.book_append_sheet(workbook, worksheet, component.title.substring(0, 31));
      }
    }

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
    */
  }

  /**
   * Exportar para PDF
   * Nota: Em producao, usar puppeteer ou pdfmake
   */
  async toPdf(result: ReportExecuteResult): Promise<Buffer> {
    // Simplificado: retorna texto formatado
    // Em producao, usar puppeteer para renderizar HTML como PDF
    this.logger.warn('PDF export usando texto. Instale puppeteer para PDF real.');

    const lines: string[] = [];

    lines.push('='.repeat(60));
    lines.push(`RELATORIO: ${result.report.name}`);
    lines.push(`Gerado em: ${result.generatedAt.toISOString()}`);
    lines.push('='.repeat(60));
    lines.push('');

    for (const component of result.components) {
      lines.push('-'.repeat(40));
      lines.push(component.title.toUpperCase());
      lines.push('-'.repeat(40));

      if (component.error) {
        lines.push(`[ERRO] ${component.error}`);
      } else if (component.data) {
        lines.push(JSON.stringify(component.data, null, 2));
      } else {
        lines.push('[Sem dados]');
      }

      lines.push('');
    }

    return Buffer.from(lines.join('\n'), 'utf-8');

    /* Exemplo com puppeteer:
    import puppeteer from 'puppeteer';

    const html = this.generateHtmlReport(result);

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(html);
    const pdf = await page.pdf({ format: 'A4' });
    await browser.close();

    return pdf;
    */
  }

  /**
   * Gerar HTML para PDF (helper)
   */
  private generateHtmlReport(result: ReportExecuteResult): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${result.report.name}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #333; }
          h2 { color: #666; margin-top: 30px; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #f5f5f5; }
          .error { color: red; }
          .meta { color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <h1>${result.report.name}</h1>
        <p class="meta">Gerado em: ${result.generatedAt.toISOString()}</p>

        ${result.components.map((comp) => `
          <h2>${comp.title}</h2>
          ${comp.error
            ? `<p class="error">Erro: ${comp.error}</p>`
            : this.dataToHtml(comp.data)
          }
        `).join('')}
      </body>
      </html>
    `;
  }

  private dataToHtml(data: any): string {
    if (!data) return '<p>Sem dados</p>';

    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
      const headers = Object.keys(data[0]);
      return `
        <table>
          <thead>
            <tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${data.map((row) => `
              <tr>${headers.map((h) => `<td>${row[h] ?? ''}</td>`).join('')}</tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    if (typeof data === 'object') {
      return `<pre>${JSON.stringify(data, null, 2)}</pre>`;
    }

    return `<p>${data}</p>`;
  }
}

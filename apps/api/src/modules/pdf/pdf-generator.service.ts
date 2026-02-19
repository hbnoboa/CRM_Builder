import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as PDFDocument from 'pdfkit';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

/**
 * Tipos de elementos do template PDF
 */
interface PdfElementPosition {
  x: number;
  y: number;
}

interface PdfElementFormat {
  type: 'text' | 'number' | 'currency' | 'percentage' | 'date' | 'datetime' | 'time';
  locale?: string;
  decimals?: number;
  dateFormat?: string;
  currencySymbol?: string;
  prefix?: string;
  suffix?: string;
}

interface PdfElementCondition {
  field: string;
  operator: 'equals' | 'notEquals' | 'contains' | 'isEmpty' | 'isNotEmpty' | 'greaterThan' | 'lessThan';
  value?: string;
}

interface PdfTableColumn {
  header: string;
  fieldSlug?: string;
  expression?: string;
  width?: number | 'auto';
  alignment?: 'left' | 'center' | 'right';
  format?: PdfElementFormat;
}

interface PdfTableFooterItem {
  colSpan?: number;
  text?: string;
  aggregation?: {
    function: 'sum' | 'avg' | 'count' | 'min' | 'max';
    fieldSlug: string;
  };
  format?: PdfElementFormat;
}

interface PdfElement {
  name: string;
  type: 'text' | 'image' | 'qrcode' | 'barcode' | 'table' | 'line' | 'rectangle';
  position: PdfElementPosition;
  width: number;
  height: number;
  fieldSlug?: string;
  staticValue?: string;
  expression?: string;
  format?: PdfElementFormat;
  fontSize?: number;
  fontColor?: string;
  fontWeight?: 'normal' | 'bold';
  alignment?: 'left' | 'center' | 'right';
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  condition?: PdfElementCondition;
  // Para tabelas
  dataSource?: 'record' | 'subEntity';
  subEntitySlug?: string;
  columns?: PdfTableColumn[];
  footer?: PdfTableFooterItem[];
  headerStyle?: {
    backgroundColor?: string;
    fontColor?: string;
    fontWeight?: 'normal' | 'bold';
  };
  alternateRowColor?: string;
}

interface ContextAggregation {
  contextQuery: {
    entitySlug: string;
    filterField: string;
    filterValue: 'fromRecord' | string;
  };
  aggregation: {
    function: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'first' | 'last' | 'countWhere';
    fieldSlug?: string;
    condition?: {
      field: string;
      operator: string;
      value?: string;
    };
  };
}

interface PdfTemplateSettings {
  pageSize?: 'A4' | 'LETTER' | 'LEGAL';
  orientation?: 'portrait' | 'landscape';
  margins?: { top: number; right: number; bottom: number; left: number };
}

interface GenerationJob {
  generationId: string;
  tenantId: string;
  userId: string;
}

@Injectable()
export class PdfGeneratorService {
  private readonly logger = new Logger(PdfGeneratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Processa job de geracao de PDF
   * Esta funcao sera chamada pelo worker BullMQ quando disponivel
   * Por enquanto, pode ser chamada diretamente (sincrono) para testes
   */
  async processGeneration(job: GenerationJob): Promise<void> {
    const { generationId, tenantId, userId } = job;

    try {
      // 1. Atualizar status para processing
      await this.prisma.pdfGeneration.update({
        where: { id: generationId },
        data: { status: 'processing' },
      });

      // 2. Buscar dados da geracao
      const generation = await this.prisma.pdfGeneration.findUnique({
        where: { id: generationId },
        include: {
          template: true,
        },
      });

      if (!generation) {
        throw new Error('Geracao nao encontrada');
      }

      // 3. Buscar dados do registro se existir
      let recordData: Record<string, unknown> = {};
      if (generation.recordId) {
        const record = await this.prisma.entityData.findUnique({
          where: { id: generation.recordId },
        });
        if (record) {
          recordData = record.data as Record<string, unknown>;
        }
      }

      // 4. Merge com inputData
      const data = {
        ...recordData,
        ...(generation.inputData as Record<string, unknown>),
      };

      // 5. Gerar PDF
      const pdfBuffer = await this.generatePdf(generation.template, data, tenantId);

      // 6. Upload para storage (por enquanto, salvar localmente ou retornar base64)
      // TODO: Integrar com UploadService para GCS/S3
      const fileUrl = await this.uploadPdf(pdfBuffer, tenantId, generationId);

      // 7. Atualizar geracao com sucesso
      await this.prisma.pdfGeneration.update({
        where: { id: generationId },
        data: {
          status: 'completed',
          fileUrl,
          fileSize: pdfBuffer.length,
          pageCount: 1, // TODO: Calcular numero real de paginas
          completedAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
        },
      });

      // 8. Notificar usuario
      await this.notificationService.notifyUser(
        userId,
        {
          type: 'success',
          title: 'PDF Gerado',
          message: `Seu documento "${generation.template.name}" esta pronto para download`,
          data: { generationId, fileUrl },
        },
        tenantId,
      );

    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(`Erro ao gerar PDF: ${error.message}`, error.stack);

      // Atualizar geracao com erro
      await this.prisma.pdfGeneration.update({
        where: { id: generationId },
        data: {
          status: 'failed',
          error: error.message,
        },
      });

      // Notificar usuario sobre erro
      await this.notificationService.notifyUser(
        userId,
        {
          type: 'error',
          title: 'Erro na Geracao',
          message: `Falha ao gerar documento: ${error.message}`,
        },
        tenantId,
      );

      throw error;
    }
  }

  /**
   * Gera o PDF usando PDFKit
   */
  private async generatePdf(
    template: { basePdf: unknown; schemas: unknown; settings: unknown; name: string },
    data: Record<string, unknown>,
    tenantId: string,
  ): Promise<Buffer> {
    const schemas = template.schemas as PdfElement[][];
    const settings = template.settings as PdfTemplateSettings;

    this.logger.log(`Gerando PDF: ${template.name}`);
    this.logger.log(`Elementos: ${schemas?.length || 0} paginas`);

    // Configurar documento PDF
    const doc = new PDFDocument({
      size: settings?.pageSize || 'A4',
      layout: settings?.orientation || 'portrait',
      margins: settings?.margins || { top: 30, right: 30, bottom: 30, left: 30 },
      compress: true,
      autoFirstPage: true,
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    // Renderizar elementos de cada pagina
    if (schemas && schemas.length > 0) {
      for (let pageIndex = 0; pageIndex < schemas.length; pageIndex++) {
        const pageElements = schemas[pageIndex];

        // Adicionar nova pagina (exceto a primeira)
        if (pageIndex > 0) {
          doc.addPage();
        }

        // Renderizar cada elemento da pagina
        if (Array.isArray(pageElements)) {
          for (const element of pageElements) {
            await this.renderElement(doc, element, data, tenantId);
          }
        }
      }
    }

    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  /**
   * Renderiza um elemento no documento PDF
   */
  private async renderElement(
    doc: PDFKit.PDFDocument,
    element: PdfElement,
    data: Record<string, unknown>,
    tenantId: string,
  ): Promise<void> {
    // Verificar condicao do elemento
    if (!this.checkCondition(element.condition, data)) {
      return;
    }

    const { position, width, height } = element;
    const x = position.x;
    const y = position.y;

    switch (element.type) {
      case 'text':
        await this.renderTextElement(doc, element, data, x, y);
        break;

      case 'rectangle':
        this.renderRectangleElement(doc, element, x, y, width, height);
        break;

      case 'line':
        this.renderLineElement(doc, element, x, y, width);
        break;

      case 'image':
        await this.renderImageElement(doc, element, data, x, y, width, height);
        break;

      case 'table':
        await this.renderTableElement(doc, element, data, x, y, width, tenantId);
        break;

      case 'qrcode':
        this.renderQRCodePlaceholder(doc, element, x, y, width, height);
        break;

      case 'barcode':
        this.renderBarcodePlaceholder(doc, element, x, y, width, height);
        break;

      default:
        this.logger.warn(`Tipo de elemento desconhecido: ${element.type}`);
    }
  }

  /**
   * Renderiza elemento de texto
   */
  private async renderTextElement(
    doc: PDFKit.PDFDocument,
    element: PdfElement,
    data: Record<string, unknown>,
    x: number,
    y: number,
  ): Promise<void> {
    // Obter valor do texto
    let textValue: string;

    if (element.expression) {
      // Avaliar expressao matematica
      const result = this.evaluateExpression(element.expression, data);
      textValue = this.formatValue(result, element.format);
    } else if (element.fieldSlug) {
      // Buscar valor do campo (suporta caminhos aninhados)
      const rawValue = this.getFieldValue(data, element.fieldSlug);
      textValue = this.formatValue(rawValue, element.format);
    } else {
      // Valor estatico - tambem pode conter templates {{campo}}
      textValue = this.interpolateTemplate(element.staticValue || '', data);
    }

    // Aplicar prefixo/sufixo
    if (element.format?.prefix) {
      textValue = element.format.prefix + textValue;
    }
    if (element.format?.suffix) {
      textValue = textValue + element.format.suffix;
    }

    // Configurar estilo do texto
    doc.fontSize(element.fontSize || 12);
    doc.fillColor(element.fontColor || '#000000');

    // Aplicar fonte
    if (element.fontWeight === 'bold') {
      doc.font('Helvetica-Bold');
    } else {
      doc.font('Helvetica');
    }

    // Configurar alinhamento
    const options: PDFKit.Mixins.TextOptions = {
      width: element.width,
      height: element.height,
      align: element.alignment || 'left',
      lineBreak: true,
    };

    // Renderizar texto
    doc.text(textValue, x, y, options);
  }

  /**
   * Interpola templates {{campo}} em um texto estatico
   */
  private interpolateTemplate(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, fieldPath) => {
      const value = this.getFieldValue(data, fieldPath);
      return value !== undefined && value !== null ? String(value) : '';
    });
  }

  /**
   * Renderiza retangulo
   */
  private renderRectangleElement(
    doc: PDFKit.PDFDocument,
    element: PdfElement,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    // Desenhar preenchimento
    if (element.backgroundColor && element.backgroundColor !== 'transparent') {
      doc.rect(x, y, width, height).fill(element.backgroundColor);
    }

    // Desenhar borda
    if (element.borderWidth && element.borderWidth > 0) {
      doc
        .rect(x, y, width, height)
        .lineWidth(element.borderWidth)
        .stroke(element.borderColor || '#000000');
    }
  }

  /**
   * Renderiza linha
   */
  private renderLineElement(
    doc: PDFKit.PDFDocument,
    element: PdfElement,
    x: number,
    y: number,
    width: number,
  ): void {
    doc
      .moveTo(x, y)
      .lineTo(x + width, y)
      .lineWidth(element.borderWidth || 1)
      .stroke(element.borderColor || '#000000');
  }

  /**
   * Renderiza imagem (placeholder por enquanto)
   */
  private async renderImageElement(
    doc: PDFKit.PDFDocument,
    element: PdfElement,
    data: Record<string, unknown>,
    x: number,
    y: number,
    width: number,
    height: number,
  ): Promise<void> {
    // Por enquanto, desenhar um retangulo placeholder
    // TODO: Implementar carregamento de imagem real
    doc
      .rect(x, y, width, height)
      .fill('#f0f0f0')
      .rect(x, y, width, height)
      .stroke('#cccccc');

    // Adicionar texto indicando imagem
    doc
      .fontSize(8)
      .fillColor('#999999')
      .text('IMG', x + width / 2 - 10, y + height / 2 - 4);
  }

  /**
   * Renderiza tabela
   */
  private async renderTableElement(
    doc: PDFKit.PDFDocument,
    element: PdfElement,
    data: Record<string, unknown>,
    x: number,
    y: number,
    width: number,
    tenantId: string,
  ): Promise<void> {
    if (!element.columns || element.columns.length === 0) {
      return;
    }

    const rowHeight = 20;
    const headerHeight = 24;
    const colWidth = width / element.columns.length;
    let currentY = y;

    // Desenhar cabecalho
    if (element.headerStyle?.backgroundColor) {
      doc.rect(x, currentY, width, headerHeight).fill(element.headerStyle.backgroundColor);
    }

    doc
      .fontSize(element.fontSize || 10)
      .fillColor(element.headerStyle?.fontColor || '#000000');

    if (element.headerStyle?.fontWeight === 'bold') {
      doc.font('Helvetica-Bold');
    }

    // Renderizar headers
    element.columns.forEach((col, index) => {
      doc.text(
        col.header,
        x + index * colWidth + 4,
        currentY + 6,
        { width: colWidth - 8, align: col.alignment || 'left' }
      );
    });

    currentY += headerHeight;

    // Borda do cabecalho
    doc.rect(x, y, width, headerHeight).stroke('#000000');

    // Obter dados para a tabela
    let tableData: Record<string, unknown>[] = [];

    if (element.dataSource === 'subEntity' && element.subEntitySlug) {
      // Buscar dados da sub-entidade
      const subEntityData = data[element.subEntitySlug];
      if (Array.isArray(subEntityData)) {
        tableData = subEntityData;
      }
    } else {
      // Usar dados do registro atual como unica linha
      tableData = [data];
    }

    // Renderizar linhas
    doc.font('Helvetica').fillColor('#000000');

    tableData.forEach((row, rowIndex) => {
      // Cor alternada
      if (element.alternateRowColor && rowIndex % 2 === 1) {
        doc.rect(x, currentY, width, rowHeight).fill(element.alternateRowColor);
      }

      // Renderizar colunas
      element.columns!.forEach((col, colIndex) => {
        let cellValue: string;

        if (col.expression) {
          const result = this.evaluateExpression(col.expression, row);
          cellValue = this.formatValue(result, col.format);
        } else if (col.fieldSlug) {
          cellValue = this.formatValue(row[col.fieldSlug], col.format);
        } else {
          cellValue = '';
        }

        doc
          .fillColor('#000000')
          .text(
            cellValue,
            x + colIndex * colWidth + 4,
            currentY + 4,
            { width: colWidth - 8, align: col.alignment || 'left' }
          );
      });

      // Borda da linha
      doc.rect(x, currentY, width, rowHeight).stroke('#cccccc');
      currentY += rowHeight;
    });

    // Renderizar rodape com agregacoes
    if (element.footer && element.footer.length > 0) {
      const footerHeight = 24;
      doc.rect(x, currentY, width, footerHeight).fill('#f5f5f5');
      doc.font('Helvetica-Bold').fillColor('#000000');

      let footerX = x;
      element.footer.forEach((footerItem) => {
        const itemWidth = (footerItem.colSpan || 1) * colWidth;
        let footerValue = footerItem.text || '';

        if (footerItem.aggregation) {
          const aggResult = this.aggregateColumn(
            tableData,
            footerItem.aggregation.fieldSlug,
            footerItem.aggregation.function,
          );
          footerValue = this.formatValue(aggResult, footerItem.format);
        }

        doc.text(footerValue, footerX + 4, currentY + 6, {
          width: itemWidth - 8,
          align: 'right',
        });

        footerX += itemWidth;
      });

      doc.rect(x, currentY, width, footerHeight).stroke('#000000');
    }
  }

  /**
   * Agrega valores de uma coluna
   */
  private aggregateColumn(
    data: Record<string, unknown>[],
    fieldSlug: string,
    func: 'sum' | 'avg' | 'count' | 'min' | 'max',
  ): number {
    const values = data.map(row => Number(row[fieldSlug]) || 0);

    switch (func) {
      case 'sum':
        return values.reduce((a, b) => a + b, 0);
      case 'avg':
        return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      case 'count':
        return values.length;
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      default:
        return 0;
    }
  }

  /**
   * Renderiza placeholder para QR Code
   */
  private renderQRCodePlaceholder(
    doc: PDFKit.PDFDocument,
    element: PdfElement,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    // Placeholder - QR code real requer biblioteca adicional
    doc.rect(x, y, width, height).fill('#ffffff').stroke('#000000');
    doc
      .fontSize(10)
      .fillColor('#666666')
      .text('QR', x + width / 2 - 8, y + height / 2 - 5);
  }

  /**
   * Renderiza placeholder para codigo de barras
   */
  private renderBarcodePlaceholder(
    doc: PDFKit.PDFDocument,
    element: PdfElement,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    // Placeholder - Barcode real requer biblioteca adicional
    doc.rect(x, y, width, height).fill('#ffffff').stroke('#000000');

    // Desenhar barras simuladas
    const barWidth = 2;
    const gap = 3;
    let currentX = x + 5;

    while (currentX < x + width - 5) {
      const barHeight = height - 10;
      doc.rect(currentX, y + 5, barWidth, barHeight).fill('#000000');
      currentX += barWidth + gap;
    }
  }

  /**
   * Upload do PDF para storage
   */
  private async uploadPdf(
    pdfBuffer: Buffer,
    tenantId: string,
    generationId: string,
  ): Promise<string> {
    // TODO: Integrar com UploadService para GCS/S3
    // Por enquanto, retorna uma URL placeholder

    // Quando o UploadService for integrado:
    /*
    return this.uploadService.uploadFile(
      pdfBuffer,
      `pdf/${tenantId}/${generationId}.pdf`,
      'application/pdf'
    );
    */

    // Placeholder
    return `/api/v1/pdf/generation/${generationId}/download`;
  }

  /**
   * Avalia expressao matematica com campos do registro
   */
  /**
   * Avalia expressao matematica com campos do registro
   * Suporta campos aninhados: {{address.number}} * {{quantity}}
   */
  evaluateExpression(expression: string, data: Record<string, unknown>): number {
    // Substitui {{campo}} ou {{campo.subcampo}} pelos valores
    let expr = expression;
    const matches = expression.match(/\{\{(\w+(?:\.\w+)*)\}\}/g) || [];

    for (const match of matches) {
      const fieldPath = match.replace(/[{}]/g, '');
      const value = this.getFieldValue(data, fieldPath) ?? 0;
      expr = expr.replace(match, String(Number(value) || 0));
    }

    // Avalia expressao matematica de forma segura
    return this.safeEval(expr);
  }

  /**
   * Avalia expressao matematica de forma segura (apenas numeros e operadores)
   */
  private safeEval(expr: string): number {
    // Permite apenas numeros, espacos e operadores matematicos
    if (!/^[\d\s+\-*/().]+$/.test(expr)) {
      throw new Error(`Expressao invalida: ${expr}`);
    }
    try {
      return Function(`'use strict'; return (${expr})`)();
    } catch {
      return 0;
    }
  }

  /**
   * Formata valor de acordo com configuracao
   */
  /**
   * Obtem valor de um campo, suportando caminhos aninhados (ex: "address.city")
   */
  getFieldValue(data: Record<string, unknown>, fieldPath: string): unknown {
    const parts = fieldPath.split('.');
    let value: unknown = data;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = (value as Record<string, unknown>)[part];
    }

    return value;
  }

  /**
   * Formata valor de acordo com configuracao
   */
  formatValue(value: unknown, format?: PdfElementFormat): string {
    if (value === null || value === undefined) return '';
    if (!format || format.type === 'text') return String(value);

    const locale = format.locale || 'pt-BR';

    try {
      switch (format.type) {
        case 'number':
          return new Intl.NumberFormat(locale, {
            minimumFractionDigits: format.decimals ?? 0,
            maximumFractionDigits: format.decimals ?? 2,
          }).format(Number(value));

        case 'currency': {
          const currencyCode = format.currencySymbol === '$' ? 'USD' : 'BRL';
          return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currencyCode,
          }).format(Number(value));
        }

        case 'percentage':
          return new Intl.NumberFormat(locale, {
            style: 'percent',
            minimumFractionDigits: format.decimals ?? 0,
            maximumFractionDigits: format.decimals ?? 2,
          }).format(Number(value));

        case 'date': {
          const dateValue = this.parseDate(value);
          if (!dateValue) return String(value);
          return new Intl.DateTimeFormat(locale, {
            dateStyle: 'short',
          }).format(dateValue);
        }

        case 'datetime': {
          const datetimeValue = this.parseDate(value);
          if (!datetimeValue) return String(value);
          return new Intl.DateTimeFormat(locale, {
            dateStyle: 'short',
            timeStyle: 'medium',
          }).format(datetimeValue);
        }

        case 'time': {
          const timeValue = this.parseDate(value);
          if (!timeValue) return String(value);
          return new Intl.DateTimeFormat(locale, {
            timeStyle: 'medium',
          }).format(timeValue);
        }

        default:
          return String(value);
      }
    } catch (error) {
      this.logger.warn(`Erro ao formatar valor: ${error}`);
      return String(value);
    }
  }

  /**
   * Tenta converter valor para Date
   */
  private parseDate(value: unknown): Date | null {
    if (value instanceof Date) return value;
    if (typeof value === 'number') return new Date(value);
    if (typeof value === 'string') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    }
    return null;
  }

  /**
   * Verifica se elemento deve ser renderizado baseado na condicao
   */
  checkCondition(condition: PdfElementCondition | undefined, data: Record<string, unknown>): boolean {
    if (!condition) return true;

    const fieldValue = data[condition.field];

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'notEquals':
        return fieldValue !== condition.value;
      case 'contains':
        return String(fieldValue).includes(condition.value || '');
      case 'isEmpty':
        return !fieldValue || String(fieldValue).trim() === '';
      case 'isNotEmpty':
        return !!fieldValue && String(fieldValue).trim() !== '';
      case 'greaterThan':
        return Number(fieldValue) > Number(condition.value);
      case 'lessThan':
        return Number(fieldValue) < Number(condition.value);
      default:
        return true;
    }
  }

  /**
   * Executa agregacao de contexto (para relatorios que agregam multiplos registros)
   */
  async executeContextAggregation(
    config: ContextAggregation,
    currentRecord: Record<string, unknown> | undefined,
    tenantId: string,
  ): Promise<unknown> {
    const { entitySlug, filterField, filterValue } = config.contextQuery;

    // Buscar entidade
    const entity = await this.prisma.entity.findFirst({
      where: { tenantId, slug: entitySlug },
    });

    if (!entity) {
      throw new Error(`Entidade "${entitySlug}" nao encontrada`);
    }

    // Determinar valor do filtro
    const filter = filterValue === 'fromRecord'
      ? currentRecord?.[filterField]
      : filterValue;

    // Buscar registros filtrados
    // Usar raw query para filtro JSON mais flexivel
    const records = await this.prisma.entityData.findMany({
      where: {
        tenantId,
        entityId: entity.id,
        deletedAt: null,
        // Filtro JSON usando path
        data: {
          path: [filterField],
          equals: filter as Prisma.InputJsonValue,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Extrair dados
    const recordsData = records.map(r => r.data as Record<string, unknown>);

    // Executar agregacao
    return this.aggregate(recordsData, config.aggregation);
  }

  /**
   * Executa funcao de agregacao em array de registros
   */
  private aggregate(
    records: Record<string, unknown>[],
    agg: ContextAggregation['aggregation'],
  ): unknown {
    const { fieldSlug } = agg;

    switch (agg.function) {
      case 'count':
        return records.length;

      case 'countWhere':
        if (!agg.condition) return records.length;
        return records.filter(r => this.matchesCondition(r, agg.condition!)).length;

      case 'sum':
        if (!fieldSlug) return 0;
        return records.reduce((sum, r) => sum + (Number(r[fieldSlug]) || 0), 0);

      case 'avg':
        if (!fieldSlug || records.length === 0) return 0;
        const sum = records.reduce((s, r) => s + (Number(r[fieldSlug]) || 0), 0);
        return sum / records.length;

      case 'min':
      case 'first':
        if (!fieldSlug || records.length === 0) return null;
        return records[0][fieldSlug];

      case 'max':
      case 'last':
        if (!fieldSlug || records.length === 0) return null;
        return records[records.length - 1][fieldSlug];

      default:
        return null;
    }
  }

  /**
   * Verifica se registro corresponde a condicao
   */
  private matchesCondition(
    record: Record<string, unknown>,
    condition: { field: string; operator: string; value?: string },
  ): boolean {
    const fieldValue = record[condition.field];

    switch (condition.operator) {
      case 'equals':
        return String(fieldValue) === condition.value;
      case 'notEquals':
        return String(fieldValue) !== condition.value;
      case 'isNotEmpty':
        return !!fieldValue && String(fieldValue).trim() !== '';
      case 'isEmpty':
        return !fieldValue || String(fieldValue).trim() === '';
      default:
        return true;
    }
  }
}

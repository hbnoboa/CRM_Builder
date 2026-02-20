import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PdfTemplate, PdfGeneration, PdfGenerationStatus, Prisma } from '@prisma/client';
import {
  CurrentUser,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  encodeCursor,
  decodeCursor,
  createPaginationMeta,
} from '../../common/types';
import { getEffectiveTenantId } from '../../common/utils/tenant.util';
import { QueryPdfGenerationDto, PreviewPdfDto } from './dto';
import {
  PdfTemplateContent,
  PdfElement,
  PdfMargins,
  TextElement,
  FieldGroupElement,
  TableElement,
  ImageGridElement,
  DividerElement,
  SpacerElement,
  StatisticsElement,
} from './interfaces/pdf-element.interface';

// Importar PDFKit
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('pdfkit-table');

@Injectable()
export class PdfGeneratorService {
  private readonly logger = new Logger(PdfGeneratorService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Gera PDF para um unico registro
   */
  async generateSingle(
    templateId: string,
    recordId: string,
    currentUser: CurrentUser,
    overrideData?: Record<string, unknown>,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const targetTenantId = getEffectiveTenantId(currentUser, undefined);

    // Buscar template
    const template = await this.prisma.pdfTemplate.findFirst({
      where: {
        id: templateId,
        tenantId: targetTenantId,
      },
      include: {
        sourceEntity: true,
      },
    });

    if (!template) {
      throw new NotFoundException('Template nao encontrado');
    }

    // Buscar dados do registro
    const record = await this.prisma.entityData.findFirst({
      where: {
        id: recordId,
        tenantId: targetTenantId,
        entityId: template.sourceEntityId || undefined,
      },
    });

    if (!record) {
      throw new NotFoundException('Registro nao encontrado');
    }

    // Enriquecer dados com sub-entidades
    const data = await this.enrichDataWithSubEntities(
      record.data as Record<string, unknown>,
      template.sourceEntity?.fields as Array<{ slug: string; type: string; subEntityId?: string }>,
      record.id,
      targetTenantId,
    );

    // Aplicar override se fornecido
    const finalData = overrideData ? { ...data, ...overrideData } : data;

    // Gerar PDF
    const buffer = await this.renderPdf(template, finalData);

    // Gerar nome do arquivo
    const titleField = (template.sourceEntity?.settings as Record<string, string>)?.titleField;
    const fileName = titleField && finalData[titleField]
      ? `${String(finalData[titleField]).replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
      : `${template.slug}-${recordId.substring(0, 8)}.pdf`;

    // Registrar geracao
    await this.prisma.pdfGeneration.create({
      data: {
        tenantId: targetTenantId,
        templateId,
        status: PdfGenerationStatus.COMPLETED,
        progress: 100,
        recordIds: [recordId],
        fileSize: buffer.length,
        requestedById: currentUser.id,
        completedAt: new Date(),
      },
    });

    return { buffer, fileName };
  }

  /**
   * Gera PDFs em lote (async via queue)
   */
  async generateBatch(
    templateId: string,
    recordIds: string[],
    currentUser: CurrentUser,
    mergePdfs?: boolean,
  ): Promise<PdfGeneration> {
    const targetTenantId = getEffectiveTenantId(currentUser, undefined);

    // Verificar template existe
    const template = await this.prisma.pdfTemplate.findFirst({
      where: {
        id: templateId,
        tenantId: targetTenantId,
      },
    });

    if (!template) {
      throw new NotFoundException('Template nao encontrado');
    }

    // Criar registro de geracao
    const generation = await this.prisma.pdfGeneration.create({
      data: {
        tenantId: targetTenantId,
        templateId,
        status: PdfGenerationStatus.PENDING,
        progress: 0,
        recordIds,
        metadata: { mergePdfs: mergePdfs || false },
        requestedById: currentUser.id,
      },
    });

    // TODO: Adicionar job na fila BullMQ
    // await this.pdfQueue.add('generate-batch', {
    //   generationId: generation.id,
    //   templateId,
    //   recordIds,
    //   mergePdfs,
    //   tenantId: targetTenantId,
    //   userId: currentUser.userId,
    // });

    this.logger.log(`Batch job criado: ${generation.id} (${recordIds.length} registros)`);

    return generation;
  }

  /**
   * Gera preview do PDF com dados de exemplo
   */
  async preview(
    templateId: string,
    currentUser: CurrentUser,
    dto: PreviewPdfDto,
  ): Promise<Buffer> {
    const targetTenantId = getEffectiveTenantId(currentUser, undefined);

    // Buscar template
    const template = await this.prisma.pdfTemplate.findFirst({
      where: {
        id: templateId,
        tenantId: targetTenantId,
      },
      include: {
        sourceEntity: true,
      },
    });

    if (!template) {
      throw new NotFoundException('Template nao encontrado');
    }

    let data: Record<string, unknown> = dto.sampleData || {};

    // Se forneceu recordId, buscar dados reais
    if (dto.recordId) {
      const record = await this.prisma.entityData.findFirst({
        where: {
          id: dto.recordId,
          tenantId: targetTenantId,
        },
      });

      if (record) {
        data = await this.enrichDataWithSubEntities(
          record.data as Record<string, unknown>,
          template.sourceEntity?.fields as Array<{ slug: string; type: string; subEntityId?: string }>,
          record.id,
          targetTenantId,
        );
      }
    }

    // Se nao tem dados, usar dados de exemplo
    if (Object.keys(data).length === 0) {
      data = this.generateSampleData(template);
    }

    return this.renderPdf(template, data);
  }

  /**
   * Lista historico de geracoes
   */
  async getGenerations(currentUser: CurrentUser, query: QueryPdfGenerationDto) {
    const targetTenantId = getEffectiveTenantId(currentUser, undefined);
    const limit = Math.min(parseInt(query.limit || String(DEFAULT_LIMIT)), MAX_LIMIT);

    const where: Prisma.PdfGenerationWhereInput = {
      tenantId: targetTenantId,
    };

    if (query.templateId) {
      where.templateId = query.templateId;
    }

    if (query.status) {
      where.status = query.status;
    }

    let cursor: Prisma.PdfGenerationWhereUniqueInput | undefined;
    if (query.cursor) {
      const decodedCursor = decodeCursor(query.cursor);
      if (decodedCursor) {
        cursor = { id: decodedCursor.id };
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.pdfGeneration.findMany({
        where,
        take: limit + 1,
        skip: cursor ? 1 : 0,
        cursor,
        orderBy: { createdAt: 'desc' },
        include: {
          template: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          requestedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.pdfGeneration.count({ where }),
    ]);

    const hasMore = data.length > limit;
    if (hasMore) data.pop();

    const nextCursor = hasMore && data.length > 0 ? encodeCursor({ id: data[data.length - 1].id }) : null;

    return {
      data,
      meta: createPaginationMeta(total, 1, limit, { hasNextPage: hasMore, hasPreviousPage: !!cursor, nextCursor: nextCursor || undefined }),
    };
  }

  /**
   * Buscar geracao por ID
   */
  async getGeneration(id: string, currentUser: CurrentUser): Promise<PdfGeneration> {
    const targetTenantId = getEffectiveTenantId(currentUser, undefined);

    const generation = await this.prisma.pdfGeneration.findFirst({
      where: {
        id,
        tenantId: targetTenantId,
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        requestedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!generation) {
      throw new NotFoundException('Geracao nao encontrada');
    }

    return generation;
  }

  // ================= METODOS PRIVADOS =================

  /**
   * Renderiza o PDF usando PDFKit
   */
  private async renderPdf(
    template: PdfTemplate,
    data: Record<string, unknown>,
  ): Promise<Buffer> {
    const margins = template.margins as unknown as PdfMargins || {
      top: 70,
      right: 70,
      bottom: 70,
      left: 70,
    };

    const doc = new PDFDocument({
      size: template.pageSize,
      layout: template.orientation.toLowerCase(),
      margins,
      compress: true,
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const content = template.content as unknown as PdfTemplateContent || { body: [] };

    // Renderizar header
    if (content.header) {
      await this.renderHeader(doc, content.header, data, template.logoUrl);

      // Repetir header em novas paginas
      if (content.header.showOnAllPages) {
        doc.on('pageAdded', () => {
          this.renderHeader(doc, content.header!, data, template.logoUrl);
        });
      }
    }

    // Renderizar elementos do body
    for (const element of content.body || []) {
      await this.renderElement(doc, element, data);
    }

    // Finalizar documento
    doc.end();

    // Retornar buffer
    return new Promise((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });
  }

  /**
   * Renderiza o header do PDF
   */
  private async renderHeader(
    doc: typeof PDFDocument,
    header: PdfTemplateContent['header'],
    data: Record<string, unknown>,
    defaultLogoUrl?: string | null,
  ): Promise<void> {
    const startY = doc.y;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Renderizar logo
    if (header?.logo?.url || defaultLogoUrl) {
      const logoUrl = header?.logo?.url || defaultLogoUrl;
      const logoWidth = header?.logo?.width || 100;
      const position = header?.logo?.position || 'left';

      let logoX = doc.page.margins.left;
      if (position === 'center') {
        logoX = (doc.page.width - logoWidth) / 2;
      } else if (position === 'right') {
        logoX = doc.page.width - doc.page.margins.right - logoWidth;
      }

      // TODO: Implementar fetch de imagem remota
      // Por enquanto, apenas reservar espaco
      doc.y = startY + 60;
    }

    // Renderizar titulo
    if (header?.title?.text) {
      const titleText = this.resolveBindings(header.title.text, data);
      doc
        .font(header.title.bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(header.title.fontSize || 14)
        .text(titleText, {
          align: 'center',
        });
    }

    // Renderizar subtitulo
    if (header?.subtitle?.text) {
      const subtitleText = this.resolveBindings(header.subtitle.text, data);
      doc
        .font('Helvetica')
        .fontSize(10)
        .text(subtitleText, {
          align: 'center',
        });
    }

    // Linha divisoria
    doc.moveDown(0.5);
    doc
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .stroke();
    doc.moveDown(0.5);
  }

  /**
   * Renderiza um elemento do body
   */
  private async renderElement(
    doc: typeof PDFDocument,
    element: PdfElement,
    data: Record<string, unknown>,
  ): Promise<void> {
    // Margem superior
    if (element.marginTop) {
      doc.y += element.marginTop;
    }

    switch (element.type) {
      case 'text':
        this.renderText(doc, element as TextElement, data);
        break;

      case 'field-group':
        this.renderFieldGroup(doc, element as FieldGroupElement, data);
        break;

      case 'table':
        await this.renderTable(doc, element as TableElement, data);
        break;

      case 'image-grid':
        await this.renderImageGrid(doc, element as ImageGridElement, data);
        break;

      case 'divider':
        this.renderDivider(doc, element as DividerElement);
        break;

      case 'spacer':
        this.renderSpacer(doc, element as SpacerElement);
        break;

      case 'statistics':
        this.renderStatistics(doc, element as StatisticsElement, data);
        break;
    }

    // Margem inferior
    if (element.marginBottom) {
      doc.y += element.marginBottom;
    }
  }

  /**
   * Renderiza elemento de texto
   */
  private renderText(
    doc: typeof PDFDocument,
    element: TextElement,
    data: Record<string, unknown>,
  ): void {
    const text = this.resolveBindings(element.content, data);

    doc
      .font(element.fontWeight === 'bold' ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(element.fontSize || 10)
      .fillColor(element.color || '#000000')
      .text(text, {
        align: element.align || 'left',
      });
  }

  /**
   * Renderiza grupo de campos (label: valor)
   */
  private renderFieldGroup(
    doc: typeof PDFDocument,
    element: FieldGroupElement,
    data: Record<string, unknown>,
  ): void {
    // Titulo da secao
    if (element.title) {
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .text(element.title, { align: 'center' });
      doc.moveDown(0.5);
    }

    const startX = doc.x;

    for (const field of element.fields) {
      const label = field.label;
      const value = this.resolveBindings(field.binding, data);
      const formattedValue = this.formatValue(value, field.format);

      if (element.layout === 'horizontal') {
        // Label e valor na mesma linha
        doc
          .font(field.labelBold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(10)
          .text(label, { continued: true });
        doc
          .font('Helvetica')
          .fontSize(10)
          .text(` ${formattedValue}`);
      } else {
        // Label e valor em linhas separadas
        doc
          .font(field.labelBold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(10)
          .text(label);
        doc
          .font('Helvetica')
          .fontSize(10)
          .text(formattedValue);
        doc.moveDown(0.3);
      }
    }

    doc.moveDown(0.5);
  }

  /**
   * Renderiza tabela
   */
  private async renderTable(
    doc: typeof PDFDocument,
    element: TableElement,
    data: Record<string, unknown>,
  ): Promise<void> {
    // Titulo da tabela
    if (element.title) {
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .text(element.title, { align: 'center' });
      doc.moveDown(0.3);
    }

    // Obter dados da tabela
    let rows: Record<string, unknown>[] = [];

    if (element.dataSource) {
      const sourceData = data[element.dataSource];
      if (Array.isArray(sourceData)) {
        rows = sourceData;
      }
    }

    // Headers
    const headers = element.columns.map((col) => col.header);
    const widths = element.columns.map((col) => col.width || 100);

    // Renderizar header
    if (element.showHeader !== false) {
      doc.font('Helvetica-Bold').fontSize(element.headerStyle?.fontSize || 8);
      doc.table({
        rowStyles: [{ height: 20 }],
        columnStyles: { width: widths, padding: [7, 5], align: 'center' },
        data: [headers],
      });
    }

    // Renderizar linhas de dados
    if (rows.length > 0) {
      const tableData = rows.map((row) =>
        element.columns.map((col) => {
          const value = row[col.field];
          return this.formatValue(value, col.format);
        }),
      );

      doc.font('Helvetica').fontSize(element.cellStyle?.fontSize || 8);
      doc.table({
        rowStyles: [{ height: 20 }],
        columnStyles: { width: widths, padding: [7, 5], align: 'center' },
        data: tableData,
      });
    } else if (element.emptyMessage) {
      doc
        .font('Helvetica')
        .fontSize(8)
        .text(element.emptyMessage, { align: 'center' });
    }

    doc.moveDown(0.5);
  }

  /**
   * Renderiza grid de imagens
   */
  private async renderImageGrid(
    doc: typeof PDFDocument,
    element: ImageGridElement,
    data: Record<string, unknown>,
  ): Promise<void> {
    // Titulo
    if (element.title) {
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .text(element.title, { align: 'center' });
      doc.moveDown(0.5);
    }

    // Headers das colunas
    if (element.captionFields && element.captionFields.length > 0) {
      const columnWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / element.columns;

      doc.font('Helvetica-Bold').fontSize(8);
      let x = doc.page.margins.left;
      for (const caption of element.captionFields) {
        doc.text(caption, x, doc.y, { width: columnWidth, align: 'center' });
        x += columnWidth;
      }
      doc.moveDown(0.5);
    }

    // Obter lista de imagens
    const images = data[element.dataSource];
    if (!Array.isArray(images) || images.length === 0) {
      doc
        .font('Helvetica')
        .fontSize(8)
        .text('Nenhuma imagem disponivel', { align: 'center' });
      return;
    }

    // TODO: Implementar renderizacao de imagens
    // Por enquanto, apenas placeholder
    const imageWidth = element.imageWidth || 90;
    const imageHeight = element.imageHeight || 68;
    const columnWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / element.columns;

    let col = 0;
    let rowY = doc.y;

    for (const img of images) {
      const x = doc.page.margins.left + col * columnWidth + (columnWidth - imageWidth) / 2;

      // Placeholder de imagem
      doc
        .rect(x, rowY, imageWidth, imageHeight)
        .strokeColor('#CCCCCC')
        .stroke();
      doc
        .font('Helvetica')
        .fontSize(6)
        .fillColor('#999999')
        .text('[IMG]', x, rowY + imageHeight / 2 - 3, {
          width: imageWidth,
          align: 'center',
        });

      col++;
      if (col >= element.columns) {
        col = 0;
        rowY += imageHeight + 10;

        // Verificar quebra de pagina
        if (rowY + imageHeight > doc.page.height - doc.page.margins.bottom) {
          doc.addPage();
          rowY = doc.page.margins.top + 50;
        }
      }
    }

    doc.y = rowY + imageHeight + 10;
  }

  /**
   * Renderiza linha divisoria
   */
  private renderDivider(doc: typeof PDFDocument, element: DividerElement): void {
    doc
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .strokeColor(element.color || '#000000')
      .lineWidth(element.thickness || 1)
      .stroke();
    doc.moveDown(0.5);
  }

  /**
   * Renderiza espacamento
   */
  private renderSpacer(doc: typeof PDFDocument, element: SpacerElement): void {
    doc.y += element.height || 10;
  }

  /**
   * Renderiza estatisticas (agrupamento)
   */
  private renderStatistics(
    doc: typeof PDFDocument,
    element: StatisticsElement,
    data: Record<string, unknown>,
  ): void {
    // Titulo
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(element.title, { align: 'center' });
    doc.moveDown(0.5);

    // Obter dados para agrupamento
    const items = data._items as Record<string, unknown>[] || [];

    if (items.length === 0) {
      doc
        .font('Helvetica')
        .fontSize(8)
        .text('Sem dados para estatisticas', { align: 'center' });
      return;
    }

    // Agrupar dados
    const groups = new Map<string, { total: number; damaged: number }>();

    for (const item of items) {
      const key = element.groupBy.map((field) => item[field] || 'N/A').join(' | ');

      if (!groups.has(key)) {
        groups.set(key, { total: 0, damaged: 0 });
      }

      const group = groups.get(key)!;
      group.total++;

      // Verificar se tem nao-conformidades
      const nonconformities = item['naoConformidades'] as unknown[];
      if (Array.isArray(nonconformities) && nonconformities.length > 0) {
        group.damaged++;
      }
    }

    // Renderizar tabela de estatisticas
    const headers = [...element.groupBy, ...element.metrics.map((m) => m.label)];
    const widths = headers.map(() => 80);

    doc.font('Helvetica-Bold').fontSize(8);
    doc.table({
      rowStyles: [{ height: 20 }],
      columnStyles: { width: widths, padding: [5, 3], align: 'center' },
      data: [headers],
    });

    doc.font('Helvetica').fontSize(8);
    const rows: string[][] = [];

    for (const [key, stats] of groups) {
      const row = key.split(' | ');
      for (const metric of element.metrics) {
        if (metric.aggregation === 'count') {
          row.push(String(stats.total));
        } else if (metric.aggregation === 'percentage') {
          const pct = stats.total > 0 ? ((stats.damaged / stats.total) * 100).toFixed(2) : '0.00';
          row.push(`${pct}%`);
        } else {
          row.push(String(stats.damaged));
        }
      }
      rows.push(row);
    }

    doc.table({
      rowStyles: [{ height: 20 }],
      columnStyles: { width: widths, padding: [5, 3], align: 'center' },
      data: rows,
    });

    doc.moveDown(0.5);
  }

  // ================= HELPERS =================

  /**
   * Resolve bindings {{campo}} no texto
   */
  private resolveBindings(template: string, data: Record<string, unknown>): string {
    if (!template) return '';

    return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
      const value = this.getNestedValue(data, path.trim());
      return value !== undefined && value !== null ? String(value) : '';
    });
  }

  /**
   * Obtem valor aninhado de um objeto
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const keys = path.split('.');
    let current: unknown = obj;

    for (const key of keys) {
      if (current === undefined || current === null) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }

    return current;
  }

  /**
   * Formata valor baseado no tipo
   */
  private formatValue(value: unknown, format?: string): string {
    if (value === undefined || value === null) {
      return '-';
    }

    switch (format) {
      case 'date':
        return new Date(String(value)).toLocaleDateString('pt-BR');

      case 'datetime':
        return new Date(String(value)).toLocaleString('pt-BR');

      case 'currency':
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(Number(value));

      case 'number':
        return new Intl.NumberFormat('pt-BR').format(Number(value));

      case 'percentage':
        return `${Number(value).toFixed(2)}%`;

      default:
        return String(value);
    }
  }

  /**
   * Enriquece dados com sub-entidades
   */
  private async enrichDataWithSubEntities(
    data: Record<string, unknown>,
    fields: Array<{ slug: string; type: string; subEntityId?: string }> | null,
    recordId: string,
    tenantId: string,
  ): Promise<Record<string, unknown>> {
    if (!fields) return data;

    const enrichedData = { ...data };

    for (const field of fields) {
      if (field.type === 'sub-entity' && field.subEntityId) {
        const childRecords = await this.prisma.entityData.findMany({
          where: {
            entityId: field.subEntityId,
            parentRecordId: recordId,
            tenantId,
          },
          orderBy: { createdAt: 'asc' },
        });

        enrichedData[field.slug] = childRecords.map((r) => r.data);
      }
    }

    return enrichedData;
  }

  /**
   * Gera dados de exemplo para preview
   */
  private generateSampleData(template: PdfTemplate): Record<string, unknown> {
    const entity = (template as Record<string, unknown>).sourceEntity as { fields?: Array<{ slug: string; type: string; name: string }> } | undefined;
    const sampleData: Record<string, unknown> = {};

    if (entity?.fields) {
      for (const field of entity.fields) {
        switch (field.type) {
          case 'text':
            sampleData[field.slug] = `Exemplo ${field.name}`;
            break;
          case 'number':
            sampleData[field.slug] = 123;
            break;
          case 'date':
            sampleData[field.slug] = new Date().toISOString();
            break;
          case 'boolean':
            sampleData[field.slug] = true;
            break;
          case 'sub-entity':
            sampleData[field.slug] = [
              { descricao: 'Item 1', valor: 100 },
              { descricao: 'Item 2', valor: 200 },
            ];
            break;
          default:
            sampleData[field.slug] = `Exemplo`;
        }
      }
    }

    return sampleData;
  }
}

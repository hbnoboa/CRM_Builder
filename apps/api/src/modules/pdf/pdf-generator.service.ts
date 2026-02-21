import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
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
  ComputedField,
  ArithmeticConfig,
  ConditionalConfig,
  FilteredCountConfig,
  ConcatConfig,
} from './interfaces/pdf-element.interface';

// pdfkit-table estende pdfkit e deve ser usado como construtor
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit-table');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const https = require('https');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const http = require('http');

@Injectable()
export class PdfGeneratorService {
  private readonly logger = new Logger(PdfGeneratorService.name);

  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
  ) {}

  /**
   * Gera PDF para um unico registro
   */
  async generateSingle(
    templateId: string,
    recordId: string,
    currentUser: CurrentUser,
    overrideData?: Record<string, unknown>,
    tenantId?: string,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const targetTenantId = getEffectiveTenantId(currentUser, tenantId);

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

    // Enriquecer dados com sub-entidades e campos do sistema
    const baseData = {
      ...(record.data as Record<string, unknown>),
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
    const data = await this.enrichDataWithSubEntities(
      baseData,
      template.sourceEntity?.fields as Array<{ slug: string; type: string; subEntityId?: string }>,
      record.id,
      targetTenantId,
    );

    // Aplicar override se fornecido
    const finalData = overrideData ? { ...data, ...overrideData } : data;

    // Avaliar campos calculados
    const computedFields = (template.content as unknown as PdfTemplateContent)?.computedFields;
    if (computedFields?.length) {
      this.evaluateComputedFields(finalData, computedFields);
    }

    // Gerar PDF
    const buffer = await this.renderPdf(template, finalData);

    // Gerar nome do arquivo
    const titleField = (template.sourceEntity?.settings as Record<string, string>)?.titleField;
    const fileName = titleField && finalData[titleField]
      ? `${String(finalData[titleField]).replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
      : `${template.slug}-${recordId.substring(0, 8)}.pdf`;

    // Upload para GCS na pasta relatorios
    let fileUrl: string | null = null;
    try {
      const uploaded = await this.uploadService.uploadBuffer(
        buffer, fileName, 'application/pdf', targetTenantId, 'relatorios',
      );
      fileUrl = uploaded.publicUrl;
      this.logger.log(`PDF enviado para GCS: ${fileUrl}`);
    } catch (error) {
      this.logger.error('Erro ao enviar PDF para GCS:', error);
    }

    // Registrar geracao
    await this.prisma.pdfGeneration.create({
      data: {
        tenantId: targetTenantId,
        templateId,
        status: PdfGenerationStatus.COMPLETED,
        progress: 100,
        recordIds: [recordId],
        fileUrl,
        fileName,
        fileSize: buffer.length,
        requestedById: currentUser.id,
        completedAt: new Date(),
      },
    });

    return { buffer, fileName };
  }

  /**
   * Gera PDF agregado em lote (relatorio com todos os registros)
   */
  async generateBatch(
    templateId: string,
    recordIds: string[],
    currentUser: CurrentUser,
    mergePdfs?: boolean,
    tenantId?: string,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const targetTenantId = getEffectiveTenantId(currentUser, tenantId);

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

    // Buscar todos os registros
    const records = await this.prisma.entityData.findMany({
      where: {
        id: { in: recordIds },
        tenantId: targetTenantId,
        entityId: template.sourceEntityId || undefined,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (records.length === 0) {
      throw new NotFoundException('Nenhum registro encontrado');
    }

    // Enriquecer cada registro com sub-entidades
    const fields = template.sourceEntity?.fields as Array<{ slug: string; type: string; subEntityId?: string }> | null;
    const enrichedRecords: Record<string, unknown>[] = [];

    for (const record of records) {
      const baseData = {
        ...(record.data as Record<string, unknown>),
        id: record.id,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      };
      const enriched = await this.enrichDataWithSubEntities(baseData, fields, record.id, targetTenantId);
      enrichedRecords.push(enriched);
    }

    // Contar veiculos avariados (que tem sub-entidade com dados)
    const totalDamaged = enrichedRecords.filter((record) =>
      Object.values(record).some((v) => Array.isArray(v) && v.length > 0),
    ).length;

    // Calcular primeiro e ultimo updatedAt dos registros
    const sortedByUpdate = [...records].sort(
      (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
    );
    const firstUpdatedAt = sortedByUpdate[0]?.updatedAt?.toISOString();
    const lastUpdatedAt = sortedByUpdate[sortedByUpdate.length - 1]?.updatedAt?.toISOString();

    // Calcular _max e _min para campos numericos e datas
    const maxValues: Record<string, unknown> = {};
    const minValues: Record<string, unknown> = {};
    if (enrichedRecords.length > 0) {
      const fieldKeys = Object.keys(enrichedRecords[0]).filter(
        (k) => !k.startsWith('_') && !Array.isArray(enrichedRecords[0][k]) && typeof enrichedRecords[0][k] !== 'object',
      );
      for (const key of fieldKeys) {
        const values = enrichedRecords
          .map((r) => r[key])
          .filter((v) => v != null && v !== '');
        if (values.length === 0) continue;

        // Tentar como numero
        const numericValues = values.map((v) => Number(v)).filter((n) => !isNaN(n));
        if (numericValues.length > 0) {
          maxValues[key] = Math.max(...numericValues);
          minValues[key] = Math.min(...numericValues);
          continue;
        }
        // Tentar como data
        const dateValues = values
          .map((v) => new Date(String(v)))
          .filter((d) => !isNaN(d.getTime()));
        if (dateValues.length > 0) {
          const sorted = dateValues.sort((a, b) => a.getTime() - b.getTime());
          minValues[key] = sorted[0].toISOString();
          maxValues[key] = sorted[sorted.length - 1].toISOString();
          continue;
        }
        // Strings: ordem alfabetica
        const strValues = values.map(String).sort();
        minValues[key] = strValues[0];
        maxValues[key] = strValues[strValues.length - 1];
      }
    }

    // Montar dados agregados para o template
    const batchData: Record<string, unknown> = {
      _items: enrichedRecords,
      _totalRecords: enrichedRecords.length,
      _totalDamaged: totalDamaged,
      _timestamp: new Date().toISOString(),
      _firstUpdatedAt: firstUpdatedAt,
      _lastUpdatedAt: lastUpdatedAt,
      _first: enrichedRecords[0] || {},
      _last: enrichedRecords[enrichedRecords.length - 1] || {},
      _max: maxValues,
      _min: minValues,
    };

    // Usar dados do primeiro registro como base (para bindings simples)
    if (enrichedRecords.length > 0) {
      Object.assign(batchData, enrichedRecords[0]);
    }

    // Avaliar campos calculados
    const computedFields = (template.content as unknown as PdfTemplateContent)?.computedFields;
    if (computedFields?.length) {
      this.evaluateComputedFields(batchData, computedFields, enrichedRecords);
    }

    // Gerar PDF
    const buffer = await this.renderBatchPdf(template, batchData, enrichedRecords);

    const fileName = `${template.slug}-lote-${records.length}-registros.pdf`;

    // Upload para GCS na pasta relatorios
    let fileUrl: string | null = null;
    try {
      const uploaded = await this.uploadService.uploadBuffer(
        buffer, fileName, 'application/pdf', targetTenantId, 'relatorios',
      );
      fileUrl = uploaded.publicUrl;
      this.logger.log(`PDF batch enviado para GCS: ${fileUrl}`);
    } catch (error) {
      this.logger.error('Erro ao enviar PDF batch para GCS:', error);
    }

    // Registrar geracao
    await this.prisma.pdfGeneration.create({
      data: {
        tenantId: targetTenantId,
        templateId,
        status: PdfGenerationStatus.COMPLETED,
        progress: 100,
        recordIds,
        fileUrl,
        fileName,
        fileSize: buffer.length,
        requestedById: currentUser.id,
        completedAt: new Date(),
      },
    });

    return { buffer, fileName };
  }

  /**
   * Gera preview do PDF com dados de exemplo
   */
  async preview(
    templateId: string,
    currentUser: CurrentUser,
    dto: PreviewPdfDto,
    tenantId?: string,
  ): Promise<Buffer> {
    const targetTenantId = getEffectiveTenantId(currentUser, tenantId);

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
        const baseData = {
          ...(record.data as Record<string, unknown>),
          id: record.id,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        };
        data = await this.enrichDataWithSubEntities(
          baseData,
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

    // Se forneceu content override, usar em vez do conteudo salvo no banco
    const templateForRender = dto.content
      ? { ...template, content: dto.content as any }
      : template;

    // Avaliar campos calculados
    const previewContent = (templateForRender.content as unknown as PdfTemplateContent);
    if (previewContent?.computedFields?.length) {
      this.evaluateComputedFields(data, previewContent.computedFields);
    }

    return this.renderPdf(templateForRender, data);
  }

  /**
   * Lista historico de geracoes
   */
  async getGenerations(currentUser: CurrentUser, query: QueryPdfGenerationDto) {
    const targetTenantId = getEffectiveTenantId(currentUser, query.tenantId);
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
  async getGeneration(id: string, currentUser: CurrentUser, tenantId?: string): Promise<PdfGeneration> {
    const targetTenantId = getEffectiveTenantId(currentUser, tenantId);

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
   * Renderiza PDF em lote (relatorio agregado com todos os registros)
   * Renderiza elementos normais com dados agregados, e para cada item
   * renderiza os elementos que estao dentro do marcador _repeat
   */
  private async renderBatchPdf(
    template: PdfTemplate,
    batchData: Record<string, unknown>,
    allRecords: Record<string, unknown>[],
  ): Promise<Buffer> {
    const margins = template.margins as unknown as PdfMargins || {
      top: 70, right: 70, bottom: 70, left: 70,
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

    // Pre-fetch logo para uso sincrono em paginas seguintes
    let logoBuffer: Buffer | null = null;
    const logoUrl = content.header?.logo?.url || template.logoUrl;
    if (logoUrl) {
      try {
        const resolvedUrl = this.resolveBindings(String(logoUrl), batchData);
        if (resolvedUrl && !resolvedUrl.includes('{{')) {
          logoBuffer = await this.fetchImageBuffer(resolvedUrl);
        }
      } catch (err) {
        this.logger.warn(`Falha ao pre-fetch logo: ${(err as Error).message}`);
      }
    }

    const logoWidth = content.header?.logo?.width || 80;
    const logoHeight = content.header?.logo?.height || 67;

    // Helper: renderiza apenas o logo (sincrono, para paginas de continuacao)
    const renderLogoOnly = () => {
      if (logoBuffer) {
        const logoX = (doc.page.width - logoWidth) / 2;
        doc.image(logoBuffer, logoX, margins.top, { fit: [logoWidth, logoHeight] });
        doc.y = margins.top + logoHeight + 10;
      }
    };

    // Renderizar header completo na primeira pagina
    if (content.header) {
      await this.renderHeader(doc, content.header, batchData, template.logoUrl);
    }

    // NAO usar pageAdded event (problemas com async) - renderizar manualmente

    // Separar elementos: normais vs repeat (por item)
    const normalElements: PdfElement[] = [];
    const repeatElements: PdfElement[] = [];
    let inRepeatSection = false;

    for (const element of content.body || []) {
      if (element.type === 'text' && (element as TextElement).content === '_repeat_start') {
        inRepeatSection = true;
        continue;
      }
      if (element.type === 'text' && (element as TextElement).content === '_repeat_end') {
        inRepeatSection = false;
        continue;
      }

      if (inRepeatSection) {
        repeatElements.push(element);
      } else {
        normalElements.push(element);
      }
    }

    // Renderizar elementos normais (estatisticas, headers, etc)
    for (const element of normalElements) {
      await this.renderElement(doc, element, batchData);
    }

    // Renderizar secao repetida para cada registro com sub-entidades (avariados)
    if (repeatElements.length > 0) {
      const recordsWithSubEntities = allRecords.filter((record) =>
        Object.values(record).some((v) => Array.isArray(v) && v.length > 0),
      );

      // Encontrar titulo da secao 4 e elemento image-grid nos repeatElements
      const sectionTitle = normalElements.find(
        (el) => el.type === 'text' && (el as TextElement).content?.includes('IMAGENS'),
      ) as TextElement | undefined;

      for (let recIdx = 0; recIdx < recordsWithSubEntities.length; recIdx++) {
        const record = recordsWithSubEntities[recIdx];
        const isFirstVehicle = recIdx === 0;

        // Renderizar cada elemento repeat com dados do registro
        for (const element of repeatElements) {
          // Para image-grid, passar callback de page break
          if (element.type === 'image-grid') {
            const imgGrid = element as ImageGridElement;
            const imageWidth = imgGrid.imageWidth || 90;
            const imageHeight = imgGrid.imageHeight || 76;
            const columnWidth = (doc.page.width - margins.left - margins.right) / imgGrid.columns;

            if (isFirstVehicle && element.marginTop) doc.y += element.marginTop;

            // Titulo do grid apenas no primeiro veiculo
            if (isFirstVehicle && imgGrid.title) {
              doc.font('Helvetica-Bold').fontSize(10).text(imgGrid.title, { align: 'center' });
              doc.moveDown(0.5);
            }

            // Renderizar mixed grid com callback de page break (continuo)
            await this.renderMixedImageGridBatch(
              doc, imgGrid, record, imageWidth, imageHeight, columnWidth,
              renderLogoOnly, sectionTitle, isFirstVehicle,
            );

            if (element.marginBottom) doc.y += element.marginBottom;
          } else {
            // Outros elementos repeat apenas no primeiro veiculo
            if (isFirstVehicle) {
              await this.renderElement(doc, element, record);
            }
          }
        }
      }
    }

    doc.end();

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
      const logoHeight = header?.logo?.height || 60;
      const position = header?.logo?.position || 'left';

      let logoX = doc.page.margins.left;
      if (position === 'center') {
        logoX = (doc.page.width - logoWidth) / 2;
      } else if (position === 'right') {
        logoX = doc.page.width - doc.page.margins.right - logoWidth;
      }

      // Resolver bindings na URL (ex: {{tenant.logo}})
      const resolvedUrl = this.resolveBindings(String(logoUrl), data);

      if (resolvedUrl && !resolvedUrl.includes('{{')) {
        try {
          const buffer = await this.fetchImageBuffer(resolvedUrl);
          doc.image(buffer, logoX, startY, {
            fit: [logoWidth, logoHeight],
          });
          doc.y = startY + logoHeight;
        } catch (err) {
          this.logger.warn(`Falha ao carregar logo: ${(err as Error).message}`);
          doc.y = startY + logoHeight;
        }
      } else {
        doc.y = startY + logoHeight;
      }
    }

    // Renderizar titulo
    if (header?.title?.text) {
      const titleText = this.resolveBindings(header.title.text, data);
      doc
        .font(header.title.bold !== false ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(header.title.fontSize || 14)
        .text(titleText, {
          align: (header.title as Record<string, unknown>)?.align as string || 'center',
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

    // Linha divisoria (opcional, default true)
    if (header?.showDivider !== false) {
      doc.moveDown(0.5);
      doc
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .strokeColor('#000000')
        .lineWidth(1)
        .stroke();
      doc.moveDown(0.5);
    } else {
      doc.moveDown(0.5);
    }
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

    // Reset PDFKit text state antes de cada elemento
    doc.x = doc.page.margins.left;

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
        await this.renderStatistics(doc, element as StatisticsElement, data);
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
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const font = element.fontWeight === 'bold' ? 'Helvetica-Bold' : 'Helvetica';
    const fontSize = element.fontSize || 10;

    doc.font(font).fontSize(fontSize).fillColor(element.color || '#000000');

    // Calcular posicao manualmente para evitar bugs do LineWrapper do PDFKit
    const align = element.align || 'left';
    if (align === 'center') {
      const textWidth = doc.widthOfString(text);
      const x = doc.page.margins.left + (pageWidth - textWidth) / 2;
      doc.text(text, x, doc.y, { lineBreak: false });
    } else if (align === 'right') {
      const textWidth = doc.widthOfString(text);
      const x = doc.page.margins.left + pageWidth - textWidth;
      doc.text(text, x, doc.y, { lineBreak: false });
    } else {
      doc.text(text, doc.page.margins.left, doc.y, { width: pageWidth });
    }
  }

  /**
   * Renderiza grupo de campos (label: valor)
   * Suporta layouts: horizontal (1 campo por linha), vertical (label em cima, valor embaixo), grid (N colunas)
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

    const labelSize = element.labelFontSize || 10;
    const valueSize = element.valueFontSize || 10;
    const lineSpacing = element.lineSpacing; // undefined = auto
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    if (element.layout === 'grid') {
      // Grid layout: N colunas lado a lado
      const cols = element.columns || 2;
      const colWidth = pageWidth / cols;
      const fields = element.fields;

      for (let i = 0; i < fields.length; i += cols) {
        const currentY = doc.y;
        for (let c = 0; c < cols && i + c < fields.length; c++) {
          const field = fields[i + c];
          const label = field.label;
          const value = this.resolveBindings(field.binding, data);
          const formattedValue = this.formatValue(value, field.format);
          const x = doc.page.margins.left + c * colWidth;

          // Renderizar label em bold e valor em regular como chamadas separadas
          const labelWidth = doc.font(field.labelBold ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(labelSize).widthOfString(label);
          doc.text(label, x, currentY, { width: colWidth, lineBreak: false });
          doc.font('Helvetica').fontSize(valueSize)
            .text(` ${formattedValue}`, x + labelWidth, currentY, { width: colWidth - labelWidth, lineBreak: false });
        }
        doc.y = currentY + (lineSpacing || valueSize + 8);
      }
      // Reset doc.x apos grid
      doc.x = doc.page.margins.left;
    } else if (element.layout === 'horizontal') {
      for (const field of element.fields) {
        const label = field.label;
        const value = this.resolveBindings(field.binding, data);
        const formattedValue = this.formatValue(value, field.format);

        if (lineSpacing) {
          // Posicionamento fixo com lineSpacing
          const currentY = doc.y;
          doc
            .font(field.labelBold ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(labelSize)
            .text(label, doc.page.margins.left, currentY, { continued: true });
          doc
            .font('Helvetica')
            .fontSize(valueSize)
            .text(` ${formattedValue}`);
          doc.y = currentY + lineSpacing;
        } else {
          // Label e valor na mesma linha (auto spacing)
          doc
            .font(field.labelBold ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(labelSize)
            .text(label, { continued: true });
          doc
            .font('Helvetica')
            .fontSize(valueSize)
            .text(` ${formattedValue}`);
        }
      }
    } else {
      // Vertical: label e valor em linhas separadas
      for (const field of element.fields) {
        const label = field.label;
        const value = this.resolveBindings(field.binding, data);
        const formattedValue = this.formatValue(value, field.format);

        doc
          .font(field.labelBold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(labelSize)
          .text(label);
        doc
          .font('Helvetica')
          .fontSize(valueSize)
          .text(formattedValue);
        if (lineSpacing) {
          doc.y += lineSpacing - valueSize;
        } else {
          doc.moveDown(0.3);
        }
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
    } else {
      // Sem dataSource: usar registro principal como linha unica
      rows = [data];
    }

    // Headers no formato pdfkit-table
    const headers = element.columns.map((col) => ({
      label: col.header,
      width: col.width || 100,
      align: 'center' as const,
    }));

    // Linhas de dados (suporta dot notation: ex: _geolocation.lat)
    const tableRows = rows.map((row) =>
      element.columns.map((col) => {
        const value = this.getNestedValue(row, col.field);
        return this.formatValue(value, col.format);
      }),
    );

    if (tableRows.length > 0 || element.showHeader !== false) {
      await doc.table(
        {
          headers,
          rows: tableRows,
        },
        {
          hideHeader: element.showHeader === false,
          padding: 5,
          prepareHeader: () => {
            doc.font('Helvetica-Bold').fontSize(element.headerStyle?.fontSize || 8);
          },
          prepareRow: () => {
            doc.font('Helvetica').fontSize(element.cellStyle?.fontSize || 8);
          },
        },
      );
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

    const imageWidth = element.imageWidth || 90;
    const imageHeight = element.imageHeight || 68;
    const columnWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / element.columns;

    // Modo misto: imagens do pai + imagens dos filhos (ex: foto_chassi, foto_perfil + avarias)
    if (element.parentImageFields?.length && element.imageFields?.length) {
      await this.renderMixedImageGrid(doc, element, data, imageWidth, imageHeight, columnWidth);
      return;
    }

    // Headers das colunas
    if (element.captionFields && element.captionFields.length > 0) {
      doc.font('Helvetica-Bold').fontSize(8);
      let x = doc.page.margins.left;
      for (const caption of element.captionFields) {
        doc.text(caption, x, doc.y, { width: columnWidth, align: 'center' });
        x += columnWidth;
      }
      doc.moveDown(0.5);
    }

    // Obter lista de imagens
    const rawData = data[element.dataSource];
    if (!Array.isArray(rawData) || rawData.length === 0) {
      doc
        .font('Helvetica')
        .fontSize(8)
        .text('Nenhuma imagem disponivel', { align: 'center' });
      return;
    }

    // Extrair URLs: sub-entidade com imageFields ou array simples de URLs
    let imageUrls: string[] = [];
    if (element.imageFields?.length && typeof rawData[0] === 'object') {
      for (const record of rawData) {
        for (const fieldSlug of element.imageFields) {
          const url = (record as Record<string, unknown>)[fieldSlug];
          if (url && typeof url === 'string') {
            imageUrls.push(url);
          }
        }
      }
    } else {
      imageUrls = rawData
        .map((img) => (typeof img === 'string' ? img : (img as Record<string, unknown>)?.url || ''))
        .filter(Boolean) as string[];
    }

    if (imageUrls.length === 0) {
      doc
        .font('Helvetica')
        .fontSize(8)
        .text('Nenhuma imagem disponivel', { align: 'center' });
      return;
    }

    const imageResults = await Promise.allSettled(
      imageUrls.map((url) => (url ? this.fetchImageBuffer(String(url)) : Promise.reject(new Error('URL vazia')))),
    );

    let col = 0;
    let rowY = doc.y;

    for (let i = 0; i < imageResults.length; i++) {
      const x = doc.page.margins.left + col * columnWidth + (columnWidth - imageWidth) / 2;
      const result = imageResults[i];

      if (result.status === 'fulfilled') {
        try {
          doc.image(result.value, x, rowY, {
            fit: [imageWidth, imageHeight],
          });
        } catch {
          // Fallback se PDFKit nao conseguir processar a imagem
          doc.rect(x, rowY, imageWidth, imageHeight).strokeColor('#CCCCCC').stroke();
          doc.font('Helvetica').fontSize(6).fillColor('#999999')
            .text('[Erro]', x, rowY + imageHeight / 2 - 3, { width: imageWidth, align: 'center' });
        }
      } else {
        // Fallback: imagem nao carregou
        doc.rect(x, rowY, imageWidth, imageHeight).strokeColor('#CCCCCC').stroke();
        doc.font('Helvetica').fontSize(6).fillColor('#999999')
          .text('[Erro]', x, rowY + imageHeight / 2 - 3, { width: imageWidth, align: 'center' });
      }

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

    // Resetar fillColor para preto
    doc.fillColor('#000000');
    doc.y = rowY + imageHeight + 10;
  }

  /**
   * Renderiza grid misto: imagens do registro pai nas primeiras colunas + imagens de sub-entidades
   * Layout: Linha 1: [pai_img1, pai_img2, filho1_img1, filho1_img2]
   *         Linha 2: [vazio,    vazio,    filho2_img1, filho2_img2]
   * Segue layout da referencia: celulas 112.5x100pt, imagens 90x76pt centradas, captions 7pt
   */
  private async renderMixedImageGrid(
    doc: typeof PDFDocument,
    element: ImageGridElement,
    data: Record<string, unknown>,
    imageWidth: number,
    imageHeight: number,
    columnWidth: number,
  ): Promise<void> {
    const parentFields = element.parentImageFields || [];
    const childFields = element.imageFields || [];
    const childCols = childFields.length;
    const parentCols = parentFields.length;
    const cellHeight = element.cellHeight || (imageHeight + 24); // celula = imagem + espaco para caption
    const captionFontSize = element.captionFontSize || 7;
    const captionDataFields = element.captionDataFields;

    // Headers das colunas
    if (element.captionFields && element.captionFields.length > 0) {
      doc.font('Helvetica-Bold').fontSize(8);
      const captionY = doc.y;
      for (let i = 0; i < element.captionFields.length; i++) {
        const x = doc.page.margins.left + i * columnWidth;
        doc.text(element.captionFields[i], x, captionY, { width: columnWidth, align: 'center' });
      }
      doc.y = captionY + 20; // Mesma altura de header row da referencia
    }

    // Obter sub-entidade
    const rawData = data[element.dataSource];
    const childRecords = Array.isArray(rawData) ? rawData as Record<string, unknown>[] : [];

    if (childRecords.length === 0) {
      const parentUrls = parentFields.map((f) => data[f] as string).filter(Boolean);
      if (parentUrls.length === 0) {
        doc.font('Helvetica').fontSize(8).text('Nenhuma imagem disponivel', { align: 'center' });
        return;
      }
      const results = await Promise.allSettled(parentUrls.map((url) => this.fetchImageBuffer(url)));
      const rowY = doc.y;
      for (let i = 0; i < results.length; i++) {
        const x = doc.page.margins.left + i * columnWidth + (columnWidth - imageWidth) / 2;
        this.placeImage(doc, results[i], x, rowY, imageWidth, imageHeight);
      }
      doc.fillColor('#000000');
      doc.y = rowY + cellHeight;
      return;
    }

    // Pre-fetch todas as imagens
    const parentResults = await Promise.allSettled(
      parentFields.map((f) => {
        const url = data[f] as string;
        return url ? this.fetchImageBuffer(url) : Promise.reject(new Error('Sem URL'));
      }),
    );

    const allChildResults: PromiseSettledResult<Buffer>[][] = [];
    for (const childRecord of childRecords) {
      const results = await Promise.allSettled(
        childFields.map((f) => {
          const url = childRecord[f] as string;
          return url ? this.fetchImageBuffer(url) : Promise.reject(new Error('Sem URL'));
        }),
      );
      allChildResults.push(results);
    }

    let rowY = doc.y;

    for (let rowIdx = 0; rowIdx < childRecords.length; rowIdx++) {
      // Verificar quebra de pagina
      if (rowY + cellHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        rowY = doc.y;
      }

      // Imagens do pai (apenas na primeira linha)
      if (rowIdx === 0) {
        for (let i = 0; i < parentCols; i++) {
          const x = doc.page.margins.left + i * columnWidth + (columnWidth - imageWidth) / 2;
          this.placeImage(doc, parentResults[i], x, rowY, imageWidth, imageHeight);
        }
        // Captions dos campos do pai
        if (captionDataFields && captionDataFields.length >= parentCols) {
          doc.font('Helvetica').fontSize(captionFontSize).fillColor('#000000');
          for (let i = 0; i < parentCols; i++) {
            const captionValue = String(data[captionDataFields[i]] || '');
            const x = doc.page.margins.left + i * columnWidth;
            doc.text(captionValue, x, rowY + imageHeight + 2, { width: columnWidth, align: 'center' });
          }
        }
      }

      // Imagens do filho
      const childResults = allChildResults[rowIdx];
      const childRecord = childRecords[rowIdx];
      for (let i = 0; i < childCols; i++) {
        const colIdx = parentCols + i;
        const x = doc.page.margins.left + colIdx * columnWidth + (columnWidth - imageWidth) / 2;
        this.placeImage(doc, childResults[i], x, rowY, imageWidth, imageHeight);
      }

      // Captions dos campos do filho
      if (captionDataFields && captionDataFields.length > parentCols) {
        doc.font('Helvetica').fontSize(captionFontSize).fillColor('#000000');
        for (let i = 0; i < childCols; i++) {
          const colIdx = parentCols + i;
          const fieldName = captionDataFields[colIdx];
          if (fieldName) {
            const captionValue = String(childRecord[fieldName] || '');
            const x = doc.page.margins.left + colIdx * columnWidth;
            doc.text(captionValue, x, rowY + imageHeight + 2, { width: columnWidth, align: 'center' });
          }
        }
      }

      rowY += cellHeight;
    }

    doc.fillColor('#000000');
    doc.y = rowY;
  }

  /**
   * Versao batch do renderMixedImageGrid que gerencia page breaks corretamente
   * Renderiza logo + titulo da secao + column headers apos cada page break
   */
  private async renderMixedImageGridBatch(
    doc: typeof PDFDocument,
    element: ImageGridElement,
    data: Record<string, unknown>,
    imageWidth: number,
    imageHeight: number,
    columnWidth: number,
    renderLogoOnly: () => void,
    sectionTitle?: TextElement,
    isFirstVehicle = true,
  ): Promise<void> {
    const parentFields = element.parentImageFields || [];
    const childFields = element.imageFields || [];
    const childCols = childFields.length;
    const parentCols = parentFields.length;
    const cellHeight = element.cellHeight || (imageHeight + 24);
    const captionFontSize = element.captionFontSize || 7;
    const captionDataFields = element.captionDataFields;

    // Helper: renderiza column headers do grid
    const renderColumnHeaders = () => {
      if (element.captionFields && element.captionFields.length > 0) {
        doc.font('Helvetica-Bold').fontSize(8);
        const captionY = doc.y;
        for (let i = 0; i < element.captionFields.length; i++) {
          const x = doc.page.margins.left + i * columnWidth;
          doc.text(element.captionFields[i], x, captionY, { width: columnWidth, align: 'center' });
        }
        doc.y = captionY + 20;
      }
    };

    // Helper: page break com logo + titulo + headers
    const handlePageBreak = () => {
      doc.addPage();
      renderLogoOnly();
      if (sectionTitle) {
        this.renderText(doc, sectionTitle, data);
        if (sectionTitle.marginBottom) doc.y += sectionTitle.marginBottom;
      }
      renderColumnHeaders();
    };

    // Renderizar column headers apenas no primeiro veiculo (page breaks re-renderizam)
    if (isFirstVehicle) {
      renderColumnHeaders();
    }

    const rawData = data[element.dataSource];
    const childRecords = Array.isArray(rawData) ? rawData as Record<string, unknown>[] : [];

    if (childRecords.length === 0) {
      const parentUrls = parentFields.map((f) => data[f] as string).filter(Boolean);
      if (parentUrls.length === 0) {
        return;
      }
      // Page break check antes de renderizar imagens do pai
      if (doc.y + cellHeight > doc.page.height - doc.page.margins.bottom) {
        handlePageBreak();
      }
      const results = await Promise.allSettled(parentUrls.map((url) => this.fetchImageBuffer(url)));
      const rowY = doc.y;
      for (let i = 0; i < results.length; i++) {
        const x = doc.page.margins.left + i * columnWidth + (columnWidth - imageWidth) / 2;
        this.placeImage(doc, results[i], x, rowY, imageWidth, imageHeight);
      }
      doc.fillColor('#000000');
      doc.y = rowY + cellHeight;
      return;
    }

    // Pre-fetch imagens
    const parentResults = await Promise.allSettled(
      parentFields.map((f) => {
        const url = data[f] as string;
        return url ? this.fetchImageBuffer(url) : Promise.reject(new Error('Sem URL'));
      }),
    );

    const allChildResults: PromiseSettledResult<Buffer>[][] = [];
    for (const childRecord of childRecords) {
      const results = await Promise.allSettled(
        childFields.map((f) => {
          const url = childRecord[f] as string;
          return url ? this.fetchImageBuffer(url) : Promise.reject(new Error('Sem URL'));
        }),
      );
      allChildResults.push(results);
    }

    let rowY = doc.y;

    for (let rowIdx = 0; rowIdx < childRecords.length; rowIdx++) {
      // Verificar quebra de pagina
      if (rowY + cellHeight > doc.page.height - doc.page.margins.bottom) {
        handlePageBreak();
        rowY = doc.y;
      }

      // Imagens do pai (apenas na primeira linha)
      if (rowIdx === 0) {
        for (let i = 0; i < parentCols; i++) {
          const x = doc.page.margins.left + i * columnWidth + (columnWidth - imageWidth) / 2;
          this.placeImage(doc, parentResults[i], x, rowY, imageWidth, imageHeight);
        }
        // Captions do pai
        if (captionDataFields && captionDataFields.length >= parentCols) {
          doc.font('Helvetica').fontSize(captionFontSize).fillColor('#000000');
          for (let i = 0; i < parentCols; i++) {
            const captionValue = String(data[captionDataFields[i]] || '');
            const x = doc.page.margins.left + i * columnWidth;
            doc.text(captionValue, x, rowY + imageHeight + 2, { width: columnWidth, align: 'center' });
          }
        }
      }

      // Imagens do filho
      const childResults = allChildResults[rowIdx];
      const childRecord = childRecords[rowIdx];
      for (let i = 0; i < childCols; i++) {
        const colIdx = parentCols + i;
        const x = doc.page.margins.left + colIdx * columnWidth + (columnWidth - imageWidth) / 2;
        this.placeImage(doc, childResults[i], x, rowY, imageWidth, imageHeight);
      }

      // Captions do filho
      if (captionDataFields && captionDataFields.length > parentCols) {
        doc.font('Helvetica').fontSize(captionFontSize).fillColor('#000000');
        for (let i = 0; i < childCols; i++) {
          const colIdx = parentCols + i;
          const fieldName = captionDataFields[colIdx];
          if (fieldName) {
            const captionValue = String(childRecord[fieldName] || '');
            const x = doc.page.margins.left + colIdx * columnWidth;
            doc.text(captionValue, x, rowY + imageHeight + 2, { width: columnWidth, align: 'center' });
          }
        }
      }

      rowY += cellHeight;
    }

    doc.fillColor('#000000');
    doc.y = rowY;
  }

  /**
   * Helper para colocar imagem ou fallback em posicao especifica
   */
  private placeImage(
    doc: typeof PDFDocument,
    result: PromiseSettledResult<Buffer>,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    if (result.status === 'fulfilled') {
      try {
        doc.image(result.value, x, y, { fit: [width, height] });
        return;
      } catch {
        // Fall through to fallback
      }
    }
    doc.rect(x, y, width, height).strokeColor('#CCCCCC').stroke();
    doc.font('Helvetica').fontSize(6).fillColor('#999999')
      .text('[Erro]', x, y + height / 2 - 3, { width, align: 'center' });
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
  private async renderStatistics(
    doc: typeof PDFDocument,
    element: StatisticsElement,
    data: Record<string, unknown>,
  ): Promise<void> {
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
    const groups = new Map<string, {
      total: number;
      damaged: number;
      fieldSums: Record<string, number>;
      fieldCounts: Record<string, number>;
    }>();

    for (const item of items) {
      const key = element.groupBy.map((field) => item[field] || 'N/A').join(' | ');

      if (!groups.has(key)) {
        groups.set(key, { total: 0, damaged: 0, fieldSums: {}, fieldCounts: {} });
      }

      const group = groups.get(key)!;
      group.total++;

      // Verificar se tem nao-conformidades (busca qualquer array de sub-entidade)
      const hasSubEntityData = Object.values(item).some(
        (v) => Array.isArray(v) && v.length > 0,
      );
      if (hasSubEntityData) {
        group.damaged++;
      }

      // Acumular somas para campos numericos (sum/avg)
      for (const metric of element.metrics) {
        if (metric.aggregation === 'sum' || metric.aggregation === 'avg') {
          const val = Number(item[metric.field]);
          if (!isNaN(val)) {
            group.fieldSums[metric.field] = (group.fieldSums[metric.field] || 0) + val;
            group.fieldCounts[metric.field] = (group.fieldCounts[metric.field] || 0) + 1;
          }
        }
      }
    }

    // Renderizar tabela de estatisticas manualmente (controle total de largura)
    const capitalizedGroupBy = element.groupBy.map((g) =>
      g.charAt(0).toUpperCase() + g.slice(1),
    );
    const statsHeaders = [...capitalizedGroupBy, ...element.metrics.map((m) => m.label)];
    const numCols = statsHeaders.length;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const rowHeight = element.rowHeight || 20;

    // Calcular larguras de coluna
    let colWidths: number[];
    if (element.columnWidths?.length === numCols) {
      const totalCustom = element.columnWidths.reduce((a, b) => a + b, 0);
      if (totalCustom > pageWidth) {
        const scale = pageWidth / totalCustom;
        colWidths = element.columnWidths.map((w) => Math.floor(w * scale));
      } else {
        colWidths = element.columnWidths;
      }
    } else {
      colWidths = statsHeaders.map(() => Math.floor(pageWidth / numCols));
    }

    // Construir dados
    const rows: string[][] = [];
    for (const [key, stats] of groups) {
      const row = key.split(' | ');
      for (const metric of element.metrics) {
        if (metric.aggregation === 'count') {
          row.push(String(stats.total));
        } else if (metric.aggregation === 'percentage') {
          const pct = stats.total > 0 ? ((stats.damaged / stats.total) * 100).toFixed(2) : '0.00';
          row.push(`${pct}%`);
        } else if (metric.aggregation === 'sum') {
          // Campo especial _damaged: conta itens avariados no grupo
          if (metric.field === '_damaged') {
            row.push(String(stats.damaged));
          } else {
            const sum = stats.fieldSums[metric.field] || 0;
            row.push(sum % 1 === 0 ? String(sum) : sum.toFixed(2));
          }
        } else if (metric.aggregation === 'avg') {
          const sum = stats.fieldSums[metric.field] || 0;
          const count = stats.fieldCounts[metric.field] || 1;
          const avg = sum / count;
          row.push(avg % 1 === 0 ? String(avg) : avg.toFixed(2));
        } else {
          row.push(String(stats.damaged));
        }
      }
      rows.push(row);
    }

    const startX = doc.page.margins.left;
    let currentY = doc.y;
    const fontSize = 8;
    const textOffsetY = (rowHeight - fontSize) / 2;

    // Header row
    if (element.headerFill && element.headerFill !== null) {
      doc.rect(startX, currentY, pageWidth, rowHeight).fill(element.headerFill);
    }
    doc.font('Helvetica-Bold').fontSize(fontSize).fillColor('#000000');
    let cellX = startX;
    for (let i = 0; i < numCols; i++) {
      doc.text(statsHeaders[i], cellX, currentY + textOffsetY, {
        width: colWidths[i],
        align: 'center',
        lineBreak: false,
      });
      cellX += colWidths[i];
    }
    // Header bottom line
    currentY += rowHeight;
    doc.moveTo(startX, currentY).lineTo(startX + pageWidth, currentY)
      .strokeColor('#000000').lineWidth(0.5).stroke();

    // Data rows
    doc.font('Helvetica').fontSize(fontSize);
    for (const row of rows) {
      cellX = startX;
      for (let i = 0; i < numCols; i++) {
        doc.text(row[i] || '', cellX, currentY + textOffsetY, {
          width: colWidths[i],
          align: 'center',
          lineBreak: false,
        });
        cellX += colWidths[i];
      }
      currentY += rowHeight;
      // Row separator line
      doc.moveTo(startX, currentY).lineTo(startX + pageWidth, currentY)
        .strokeColor('#CCCCCC').lineWidth(0.3).stroke();
    }

    doc.x = doc.page.margins.left;
    doc.y = currentY + 5;
    doc.moveDown(0.5);
  }

  // ================= HELPERS =================

  /**
   * Faz fetch de uma imagem remota e retorna como Buffer
   */
  private fetchImageBuffer(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      const request = client.get(url, { timeout: 10000 }, (res: typeof http.IncomingMessage) => {
        // Seguir redirects
        if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
          return this.fetchImageBuffer(res.headers.location).then(resolve).catch(reject);
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} ao buscar imagem`));
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      });
      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Timeout ao buscar imagem'));
      });
    });
  }

  // =============== Computed Fields ===============

  /**
   * Avalia campos calculados e injeta em data._calc
   */
  private evaluateComputedFields(
    data: Record<string, unknown>,
    computedFields: ComputedField[],
    allRecords?: Record<string, unknown>[],
  ): void {
    const calc: Record<string, unknown> = {};
    // Expose _calc on data immediately so later fields can reference earlier ones
    data._calc = calc;

    for (const cf of computedFields) {
      try {
        switch (cf.type) {
          case 'arithmetic': {
            const config = cf.config as ArithmeticConfig;
            if (!config.operands?.length) break;
            let result = this.resolveOperandValue(config.operands[0], data);
            for (let i = 0; i < (config.operators?.length || 0); i++) {
              const nextVal = this.resolveOperandValue(config.operands[i + 1], data);
              switch (config.operators[i]) {
                case '+': result += nextVal; break;
                case '-': result -= nextVal; break;
                case '*': result *= nextVal; break;
                case '/': result = nextVal !== 0 ? result / nextVal : 0; break;
              }
            }
            calc[cf.slug] = result;
            break;
          }

          case 'conditional': {
            const config = cf.config as ConditionalConfig;
            const fieldValue = this.getNestedValue(data, config.field);
            const matches = this.evaluateCondition(fieldValue, config.operator, config.compareValue);
            const chosen = matches ? config.trueResult : config.falseResult;
            calc[cf.slug] = chosen.type === 'field'
              ? this.getNestedValue(data, chosen.value)
              : chosen.value;
            break;
          }

          case 'filtered-count': {
            const config = cf.config as FilteredCountConfig;
            const items = (allRecords || (data._items as Record<string, unknown>[]) || []);
            // Support new multi-filter format and legacy single-filter
            const filters = config.filters || [{ field: (config as any).field, operator: (config as any).operator, value: (config as any).value }];
            calc[cf.slug] = items.filter((item) => {
              return filters.every((f) => {
                const val = this.getNestedValue(item as Record<string, unknown>, f.field);
                return this.evaluateCondition(val, f.operator, f.value);
              });
            }).length;
            break;
          }

          case 'concat': {
            const config = cf.config as ConcatConfig;
            const parts = (config.parts || []).map((p) =>
              p.type === 'field'
                ? String(this.getNestedValue(data, p.value) ?? '')
                : p.value,
            );
            calc[cf.slug] = parts.filter(Boolean).join(config.separator || '');
            break;
          }
        }
      } catch (err) {
        this.logger.warn(`Erro ao calcular campo ${cf.slug}: ${(err as Error).message}`);
        calc[cf.slug] = '';
      }
    }
  }

  private resolveOperandValue(
    operand: { type: 'field' | 'number'; value: string },
    data: Record<string, unknown>,
  ): number {
    if (!operand) return 0;
    if (operand.type === 'number') return Number(operand.value) || 0;
    return Number(this.getNestedValue(data, operand.value)) || 0;
  }

  private evaluateCondition(
    fieldValue: unknown,
    operator: string,
    compareValue: string,
  ): boolean {
    const strVal = String(fieldValue ?? '');
    const numVal = Number(fieldValue);
    const compNum = Number(compareValue);

    switch (operator) {
      case 'equals': return strVal === compareValue;
      case 'not_equals': return strVal !== compareValue;
      case 'greater': return !isNaN(numVal) && !isNaN(compNum) && numVal > compNum;
      case 'less': return !isNaN(numVal) && !isNaN(compNum) && numVal < compNum;
      case 'contains': return strVal.toLowerCase().includes((compareValue || '').toLowerCase());
      case 'not_empty': return strVal !== '' && fieldValue != null;
      case 'has_items': return Array.isArray(fieldValue) && fieldValue.length > 0;
      case 'no_items': return !Array.isArray(fieldValue) || fieldValue.length === 0;
      default: return false;
    }
  }

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
        return new Date(String(value)).toLocaleString('pt-BR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });

      case 'time':
        return new Date(String(value)).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        });

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

        enrichedData[field.slug] = childRecords.map((r) => ({
          ...(r.data as Record<string, unknown>),
          id: r.id,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        }));
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

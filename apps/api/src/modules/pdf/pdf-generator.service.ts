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
  MapConfig,
  SubEntityAggregateConfig,
  PdfHeader,
  PdfFooter,
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
  private emptyFieldDefault = '';

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
    useAllRecords?: boolean,
    filters?: string,
    search?: string,
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

    // Buscar registros
    let records: { id: string; data: unknown; createdAt: Date; updatedAt: Date; parentRecordId: string | null }[];

    if (useAllRecords) {
      const where: { tenantId: string; entityId?: string; deletedAt: null; parentRecordId: null; AND?: unknown[] } = {
        tenantId: targetTenantId,
        entityId: template.sourceEntityId || undefined,
        deletedAt: null,
        parentRecordId: null,
      };

      if (filters) {
        try {
          const parsed = JSON.parse(filters);
          if (Array.isArray(parsed)) {
            const andClauses: unknown[] = [];
            for (const f of parsed) {
              if (!f.fieldSlug || !f.value) continue;
              andClauses.push({
                data: { path: [f.fieldSlug], string_contains: String(f.value) },
              });
            }
            if (andClauses.length > 0) {
              where.AND = andClauses;
            }
          }
        } catch {
          this.logger.warn('Failed to parse batch filters');
        }
      }

      if (search) {
        if (!where.AND) where.AND = [];
        (where.AND as unknown[]).push({
          OR: [
            { data: { string_contains: search } },
            { data: { string_contains: search.toUpperCase() } },
            { data: { string_contains: search.toLowerCase() } },
          ],
        });
      }

      records = await this.prisma.entityData.findMany({
        where: where as any,
        orderBy: { createdAt: 'asc' },
      });
    } else {
      records = await this.prisma.entityData.findMany({
        where: {
          id: { in: recordIds },
          tenantId: targetTenantId,
          entityId: template.sourceEntityId || undefined,
        },
        orderBy: { createdAt: 'asc' },
      });
    }

    if (records.length === 0) {
      throw new NotFoundException('Nenhum registro encontrado');
    }

    // Enriquecer registros com sub-entidades (batch para performance)
    const fields = template.sourceEntity?.fields as Array<{ slug: string; type: string; subEntityId?: string }> | null;
    const enrichedRecords: Record<string, unknown>[] = [];
    const subEntityFields = (fields || []).filter((f) => f.type === 'sub-entity' && f.subEntityId);

    if (subEntityFields.length > 0) {
      const allRecordIds = records.map((r) => r.id);
      const subData: Record<string, Record<string, unknown>[]> = {};

      for (const subField of subEntityFields) {
        const children = await this.prisma.entityData.findMany({
          where: {
            entityId: subField.subEntityId!,
            parentRecordId: { in: allRecordIds },
            tenantId: targetTenantId,
            deletedAt: null,
          },
          orderBy: { createdAt: 'asc' },
        });
        for (const child of children) {
          const key = `${child.parentRecordId}_${subField.slug}`;
          if (!subData[key]) subData[key] = [];
          subData[key].push({
            ...(child.data as Record<string, unknown>),
            id: child.id,
            createdAt: child.createdAt,
            updatedAt: child.updatedAt,
          });
        }
      }

      for (const record of records) {
        const enriched: Record<string, unknown> = {
          ...(record.data as Record<string, unknown>),
          id: record.id,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        };
        for (const subField of subEntityFields) {
          enriched[subField.slug] = subData[`${record.id}_${subField.slug}`] || [];
        }
        enrichedRecords.push(enriched);
      }
    } else {
      for (const record of records) {
        enrichedRecords.push({
          ...(record.data as Record<string, unknown>),
          id: record.id,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        });
      }
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
    const finalRecordIds = useAllRecords ? records.map((r) => r.id) : recordIds;
    await this.prisma.pdfGeneration.create({
      data: {
        tenantId: targetTenantId,
        templateId,
        status: PdfGenerationStatus.COMPLETED,
        progress: 100,
        recordIds: finalRecordIds,
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

    const hasFooter = !!(template.content as any)?.footer;
    const doc = new PDFDocument({
      size: template.pageSize,
      layout: template.orientation.toLowerCase(),
      margins,
      compress: true,
      ...(hasFooter && { bufferPages: true }),
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const content = template.content as unknown as PdfTemplateContent || { body: [] };

    // Configurar valor padrao para campos vazios
    this.emptyFieldDefault = content.settings?.emptyFieldDefault || '';

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

    // Renderizar footer em todas as paginas
    if (content.footer) {
      this.renderFooterOnAllPages(doc, content.footer);
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

    const hasFooter = !!(template.content as any)?.footer;
    const doc = new PDFDocument({
      size: template.pageSize,
      layout: template.orientation.toLowerCase(),
      margins,
      compress: true,
      ...(hasFooter && { bufferPages: true }),
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const content = template.content as unknown as PdfTemplateContent || { body: [] };

    // Configurar valor padrao para campos vazios
    this.emptyFieldDefault = content.settings?.emptyFieldDefault || '';

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

    // NAO usar pageAdded event (problemas com async) - renderizar manualmente

    // Separar elementos: normais vs repeat (por item)
    const normalElements: PdfElement[] = [];
    const repeatElements: PdfElement[] = [];
    const hasRepeatProperty = (content.body || []).some((el) => el.repeatPerRecord);

    if (hasRepeatProperty) {
      // Nova abordagem: propriedade repeatPerRecord
      for (const element of content.body || []) {
        (element.repeatPerRecord ? repeatElements : normalElements).push(element);
      }
    } else {
      // Legacy: marcadores _repeat_start / _repeat_end
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
        (inRepeatSection ? repeatElements : normalElements).push(element);
      }
    }

    // Template "single" usado via batch: cada registro gera o template completo em pagina separada
    const isSingleTemplate = template.templateType === 'single';
    if (isSingleTemplate && repeatElements.length === 0 && normalElements.length > 0) {
      for (let recIdx = 0; recIdx < allRecords.length; recIdx++) {
        if (recIdx > 0) doc.addPage();

        if (content.header) {
          await this.renderHeader(doc, content.header, allRecords[recIdx], template.logoUrl);
        }

        for (const element of normalElements) {
          await this.renderElement(doc, element, allRecords[recIdx]);
        }
      }
    } else {
      // Template "batch": header uma vez, elementos normais com dados agregados, repeat por registro
      if (content.header) {
        await this.renderHeader(doc, content.header, batchData, template.logoUrl);
      }

      // Renderizar elementos normais (estatisticas, headers, etc) uma vez
      for (const element of normalElements) {
        await this.renderElement(doc, element, batchData);
      }

      // Callback para novas paginas: header completo ou so logo
      const onPageAdded = async () => {
        if (content.header?.showOnAllPages) {
          await this.renderHeader(doc, content.header, batchData, template.logoUrl);
        } else {
          renderLogoOnly();
        }
      };

      // Renderizar secao repetida para cada registro
      if (repeatElements.length > 0) {
        const recordsWithSubEntities = allRecords.filter((record) =>
          Object.values(record).some((v) => Array.isArray(v) && v.length > 0),
        );

        for (let recIdx = 0; recIdx < recordsWithSubEntities.length; recIdx++) {
          const record = recordsWithSubEntities[recIdx];
          const isFirstRecord = recIdx === 0;

          // Renderizar cada elemento repeat com dados do registro
          for (const element of repeatElements) {
            if (element.type === 'image-grid') {
              const imgGrid = element as ImageGridElement;
              const imageWidth = imgGrid.imageWidth || 90;
              const imageHeight = imgGrid.imageHeight || 76;
              const columnWidth = (doc.page.width - margins.left - margins.right) / imgGrid.columns;

              if (isFirstRecord && element.marginTop) doc.y += element.marginTop;

              if (isFirstRecord && imgGrid.title) {
                doc.font('Helvetica-Bold').fontSize(10).text(imgGrid.title, { align: 'center' });
                doc.moveDown(0.5);
              }

              await this.renderMixedImageGridBatch(
                doc, imgGrid, record, imageWidth, imageHeight, columnWidth,
                onPageAdded, undefined, isFirstRecord,
              );

              if (element.marginBottom) doc.y += element.marginBottom;
            } else {
              await this.renderElement(doc, element, record);
            }
          }
        }
      }
    }

    // Renderizar footer em todas as paginas
    if (content.footer) {
      this.renderFooterOnAllPages(doc, content.footer);
    }

    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });
  }

  /**
   * Renderiza footer em todas as paginas do documento
   * Requer bufferPages: true no construtor do doc
   */
  private renderFooterOnAllPages(
    doc: typeof PDFDocument,
    footer: PdfFooter,
  ): void {
    const pages = doc.bufferedPageRange();
    const totalPages = pages.count;
    if (totalPages === 0) return;

    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(pages.start + i);

      const left = doc.page.margins.left;
      const pageWidth = doc.page.width - left - doc.page.margins.right;
      const footerY = doc.page.height - doc.page.margins.bottom + 10;

      // Zerar margem inferior temporariamente para PDFKit nao pular pagina
      const savedMarginBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;

      // Linha divisoria
      doc.save();
      doc
        .moveTo(left, footerY - 5)
        .lineTo(left + pageWidth, footerY - 5)
        .lineWidth(0.5)
        .strokeColor('#cccccc')
        .stroke();
      doc.restore();

      doc.font('Helvetica').fontSize(8).fillColor('#666666');

      const pageLabel = `Pagina ${i + 1} de ${totalPages}`;
      const position = footer.position || 'center';
      const hasText = !!footer.text;
      const hasPages = !!footer.showPageNumbers;

      if (hasText || hasPages) {
        if (hasText && hasPages) {
          if (position === 'left') {
            doc.text(footer.text!, left, footerY, { lineBreak: false, width: pageWidth / 2, align: 'left' });
            doc.text(pageLabel, left + pageWidth / 2, footerY, { lineBreak: false, width: pageWidth / 2, align: 'right' });
          } else if (position === 'right') {
            doc.text(pageLabel, left, footerY, { lineBreak: false, width: pageWidth / 2, align: 'left' });
            doc.text(footer.text!, left + pageWidth / 2, footerY, { lineBreak: false, width: pageWidth / 2, align: 'right' });
          } else {
            doc.text(`${footer.text} - ${pageLabel}`, left, footerY, { lineBreak: false, width: pageWidth, align: 'center' });
          }
        } else if (hasText) {
          doc.text(footer.text!, left, footerY, { lineBreak: false, width: pageWidth, align: position });
        } else {
          doc.text(pageLabel, left, footerY, { lineBreak: false, width: pageWidth, align: position });
        }
      }

      // Restaurar margem
      doc.page.margins.bottom = savedMarginBottom;
    }

    // Voltar para ultima pagina para doc.end() funcionar corretamente
    doc.switchToPage(pages.start + totalPages - 1);
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
    // Se tem rows (novo formato flexivel), usar renderizacao flexivel
    if (header?.rows && header.rows.length > 0) {
      await this.renderFlexibleHeader(doc, header, data);
      return;
    }

    // Formato legado (logo, title, subtitle)
    await this.renderLegacyHeader(doc, header, data, defaultLogoUrl);
  }

  /**
   * Renderiza header no formato flexivel (multiplas linhas/elementos)
   */
  private async renderFlexibleHeader(
    doc: typeof PDFDocument,
    header: PdfHeader,
    data: Record<string, unknown>,
  ): Promise<void> {
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    for (const row of header.rows || []) {
      const rowStartY = doc.y;
      let maxRowHeight = 0;

      // Agrupar elementos por posicao
      const leftElements = row.elements.filter((e) => e.position === 'left');
      const centerElements = row.elements.filter((e) => e.position === 'center');
      const rightElements = row.elements.filter((e) => e.position === 'right');

      // Renderizar cada grupo
      for (const element of row.elements) {
        const elementStartY = rowStartY;
        let elementX = doc.page.margins.left;
        let elementWidth = pageWidth;

        if (element.position === 'center') {
          // Centro: calcular posicao baseada no conteudo
          if (element.type === 'image') {
            elementX = (doc.page.width - (element.width || 100)) / 2;
          } else {
            elementX = doc.page.margins.left;
          }
        } else if (element.position === 'right') {
          if (element.type === 'image') {
            elementX = doc.page.width - doc.page.margins.right - (element.width || 100);
          } else {
            elementX = doc.page.margins.left + pageWidth / 2;
            elementWidth = pageWidth / 2;
          }
        } else {
          // Left
          if (leftElements.length > 0 && (centerElements.length > 0 || rightElements.length > 0)) {
            elementWidth = pageWidth / 2;
          }
        }

        if (element.type === 'image' && element.url) {
          const resolvedUrl = this.resolveBindings(element.url, data);
          if (resolvedUrl && !resolvedUrl.includes('{{')) {
            try {
              const buffer = await this.fetchImageBuffer(resolvedUrl);
              doc.image(buffer, elementX, elementStartY, {
                fit: [element.width || 100, element.height || 60],
              });
              maxRowHeight = Math.max(maxRowHeight, element.height || 60);
            } catch (err) {
              this.logger.warn(`Falha ao carregar imagem do header: ${(err as Error).message}`);
              maxRowHeight = Math.max(maxRowHeight, element.height || 60);
            }
          }
        } else if (element.type === 'text' && element.text) {
          const resolvedText = this.resolveBindings(element.text, data);
          const fontSize = element.fontSize || 12;
          const padding = element.padding || 8;

          doc.font(element.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize);

          if (element.hasBorder) {
            // Calcular tamanho do texto para a caixa
            const textWidth = doc.widthOfString(resolvedText);
            const textHeight = doc.heightOfString(resolvedText, { width: elementWidth - padding * 2 });
            const boxWidth = Math.min(textWidth + padding * 2, elementWidth);
            const boxHeight = textHeight + padding * 2;

            let boxX = elementX;
            if (element.position === 'center') {
              boxX = (doc.page.width - boxWidth) / 2;
            } else if (element.position === 'right') {
              boxX = doc.page.width - doc.page.margins.right - boxWidth;
            }

            // Desenhar borda
            doc
              .rect(boxX, elementStartY, boxWidth, boxHeight)
              .strokeColor(element.borderColor || '#000000')
              .lineWidth(1)
              .stroke();

            // Texto dentro da caixa
            doc.fillColor(element.color || '#000000');
            doc.text(resolvedText, boxX + padding, elementStartY + padding, {
              width: boxWidth - padding * 2,
              align: 'center',
            });

            maxRowHeight = Math.max(maxRowHeight, boxHeight);
          } else {
            // Texto sem borda
            const textAlign = element.position === 'center' ? 'center' : element.position === 'right' ? 'right' : 'left';
            doc.fillColor(element.color || '#000000');

            // Calcular altura do texto
            const textHeight = doc.heightOfString(resolvedText, { width: elementWidth });

            doc.text(resolvedText, elementX, elementStartY, {
              width: elementWidth,
              align: textAlign,
            });

            maxRowHeight = Math.max(maxRowHeight, textHeight);
          }
        }
      }

      // Mover para apos a linha
      doc.y = rowStartY + maxRowHeight + (row.marginBottom || 10);
    }

    // Linha divisoria (opcional, default true)
    if (header?.showDivider !== false) {
      doc.moveDown(0.3);
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
   * Renderiza header no formato legado (logo, title, subtitle)
   */
  private async renderLegacyHeader(
    doc: typeof PDFDocument,
    header: PdfTemplateContent['header'],
    data: Record<string, unknown>,
    defaultLogoUrl?: string | null,
  ): Promise<void> {
    const startY = doc.y;

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
    // Verificar visibilidade condicional
    if (element.visibility) {
      const fieldValue = this.getNestedValue(data, element.visibility.field);
      const isVisible = this.evaluateCondition(
        fieldValue,
        element.visibility.operator,
        element.visibility.value || '',
      );
      if (!isVisible) return;
    }

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
          const formattedValue = this.formatValue(value, field.format, field.defaultValue);
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
        const formattedValue = this.formatValue(value, field.format, field.defaultValue);

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
        const formattedValue = this.formatValue(value, field.format, field.defaultValue);

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

    // Aplicar filtros
    if (element.filters?.length) {
      const logic = element.filterLogic || 'and';
      rows = rows.filter((row) => {
        const results = element.filters!.map((f) => {
          const val = this.getNestedValue(row, f.field);
          return this.evaluateCondition(val, f.operator, f.value);
        });
        return logic === 'and'
          ? results.every(Boolean)
          : results.some(Boolean);
      });
    }

    // Aplicar ordenacao
    if (element.sorting?.length) {
      rows = [...rows].sort((a, b) => {
        for (const rule of element.sorting!) {
          const aVal = this.getNestedValue(a, rule.field);
          const bVal = this.getNestedValue(b, rule.field);
          const aNum = Number(aVal);
          const bNum = Number(bVal);
          let cmp: number;
          if (!isNaN(aNum) && !isNaN(bNum)) {
            cmp = aNum - bNum;
          } else {
            cmp = String(aVal ?? '').localeCompare(String(bVal ?? ''), 'pt-BR');
          }
          if (cmp !== 0) return rule.direction === 'desc' ? -cmp : cmp;
        }
        return 0;
      });
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
        return this.formatValue(value, col.format, col.defaultValue);
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
    onPageAdded: () => Promise<void>,
    _unused?: unknown,
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

    // Helper: page break com header + column headers
    const handlePageBreak = async () => {
      doc.addPage();
      await onPageAdded();
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
        await handlePageBreak();
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
        await handlePageBreak();
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
      fieldMins: Record<string, number>;
      fieldMaxs: Record<string, number>;
      percentageFilterCounts: Record<string, number>;
    }>();

    for (const item of items) {
      const key = element.groupBy.map((field) => item[field] || 'N/A').join(' | ');

      if (!groups.has(key)) {
        groups.set(key, {
          total: 0, damaged: 0,
          fieldSums: {}, fieldCounts: {},
          fieldMins: {}, fieldMaxs: {},
          percentageFilterCounts: {},
        });
      }

      const group = groups.get(key)!;
      group.total++;

      // Verificar se tem sub-entidade (fallback para percentage sem filtro)
      const hasSubEntityData = Object.values(item).some(
        (v) => Array.isArray(v) && v.length > 0,
      );
      if (hasSubEntityData) {
        group.damaged++;
      }

      // Acumular valores para campos numericos (sum/avg/min/max)
      for (const metric of element.metrics) {
        if (['sum', 'avg', 'min', 'max'].includes(metric.aggregation)) {
          const val = Number(this.getNestedValue(item, metric.field));
          if (!isNaN(val)) {
            group.fieldSums[metric.field] = (group.fieldSums[metric.field] || 0) + val;
            group.fieldCounts[metric.field] = (group.fieldCounts[metric.field] || 0) + 1;
            if (group.fieldMins[metric.field] === undefined || val < group.fieldMins[metric.field]) {
              group.fieldMins[metric.field] = val;
            }
            if (group.fieldMaxs[metric.field] === undefined || val > group.fieldMaxs[metric.field]) {
              group.fieldMaxs[metric.field] = val;
            }
          }
        }

        // Contagem para percentageFilter
        if (metric.aggregation === 'percentage' && metric.percentageFilter) {
          const filterKey = `${metric.field}_${metric.label}`;
          const filterVal = this.getNestedValue(item, metric.percentageFilter.field);
          if (this.evaluateCondition(filterVal, metric.percentageFilter.operator, metric.percentageFilter.value)) {
            group.percentageFilterCounts[filterKey] = (group.percentageFilterCounts[filterKey] || 0) + 1;
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
        switch (metric.aggregation) {
          case 'count':
            row.push(String(stats.total));
            break;
          case 'percentage': {
            let matchCount: number;
            if (metric.percentageFilter) {
              const filterKey = `${metric.field}_${metric.label}`;
              matchCount = stats.percentageFilterCounts[filterKey] || 0;
            } else {
              matchCount = stats.damaged;
            }
            const pct = stats.total > 0 ? ((matchCount / stats.total) * 100).toFixed(2) : '0.00';
            row.push(`${pct}%`);
            break;
          }
          case 'sum': {
            if (metric.field === '_damaged') {
              row.push(String(stats.damaged));
            } else {
              const sum = stats.fieldSums[metric.field] || 0;
              row.push(sum % 1 === 0 ? String(sum) : sum.toFixed(2));
            }
            break;
          }
          case 'avg': {
            const sum = stats.fieldSums[metric.field] || 0;
            const count = stats.fieldCounts[metric.field] || 1;
            const avg = sum / count;
            row.push(avg % 1 === 0 ? String(avg) : avg.toFixed(2));
            break;
          }
          case 'min': {
            const minVal = stats.fieldMins[metric.field];
            row.push(minVal !== undefined ? (minVal % 1 === 0 ? String(minVal) : minVal.toFixed(2)) : '-');
            break;
          }
          case 'max': {
            const maxVal = stats.fieldMaxs[metric.field];
            row.push(maxVal !== undefined ? (maxVal % 1 === 0 ? String(maxVal) : maxVal.toFixed(2)) : '-');
            break;
          }
          default:
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

          case 'map': {
            const config = cf.config as MapConfig;
            const rawValue = String(this.getNestedValue(data, config.field) ?? '');
            const mapping = config.mappings.find((m) => m.from === rawValue);
            calc[cf.slug] = mapping ? mapping.to : (config.defaultMapping ?? rawValue);
            break;
          }

          case 'sub-entity-aggregate': {
            const config = cf.config as SubEntityAggregateConfig;
            let items = data[config.subEntityField];
            if (!Array.isArray(items)) { calc[cf.slug] = 0; break; }
            // Aplicar filtros opcionais
            if (config.filters?.length) {
              items = items.filter((item) =>
                config.filters!.every((f) => {
                  const val = this.getNestedValue(item as Record<string, unknown>, f.field);
                  return this.evaluateCondition(val, f.operator, f.value);
                }),
              );
            }
            const arr = items as Record<string, unknown>[];
            switch (config.aggregation) {
              case 'count':
                calc[cf.slug] = arr.length;
                break;
              case 'sum': {
                calc[cf.slug] = arr.reduce((s, item) => s + (Number(this.getNestedValue(item, config.field || '') || 0)), 0);
                break;
              }
              case 'avg': {
                const sum = arr.reduce((s, item) => s + (Number(this.getNestedValue(item, config.field || '') || 0)), 0);
                calc[cf.slug] = arr.length > 0 ? sum / arr.length : 0;
                break;
              }
              case 'min': {
                const vals = arr.map((item) => Number(this.getNestedValue(item, config.field || '') || 0));
                calc[cf.slug] = vals.length > 0 ? Math.min(...vals) : 0;
                break;
              }
              case 'max': {
                const vals = arr.map((item) => Number(this.getNestedValue(item, config.field || '') || 0));
                calc[cf.slug] = vals.length > 0 ? Math.max(...vals) : 0;
                break;
              }
            }
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
  private formatValue(value: unknown, format?: string, defaultValue?: string): string {
    if (value === undefined || value === null || value === '') {
      return defaultValue || this.emptyFieldDefault || '-';
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

      case 'cpf': {
        const cpfDigits = String(value).replace(/\D/g, '').padStart(11, '0');
        return `${cpfDigits.slice(0,3)}.${cpfDigits.slice(3,6)}.${cpfDigits.slice(6,9)}-${cpfDigits.slice(9,11)}`;
      }

      case 'cnpj': {
        const cnpjDigits = String(value).replace(/\D/g, '').padStart(14, '0');
        return `${cnpjDigits.slice(0,2)}.${cnpjDigits.slice(2,5)}.${cnpjDigits.slice(5,8)}/${cnpjDigits.slice(8,12)}-${cnpjDigits.slice(12,14)}`;
      }

      case 'cep': {
        const cepDigits = String(value).replace(/\D/g, '').padStart(8, '0');
        return `${cepDigits.slice(0,5)}-${cepDigits.slice(5,8)}`;
      }

      case 'phone': {
        const phoneDigits = String(value).replace(/\D/g, '');
        if (phoneDigits.length === 11) return `(${phoneDigits.slice(0,2)}) ${phoneDigits.slice(2,7)}-${phoneDigits.slice(7)}`;
        if (phoneDigits.length === 10) return `(${phoneDigits.slice(0,2)}) ${phoneDigits.slice(2,6)}-${phoneDigits.slice(6)}`;
        return String(value);
      }

      case 'boolean': {
        const boolVal = value === true || value === 'true' || value === '1' || value === 1;
        return boolVal ? 'Sim' : 'Nao';
      }

      case 'uppercase':
        return String(value).toUpperCase();

      case 'lowercase':
        return String(value).toLowerCase();

      case 'titlecase':
        return String(value).replace(/\b\w/g, (c) => c.toUpperCase());

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

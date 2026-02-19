import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import type { CurrentUser } from '../../common/types';
import { GeneratePdfDto, GenerateBatchPdfDto, GenerateWithQueryDto } from './dto';
import { PdfQueueService } from './pdf-queue.service';

@Injectable()
export class PdfGenerationService {
  private readonly logger = new Logger(PdfGenerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfQueueService: PdfQueueService,
  ) {}

  /**
   * Cria um registro de geracao de PDF (status: pending)
   * O worker BullMQ pegara e processara
   */
  async requestGeneration(dto: GeneratePdfDto, user: CurrentUser) {
    // Buscar template por ID ou slug
    const template = await this.prisma.pdfTemplate.findFirst({
      where: {
        OR: [
          { id: dto.templateId, tenantId: user.tenantId },
          { id: dto.templateId, isGlobal: true },
          { slug: dto.templateId, tenantId: user.tenantId },
          { slug: dto.templateId, isGlobal: true },
        ],
      },
    });

    if (!template) {
      throw new NotFoundException('Template nao encontrado');
    }

    if (!template.isPublished) {
      throw new BadRequestException('Template nao esta publicado');
    }

    // Se recordId informado, verificar se existe
    if (dto.recordId) {
      const record = await this.prisma.entityData.findFirst({
        where: {
          id: dto.recordId,
          tenantId: user.tenantId,
        },
      });
      if (!record) {
        throw new NotFoundException('Registro nao encontrado');
      }
    }

    // Criar registro de geracao
    const generation = await this.prisma.pdfGeneration.create({
      data: {
        tenantId: user.tenantId,
        templateId: template.id,
        recordId: dto.recordId,
        inputData: (dto.inputData ?? {}) as Prisma.InputJsonValue,
        status: 'pending',
        createdById: user.id,
      },
      include: {
        template: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    // Adicionar job na fila BullMQ
    const jobId = await this.pdfQueueService.addGenerationJob({
      generationId: generation.id,
      tenantId: user.tenantId,
      userId: user.id,
    });

    this.logger.log(`PDF generation job ${jobId} added for generation ${generation.id}`);

    return {
      generationId: generation.id,
      jobId,
      status: generation.status,
      template: generation.template,
      message: 'PDF sendo gerado. Voce sera notificado quando estiver pronto.',
    };
  }

  /**
   * Cria multiplas geracoes de PDF (batch)
   */
  async requestBatchGeneration(dto: GenerateBatchPdfDto, user: CurrentUser) {
    const template = await this.prisma.pdfTemplate.findFirst({
      where: {
        OR: [
          { id: dto.templateId, tenantId: user.tenantId },
          { id: dto.templateId, isGlobal: true },
          { slug: dto.templateId, tenantId: user.tenantId },
          { slug: dto.templateId, isGlobal: true },
        ],
      },
    });

    if (!template) {
      throw new NotFoundException('Template nao encontrado');
    }

    if (!template.isPublished) {
      throw new BadRequestException('Template nao esta publicado');
    }

    // Criar geracoes em batch
    const generations = await Promise.all(
      dto.recordIds.map((recordId) =>
        this.prisma.pdfGeneration.create({
          data: {
            tenantId: user.tenantId,
            templateId: template.id,
            recordId,
            status: 'pending',
            createdById: user.id,
          },
        }),
      ),
    );

    // Adicionar jobs na fila BullMQ em batch
    const jobData = generations.map((g) => ({
      generationId: g.id,
      tenantId: user.tenantId,
      userId: user.id,
    }));

    const jobIds = await this.pdfQueueService.addBatchGenerationJobs(jobData);

    this.logger.log(`${jobIds.length} PDF generation jobs added in batch`);

    return {
      total: generations.length,
      generationIds: generations.map((g) => g.id),
      jobIds,
      message: `${generations.length} PDFs sendo gerados.`,
    };
  }

  /**
   * Gera PDF com query para agregar dados
   */
  async requestGenerationWithQuery(dto: GenerateWithQueryDto, user: CurrentUser) {
    const template = await this.prisma.pdfTemplate.findFirst({
      where: {
        OR: [
          { id: dto.templateId, tenantId: user.tenantId },
          { id: dto.templateId, isGlobal: true },
          { slug: dto.templateId, tenantId: user.tenantId },
          { slug: dto.templateId, isGlobal: true },
        ],
      },
    });

    if (!template) {
      throw new NotFoundException('Template nao encontrado');
    }

    if (!template.isPublished) {
      throw new BadRequestException('Template nao esta publicado');
    }

    // Criar geracao com query nos inputData
    const generation = await this.prisma.pdfGeneration.create({
      data: {
        tenantId: user.tenantId,
        templateId: template.id,
        recordId: dto.recordId,
        inputData: { query: dto.query } as Prisma.InputJsonValue,
        status: 'pending',
        createdById: user.id,
      },
      include: {
        template: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    // Adicionar job na fila BullMQ
    const jobId = await this.pdfQueueService.addGenerationJob({
      generationId: generation.id,
      tenantId: user.tenantId,
      userId: user.id,
    });

    this.logger.log(`PDF generation job ${jobId} added for generation ${generation.id} (with query)`);

    return {
      generationId: generation.id,
      jobId,
      status: generation.status,
      template: generation.template,
      message: 'PDF sendo gerado com dados agregados.',
    };
  }

  /**
   * Busca status de uma geracao
   */
  async getStatus(id: string, user: CurrentUser) {
    const generation = await this.prisma.pdfGeneration.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
      },
      include: {
        template: {
          select: { id: true, name: true, slug: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    if (!generation) {
      throw new NotFoundException('Geracao nao encontrada');
    }

    return generation;
  }

  /**
   * Lista geracoes do usuario
   */
  async findAll(user: CurrentUser, query: { page?: number; limit?: number; status?: string }) {
    const { page = 1, limit = 20, status } = query;

    const where = {
      tenantId: user.tenantId,
      ...(status && { status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.pdfGeneration.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          template: {
            select: { id: true, name: true, slug: true },
          },
          createdBy: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.pdfGeneration.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Busca geracoes de um usuario especifico
   */
  async findByUser(userId: string, tenantId: string, limit = 10) {
    return this.prisma.pdfGeneration.findMany({
      where: {
        tenantId,
        createdById: userId,
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        template: {
          select: { id: true, name: true, slug: true },
        },
      },
    });
  }

  /**
   * Cria registro de geracao SEM adicionar na fila (para geracao sincrona)
   */
  async createGenerationRecord(dto: GeneratePdfDto, user: CurrentUser) {
    // Buscar template por ID ou slug
    const template = await this.prisma.pdfTemplate.findFirst({
      where: {
        OR: [
          { id: dto.templateId, tenantId: user.tenantId },
          { id: dto.templateId, isGlobal: true },
          { slug: dto.templateId, tenantId: user.tenantId },
          { slug: dto.templateId, isGlobal: true },
        ],
      },
    });

    if (!template) {
      throw new NotFoundException('Template nao encontrado');
    }

    // Para geracao sincrona (preview), nao precisa estar publicado
    // if (!template.isPublished) {
    //   throw new BadRequestException('Template nao esta publicado');
    // }

    // Criar registro de geracao
    const generation = await this.prisma.pdfGeneration.create({
      data: {
        tenantId: user.tenantId,
        templateId: template.id,
        recordId: dto.recordId,
        inputData: (dto.inputData ?? {}) as Prisma.InputJsonValue,
        status: 'pending',
        createdById: user.id,
      },
      include: {
        template: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    return generation;
  }

  /**
   * Limpa geracoes expiradas (para job de cleanup)
   */
  async cleanupExpired() {
    const result = await this.prisma.pdfGeneration.deleteMany({
      where: {
        expiresAt: {
          lte: new Date(),
        },
      },
    });

    return { deleted: result.count };
  }

  /**
   * Atualiza status da geracao (usado pelo worker)
   */
  async updateStatus(
    id: string,
    data: {
      status: string;
      fileUrl?: string;
      fileSize?: number;
      pageCount?: number;
      error?: string;
      completedAt?: Date;
      expiresAt?: Date;
    },
  ) {
    return this.prisma.pdfGeneration.update({
      where: { id },
      data,
    });
  }
}

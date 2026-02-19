import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PdfTemplateService } from './pdf-template.service';
import { PdfGenerationService } from './pdf-generation.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { PdfQueueService } from './pdf-queue.service';
import {
  CreatePdfTemplateDto,
  UpdatePdfTemplateDto,
  QueryPdfTemplateDto,
  GeneratePdfDto,
  GenerateBatchPdfDto,
  GenerateWithQueryDto,
} from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';
import { checkModulePermission } from '../../common/utils/check-module-permission';

@ApiTags('PDF')
@Controller('pdf')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PdfController {
  constructor(
    private readonly templateService: PdfTemplateService,
    private readonly generationService: PdfGenerationService,
    private readonly generatorService: PdfGeneratorService,
    private readonly queueService: PdfQueueService,
  ) {}

  // ==================== TEMPLATES ====================

  @Post('templates')
  @ApiOperation({ summary: 'Criar template de PDF' })
  async createTemplate(
    @Body() dto: CreatePdfTemplateDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'pdf', 'canCreate');
    return this.templateService.create(dto, user);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Listar templates de PDF' })
  async findAllTemplates(
    @Query() query: QueryPdfTemplateDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'pdf', 'canRead');
    return this.templateService.findAll(user, query);
  }

  @Get('templates/:id')
  @ApiOperation({ summary: 'Buscar template por ID' })
  async findOneTemplate(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'pdf', 'canRead');
    return this.templateService.findOne(id, user);
  }

  @Get('templates/slug/:slug')
  @ApiOperation({ summary: 'Buscar template por slug' })
  async findTemplateBySlug(
    @Param('slug') slug: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'pdf', 'canRead');
    return this.templateService.findBySlug(slug, user);
  }

  @Get('templates/entity/:entitySlug')
  @ApiOperation({ summary: 'Listar templates disponiveis para uma entidade' })
  async findTemplatesByEntity(
    @Param('entitySlug') entitySlug: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    // Nao precisa checkModulePermission - qualquer usuario pode ver templates publicados
    return this.templateService.findByEntity(entitySlug, user);
  }

  @Patch('templates/:id')
  @ApiOperation({ summary: 'Atualizar template' })
  async updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdatePdfTemplateDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'pdf', 'canUpdate');
    return this.templateService.update(id, dto, user);
  }

  @Patch('templates/:id/publish')
  @ApiOperation({ summary: 'Publicar template' })
  async publishTemplate(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'pdf', 'canPublish');
    return this.templateService.publish(id, user);
  }

  @Patch('templates/:id/unpublish')
  @ApiOperation({ summary: 'Despublicar template' })
  async unpublishTemplate(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'pdf', 'canPublish');
    return this.templateService.unpublish(id, user);
  }

  @Post('templates/:id/duplicate')
  @ApiOperation({ summary: 'Duplicar template' })
  async duplicateTemplate(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'pdf', 'canCreate');
    return this.templateService.duplicate(id, user);
  }

  @Delete('templates/:id')
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Excluir template' })
  async removeTemplate(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'pdf', 'canDelete');
    return this.templateService.remove(id, user);
  }

  // ==================== GENERATION ====================

  @Post('generate')
  @ApiOperation({ summary: 'Gerar PDF (async)' })
  async generatePdf(
    @Body() dto: GeneratePdfDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'pdf', 'canGenerate');
    return this.generationService.requestGeneration(dto, user);
  }

  @Post('generate-batch')
  @ApiOperation({ summary: 'Gerar multiplos PDFs (async)' })
  async generateBatchPdf(
    @Body() dto: GenerateBatchPdfDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'pdf', 'canGenerate');
    return this.generationService.requestBatchGeneration(dto, user);
  }

  @Post('generate-with-query')
  @ApiOperation({ summary: 'Gerar PDF com query de agregacao' })
  async generateWithQuery(
    @Body() dto: GenerateWithQueryDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'pdf', 'canGenerate');
    return this.generationService.requestGenerationWithQuery(dto, user);
  }

  @Get('generations')
  @ApiOperation({ summary: 'Listar geracoes de PDF' })
  async findAllGenerations(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @CurrentUser() user?: CurrentUserType,
  ) {
    return this.generationService.findAll(user!, { page, limit, status });
  }

  @Get('generation/:id')
  @ApiOperation({ summary: 'Status de uma geracao' })
  async getGenerationStatus(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.generationService.getStatus(id, user);
  }

  @Get('generation/:id/download')
  @ApiOperation({ summary: 'Download do PDF gerado' })
  async downloadPdf(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    const generation = await this.generationService.getStatus(id, user);

    if (generation.status !== 'completed') {
      return {
        error: 'PDF ainda nao esta pronto',
        status: generation.status,
      };
    }

    if (!generation.fileUrl) {
      return {
        error: 'URL do arquivo nao disponivel',
      };
    }

    return {
      downloadUrl: generation.fileUrl,
      fileName: `${generation.template.name}.pdf`,
      fileSize: generation.fileSize,
    };
  }

  // ==================== SYNC GENERATION (para testes/preview) ====================

  @Post('generate-sync')
  @ApiOperation({ summary: 'Gerar PDF sincronamente (para testes/preview)' })
  async generatePdfSync(
    @Body() dto: GeneratePdfDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'pdf', 'canGenerate');

    // Criar registro de geracao SEM adicionar na fila
    const generation = await this.generationService.createGenerationRecord(dto, user);

    // Processar imediatamente (sincrono)
    await this.generatorService.processGeneration({
      generationId: generation.id,
      tenantId: user.tenantId,
      userId: user.id,
    });

    // Retornar status atualizado
    return this.generationService.getStatus(generation.id, user);
  }

  @Post('generation/:id/process')
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Processar geracao manualmente (admin)' })
  async processGeneration(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    const generation = await this.generationService.getStatus(id, user);

    if (generation.status !== 'pending') {
      return {
        error: 'Geracao ja foi processada',
        status: generation.status,
      };
    }

    await this.generatorService.processGeneration({
      generationId: id,
      tenantId: user.tenantId,
      userId: user.id,
    });

    return this.generationService.getStatus(id, user);
  }

  // ==================== QUEUE MANAGEMENT (admin) ====================

  @Get('queue/stats')
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Estatisticas da fila de geracao' })
  async getQueueStats() {
    return this.queueService.getQueueStats();
  }

  @Post('queue/clean')
  @Roles('PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Limpar jobs antigos da fila' })
  async cleanQueue(@Query('gracePeriod') gracePeriod?: number) {
    await this.queueService.cleanOldJobs(gracePeriod);
    return { message: 'Jobs antigos removidos' };
  }

  @Post('queue/pause')
  @Roles('PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Pausar fila de geracao' })
  async pauseQueue() {
    await this.queueService.pauseQueue();
    return { message: 'Fila pausada' };
  }

  @Post('queue/resume')
  @Roles('PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Retomar fila de geracao' })
  async resumeQueue() {
    await this.queueService.resumeQueue();
    return { message: 'Fila retomada' };
  }
}

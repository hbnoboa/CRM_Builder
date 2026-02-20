import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProduces } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';
import { checkModulePermission } from '../../common/utils/check-module-permission';

import { PdfTemplateService } from './pdf-template.service';
import { PdfGeneratorService } from './pdf-generator.service';
import {
  CreatePdfTemplateDto,
  UpdatePdfTemplateDto,
  QueryPdfTemplateDto,
  QueryPdfGenerationDto,
  GenerateSinglePdfDto,
  GenerateBatchPdfDto,
  PreviewPdfDto,
} from './dto';

@ApiTags('PDF Templates')
@Controller('pdf-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PdfController {
  constructor(
    private readonly templateService: PdfTemplateService,
    private readonly generatorService: PdfGeneratorService,
  ) {}

  // ================= CRUD DE TEMPLATES =================

  @Post()
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Criar template de PDF' })
  async create(
    @Body() dto: CreatePdfTemplateDto,
    @Query('tenantId') tenantId: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'pdfTemplates', 'canCreate');
    return this.templateService.create({ ...dto, tenantId: tenantId || dto.tenantId }, user);
  }

  @Get()
  @ApiOperation({ summary: 'Listar templates do tenant' })
  async findAll(@Query() query: QueryPdfTemplateDto, @CurrentUser() user: CurrentUserType) {
    checkModulePermission(user, 'pdfTemplates', 'canRead');
    return this.templateService.findAll(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar template por ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    checkModulePermission(user, 'pdfTemplates', 'canRead');
    return this.templateService.findOne(id, user);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Buscar template por slug' })
  async findBySlug(@Param('slug') slug: string, @CurrentUser() user: CurrentUserType) {
    checkModulePermission(user, 'pdfTemplates', 'canRead');
    return this.templateService.findBySlug(slug, user);
  }

  @Patch(':id')
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Atualizar template' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePdfTemplateDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'pdfTemplates', 'canUpdate');
    return this.templateService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Excluir template' })
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    checkModulePermission(user, 'pdfTemplates', 'canDelete');
    return this.templateService.remove(id, user);
  }

  @Post(':id/duplicate')
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Duplicar template' })
  async duplicate(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    checkModulePermission(user, 'pdfTemplates', 'canCreate');
    return this.templateService.duplicate(id, user);
  }

  @Post(':id/publish')
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Publicar template' })
  async publish(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    checkModulePermission(user, 'pdfTemplates', 'canUpdate');
    return this.templateService.publish(id, user);
  }

  @Post(':id/unpublish')
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Despublicar template' })
  async unpublish(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    checkModulePermission(user, 'pdfTemplates', 'canUpdate');
    return this.templateService.unpublish(id, user);
  }

  // ================= GERACAO DE PDF =================

  @Post(':id/generate')
  @ApiOperation({ summary: 'Gerar PDF para um registro especifico' })
  @ApiProduces('application/pdf')
  async generateSingle(
    @Param('id') templateId: string,
    @Body() dto: GenerateSinglePdfDto,
    @CurrentUser() user: CurrentUserType,
    @Res() res: Response,
  ) {
    checkModulePermission(user, 'pdfTemplates', 'canGenerate');

    const { buffer, fileName } = await this.generatorService.generateSingle(
      templateId,
      dto.recordId,
      user,
      dto.overrideData,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  @Post(':id/generate-batch')
  @ApiOperation({ summary: 'Gerar PDFs em lote (assincrono)' })
  async generateBatch(
    @Param('id') templateId: string,
    @Body() dto: GenerateBatchPdfDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'pdfTemplates', 'canGenerateBatch');
    return this.generatorService.generateBatch(templateId, dto.recordIds, user, dto.mergePdfs);
  }

  @Post(':id/preview')
  @ApiOperation({ summary: 'Preview do PDF com dados de exemplo' })
  @ApiProduces('application/pdf')
  async preview(
    @Param('id') templateId: string,
    @Body() dto: PreviewPdfDto,
    @CurrentUser() user: CurrentUserType,
    @Res() res: Response,
  ) {
    checkModulePermission(user, 'pdfTemplates', 'canRead');

    const buffer = await this.generatorService.preview(templateId, user, dto);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="preview.pdf"',
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  // ================= HISTORICO DE GERACOES =================

  @Get('generations')
  @ApiOperation({ summary: 'Listar historico de geracoes' })
  async getGenerations(
    @Query() query: QueryPdfGenerationDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'pdfTemplates', 'canRead');
    return this.generatorService.getGenerations(user, query);
  }

  @Get('generations/:id')
  @ApiOperation({ summary: 'Buscar geracao por ID' })
  async getGeneration(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    checkModulePermission(user, 'pdfTemplates', 'canRead');
    return this.generatorService.getGeneration(id, user);
  }

  @Get('generations/:id/download')
  @ApiOperation({ summary: 'Download do PDF gerado' })
  @ApiProduces('application/pdf', 'application/zip')
  async downloadGeneration(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
    @Res() res: Response,
  ) {
    checkModulePermission(user, 'pdfTemplates', 'canRead');

    const generation = await this.generatorService.getGeneration(id, user);

    if (!generation.fileUrl) {
      res.status(404).json({ message: 'Arquivo nao disponivel' });
      return;
    }

    // Redirecionar para URL do arquivo (GCS)
    res.redirect(generation.fileUrl);
  }
}

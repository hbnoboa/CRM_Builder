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
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProduces } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ModulePermissionGuard } from '../../common/guards/module-permission.guard';
import { RequireModulePermission } from '../../common/decorators/module-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';

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
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
@ApiBearerAuth()
export class PdfController {
  constructor(
    private readonly templateService: PdfTemplateService,
    private readonly generatorService: PdfGeneratorService,
  ) {}

  // ================= CRUD DE TEMPLATES =================

  @Post()
  @RequireModulePermission('templates', 'canCreate', 'pdfTemplates')
  @ApiOperation({ summary: 'Criar template de PDF' })
  async create(
    @Body() dto: CreatePdfTemplateDto,
    @Query('tenantId') tenantId: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.templateService.create({ ...dto, tenantId: tenantId || dto.tenantId }, user);
  }

  @Get()
  @RequireModulePermission('templates', 'canRead', 'pdfTemplates')
  @ApiOperation({ summary: 'Listar templates do tenant' })
  async findAll(@Query() query: QueryPdfTemplateDto, @CurrentUser() user: CurrentUserType) {
    return this.templateService.findAll(user, query);
  }

  @Get(':id')
  @RequireModulePermission('templates', 'canRead', 'pdfTemplates')
  @ApiOperation({ summary: 'Buscar template por ID' })
  async findOne(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.templateService.findOne(id, user, tenantId);
  }

  @Get('slug/:slug')
  @RequireModulePermission('templates', 'canRead', 'pdfTemplates')
  @ApiOperation({ summary: 'Buscar template por slug' })
  async findBySlug(
    @Param('slug') slug: string,
    @Query('tenantId') tenantId: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.templateService.findBySlug(slug, user, tenantId);
  }

  @Patch(':id')
  @RequireModulePermission('templates', 'canUpdate', 'pdfTemplates')
  @ApiOperation({ summary: 'Atualizar template' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePdfTemplateDto,
    @Query('tenantId') tenantId: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.templateService.update(id, { ...dto, tenantId: tenantId || dto.tenantId }, user);
  }

  @Delete(':id')
  @RequireModulePermission('templates', 'canDelete', 'pdfTemplates')
  @ApiOperation({ summary: 'Excluir template' })
  async remove(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.templateService.remove(id, user, tenantId);
  }

  @Post(':id/duplicate')
  @RequireModulePermission('templates', 'canCreate', 'pdfTemplates')
  @ApiOperation({ summary: 'Duplicar template' })
  async duplicate(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.templateService.duplicate(id, user, tenantId);
  }

  @Post(':id/publish')
  @RequireModulePermission('templates', 'canUpdate', 'pdfTemplates')
  @ApiOperation({ summary: 'Publicar template' })
  async publish(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.templateService.publish(id, user, tenantId);
  }

  @Post(':id/unpublish')
  @RequireModulePermission('templates', 'canUpdate', 'pdfTemplates')
  @ApiOperation({ summary: 'Despublicar template' })
  async unpublish(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.templateService.unpublish(id, user, tenantId);
  }

  // ================= GERACAO DE PDF =================

  @Post(':id/generate')
  @RequireModulePermission('templates', 'canGenerate', 'pdfTemplates')
  @ApiOperation({ summary: 'Gerar PDF para um registro especifico' })
  @ApiProduces('application/pdf')
  async generateSingle(
    @Param('id') templateId: string,
    @Body() dto: GenerateSinglePdfDto,
    @Query('tenantId') tenantId: string | undefined,
    @CurrentUser() user: CurrentUserType,
    @Res() res: Response,
  ) {
    const { buffer, fileName } = await this.generatorService.generateSingle(
      templateId,
      dto.recordId,
      user,
      dto.overrideData,
      tenantId,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  @Post(':id/generate-batch')
  @RequireModulePermission('templates', 'canGenerate', 'pdfTemplates')
  @ApiOperation({ summary: 'Gerar PDF agregado em lote' })
  @ApiProduces('application/pdf')
  async generateBatch(
    @Param('id') templateId: string,
    @Body() dto: GenerateBatchPdfDto,
    @Query('tenantId') tenantId: string | undefined,
    @CurrentUser() user: CurrentUserType,
    @Res() res: Response,
  ) {
    if (!dto.useAllRecords && (!dto.recordIds || dto.recordIds.length === 0)) {
      throw new BadRequestException('Informe recordIds ou use useAllRecords: true');
    }

    const { buffer, fileName } = await this.generatorService.generateBatch(
      templateId, dto.recordIds || [], user, dto.mergePdfs, tenantId,
      dto.useAllRecords, dto.filters, dto.search,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  @Post(':id/preview')
  @RequireModulePermission('templates', 'canRead', 'pdfTemplates')
  @ApiOperation({ summary: 'Preview do PDF com dados de exemplo' })
  @ApiProduces('application/pdf')
  async preview(
    @Param('id') templateId: string,
    @Body() dto: PreviewPdfDto,
    @Query('tenantId') tenantId: string | undefined,
    @CurrentUser() user: CurrentUserType,
    @Res() res: Response,
  ) {
    const buffer = await this.generatorService.preview(templateId, user, dto, tenantId);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="preview.pdf"',
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  // ================= HISTORICO DE GERACOES =================

  @Get('generations')
  @RequireModulePermission('templates', 'canRead', 'pdfTemplates')
  @ApiOperation({ summary: 'Listar historico de geracoes' })
  async getGenerations(
    @Query() query: QueryPdfGenerationDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.generatorService.getGenerations(user, query);
  }

  @Get('generations/:id')
  @RequireModulePermission('templates', 'canRead', 'pdfTemplates')
  @ApiOperation({ summary: 'Buscar geracao por ID' })
  async getGeneration(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.generatorService.getGeneration(id, user, tenantId);
  }

  @Get('generations/:id/download')
  @RequireModulePermission('templates', 'canRead', 'pdfTemplates')
  @ApiOperation({ summary: 'Download do PDF gerado' })
  @ApiProduces('application/pdf', 'application/zip')
  async downloadGeneration(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string | undefined,
    @CurrentUser() user: CurrentUserType,
    @Res() res: Response,
  ) {
    const generation = await this.generatorService.getGeneration(id, user, tenantId);

    if (!generation.fileUrl) {
      res.status(404).json({ message: 'Arquivo nao disponivel' });
      return;
    }

    // Redirecionar para URL do arquivo (GCS)
    res.redirect(generation.fileUrl);
  }
}

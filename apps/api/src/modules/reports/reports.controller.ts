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
  Res,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';
import { ReportsService, QueryReportDto } from './reports.service';
import { CreateReportDto, UpdateReportDto, ExecuteReportDto } from './dto/report.dto';
import { ExportService } from './export.service';
import { checkModulePermission } from '../../common/utils/check-module-permission';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ReportsController {
  private readonly logger = new Logger(ReportsController.name);

  constructor(
    private readonly reportsService: ReportsService,
    private readonly exportService: ExportService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  @Post()
  @ApiOperation({ summary: 'Criar relatorio' })
  async create(
    @Body() dto: CreateReportDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'reports', 'canCreate');
    this.logger.log(`Criando relatorio: ${dto.name}`);
    return this.reportsService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Listar relatorios' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'visibility', required: false })
  async findAll(
    @Query() query: QueryReportDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'reports', 'canRead');
    return this.reportsService.findAll(user, query);
  }

  @Get('my')
  @ApiOperation({ summary: 'Listar meus relatorios' })
  async findMyReports(
    @Query() query: QueryReportDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'reports', 'canRead');
    return this.reportsService.findAll(user, { ...query, createdById: user.id });
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Listar relatorios para exibir no dashboard' })
  async findDashboardReports(@CurrentUser() user: CurrentUserType) {
    checkModulePermission(user, 'dashboard', 'canRead');
    return this.reportsService.findDashboardReports(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter relatorio por ID' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'reports', 'canRead');
    return this.reportsService.findOne(id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar relatorio' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateReportDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'reports', 'canUpdate');
    return this.reportsService.update(id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Excluir relatorio' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'reports', 'canDelete');
    return this.reportsService.remove(id, user);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicar relatorio' })
  async duplicate(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'reports', 'canCreate');
    return this.reportsService.duplicate(id, user);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Execute & Export
  // ═══════════════════════════════════════════════════════════════════════════

  @Post(':id/execute')
  @ApiOperation({ summary: 'Executar relatorio (buscar dados)' })
  async execute(
    @Param('id') id: string,
    @Body() dto: ExecuteReportDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'reports', 'canRead');
    return this.reportsService.execute(id, user, dto);
  }

  @Get(':id/export')
  @ApiOperation({ summary: 'Exportar relatorio' })
  @ApiQuery({ name: 'format', enum: ['csv', 'xlsx', 'pdf'] })
  async exportReport(
    @Param('id') id: string,
    @Query('format') format: 'csv' | 'xlsx' | 'pdf',
    @CurrentUser() user: CurrentUserType,
    @Res() res: Response,
  ) {
    checkModulePermission(user, 'reports', 'canRead');

    const report = await this.reportsService.findOne(id, user);
    const data = await this.reportsService.execute(id, user);

    let buffer: Buffer;
    let contentType: string;
    let extension: string;

    switch (format) {
      case 'csv':
        buffer = await this.exportService.toCsv(data);
        contentType = 'text/csv';
        extension = 'csv';
        break;
      case 'xlsx':
        buffer = await this.exportService.toExcel(data);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        extension = 'xlsx';
        break;
      case 'pdf':
        buffer = await this.exportService.toPdf(data);
        contentType = 'application/pdf';
        extension = 'pdf';
        break;
      default:
        buffer = await this.exportService.toCsv(data);
        contentType = 'text/csv';
        extension = 'csv';
    }

    const fileName = `${report.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.${extension}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Analytics (Platform Admin)
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('analytics/tenants')
  @Roles('PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Analytics de todos tenants (Platform Admin)' })
  async getTenantAnalytics(@CurrentUser() user: CurrentUserType) {
    return this.reportsService.getTenantAnalytics(user);
  }

  @Get('analytics/entities')
  @ApiOperation({ summary: 'Distribuicao por entidade' })
  @ApiQuery({ name: 'tenantId', required: false })
  async getEntityDistribution(
    @CurrentUser() user: CurrentUserType,
    @Query('tenantId') tenantId?: string,
  ) {
    checkModulePermission(user, 'reports', 'canRead');
    return this.reportsService.getEntityDistribution(user, tenantId);
  }

  @Get('analytics/records-over-time')
  @ApiOperation({ summary: 'Registros ao longo do tempo' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'days', required: false })
  async getRecordsOverTime(
    @CurrentUser() user: CurrentUserType,
    @Query('tenantId') tenantId?: string,
    @Query('days') days?: number,
  ) {
    checkModulePermission(user, 'reports', 'canRead');
    return this.reportsService.getRecordsOverTime(user, tenantId, days || 30);
  }

  @Post('analytics/refresh')
  @Roles('PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Forcar refresh das Materialized Views' })
  async refreshAnalytics(@CurrentUser() user: CurrentUserType) {
    this.logger.log(`Refresh analytics solicitado por ${user.id}`);
    return this.reportsService.refreshAnalytics();
  }
}

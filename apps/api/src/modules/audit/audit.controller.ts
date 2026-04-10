import { Controller, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ModulePermissionGuard } from '../../common/guards/module-permission.guard';
import { RequireModulePermission } from '../../common/decorators/module-permission.decorator';
import { AuditService } from './audit.service';
import { AuditArchiveService } from './audit-archive.service';
import { QueryAuditLogDto, ExportAuditLogDto } from './dto/audit-log.dto';
import { Prisma } from '@prisma/client';

@ApiTags('Audit Logs')
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
@RequireModulePermission('logs', 'canRead', 'auditLogs')
@ApiBearerAuth()
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly archiveService: AuditArchiveService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar audit logs (PLATFORM_ADMIN only)' })
  async findAll(@Query() query: QueryAuditLogDto) {
    return this.auditService.findAll(query);
  }

  @Get('export')
  @ApiOperation({ summary: 'Exportar audit logs como JSON' })
  async exportLogs(@Query() query: ExportAuditLogDto, @Res() res: Response) {
    const where: Prisma.AuditLogWhereInput = {};

    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(query.dateFrom);
      if (query.dateTo) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(query.dateTo);
    }

    const { buffer, count } = await this.auditService.exportRange(where);

    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${dateStr}.json`);
    res.setHeader('X-Total-Count', String(count));
    res.send(buffer);
  }

  // ==========================================
  // Endpoints de Arquivamento e Monitoramento
  // ==========================================

  @Get('stats')
  @ApiOperation({ summary: 'Estatísticas de audit logs (ativos vs arquivados)' })
  async getStats() {
    return this.archiveService.getStats();
  }

  @Post('archive/manual')
  @RequireModulePermission('logs', 'canUpdate', 'auditLogs')
  @ApiOperation({ summary: 'Arquivar logs manualmente (admin)' })
  async manualArchive(@Query('daysOld') daysOld?: string) {
    const days = daysOld ? parseInt(daysOld, 10) : undefined;
    return this.archiveService.manualArchive(days);
  }

  @Post('archive/delete')
  @RequireModulePermission('logs', 'canDelete', 'auditLogs')
  @ApiOperation({ summary: 'Deletar logs arquivados manualmente (admin)' })
  async manualDelete(@Query('daysOld') daysOld?: string) {
    const days = daysOld ? parseInt(daysOld, 10) : undefined;
    return this.archiveService.manualDelete(days);
  }
}

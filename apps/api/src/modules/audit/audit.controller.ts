import { ServiceScope } from '../../common/service-scope/service-scope.decorator';
import { Controller, Get, Post, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ModulePermissionGuard } from '../../common/guards/module-permission.guard';
import { RequireModulePermission } from '../../common/decorators/module-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';
import { AuditService } from './audit.service';
import { AuditArchiveService } from './audit-archive.service';
import { QueryAuditLogDto, ExportAuditLogDto } from './dto/audit-log.dto';
import { Prisma } from '@prisma/client';

@ApiTags('Audit Logs')
@ServiceScope('admin')
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
  @ApiOperation({ summary: 'Listar audit logs do tenant atual' })
  async findAll(@Query() query: QueryAuditLogDto, @CurrentUser() user: CurrentUserType) {
    return this.auditService.findAll(user.tenantId, query);
  }

  @Get('export')
  @ApiOperation({ summary: 'Exportar audit logs do tenant atual como JSON' })
  async exportLogs(
    @Query() query: ExportAuditLogDto,
    @CurrentUser() user: CurrentUserType,
    @Res() res: Response,
  ) {
    // Sempre escopado ao tenant do caller (query.tenantId nao existe mais).
    const where: Prisma.AuditLogWhereInput = { tenantId: user.tenantId };

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
  @ApiOperation({ summary: 'Estatísticas de audit logs do tenant atual (ativos vs arquivados)' })
  async getStats(@CurrentUser() user: CurrentUserType) {
    return this.archiveService.getStats(user.tenantId);
  }

  @Post(':id/revert')
  @RequireModulePermission('logs', 'canUpdate', 'auditLogs')
  @ApiOperation({ summary: 'Desfazer (revert) uma mutacao auditada de entity_data' })
  async revert(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.auditService.revert(user, id);
  }

  @Post('archive/manual')
  @RequireModulePermission('logs', 'canUpdate', 'auditLogs')
  @ApiOperation({ summary: 'Arquivar logs do tenant atual manualmente (admin)' })
  async manualArchive(@CurrentUser() user: CurrentUserType, @Query('daysOld') daysOld?: string) {
    const days = daysOld ? parseInt(daysOld, 10) : undefined;
    return this.archiveService.manualArchive(user.tenantId, days);
  }

  @Post('archive/delete')
  @RequireModulePermission('logs', 'canDelete', 'auditLogs')
  @ApiOperation({ summary: 'Deletar logs arquivados do tenant atual manualmente (admin)' })
  async manualDelete(@CurrentUser() user: CurrentUserType, @Query('daysOld') daysOld?: string) {
    const days = daysOld ? parseInt(daysOld, 10) : undefined;
    return this.archiveService.manualDelete(user.tenantId, days);
  }
}

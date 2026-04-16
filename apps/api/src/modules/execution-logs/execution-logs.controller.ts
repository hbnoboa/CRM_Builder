import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ExecutionLogsService } from './execution-logs.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ModulePermissionGuard } from '../../common/guards/module-permission.guard';
import { RequireModulePermission } from '../../common/decorators/module-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Execution Logs')
@ApiBearerAuth()
@Controller('execution-logs')
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
export class ExecutionLogsController {
  constructor(private readonly executionLogsService: ExecutionLogsService) {}

  @Get()
  @RequireModulePermission('logs', 'canRead', 'executionLogs')
  @ApiOperation({ summary: 'Lista execucoes de automacoes' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'type', required: false, enum: ['webhook', 'action-chain', 'scheduled-task', 'api-execution'] })
  @ApiQuery({ name: 'status', required: false, enum: ['success', 'error', 'timeout'] })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async findAll(
    @CurrentUser() user: { tenantId: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: 'webhook' | 'action-chain' | 'scheduled-task' | 'api-execution',
    @Query('status') status?: 'success' | 'error' | 'timeout',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.executionLogsService.findAll(user.tenantId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      type,
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('stats')
  @RequireModulePermission('logs', 'canRead', 'executionLogs')
  @ApiOperation({ summary: 'Estatisticas de execucoes' })
  @ApiQuery({ name: 'period', required: false, enum: ['day', 'week', 'month'] })
  async getStats(
    @CurrentUser() user: { tenantId: string },
    @Query('period') period?: 'day' | 'week' | 'month',
  ) {
    return this.executionLogsService.getStats(user.tenantId, period);
  }

  @Get(':type/:id')
  @RequireModulePermission('logs', 'canRead', 'executionLogs')
  @ApiOperation({ summary: 'Detalhes de uma execucao' })
  async findOne(
    @CurrentUser() user: { tenantId: string },
    @Param('type') type: string,
    @Param('id') id: string,
  ) {
    return this.executionLogsService.findOne(user.tenantId, id, type);
  }
}

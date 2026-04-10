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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ModulePermissionGuard } from '../../common/guards/module-permission.guard';
import { RequireModulePermission } from '../../common/decorators/module-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';
import { getEffectiveTenantId } from '../../common/utils/tenant.util';
import { EntityAutomationService } from './entity-automation.service';
import { ExecutionContextService } from './execution-context.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';
import { IsString, IsOptional } from 'class-validator';

class ExecuteManualDto {
  @IsOptional()
  @IsString()
  recordId?: string;

  @IsOptional()
  inputData?: Record<string, unknown>;
}

@ApiTags('Entity Automations')
@ApiBearerAuth()
@Controller('entities/:entityId/automations')
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
export class EntityAutomationController {
  constructor(
    private readonly automationService: EntityAutomationService,
    private readonly executionContextService: ExecutionContextService,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {}

  @Get()
  @RequireModulePermission('automations', 'canRead', 'entityAutomation')
  @ApiOperation({ summary: 'Lista automacoes de uma entidade' })
  async findAll(
    @Param('entityId') entityId: string,
    @CurrentUser() user: CurrentUserType,
    @Query('tenantId') tenantId?: string,
    @Query('isActive') isActive?: string,
    @Query('trigger') trigger?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const effectiveTenantId = getEffectiveTenantId(user, tenantId);
    return this.automationService.findAll(effectiveTenantId, entityId, {
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      trigger,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Get(':id')
  @RequireModulePermission('automations', 'canRead', 'entityAutomation')
  @ApiOperation({ summary: 'Busca automacao por ID' })
  async findOne(
    @Param('entityId') entityId: string,
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
    @Query('tenantId') tenantId?: string,
  ) {
    const effectiveTenantId = getEffectiveTenantId(user, tenantId);
    return this.automationService.findOne(effectiveTenantId, entityId, id);
  }

  @Post()
  @RequireModulePermission('automations', 'canCreate', 'entityAutomation')
  @ApiOperation({ summary: 'Cria nova automacao' })
  async create(
    @Param('entityId') entityId: string,
    @Body() dto: CreateAutomationDto,
    @CurrentUser() user: CurrentUserType,
    @Query('tenantId') tenantId?: string,
  ) {
    const effectiveTenantId = getEffectiveTenantId(user, tenantId);
    return this.automationService.create(effectiveTenantId, entityId, dto);
  }

  @Patch(':id')
  @RequireModulePermission('automations', 'canUpdate', 'entityAutomation')
  @ApiOperation({ summary: 'Atualiza automacao' })
  async update(
    @Param('entityId') entityId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAutomationDto,
    @CurrentUser() user: CurrentUserType,
    @Query('tenantId') tenantId?: string,
  ) {
    const effectiveTenantId = getEffectiveTenantId(user, tenantId);
    return this.automationService.update(effectiveTenantId, entityId, id, dto);
  }

  @Delete(':id')
  @RequireModulePermission('automations', 'canDelete', 'entityAutomation')
  @ApiOperation({ summary: 'Remove automacao' })
  async remove(
    @Param('entityId') entityId: string,
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
    @Query('tenantId') tenantId?: string,
  ) {
    const effectiveTenantId = getEffectiveTenantId(user, tenantId);
    return this.automationService.remove(effectiveTenantId, entityId, id);
  }

  @Post(':id/execute')
  @RequireModulePermission('automations', 'canUpdate', 'entityAutomation')
  @ApiOperation({ summary: 'Executa automacao manualmente' })
  async executeManual(
    @Param('entityId') entityId: string,
    @Param('id') id: string,
    @Body() dto: ExecuteManualDto,
    @CurrentUser() user: CurrentUserType,
    @Query('tenantId') tenantId?: string,
  ) {
    const effectiveTenantId = getEffectiveTenantId(user, tenantId);
    return this.automationService.executeManual(
      effectiveTenantId,
      entityId,
      id,
      user.id,
      dto.recordId,
      dto.inputData,
    );
  }

  @Get(':id/executions')
  @RequireModulePermission('automations', 'canRead', 'entityAutomation')
  @ApiOperation({ summary: 'Lista execucoes da automacao' })
  async getExecutions(
    @Param('entityId') entityId: string,
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
    @Query('tenantId') tenantId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const effectiveTenantId = getEffectiveTenantId(user, tenantId);
    return this.automationService.getExecutions(
      effectiveTenantId,
      id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  // ==========================================
  // Endpoints de Monitoramento (Loop Detection & Circuit Breaker)
  // ==========================================

  @Get('monitoring/execution-contexts')
  @RequireModulePermission('automations', 'canRead', 'entityAutomation')
  @ApiOperation({ summary: 'Lista contextos de execucao ativos' })
  async getExecutionContexts() {
    return {
      activeContexts: this.executionContextService.getActiveContexts(),
      totalActive: this.executionContextService.getActiveContextCount(),
    };
  }

  @Get('monitoring/circuit-breakers')
  @RequireModulePermission('automations', 'canRead', 'entityAutomation')
  @ApiOperation({ summary: 'Lista estado dos circuit breakers' })
  async getCircuitBreakers() {
    return {
      circuits: this.circuitBreakerService.getAllCircuits(),
      summary: this.circuitBreakerService.getSummary(),
    };
  }

  @Post(':id/circuit-breaker/reset')
  @RequireModulePermission('automations', 'canUpdate', 'entityAutomation')
  @ApiOperation({ summary: 'Reseta circuit breaker de uma automacao' })
  async resetCircuitBreaker(
    @Param('id') automationId: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    this.circuitBreakerService.reset(automationId);
    return {
      message: `Circuit breaker resetado para automacao ${automationId}`,
      automation: automationId,
    };
  }
}

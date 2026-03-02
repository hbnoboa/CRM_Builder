import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ActionChainService } from './action-chain.service';
import { IsString, IsOptional, IsEnum, IsArray, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ActionChainTrigger } from '@prisma/client';

class ActionConfigDto {
  order: number;
  type: 'custom-api' | 'email' | 'webhook' | 'status-change' | 'notification' | 'wait';
  config: Record<string, unknown>;
  inputMapping?: Record<string, string>;
  condition?: { field: string; operator: string; value: unknown };
}

class CreateActionChainDto {
  @IsOptional()
  @IsString()
  entityId?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(ActionChainTrigger)
  trigger: ActionChainTrigger;

  @IsOptional()
  triggerConfig?: Record<string, unknown>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActionConfigDto)
  actions: ActionConfigDto[];

  @IsOptional()
  @IsString()
  errorHandling?: 'stop' | 'continue' | 'rollback';
}

class UpdateActionChainDto extends CreateActionChainDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class ExecuteManualDto {
  @IsOptional()
  @IsString()
  recordId?: string;

  @IsOptional()
  inputData?: Record<string, unknown>;
}

interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
}

@ApiTags('Action Chains')
@ApiBearerAuth()
@Controller('action-chains')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ActionChainController {
  constructor(private readonly actionChainService: ActionChainService) {}

  @Get()
  @ApiOperation({ summary: 'Lista action chains do tenant' })
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('entityId') entityId?: string,
  ) {
    return this.actionChainService.findAll(user.tenantId, entityId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca action chain por ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.actionChainService.findOne(id, user.tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Cria nova action chain' })
  async create(@Body() dto: CreateActionChainDto, @CurrentUser() user: AuthUser) {
    return this.actionChainService.create(user.tenantId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualiza action chain' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateActionChainDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.actionChainService.update(id, user.tenantId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove action chain' })
  async delete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.actionChainService.delete(id, user.tenantId);
  }

  @Post(':id/execute')
  @ApiOperation({ summary: 'Executa action chain manualmente' })
  async executeManual(
    @Param('id') id: string,
    @Body() dto: ExecuteManualDto,
    @CurrentUser() user: AuthUser,
  ) {
    const executionId = await this.actionChainService.executeManual(
      id,
      user.tenantId,
      user.id,
      dto.recordId,
      dto.inputData,
    );

    return { executionId, message: 'Action chain iniciada' };
  }

  @Get(':id/executions')
  @ApiOperation({ summary: 'Lista execucoes da action chain' })
  async getExecutions(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.actionChainService.getExecutions(
      id,
      user.tenantId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }
}

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
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { EntityAutomationService } from './entity-automation.service';
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

interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
}

@ApiTags('Entity Automations')
@ApiBearerAuth()
@Controller('entities/:entityId/automations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EntityAutomationController {
  constructor(
    private readonly automationService: EntityAutomationService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista automacoes de uma entidade' })
  async findAll(
    @Param('entityId') entityId: string,
    @CurrentUser() user: AuthUser,
    @Query('isActive') isActive?: string,
    @Query('trigger') trigger?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.automationService.findAll(user.tenantId, entityId, {
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      trigger,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca automacao por ID' })
  async findOne(
    @Param('entityId') entityId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.automationService.findOne(user.tenantId, entityId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Cria nova automacao' })
  async create(
    @Param('entityId') entityId: string,
    @Body() dto: CreateAutomationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.automationService.create(user.tenantId, entityId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza automacao' })
  async update(
    @Param('entityId') entityId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAutomationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.automationService.update(user.tenantId, entityId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove automacao' })
  async remove(
    @Param('entityId') entityId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.automationService.remove(user.tenantId, entityId, id);
  }

  @Post(':id/execute')
  @ApiOperation({ summary: 'Executa automacao manualmente' })
  async executeManual(
    @Param('entityId') entityId: string,
    @Param('id') id: string,
    @Body() dto: ExecuteManualDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.automationService.executeManual(
      user.tenantId,
      entityId,
      id,
      user.id,
      dto.recordId,
      dto.inputData,
    );
  }

  @Get(':id/executions')
  @ApiOperation({ summary: 'Lista execucoes da automacao' })
  async getExecutions(
    @Param('entityId') entityId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.automationService.getExecutions(
      user.tenantId,
      id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }
}

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
import { ScheduledTaskService } from './scheduled-task.service';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

class CreateScheduledTaskDto {
  @IsOptional()
  @IsString()
  entityId?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  cronExpression: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsString()
  actionType: 'custom-api' | 'action-chain' | 'webhook' | 'email-report';

  @IsOptional()
  actionConfig?: Record<string, unknown>;
}

class UpdateScheduledTaskDto extends CreateScheduledTaskDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
}

@ApiTags('Scheduled Tasks')
@ApiBearerAuth()
@Controller('scheduled-tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScheduledTaskController {
  constructor(private readonly scheduledTaskService: ScheduledTaskService) {}

  @Get()
  @ApiOperation({ summary: 'Lista scheduled tasks do tenant' })
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('entityId') entityId?: string,
  ) {
    return this.scheduledTaskService.findAll(user.tenantId, entityId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca scheduled task por ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.scheduledTaskService.findOne(id, user.tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Cria nova scheduled task' })
  async create(@Body() dto: CreateScheduledTaskDto, @CurrentUser() user: AuthUser) {
    return this.scheduledTaskService.create(user.tenantId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualiza scheduled task' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateScheduledTaskDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.scheduledTaskService.update(id, user.tenantId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove scheduled task' })
  async delete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.scheduledTaskService.delete(id, user.tenantId);
  }

  @Post(':id/run')
  @ApiOperation({ summary: 'Executa scheduled task manualmente' })
  async runManually(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.scheduledTaskService.runManually(id, user.tenantId);
  }

  @Get(':id/executions')
  @ApiOperation({ summary: 'Lista execucoes da scheduled task' })
  async getExecutions(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.scheduledTaskService.getExecutions(
      id,
      user.tenantId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }
}

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
import { WebhookService } from './webhook.service';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsNumber,
  IsObject,
  Min,
} from 'class-validator';
import { HttpMethod, WebhookStatus } from '@prisma/client';

class CreateWebhookDto {
  @IsOptional()
  @IsString()
  entityId?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  url: string;

  @IsOptional()
  @IsEnum(HttpMethod)
  method?: HttpMethod;

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @IsOptional()
  @IsObject()
  bodyTemplate?: Record<string, unknown>;

  @IsArray()
  @IsString({ each: true })
  events: string[];

  @IsOptional()
  @IsArray()
  filterConditions?: Array<{ field: string; operator: string; value: unknown }>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  retryCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(100)
  retryDelay?: number;

  @IsOptional()
  @IsNumber()
  @Min(1000)
  timeout?: number;

  @IsOptional()
  @IsString()
  secret?: string;
}

class UpdateWebhookDto extends CreateWebhookDto {
  @IsOptional()
  @IsEnum(WebhookStatus)
  status?: WebhookStatus;
}

interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
}

@ApiTags('Webhooks')
@ApiBearerAuth()
@Controller('webhooks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Get()
  @ApiOperation({ summary: 'Lista webhooks do tenant' })
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('entityId') entityId?: string,
  ) {
    return this.webhookService.findAll(user.tenantId, entityId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca webhook por ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.webhookService.findOne(id, user.tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Cria novo webhook' })
  async create(@Body() dto: CreateWebhookDto, @CurrentUser() user: AuthUser) {
    return this.webhookService.create(user.tenantId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualiza webhook' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.webhookService.update(id, user.tenantId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove webhook' })
  async delete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.webhookService.delete(id, user.tenantId);
  }

  @Get(':id/executions')
  @ApiOperation({ summary: 'Lista execucoes do webhook' })
  async getExecutions(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.webhookService.getExecutions(
      id,
      user.tenantId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }
}

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ModulePermissionGuard } from '../../common/guards/module-permission.guard';
import { RequireModulePermission } from '../../common/decorators/module-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';
import { EmailTemplateService } from './email-template.service';
import { IsString, IsOptional, IsArray, IsBoolean } from 'class-validator';

class CreateEmailTemplateDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  subject: string;

  @IsString()
  bodyHtml: string;

  @IsOptional()
  @IsString()
  bodyText?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variables?: string[];

  @IsOptional()
  @IsString()
  fromName?: string;

  @IsOptional()
  @IsString()
  fromEmail?: string;

  @IsOptional()
  @IsString()
  replyTo?: string;
}

class UpdateEmailTemplateDto extends CreateEmailTemplateDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class PreviewEmailTemplateDto {
  @IsOptional()
  user?: { id: string; name: string; email: string };

  @IsOptional()
  record?: Record<string, unknown>;

  @IsOptional()
  entity?: { id: string; slug: string; name: string };

  @IsOptional()
  custom?: Record<string, unknown>;
}

@ApiTags('Email Templates')
@ApiBearerAuth()
@Controller('email-templates')
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
export class EmailTemplateController {
  constructor(private readonly emailTemplateService: EmailTemplateService) {}

  @Get()
  @RequireModulePermission('templates', 'canRead', 'emailTemplates')
  @ApiOperation({ summary: 'Lista templates de email do tenant' })
  async findAll(@CurrentUser() user: CurrentUserType) {
    return this.emailTemplateService.findAll(user.tenantId);
  }

  @Get(':id')
  @RequireModulePermission('templates', 'canRead', 'emailTemplates')
  @ApiOperation({ summary: 'Busca template por ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.emailTemplateService.findOne(id, user.tenantId);
  }

  @Post()
  @RequireModulePermission('templates', 'canCreate', 'emailTemplates')
  @ApiOperation({ summary: 'Cria novo template de email' })
  async create(@Body() dto: CreateEmailTemplateDto, @CurrentUser() user: CurrentUserType) {
    return this.emailTemplateService.create(user.tenantId, dto);
  }

  @Put(':id')
  @RequireModulePermission('templates', 'canUpdate', 'emailTemplates')
  @ApiOperation({ summary: 'Atualiza template de email' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEmailTemplateDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.emailTemplateService.update(id, user.tenantId, dto);
  }

  @Delete(':id')
  @RequireModulePermission('templates', 'canDelete', 'emailTemplates')
  @ApiOperation({ summary: 'Remove template de email' })
  async delete(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.emailTemplateService.delete(id, user.tenantId);
  }

  @Post(':id/preview')
  @RequireModulePermission('templates', 'canRead', 'emailTemplates')
  @ApiOperation({ summary: 'Preview do template com dados de exemplo' })
  async preview(
    @Param('id') id: string,
    @Body() dto: PreviewEmailTemplateDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.emailTemplateService.previewTemplate(id, user.tenantId, dto);
  }
}

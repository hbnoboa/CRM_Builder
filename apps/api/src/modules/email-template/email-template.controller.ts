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
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { EmailTemplateService } from './email-template.service';
import { checkModulePermission } from '../../common/utils/check-module-permission';
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

interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
}

@ApiTags('Email Templates')
@ApiBearerAuth()
@Controller('email-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmailTemplateController {
  constructor(private readonly emailTemplateService: EmailTemplateService) {}

  @Get()
  @ApiOperation({ summary: 'Lista templates de email do tenant' })
  async findAll(@CurrentUser() user: AuthUser) {
    checkModulePermission(user, 'emailTemplates', 'canRead');
    return this.emailTemplateService.findAll(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca template por ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    checkModulePermission(user, 'emailTemplates', 'canRead');
    return this.emailTemplateService.findOne(id, user.tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Cria novo template de email' })
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  async create(@Body() dto: CreateEmailTemplateDto, @CurrentUser() user: AuthUser) {
    checkModulePermission(user, 'emailTemplates', 'canCreate');
    return this.emailTemplateService.create(user.tenantId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualiza template de email' })
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEmailTemplateDto,
    @CurrentUser() user: AuthUser,
  ) {
    checkModulePermission(user, 'emailTemplates', 'canUpdate');
    return this.emailTemplateService.update(id, user.tenantId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove template de email' })
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  async delete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    checkModulePermission(user, 'emailTemplates', 'canDelete');
    return this.emailTemplateService.delete(id, user.tenantId);
  }

  @Post(':id/preview')
  @ApiOperation({ summary: 'Preview do template com dados de exemplo' })
  async preview(
    @Param('id') id: string,
    @Body() dto: PreviewEmailTemplateDto,
    @CurrentUser() user: AuthUser,
  ) {
    checkModulePermission(user, 'emailTemplates', 'canRead');
    return this.emailTemplateService.previewTemplate(id, user.tenantId, dto);
  }
}

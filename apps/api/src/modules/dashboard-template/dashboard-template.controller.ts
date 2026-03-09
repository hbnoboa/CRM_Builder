import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';
import { checkModulePermission } from '../../common/utils/check-module-permission';
import { DashboardTemplateService } from './dashboard-template.service';
import { CreateDashboardTemplateDto, UpdateDashboardTemplateDto } from './dto/dashboard-template.dto';

@ApiTags('Dashboard Templates')
@Controller('dashboard-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DashboardTemplateController {
  constructor(private readonly service: DashboardTemplateService) {}

  @Get()
  @ApiOperation({ summary: 'Listar templates de dashboard do tenant' })
  async findAll(
    @CurrentUser() user: CurrentUserType,
    @Query('tenantId') tenantId?: string,
  ) {
    checkModulePermission(user, 'settings', 'canRead');
    return this.service.findAll(user, tenantId);
  }

  @Get('my/:entitySlug')
  @ApiOperation({ summary: 'Obter template atribuido ao role do usuario para uma entidade' })
  async findMyTemplate(
    @Param('entitySlug') entitySlug: string,
    @CurrentUser() user: CurrentUserType,
    @Query('tenantId') tenantId?: string,
  ) {
    checkModulePermission(user, 'data', 'canRead');
    return this.service.findMyTemplate(entitySlug, user, tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter template de dashboard por ID' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
    @Query('tenantId') tenantId?: string,
  ) {
    checkModulePermission(user, 'settings', 'canRead');
    return this.service.findOne(id, user, tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Criar template de dashboard' })
  async create(
    @Body() dto: CreateDashboardTemplateDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'settings', 'canUpdate');
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar template de dashboard' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDashboardTemplateDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'settings', 'canUpdate');
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Excluir template de dashboard' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'settings', 'canDelete');
    return this.service.remove(id, user);
  }
}

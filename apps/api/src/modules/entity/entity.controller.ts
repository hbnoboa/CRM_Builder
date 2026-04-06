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
import { EntityService, QueryEntityDto, CreateEntityDto, UpdateEntityDto } from './entity.service';
import { UpdateColumnConfigDto } from './dto/entity.dto';
import { UpdateGlobalFiltersDto } from './dto/update-global-filters.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ModulePermissionGuard } from '../../common/guards/module-permission.guard';
import { RequireModulePermission } from '../../common/decorators/module-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';
import { checkEntityAction } from '../../common/utils/check-module-permission';

@ApiTags('Entities')
@Controller('entities')
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
@ApiBearerAuth()
export class EntityController {
  constructor(private readonly entityService: EntityService) {}

  @Post()
  @RequireModulePermission('entities', 'canCreate')
  @ApiOperation({ summary: 'Criar entidade' })
  async create(@Body() dto: CreateEntityDto, @CurrentUser() user: CurrentUserType) {
    return this.entityService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Listar entidades do tenant' })
  async findAll(@Query() query: QueryEntityDto, @CurrentUser() user: CurrentUserType) {
    return this.entityService.findAll(user, query);
  }

  @Get('grouped')
  @ApiOperation({ summary: 'Listar entidades agrupadas por categoria' })
  async findAllGrouped(@Query('tenantId') tenantId: string, @CurrentUser() user: CurrentUserType) {
    return this.entityService.findAllGrouped(user, tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar entidade por ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.entityService.findOne(id, user);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Buscar entidade por slug' })
  async findBySlug(
    @Param('slug') slug: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.entityService.findBySlug(slug, user);
  }

  @Patch(':id/column-config')
  @ApiOperation({ summary: 'Atualizar configuracao de colunas' })
  async updateColumnConfig(
    @Param('id') id: string,
    @Body() dto: UpdateColumnConfigDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    const entity = await this.entityService.findOne(id, user);
    checkEntityAction(user, entity.slug, 'canConfigureColumns');
    return this.entityService.updateColumnConfig(id, dto.visibleColumns, user);
  }

  @Patch(':id/global-filters')
  @RequireModulePermission('entities', 'canUpdate')
  @ApiOperation({ summary: 'Atualizar filtros globais da entidade' })
  async updateGlobalFilters(
    @Param('id') id: string,
    @Body() dto: UpdateGlobalFiltersDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.entityService.updateGlobalFilters(id, dto.globalFilters, user);
  }

  @Patch(':id')
  @RequireModulePermission('entities', 'canUpdate')
  @ApiOperation({ summary: 'Atualizar entidade' })
  async update(@Param('id') id: string, @Body() dto: UpdateEntityDto, @CurrentUser() user: CurrentUserType) {
    return this.entityService.update(id, dto, user);
  }

  @Delete(':id')
  @RequireModulePermission('entities', 'canDelete')
  @ApiOperation({ summary: 'Excluir entidade' })
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.entityService.remove(id, user);
  }
}

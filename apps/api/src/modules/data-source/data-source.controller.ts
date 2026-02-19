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
import { DataSourceService } from './data-source.service';
import { CreateDataSourceDto, UpdateDataSourceDto, ExecuteDataSourceDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';
import { checkModulePermission } from '../../common/utils/check-module-permission';
import { getEffectiveTenantId } from '../../common/utils/tenant.util';

@ApiTags('Data Sources')
@Controller('data-sources')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DataSourceController {
  constructor(private readonly dataSourceService: DataSourceService) {}

  @Post()
  @ApiOperation({ summary: 'Criar fonte de dados' })
  async create(
    @Body() dto: CreateDataSourceDto,
    @Query('tenantId') tenantId: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'data-sources', 'canCreate');
    const effectiveTenantId = getEffectiveTenantId(user, tenantId);
    return this.dataSourceService.create(dto, user, effectiveTenantId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar fontes de dados' })
  async findAll(
    @Query('search') search: string,
    @Query('tenantId') tenantId: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'data-sources', 'canRead');
    const effectiveTenantId = getEffectiveTenantId(user, tenantId);
    return this.dataSourceService.findAll(effectiveTenantId, search);
  }

  // Static routes BEFORE :id routes
  @Post('preview')
  @ApiOperation({ summary: 'Preview de uma definicao (sem salvar)' })
  async preview(
    @Body() body: { definition: Record<string, unknown>; limit?: number },
    @Query('tenantId') tenantId: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'data-sources', 'canRead');
    const effectiveTenantId = getEffectiveTenantId(user, tenantId);
    return this.dataSourceService.preview(body.definition as any, effectiveTenantId, { limit: body.limit || 10 });
  }

  @Get('related/:entitySlug')
  @ApiOperation({ summary: 'Buscar entidades relacionadas a uma entidade' })
  async getRelatedEntities(
    @Param('entitySlug') entitySlug: string,
    @Query('tenantId') tenantId: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'data-sources', 'canRead');
    const effectiveTenantId = getEffectiveTenantId(user, tenantId);
    return this.dataSourceService.getRelatedEntities(entitySlug, effectiveTenantId);
  }

  // Parameterized routes
  @Get(':id')
  @ApiOperation({ summary: 'Buscar fonte de dados por ID' })
  async findOne(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'data-sources', 'canRead');
    const effectiveTenantId = getEffectiveTenantId(user, tenantId);
    return this.dataSourceService.findOne(id, effectiveTenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar fonte de dados' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDataSourceDto,
    @Query('tenantId') tenantId: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'data-sources', 'canUpdate');
    const effectiveTenantId = getEffectiveTenantId(user, tenantId);
    return this.dataSourceService.update(id, dto, user, effectiveTenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Excluir fonte de dados' })
  async remove(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'data-sources', 'canDelete');
    const effectiveTenantId = getEffectiveTenantId(user, tenantId);
    return this.dataSourceService.remove(id, effectiveTenantId);
  }

  @Post(':id/execute')
  @ApiOperation({ summary: 'Executar fonte de dados' })
  async execute(
    @Param('id') id: string,
    @Body() dto: ExecuteDataSourceDto,
    @Query('tenantId') tenantId: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'data-sources', 'canRead');
    const effectiveTenantId = getEffectiveTenantId(user, tenantId);
    return this.dataSourceService.execute(id, effectiveTenantId, {
      runtimeFilters: dto.runtimeFilters,
      page: dto.page,
      limit: dto.limit,
    });
  }
}

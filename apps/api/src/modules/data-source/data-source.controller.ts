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
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'data-sources', 'canCreate');
    return this.dataSourceService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Listar fontes de dados' })
  async findAll(
    @Query('search') search: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'data-sources', 'canRead');
    return this.dataSourceService.findAll(user.tenantId, search);
  }

  // Static routes BEFORE :id routes
  @Post('preview')
  @ApiOperation({ summary: 'Preview de uma definicao (sem salvar)' })
  async preview(
    @Body() body: { definition: Record<string, unknown>; limit?: number },
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'data-sources', 'canRead');
    return this.dataSourceService.preview(body.definition as any, user.tenantId, { limit: body.limit || 10 });
  }

  @Get('related/:entitySlug')
  @ApiOperation({ summary: 'Buscar entidades relacionadas a uma entidade' })
  async getRelatedEntities(
    @Param('entitySlug') entitySlug: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'data-sources', 'canRead');
    return this.dataSourceService.getRelatedEntities(entitySlug, user.tenantId);
  }

  // Parameterized routes
  @Get(':id')
  @ApiOperation({ summary: 'Buscar fonte de dados por ID' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'data-sources', 'canRead');
    return this.dataSourceService.findOne(id, user.tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar fonte de dados' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDataSourceDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'data-sources', 'canUpdate');
    return this.dataSourceService.update(id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Excluir fonte de dados' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'data-sources', 'canDelete');
    return this.dataSourceService.remove(id, user.tenantId);
  }

  @Post(':id/execute')
  @ApiOperation({ summary: 'Executar fonte de dados' })
  async execute(
    @Param('id') id: string,
    @Body() dto: ExecuteDataSourceDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    checkModulePermission(user, 'data-sources', 'canRead');
    return this.dataSourceService.execute(id, user.tenantId, {
      runtimeFilters: dto.runtimeFilters,
      page: dto.page,
      limit: dto.limit,
    });
  }
}
